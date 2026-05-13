'use client';

import { ReactNode, useMemo } from 'react';
import { SWRConfig } from 'swr';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Teacher, Student } from '@/types';

// Generic fetcher type that handles our API patterns
// Format: [resource, ...args]
type FetcherKey =
    // Object-param resources (pagination/filters)
    | readonly ['sections', object]
    | readonly ['students', object]
    | readonly ['teachers', object]
    | readonly ['courses', object]
    | readonly ['admin-organizations', object]
    | readonly ['platform-admins', object]
    | readonly ['mails', object]
    | readonly ['admin-mails', object]
    | readonly ['attendance-sections', object]
    | readonly ['sections-for-grades', object]
    | readonly ['sections-for-schedules', object]
    | readonly ['student-assessments', object]
    | readonly ['teacher-sections', object]
    | readonly ['academicCycles', object]
    | readonly ['cohorts', object]
    | readonly ['studentsSearch', object]
    // Single string ID resources
    | readonly ['attendance-section', string]
    | readonly ['section-schedules', string]
    | readonly ['schedules', string]
    | readonly ['student', string]
    | readonly ['teacher', string]
    | readonly ['section-materials', string]
    | readonly ['section-detail', string]
    | readonly ['validate-student', string]
    | readonly ['validate-teacher', string]
    | readonly ['student-grades', string]
    | readonly ['student-attendance', string]
    | readonly ['section-attendance-range', string]
    | readonly ['teacher-profile', string]
    | readonly ['student-profile', string]
    | readonly ['transcript', string]
    // Multi-param resources
    | readonly ['attendance-daily', string, string, string | undefined]  // [sectionId, date, scheduleId?]
    | readonly ['attendance-monthly', string, string, string]  // [sectionId, start, end]
    | readonly ['timetable', string, string]  // [userId, role]
    | readonly ['assessment-detail', string, string]  // [sectionId, assessmentId]
    | readonly ['student-sections', string, object]  // [userId, params]
    // No-param resources
    | readonly ['insights']
    | readonly ['student-insights']
    | readonly ['teacher-insights'];

// Create a fetcher factory that has access to the token
function createFetcher(token: string | null) {
    return async function fetcher<T>(key: FetcherKey): Promise<T> {
        if (!token) {
            throw new Error('Authentication required');
        }

        const [resource, ...args] = key;

        try {
            switch (resource) {
                // Paginated lists
                case 'sections':
                    return await api.org.getSections(token, args[0] as object) as T;
                case 'students':
                    return await api.org.getStudents(token, args[0] as object) as T;
                case 'teachers':
                    return await api.org.getTeachers(token, args[0] as object) as T;
                case 'courses':
                    return await api.org.getCourses(token, args[0] as object) as T;
                case 'admin-organizations':
                    return await api.admin.getOrganizations(token, args[0] as object) as T;
                case 'platform-admins':
                    return await api.admin.getPlatformAdmins(token, args[0] as object) as T;
                case 'academicCycles':
                    return await api.academicCycles.getCycles(token, args[0] as object) as T;
                case 'cohorts':
                    return await api.cohorts.getCohorts(token, args[0] as object) as T;
                case 'studentsSearch':
                    return await api.org.getStudents(token, args[0] as object) as T;

                // Mail
                case 'mails':
                    return await api.mail.getMails(token, args[0] as object) as T;
                case 'admin-mails':
                    return await api.mail.getMails(token, args[0] as object) as T;

                // Attendance
                case 'attendance-sections':
                    return await api.org.getSections(token, args[0] as object) as T;
                case 'attendance-section':
                    return await api.org.getSection(args[0] as string, token) as T;
                case 'attendance-daily': {
                    const [sectionId, date, scheduleId] = args as [string, string, string | undefined];
                    return await api.org.getSectionAttendance(sectionId, date, token, scheduleId) as T;
                }
                case 'attendance-monthly': {
                    const [sectionId, start, end] = args as [string, string, string];
                    return await api.org.getSectionAttendanceRange(sectionId, start, end, token) as T;
                }

                // Timetable & Schedules
                case 'timetable':
                    return await api.org.getTimetable(token) as T;
                case 'section-schedules':
                    return await api.org.getSchedules(args[0] as string, token) as T;
                case 'sections-for-schedules':
                    return await api.org.getSections(token, args[0] as object) as T;
                case 'schedules':
                    return await api.org.getSchedules(args[0] as string, token) as T;

                // Grades
                case 'sections-for-grades':
                    return await api.org.getSections(token, args[0] as object) as T;

                // Detail pages
                case 'assessment-detail': {
                    const [sectionId, assessmentId] = args as [string, string];
                    const [assessment, section, grades, submissions] = await Promise.all([
                        api.org.getAssessment(assessmentId, token),
                        api.org.getSection(sectionId, token),
                        api.org.getGrades(assessmentId, token),
                        api.org.getSubmissions(assessmentId, token)
                    ]);
                    return { assessment, section, grades, submissions } as T;
                }
                case 'student':
                    return await api.org.getStudent(args[0] as string, token) as T;
                case 'teacher':
                    return await api.org.getTeacher(args[0] as string, token) as T;
                case 'section-materials':
                    return await api.org.getSection(args[0] as string, token) as T;
                case 'section-detail':
                    return await api.org.getSection(args[0] as string, token) as T;

                // Insights
                case 'insights':
                    return await api.org.getInsights(token) as T;

                // Validation lookups
                case 'validate-student':
                    return await api.org.getStudentByUserId(args[0] as string, token) as T;
                case 'validate-teacher':
                    return await api.org.getTeacherByUserId(args[0] as string, token) as T;

                // Student portal data
                case 'student-sections':
                    return await api.org.getSections(token, { ...args[1] as object, userId: args[0] as string }) as T;
                case 'student-grades':
                    return await api.org.getStudentFinalGrades(args[0] as string, token) as T;
                case 'student-assessments':
                    return await api.org.getAssessments(token, args[0] as object) as T;
                case 'student-insights':
                    return await api.org.getInsights(token) as T;
                case 'teacher-insights':
                    return await api.org.getInsights(token) as T;
                case 'teacher-sections':
                    return await api.org.getSections(token, args[0] as object) as T;

                // Profile
                case 'teacher-profile':
                    return await api.org.getProfile<Teacher>(token) as T;
                case 'student-profile':
                    return await api.org.getProfile<Student>(token) as T;
                case 'transcript':
                    return await api.transcripts.getStudentTranscript(args[0] as string, token) as T;

                // Attendance component
                case 'student-attendance':
                    return await api.org.getStudentAttendance(args[0] as string, token) as T;
                case 'section-attendance-range': {
                    const sectionId = args[0] as string;
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                    return await api.org.getSectionAttendanceRange(sectionId, start, end, token) as T;
                }

                default:
                    throw new Error(`Unknown resource: ${resource}`);
            }
        } catch (error: unknown) {
            // Re-throw for SWR to handle
            throw error;
        }
    };
}

interface SWRProviderProps {
    children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
    const { token } = useAuth();

    const fetcher = useMemo(() => createFetcher(token), [token]);
    const swrConfig = useMemo(() => ({
        fetcher,
        revalidateOnFocus: true,
        errorRetryCount: 3,
        dedupingInterval: 2000, // 2 seconds
        shouldRetryOnError: (err: unknown) => {
            // Don't retry on 401 (unauthorized) or 403 (forbidden)
            if (err && typeof err === 'object' && 'status' in err) {
                const status = (err as { status: number }).status;
                if (status === 401 || status === 403) return false;
            }
            return true;
        },
        onError: (err: unknown) => {
            // Log errors but let components handle UI
            if (err && typeof err === 'object' && 'message' in err) {
                console.warn('SWR Error:', (err as Error).message);
            }
        },
        // Null key pattern: when token is null, don't fetch
        suspense: false,
        keepPreviousData: true,
    }), [fetcher]);

    return (
        <SWRConfig value={swrConfig}>
            {children}
        </SWRConfig>
    );
}
