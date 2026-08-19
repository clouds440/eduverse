'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { OnlineAdmissionSubmissionStatus, Role, StudentStatus, type OnlineAdmissionSubmission } from '@/types';
import StudentForm from '@/components/forms/StudentForm';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';
import type { StudentCreateFormData } from '@/lib/schemas';

function stringValue(value: unknown) {
    return typeof value === 'string' ? value : '';
}

function prefillFromSubmission(submission: OnlineAdmissionSubmission): Partial<StudentCreateFormData> {
    const canonical = submission.canonicalData || {};
    return {
        name: submission.applicantName,
        email: '',
        password: '',
        registrationNumber: '',
        rollNumber: '',
        admissionDate: new Date().toISOString().split('T')[0],
        status: StudentStatus.ACTIVE,
        programId: submission.programId,
        primaryDepartmentId: submission.departmentId,
        departmentIds: [],
        fatherName: stringValue(canonical['student.fatherName']),
        gender: stringValue(canonical['student.gender']),
        phone: submission.applicantPhone || '',
        emergencyContact: stringValue(canonical['student.emergencyContact']),
        bloodGroup: stringValue(canonical['student.bloodGroup']),
        address: stringValue(canonical['student.address']),
        guardianId: '',
        guardianRelationship: stringValue(canonical['guardian.relationship']),
    };
}

export default function AddStudentFromOnlineAdmissionPage() {
    const { user, token } = useAuth();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = decodeURIComponent(params.id);
    const { data, error, isLoading } = useSWR<OnlineAdmissionSubmission>(
        token ? ['online-admission-admit-prefill', id] : null,
        () => api.onlineAdmissions.get(id, token!),
    );

    useEffect(() => {
        if (!user) return;
        if (user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) {
            router.push('/online-admissions');
        }
    }, [router, user]);

    const initialValues = useMemo(() => data ? prefillFromSubmission(data) : {}, [data]);
    const canAdmit = data && data.status !== OnlineAdmissionSubmissionStatus.REJECTED && data.status !== OnlineAdmissionSubmissionStatus.ADMITTED;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Admit Student"
                description={data ? `Prefilled from ${data.publicReference}. Set the final login email, password, and registration details before saving.` : 'Prefill student admission from online submission.'}
                icon={UserPlus}
            />
            {isLoading ? (
                <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div>
            ) : error ? (
                <ErrorState error={error} title="Online admission could not be loaded" />
            ) : !data ? (
                <StatusBanner title="Submission unavailable" description="This online admission could not be found." variant="warning" />
            ) : !canAdmit ? (
                <StatusBanner title="Submission cannot be admitted" description="Rejected and already admitted submissions are final records." variant="warning" />
            ) : (
                <StudentForm initialValues={initialValues} onlineAdmissionId={data.id} onlineAdmissionOfferingId={data.programOfferingId} />
            )}
        </FormPageShell>
    );
}
