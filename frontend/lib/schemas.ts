import { z } from 'zod';
import { OrganizationType, TeacherStatus, StudentStatus, UserStatus, AssessmentType, GradeStatus } from '@/types';
import { isSafeHttpUrl } from './safeUrl';

// --- Shared Patterns ---
const phoneRegex = /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/;

// --- Password Rules (Single Source of Truth) ---
const passwordRules = z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

// Optional password (for updates only)
const optionalPasswordRules = z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => {
        if (!val) return true;
        return passwordRules.safeParse(val).success;
    }, {
        message: 'Password must be at least 8 characters long and include uppercase, lowercase, and number',
    });

// --- Registration Schema ---
export const registerSchema = z.object({
    name: z.string().min(1, 'Organization Name is required'),
    adminName: z.string().min(1, 'Full Name is required'),
    location: z.string().min(1, 'Location is required'),
    type: z.nativeEnum(OrganizationType),
    email: z.string().email('Invalid login email address'),
    contactEmail: z.string().email('Invalid contact email address').optional().or(z.literal('')),
    phone: z.string().regex(phoneRegex, 'Invalid phone number'),
    password: passwordRules,
});

export type RegisterFormData = z.infer<typeof registerSchema>;

// =========================
// --- TEACHER SCHEMAS ---
// =========================

const teacherBaseSchema = z.object({
    name: z.string().min(1, 'Full Name is required'),
    phone: z.string().regex(phoneRegex, 'Invalid phone number').optional().or(z.literal('')),
    email: z.string().email('Invalid email address'),
    education: z.string().optional().or(z.literal('')),
    designation: z.string().optional().or(z.literal('')),
    subject: z.string().optional().or(z.literal('')),
    department: z.string().optional().or(z.literal('')),
    joiningDate: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    emergencyContact: z.string().optional().or(z.literal('')),
    bloodGroup: z.string().optional().or(z.literal('')),
    status: z.nativeEnum(TeacherStatus),
    isManager: z.boolean(),
    sectionIds: z.array(z.string()).default([]),
});

// Create → password REQUIRED + metadata REQUIRED
export const teacherCreateSchema = teacherBaseSchema.extend({
    password: passwordRules,
    education: z.string().min(1, 'Education is required'),
    designation: z.string().min(1, 'Designation is required'),
    subject: z.string().min(1, 'Subject Expertise is required'),
    phone: z.string().regex(phoneRegex, 'Invalid phone number').min(1, 'Phone number is required'),
});

export type TeacherCreateFormData = z.infer<typeof teacherCreateSchema>;

// Update → password OPTIONAL + metadata REQUIRED
export const teacherUpdateSchema = teacherBaseSchema.extend({
    password: optionalPasswordRules,
    education: z.string().min(1, 'Education is required'),
    designation: z.string().min(1, 'Designation is required'),
    subject: z.string().min(1, 'Subject Expertise is required'),
    phone: z.string().regex(phoneRegex, 'Invalid phone number').min(1, 'Phone number is required'),
});

export type TeacherUpdateFormData = z.infer<typeof teacherUpdateSchema>;

// Profile Update (Teacher self-update)
export const teacherProfileSchema = teacherBaseSchema.extend({
    password: optionalPasswordRules,
});

export type TeacherProfileFormData = z.infer<typeof teacherProfileSchema>;

// =========================
// --- SUB ADMIN SCHEMAS ---
// =========================

const subAdminBaseSchema = z.object({
    name: z.string().min(1, 'Full Name is required'),
    phone: z.string().regex(phoneRegex, 'Invalid phone number').optional().or(z.literal('')),
    email: z.string().email('Invalid email address'),
    status: z.nativeEnum(UserStatus),
});

export const subAdminCreateSchema = subAdminBaseSchema.extend({
    password: passwordRules,
});

export type SubAdminCreateFormData = z.infer<typeof subAdminCreateSchema>;

export const subAdminUpdateSchema = subAdminBaseSchema.extend({
    password: optionalPasswordRules,
});

export type SubAdminUpdateFormData = z.infer<typeof subAdminUpdateSchema>;

export const financeManagerCreateSchema = subAdminCreateSchema;
export type FinanceManagerCreateFormData = z.infer<typeof financeManagerCreateSchema>;

export const financeManagerUpdateSchema = subAdminUpdateSchema;
export type FinanceManagerUpdateFormData = z.infer<typeof financeManagerUpdateSchema>;

// =========================
// --- STUDENT SCHEMAS ---
// =========================

const studentBaseSchema = z.object({
    name: z.string().min(1, 'Full Name is required'),
    email: z.string().email('Invalid email address'),
    registrationNumber: z.string().optional().or(z.literal('')),
    rollNumber: z.string().optional().or(z.literal('')),
    admissionDate: z.string().optional().or(z.literal('')),
    status: z.nativeEnum(StudentStatus),
    major: z.string().optional().or(z.literal('')),
    department: z.string().optional().or(z.literal('')),
    fatherName: z.string().optional().or(z.literal('')),
    age: z.string().nullable().optional(),
    gender: z.string().optional().or(z.literal('')),
    graduationDate: z.string().optional().or(z.literal('')),
    phone: z.string().regex(phoneRegex, 'Invalid phone number').optional().or(z.literal('')),
    emergencyContact: z.string().optional().or(z.literal('')),
    bloodGroup: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    sectionIds: z.array(z.string()).default([]),
    cohortId: z.string().optional().or(z.literal('')),
    guardianId: z.string().optional().or(z.literal('')),
    guardianRelationship: z.string().optional().or(z.literal('')),
});

// Create → password REQUIRED + metadata REQUIRED
export const studentCreateSchema = studentBaseSchema.extend({
    password: passwordRules,
    registrationNumber: z.string().min(1, 'Registration Number is required'),
    rollNumber: z.string().min(1, 'Roll Number is required'),
    major: z.string().min(1, 'Major/Program is required'),
    gender: z.string().min(1, 'Gender is required'),
});

// Update → password OPTIONAL + metadata REQUIRED
export const studentUpdateSchema = studentBaseSchema.extend({
    password: optionalPasswordRules,
    registrationNumber: z.string().min(1, 'Registration Number is required'),
    rollNumber: z.string().min(1, 'Roll Number is required'),
    major: z.string().min(1, 'Major/Program is required'),
    gender: z.string().min(1, 'Gender is required'),
});

export type StudentCreateFormData = z.infer<typeof studentCreateSchema>;
export type StudentUpdateFormData = z.infer<typeof studentUpdateSchema>;

// Profile Update (Student self-update) → Only personal/contact fields
export const studentProfileSchema = studentBaseSchema.extend({
    password: optionalPasswordRules,
    // Other fields from base are already optional or have defaults
});

export type StudentProfileFormData = z.infer<typeof studentProfileSchema>;

// =========================
// --- ASSESSMENT SCHEMAS ---
// =========================

export const assessmentSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    type: z.nativeEnum(AssessmentType),
    totalMarks: z.string().min(1, 'Total Marks is required').refine(val => !isNaN(Number(val)) && Number(val) > 0, 'Must be a positive number'),
    weightage: z.string().min(1, 'Weightage is required').refine(val => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100, 'Must be between 0 and 100'),
    dueDate: z.string().optional().or(z.literal('')),
    allowSubmissions: z.boolean(),
    externalLink: z.string().url('Invalid URL').refine(isSafeHttpUrl, 'Only safe http(s) URLs are allowed').optional().or(z.literal('')),
    isVideoLink: z.boolean().optional(),
});

export type AssessmentFormData = z.infer<typeof assessmentSchema>;

// =========================
// --- GRADE SCHEMAS ---
// =========================

export const MIN_GRADE_MARKS = 0.5;

export function roundGradeMarks(value: number) {
    return Number.isFinite(value) ? Number(value.toFixed(1)) : Number.NaN;
}

export function isAllowedGradeMarks(value: number) {
    const roundedValue = roundGradeMarks(value);
    return Number.isFinite(roundedValue) && (roundedValue === 0 || roundedValue >= MIN_GRADE_MARKS);
}

export const gradeSchema = z.object({
    marksObtained: z.string()
        .min(1, 'Marks obtained is required')
        .refine((val) => Number.isFinite(Number(val)), 'Enter a valid number')
        .refine((val) => isAllowedGradeMarks(Number(val)), `Use 0 or at least ${MIN_GRADE_MARKS}`),
    feedback: z.string().optional().or(z.literal('')),
    status: z.nativeEnum(GradeStatus).optional(),
});

export type GradeFormData = z.infer<typeof gradeSchema>;
