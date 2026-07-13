import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { StudentService } from '../students/student.service';
import { SectionsService } from '../sections/sections.service';
import { CreateCourseMaterialDto } from './dto/create-course-material.dto';
import { Role } from '../common/enums';

@Injectable()
export class CourseMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly filesService: FilesService,
    private readonly studentService: StudentService,
    private readonly sectionsService: SectionsService,
  ) {}

  /**
   * Create a new course material for a section
   * Teacher must be assigned to the section
   */
  async createMaterial(
    sectionId: string,
    dto: CreateCourseMaterialDto,
    userId: string,
    userRole: string,
    organizationId: string,
  ) {
    // Verify section exists and belongs to the organization
    const section = await this.sectionsService.validateSectionBelongsToOrg(sectionId, organizationId);

    // Verify teacher is assigned to this section
    if (userRole === Role.TEACHER || userRole === Role.ORG_MANAGER) {
      const isAssigned = await this.sectionsService.isTeacherAssignedToSection(sectionId, userId);
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to this section');
      }
    }

    // Create the course material
    const material = await this.prisma.courseMaterial.create({
      data: {
        sectionId,
        academicCycleId: section.academicCycleId,
        title: dto.title,
        description: dto.description,
        links: dto.links || [],
        isVideoLink: dto.isVideoLink || false,
        createdBy: userId,
      },
    });

    // Fetch enrolled students to send notifications
    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
    });

    // If fileIds were provided, update the files to link to this material
    if (dto.fileIds && dto.fileIds.length > 0) {
      const updateResult = await this.prisma.file.updateMany({
        where: {
          id: { in: dto.fileIds },
        },
        data: {
          entityId: material.id,
          entityType: 'COURSE_MATERIAL',
        },
      });
    }

    // Create notifications for all enrolled students
    const notificationPromises = enrollments.map((enrollment) =>
      this.notifications.createNotification({
        userId: enrollment.student.userId,
        title: `New Course Material in ${section.name}: ${dto.title}`,
        body: dto.description || 'A new course material has been uploaded',
        actionUrl: `/course-materials/${sectionId}`,
        type: 'COURSE_MATERIAL',
        metadata: {
          materialId: material.id,
          sectionId,
          sectionName: section.name,
        },
      })
    );

    await Promise.all(notificationPromises);

    return material;
  }

  /**
   * Get all materials for a section
   * Students must be enrolled, teachers must be assigned
   */
  async getSectionMaterials(
    sectionId: string,
    userId: string,
    userRole: string,
    organizationId: string,
  ) {
    // Verify section exists and belongs to the organization
    await this.sectionsService.validateSectionBelongsToOrg(sectionId, organizationId);

    // Check access permissions
    if (userRole === Role.STUDENT) {
      const student = await this.studentService.getStudentByUserId(userId);
      if (!student) {
        throw new ForbiddenException('Student profile not found');
      }
      const enrollment = await this.prisma.enrollment.findUnique({
        where: {
          studentId_sectionId: {
            studentId: student.id,
            sectionId,
          },
        },
      });

      if (!enrollment) {
        throw new ForbiddenException('You are not enrolled in this section');
      }
    } else if (userRole === Role.TEACHER) {
      const isAssigned = await this.sectionsService.isTeacherAssignedToSection(sectionId, userId);
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to this section');
      }
    }

    // Fetch materials with files and creator info
    const materials = await this.prisma.courseMaterial.findMany({
      where: { sectionId },
      orderBy: { createdAt: 'desc' },
      include: {
        section: {
          include: {
            course: true,
          },
        },
      },
    });

    // Fetch files for each material
    const materialIds = materials.map((m) => m.id);
    const files = await this.prisma.file.findMany({
      where: {
        entityType: 'COURSE_MATERIAL',
        entityId: { in: materialIds },
      },
    });
    const publicFiles = this.filesService.toPublicFiles(files);

    // Group files by material ID
    const filesByMaterial = publicFiles.reduce((acc, file) => {
      if (!acc[file.entityId]) {
        acc[file.entityId] = [];
      }
      acc[file.entityId].push(file);
      return acc;
    }, {} as Record<string, any[]>);

    // Fetch creator info
    const creatorIds = materials.map((m) => m.createdBy);
    const creators = await this.prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: {
        id: true,
        name: true,
      },
    });

    const creatorsById = creators.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, any>);

    // Combine data
    return materials.map((material) => ({
      ...material,
      files: filesByMaterial[material.id] || [],
      creator: creatorsById[material.createdBy] || null,
    }));
  }

  /**
   * Delete a course material
   * Only teachers assigned to the section can delete
   */
  async deleteMaterial(
    materialId: string,
    userId: string,
    userRole: string,
    organizationId: string,
  ) {
    const material = await this.prisma.courseMaterial.findUnique({
      where: { id: materialId },
      include: {
        section: {
          include: {
            course: true,
            teachers: true,
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    if (material.section.course.organizationId !== organizationId) {
      throw new ForbiddenException('Material does not belong to your organization');
    }

    // Only teachers assigned to the section can delete
    if (userRole === Role.TEACHER) {
      const isAssigned = material.section.teachers.some((t) => t.userId === userId);
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to this section');
      }
    } else if (userRole !== Role.ORG_ADMIN && userRole !== Role.ORG_MANAGER) {
      throw new ForbiddenException('Only teachers and admins can delete materials');
    }

    // Delete associated files from Cloudinary and the database.
    const files = await this.prisma.file.findMany({
      where: {
        entityType: 'COURSE_MATERIAL',
        entityId: materialId,
      },
    });

    for (const file of files) {
      await this.filesService.deleteFile(file.id, {
        id: userId,
        role: userRole,
        organizationId,
      });
    }

    // Delete the material
    await this.prisma.courseMaterial.delete({
      where: { id: materialId },
    });

    return { message: 'Material deleted successfully' };
  }

  /**
   * Update a course material
   * Only teachers assigned to the section can update
   */
  async updateMaterial(
    materialId: string,
    dto: { title?: string; description?: string; fileIds?: string[]; filesToRemove?: string[]; links?: string[]; isVideoLink?: boolean },
    userId: string,
    userRole: string,
    organizationId: string,
  ) {
    const material = await this.prisma.courseMaterial.findUnique({
      where: { id: materialId },
      include: {
        section: {
          include: {
            course: true,
            teachers: true,
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    if (material.section.course.organizationId !== organizationId) {
      throw new ForbiddenException('Material does not belong to your organization');
    }

    // Only teachers assigned to the section can update
    if (userRole === Role.TEACHER) {
      const isAssigned = material.section.teachers.some((t) => t.userId === userId);
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to this section');
      }
    } else if (userRole !== Role.ORG_ADMIN && userRole !== Role.ORG_MANAGER) {
      throw new ForbiddenException('Only teachers and admins can update materials');
    }

    // Update material fields
    const updateData: {
      title?: string;
      description?: string | null;
      links?: string[];
      isVideoLink?: boolean;
    } = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.links !== undefined) updateData.links = dto.links;
    if (dto.isVideoLink !== undefined) updateData.isVideoLink = dto.isVideoLink;

    const updatedMaterial = await this.prisma.courseMaterial.update({
      where: { id: materialId },
      data: updateData,
    });

    // Remove specified files
    if (dto.filesToRemove && dto.filesToRemove.length > 0) {
      for (const fileId of dto.filesToRemove) {
        try {
          await this.filesService.deleteFile(fileId, {
            id: userId,
            role: userRole,
            organizationId,
          });
        } catch (error) {
          console.error(`Failed to delete file ${fileId}:`, error);
        }
      }
    }

    // Add new files by updating their entityId
    if (dto.fileIds && dto.fileIds.length > 0) {
      await this.prisma.file.updateMany({
        where: {
          id: { in: dto.fileIds },
        },
        data: {
          entityId: materialId,
          entityType: 'COURSE_MATERIAL',
        },
      });
    }

    // Fetch enrolled students to send notifications
    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId: material.sectionId },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
    });

    // Create notifications for all enrolled students
    const notificationPromises = enrollments.map((enrollment) =>
      this.notifications.createNotification({
        userId: enrollment.student.userId,
        title: `Course Material Updated in ${material.section.name}: ${dto.title || material.title}`,
        body: dto.description || 'A course material has been updated',
        actionUrl: `/course-materials/${material.sectionId}`,
        type: 'COURSE_MATERIAL',
        metadata: {
          materialId: material.id,
          sectionId: material.sectionId,
          sectionName: material.section.name,
        },
      })
    );

    await Promise.all(notificationPromises);

    return updatedMaterial;
  }
}
