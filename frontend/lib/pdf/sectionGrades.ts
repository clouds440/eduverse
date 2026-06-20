import { createPdfBuilder } from './core';
import { getCourseSectionLabelParts, getSectionColor } from '@/lib/utils';
import { GradeStatus, type SectionGradebookAssessment, type SectionGradebookCell, type SectionGradebookResponse } from '@/types';

export interface SectionGradesPdfInput {
    orgName: string;
    logoUrl?: string | null;
    gradebook: SectionGradebookResponse;
    theme?: 'light' | 'dark';
}

const PAGE = { width: 792, height: 612 };

function palette(theme: 'light' | 'dark' = 'light') {
    if (theme === 'dark') {
        return {
            page: '#0B0F19',
            surface: '#121826',
            mutedSurface: '#1A2233',
            text: '#E6EAF2',
            muted: '#94A3B8',
            border: '#334155',
            primary: '#8FB2FF',
            warning: '#FBBF24',
            success: '#34D399',
            info: '#38BDF8',
        };
    }

    return {
        page: '#FFFFFF',
        surface: '#FFFFFF',
        mutedSurface: '#F8FAFC',
        text: '#111827',
        muted: '#6B7280',
        border: '#D1D5DB',
        primary: '#2952BF',
        warning: '#B45309',
        success: '#047857',
        info: '#0369A1',
    };
}

function truncateToWidth(text: string, maxWidth: number, measure: (value: string) => number) {
    if (measure(text) <= maxWidth) return text;
    const suffix = '...';
    let next = text;
    while (next.length > 0 && measure(`${next}${suffix}`) > maxWidth) {
        next = next.slice(0, -1);
    }
    return next ? `${next}${suffix}` : suffix;
}

function formatNumber(value?: number | null) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 1);
}

function formatCell(cell?: SectionGradebookCell) {
    if (!cell || cell.marksObtained === null || cell.marksObtained === undefined) return 'Missing';
    return `${formatNumber(cell.marksObtained)}/${formatNumber(cell.totalMarks)}`;
}

function statusLabel(status?: GradeStatus | null) {
    if (!status) return 'Missing';
    return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusColor(status: GradeStatus | null | undefined, colors: ReturnType<typeof palette>) {
    if (status === GradeStatus.FINALIZED) return colors.success;
    if (status === GradeStatus.PUBLISHED) return colors.info;
    if (status === GradeStatus.DRAFT) return colors.warning;
    return colors.muted;
}

function getAssessmentCell(row: SectionGradebookResponse['students'][number], assessment: SectionGradebookAssessment) {
    return row.grades.find((grade) => grade.assessmentId === assessment.id);
}

export async function createSectionGradesPdf({ orgName, logoUrl, gradebook, theme = 'light' }: SectionGradesPdfInput) {
    const pdf = await createPdfBuilder({
        page: PAGE,
        margin: 36,
        title: `${gradebook.section.course?.name || 'Section'} Grades`,
        author: orgName,
    });
    const colors = palette(theme);
    const usableWidth = pdf.width - pdf.margin * 2;
    const sectionColor = getSectionColor(gradebook.section.color);
    const labelParts = getCourseSectionLabelParts({
        courseName: gradebook.section.course?.name,
        sectionName: gradebook.section.name,
    });
    const studentWidth = 150;
    const summaryWidth = 106;
    const assessmentWidth = 76;
    const maxAssessmentsPerTable = Math.max(1, Math.floor((usableWidth - studentWidth - summaryWidth) / assessmentWidth));
    const chunks: SectionGradebookAssessment[][] = [];

    for (let i = 0; i < gradebook.assessments.length || i === 0; i += maxAssessmentsPerTable) {
        chunks.push(gradebook.assessments.slice(i, i + maxAssessmentsPerTable));
        if (gradebook.assessments.length === 0) break;
    }

    let y = pdf.cursorY;

    const drawText = (text: string, x: number, textY: number, width: number, options: { size?: number; font?: 'regular' | 'bold'; color?: string } = {}) => {
        const size = options.size ?? 8;
        const font = options.font ?? 'regular';
        const value = truncateToWidth(text, width, (candidate) => pdf.font(font).widthOfTextAtSize(candidate, size));
        pdf.text(value, x, textY, { size, font, color: options.color ?? colors.text });
    };

    const drawPageHeader = async (full = false) => {
        pdf.rect({ x: 0, y: 0, width: pdf.width, height: pdf.height, fill: colors.page });
        const didDrawLogo = logoUrl ? await pdf.imageFromUrl(logoUrl, pdf.margin, y - 30, 30, 30, { rounded: true }) : false;
        if (!didDrawLogo) {
            pdf.text(orgName.slice(0, 1).toUpperCase(), pdf.margin + 10, y - 20, { size: 13, font: 'bold', color: colors.primary });
        }
        pdf.text(orgName, pdf.margin + 42, y - 9, { size: 13, font: 'bold', color: colors.text, maxWidth: 340 });
        pdf.text('Section Grades Report', pdf.margin + 42, y - 24, { size: 9, color: colors.muted });
        pdf.text(new Date().toLocaleDateString(), pdf.width - pdf.margin - 78, y - 16, { size: 8, color: colors.muted });
        y -= full ? 46 : 40;
        pdf.cursorY = y;
    };

    const ensureSpace = async (height: number) => {
        if (!pdf.ensureSpace(height)) return false;
        y = pdf.cursorY;
        await drawPageHeader(false);
        return true;
    };

    await drawPageHeader(true);

    pdf.rect({ x: pdf.margin, y: y - 58, width: usableWidth, height: 58, fill: colors.mutedSurface, stroke: colors.border, borderWidth: 0.5 });
    pdf.rect({ x: pdf.margin, y: y - 58, width: 5, height: 58, fill: sectionColor });
    pdf.text(labelParts.courseName || labelParts.inlineLabel, pdf.margin + 14, y - 21, { size: 14, font: 'bold', color: sectionColor, maxWidth: 360 });
    pdf.text(labelParts.sectionName || 'Section', pdf.margin + 14, y - 39, { size: 9, color: colors.muted, maxWidth: 360 });
    pdf.text(`${gradebook.summary.studentCount} students | ${gradebook.summary.assessmentCount} assessments`, pdf.width - pdf.margin - 220, y - 20, { size: 9, font: 'bold', color: colors.text, maxWidth: 205 });
    pdf.text(`Average ${formatNumber(gradebook.summary.averageWeightedPercentage)}% | ${gradebook.summary.policyName}`, pdf.width - pdf.margin - 220, y - 38, { size: 8, color: colors.muted, maxWidth: 205 });
    y -= 78;
    pdf.cursorY = y;

    if (gradebook.students.length === 0) {
        pdf.text('No students are enrolled in this section.', pdf.margin, y, { size: 11, font: 'bold', color: colors.text });
        return pdf.saveAsBlob();
    }

    const drawTableHeader = (chunk: SectionGradebookAssessment[]) => {
        const tableWidth = studentWidth + chunk.length * assessmentWidth + summaryWidth;
        pdf.rect({ x: pdf.margin, y: y - 24, width: tableWidth, height: 24, fill: colors.surface, stroke: colors.border, borderWidth: 0.5 });
        drawText('Student', pdf.margin + 8, y - 15, studentWidth - 14, { font: 'bold', color: colors.muted });
        let x = pdf.margin + studentWidth;
        chunk.forEach((assessment) => {
            drawText(assessment.title, x + 5, y - 10, assessmentWidth - 10, { size: 7, font: 'bold', color: colors.muted });
            drawText(`${assessment.weightage}%`, x + 5, y - 20, assessmentWidth - 10, { size: 6, color: colors.muted });
            x += assessmentWidth;
        });
        drawText('Total', x + 6, y - 15, summaryWidth - 12, { font: 'bold', color: colors.muted });
        y -= 24;
        pdf.cursorY = y;
    };

    for (const [chunkIndex, chunk] of chunks.entries()) {
        await ensureSpace(70);
        pdf.text(`Assessment set ${chunkIndex + 1} of ${chunks.length}`, pdf.margin, y - 8, { size: 9, font: 'bold', color: colors.muted });
        y -= 18;
        pdf.cursorY = y;
        drawTableHeader(chunk);

        for (const row of gradebook.students) {
            const rowHeight = 34;
            if (await ensureSpace(rowHeight + 32)) {
                drawTableHeader(chunk);
            }

            const tableWidth = studentWidth + chunk.length * assessmentWidth + summaryWidth;
            pdf.rect({ x: pdf.margin, y: y - rowHeight, width: tableWidth, height: rowHeight, fill: colors.surface, stroke: colors.border, borderWidth: 0.35 });
            const student = row.student;
            drawText(student.user?.name || 'Unnamed student', pdf.margin + 8, y - 12, studentWidth - 14, { size: 8, font: 'bold' });
            drawText(student.registrationNumber || student.rollNumber || 'No registration', pdf.margin + 8, y - 25, studentWidth - 14, { size: 7, color: colors.muted });

            let x = pdf.margin + studentWidth;
            chunk.forEach((assessment) => {
                const cell = getAssessmentCell(row, assessment);
                drawText(formatCell(cell), x + 5, y - 12, assessmentWidth - 10, { size: 8, font: cell?.status ? 'bold' : 'regular', color: statusColor(cell?.status, colors) });
                drawText(statusLabel(cell?.status), x + 5, y - 25, assessmentWidth - 10, { size: 6, color: colors.muted });
                x += assessmentWidth;
            });

            drawText(`${formatNumber(row.summary.weightedPercentage)}%`, x + 6, y - 12, summaryWidth - 12, { size: 8, font: 'bold', color: sectionColor });
            drawText(`${row.summary.letterGrade} | ${row.summary.gradedAssessments}/${gradebook.assessments.length}`, x + 6, y - 25, summaryWidth - 12, { size: 7, color: colors.muted });
            y -= rowHeight;
            pdf.cursorY = y;
        }

        y -= 18;
        pdf.cursorY = y;
    }

    return pdf.saveAsBlob();
}
