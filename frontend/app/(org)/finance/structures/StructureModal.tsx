'use client';

import React, { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { Toggle } from '@/components/ui/Toggle';
import {
    BillingCycle,
    Cohort,
    Course,
    FinanceAssignmentSource,
    FinanceCategory,
    FinancialStructure,
    FinanceTargetType,
    PaginatedResponse,
    Section,
    Student,
    Teacher,
    User,
} from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatCourseSectionLabel } from '@/lib/utils';

type StructurePayload = Partial<FinancialStructure> & {
    assignmentSource?: FinanceAssignmentSource;
    studentIds?: string[];
    teacherIds?: string[];
    employeeUserIds?: string[];
    sectionIds?: string[];
    cohortIds?: string[];
    courseIds?: string[];
    entityName?: string;
    applyToExistingEntries?: boolean;
    entryUpdateScope?: 'OUTSTANDING';
};

interface StructureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: StructurePayload) => Promise<void>;
    initialData?: FinancialStructure | null;
}

const studentCategories = [
    FinanceCategory.TUITION,
    FinanceCategory.TRANSPORT,
    FinanceCategory.LIBRARY,
    FinanceCategory.LIBRARY_FINE,
    FinanceCategory.EXAM,
    FinanceCategory.ADMISSION,
    FinanceCategory.HOSTEL,
    FinanceCategory.ACTIVITY,
    FinanceCategory.LATE_FEE,
    FinanceCategory.FINE,
    FinanceCategory.BOOKS_SUPPLIES,
    FinanceCategory.STATIONERY,
    FinanceCategory.UNIFORM,
    FinanceCategory.LAB,
    FinanceCategory.ID_CARD,
    FinanceCategory.CERTIFICATE,
    FinanceCategory.TRANSCRIPT,
    FinanceCategory.GRADUATION,
    FinanceCategory.REGISTRATION,
    FinanceCategory.APPLICATION_FEE,
    FinanceCategory.PROCESSING_FEE,
    FinanceCategory.DEVELOPMENT_FEE,
    FinanceCategory.BUILDING_FUND,
    FinanceCategory.CANTEEN,
    FinanceCategory.CAFETERIA,
    FinanceCategory.MEDICAL,
    FinanceCategory.HEALTH,
    FinanceCategory.SPORTS,
    FinanceCategory.ARTS,
    FinanceCategory.MUSIC,
    FinanceCategory.TECHNOLOGY,
    FinanceCategory.PRINTING,
    FinanceCategory.PARKING,
    FinanceCategory.SECURITY_DEPOSIT,
    FinanceCategory.FIELD_TRIP,
    FinanceCategory.EVENT,
    FinanceCategory.SCHOLARSHIP,
    FinanceCategory.DISCOUNT,
    FinanceCategory.WAIVER,
    FinanceCategory.OTHER,
];

const teacherCategories = [
    FinanceCategory.SALARY,
    FinanceCategory.BONUS,
    FinanceCategory.ALLOWANCE,
    FinanceCategory.OVERTIME,
    FinanceCategory.COMMISSION,
    FinanceCategory.ADVANCE,
    FinanceCategory.LOAN,
    FinanceCategory.REIMBURSEMENT,
    FinanceCategory.TRAINING,
    FinanceCategory.PROFESSIONAL_DEVELOPMENT,
    FinanceCategory.TRAVEL,
    FinanceCategory.MEAL,
    FinanceCategory.ACCOMMODATION,
    FinanceCategory.MEDICAL,
    FinanceCategory.HEALTH,
    FinanceCategory.REFUND,
    FinanceCategory.TAX,
    FinanceCategory.INSURANCE,
    FinanceCategory.OTHER,
];

const otherIncomeCategories = [
    FinanceCategory.ADMISSION,
    FinanceCategory.ACTIVITY,
    FinanceCategory.LIBRARY,
    FinanceCategory.LATE_FEE,
    FinanceCategory.FINE,
    FinanceCategory.LIBRARY_FINE,
    FinanceCategory.DONATION,
    FinanceCategory.GRANT,
    FinanceCategory.REGISTRATION,
    FinanceCategory.APPLICATION_FEE,
    FinanceCategory.PROCESSING_FEE,
    FinanceCategory.DEVELOPMENT_FEE,
    FinanceCategory.BUILDING_FUND,
    FinanceCategory.CANTEEN,
    FinanceCategory.CAFETERIA,
    FinanceCategory.SPORTS,
    FinanceCategory.ARTS,
    FinanceCategory.MUSIC,
    FinanceCategory.TECHNOLOGY,
    FinanceCategory.PRINTING,
    FinanceCategory.PARKING,
    FinanceCategory.EVENT,
    FinanceCategory.REFUND,
    FinanceCategory.MISC_INCOME,
    FinanceCategory.OTHER,
];

const otherExpenseCategories = [
    FinanceCategory.SALARY,
    FinanceCategory.BONUS,
    FinanceCategory.REIMBURSEMENT,
    FinanceCategory.REFUND,
    FinanceCategory.VENDOR_PAYMENT,
    FinanceCategory.ALLOWANCE,
    FinanceCategory.OVERTIME,
    FinanceCategory.ADVANCE,
    FinanceCategory.LOAN,
    FinanceCategory.TRAINING,
    FinanceCategory.PROFESSIONAL_DEVELOPMENT,
    FinanceCategory.TRAVEL,
    FinanceCategory.MEAL,
    FinanceCategory.ACCOMMODATION,
    FinanceCategory.MAINTENANCE,
    FinanceCategory.UTILITIES,
    FinanceCategory.RENT,
    FinanceCategory.EQUIPMENT,
    FinanceCategory.SOFTWARE,
    FinanceCategory.INTERNET,
    FinanceCategory.PHONE,
    FinanceCategory.OFFICE_SUPPLIES,
    FinanceCategory.CLEANING,
    FinanceCategory.SECURITY,
    FinanceCategory.REPAIRS,
    FinanceCategory.MARKETING,
    FinanceCategory.LEGAL,
    FinanceCategory.CONSULTING,
    FinanceCategory.TAX,
    FinanceCategory.INSURANCE,
    FinanceCategory.BANK_CHARGE,
    FinanceCategory.BOOKS_SUPPLIES,
    FinanceCategory.STATIONERY,
    FinanceCategory.UNIFORM,
    FinanceCategory.LAB,
    FinanceCategory.ID_CARD,
    FinanceCategory.FIELD_TRIP,
    FinanceCategory.EVENT,
    FinanceCategory.MISC_EXPENSE,
    FinanceCategory.OTHER,
];

function labelize(value: string) {
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCategoryOptions(targetType: FinanceTargetType) {
    const categories = targetType === FinanceTargetType.STUDENT
        ? studentCategories
        : targetType === FinanceTargetType.TEACHER || targetType === FinanceTargetType.SUB_ADMIN || targetType === FinanceTargetType.FINANCE_MANAGER
            ? teacherCategories
            : targetType === FinanceTargetType.OTHER_EXPENSE
                ? otherExpenseCategories
                : otherIncomeCategories;
    return categories.map((category) => ({ value: category, label: labelize(category) }));
}

export function StructureModal({ isOpen, onClose, onSave, initialData }: StructureModalProps) {
    const { token } = useAuth();

    const [targetType, setTargetType] = useState<FinanceTargetType>(FinanceTargetType.STUDENT);
    const [assignmentSource, setAssignmentSource] = useState<FinanceAssignmentSource>(FinanceAssignmentSource.MANUAL);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [entityName, setEntityName] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<FinanceCategory>(FinanceCategory.TUITION);
    const [amount, setAmount] = useState('');
    const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);
    const [dueDay, setDueDay] = useState<number | ''>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [applyToExistingEntries, setApplyToExistingEntries] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (initialData) {
            const nextTargetType = initialData.targetType || (initialData.teacherId ? FinanceTargetType.TEACHER : FinanceTargetType.STUDENT);
            setTargetType(nextTargetType);
            setAssignmentSource(initialData.assignments?.[0]?.sourceType || FinanceAssignmentSource.MANUAL);
            setSelectedIds([]);
            setEntityName(initialData.assignments?.[0]?.entityName || '');
            setTitle(initialData.title);
            setCategory(initialData.category);
            setAmount(String(initialData.amount));
            setBillingCycle(initialData.billingCycle);
            setDueDay(initialData.dueDay || '');
            setStartDate(initialData.startDate.split('T')[0]);
            setEndDate(initialData.endDate ? initialData.endDate.split('T')[0] : '');
            setApplyToExistingEntries(false);
        } else {
            setTargetType(FinanceTargetType.STUDENT);
            setAssignmentSource(FinanceAssignmentSource.MANUAL);
            setSelectedIds([]);
            setEntityName('');
            setTitle('');
            setCategory(FinanceCategory.TUITION);
            setAmount('');
            setBillingCycle(BillingCycle.MONTHLY);
            setDueDay('');
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate('');
            setApplyToExistingEntries(false);
        }
    }, [isOpen, initialData]);

    const { data: studentsRes } = useSWR<PaginatedResponse<Student>>(
        isOpen && token ? ['finance-students', token] : null,
        ([, t]) => api.org.getStudents(t as string, { limit: 1000 })
    );
    const { data: teachersRes } = useSWR<PaginatedResponse<Teacher>>(
        isOpen && token ? ['finance-teachers', token] : null,
        ([, t]) => api.org.getTeachers(t as string, { limit: 1000 })
    );
    const { data: subAdminsRes } = useSWR<PaginatedResponse<User>>(
        isOpen && token ? ['finance-sub-admins', token] : null,
        ([, t]) => api.org.getSubAdmins(t as string, { limit: 1000, status: 'ACTIVE' })
    );
    const { data: financeManagersRes } = useSWR<PaginatedResponse<User>>(
        isOpen && token ? ['finance-managers-for-payroll', token] : null,
        ([, t]) => api.org.getFinanceManagers(t as string, { limit: 1000, status: 'ACTIVE' })
    );
    const { data: sectionsRes } = useSWR<PaginatedResponse<Section>>(
        isOpen && token ? ['finance-sections', token] : null,
        ([, t]) => api.org.getSections(t as string, { limit: 1000 })
    );
    const { data: coursesRes } = useSWR<PaginatedResponse<Course>>(
        isOpen && token ? ['finance-courses', token] : null,
        ([, t]) => api.org.getCourses(t as string, { limit: 1000 })
    );
    const { data: cohortsRes } = useSWR<PaginatedResponse<Cohort>>(
        isOpen && token ? ['finance-cohorts', token] : null,
        ([, t]) => api.cohorts.getCohorts(t as string, { limit: 1000 })
    );

    const categoryOptions = useMemo(() => getCategoryOptions(targetType), [targetType]);
    const cycleOptions = Object.values(BillingCycle).map((cycle) => ({ value: cycle, label: labelize(cycle) }));

    const assignmentSourceOptions = useMemo(() => {
        if (targetType === FinanceTargetType.STUDENT) {
            return [
                { value: FinanceAssignmentSource.MANUAL, label: 'Specific students' },
                { value: FinanceAssignmentSource.SECTION, label: 'Students in sections' },
                { value: FinanceAssignmentSource.COHORT, label: 'Students in cohorts' },
                { value: FinanceAssignmentSource.COURSE, label: 'Students in courses' },
            ];
        }
        if (targetType === FinanceTargetType.TEACHER) {
            return [
                { value: FinanceAssignmentSource.MANUAL, label: 'Specific teachers' },
                { value: FinanceAssignmentSource.SECTION, label: 'Teachers in sections' },
                { value: FinanceAssignmentSource.COURSE, label: 'Teachers in courses' },
            ];
        }
        if (targetType === FinanceTargetType.SUB_ADMIN) {
            return [{ value: FinanceAssignmentSource.MANUAL, label: 'Specific sub admins' }];
        }
        if (targetType === FinanceTargetType.FINANCE_MANAGER) {
            return [{ value: FinanceAssignmentSource.MANUAL, label: 'Specific finance managers' }];
        }
        return [{ value: FinanceAssignmentSource.OTHER, label: 'External entity' }];
    }, [targetType]);

    const assignmentOptions = useMemo(() => {
        if (targetType === FinanceTargetType.STUDENT && assignmentSource === FinanceAssignmentSource.MANUAL) {
            return (studentsRes?.data || []).map((student) => ({
                value: student.id,
                label: `${student.user.name || student.user.email} (${student.registrationNumber || student.rollNumber || 'Student'})`,
            }));
        }
        if (targetType === FinanceTargetType.TEACHER && assignmentSource === FinanceAssignmentSource.MANUAL) {
            return (teachersRes?.data || []).map((teacher) => ({
                value: teacher.id,
                label: `${teacher.user.name || teacher.user.email} (${teacher.department || teacher.subject || 'Teacher'})`,
            }));
        }
        if (targetType === FinanceTargetType.SUB_ADMIN && assignmentSource === FinanceAssignmentSource.MANUAL) {
            return (subAdminsRes?.data || []).map((user) => ({
                value: user.id,
                label: `${user.name || user.email} (${user.email} - ${labelize(user.status || 'ACTIVE')})`,
            }));
        }
        if (targetType === FinanceTargetType.FINANCE_MANAGER && assignmentSource === FinanceAssignmentSource.MANUAL) {
            return (financeManagersRes?.data || []).map((user) => ({
                value: user.id,
                label: `${user.name || user.email} (${user.email} - ${labelize(user.status || 'ACTIVE')})`,
            }));
        }
        if (assignmentSource === FinanceAssignmentSource.SECTION) {
            return (sectionsRes?.data || []).map((section) => ({
                value: section.id,
                label: formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name }),
            }));
        }
        if (assignmentSource === FinanceAssignmentSource.COHORT) {
            return (cohortsRes?.data || []).map((cohort) => ({ value: cohort.id, label: cohort.name }));
        }
        if (assignmentSource === FinanceAssignmentSource.COURSE) {
            return (coursesRes?.data || []).map((course) => ({ value: course.id, label: course.name }));
        }
        return [];
    }, [assignmentSource, cohortsRes?.data, coursesRes?.data, financeManagersRes?.data, sectionsRes?.data, studentsRes?.data, subAdminsRes?.data, targetType, teachersRes?.data]);

    const handleTargetTypeChange = (value: string) => {
        const nextTargetType = value as FinanceTargetType;
        const nextCategoryOptions = getCategoryOptions(nextTargetType);
        setTargetType(nextTargetType);
        setAssignmentSource(nextTargetType === FinanceTargetType.OTHER_EXPENSE || nextTargetType === FinanceTargetType.OTHER_INCOME
            ? FinanceAssignmentSource.OTHER
            : FinanceAssignmentSource.MANUAL);
        setSelectedIds([]);
        setCategory(nextCategoryOptions[0]?.value as FinanceCategory);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const payload: StructurePayload = {
                title,
                targetType,
                category,
                amount: Number(amount).toFixed(2) as unknown as FinancialStructure['amount'],
                billingCycle,
                dueDay: billingCycle === BillingCycle.ONCE ? null : dueDay ? Number(dueDay) : null,
                startDate: new Date(startDate).toISOString(),
                endDate: endDate ? new Date(endDate).toISOString() : null,
                assignmentSource,
                applyToExistingEntries: initialData ? applyToExistingEntries : undefined,
                entryUpdateScope: initialData && applyToExistingEntries ? 'OUTSTANDING' : undefined,
            };

            if (!initialData) {
                if (targetType === FinanceTargetType.OTHER_INCOME || targetType === FinanceTargetType.OTHER_EXPENSE) {
                    payload.entityName = entityName.trim();
                } else if (targetType === FinanceTargetType.STUDENT && assignmentSource === FinanceAssignmentSource.MANUAL) {
                    payload.studentIds = selectedIds;
                } else if (targetType === FinanceTargetType.TEACHER && assignmentSource === FinanceAssignmentSource.MANUAL) {
                    payload.teacherIds = selectedIds;
                } else if ((targetType === FinanceTargetType.SUB_ADMIN || targetType === FinanceTargetType.FINANCE_MANAGER) && assignmentSource === FinanceAssignmentSource.MANUAL) {
                    payload.employeeUserIds = selectedIds;
                } else if (assignmentSource === FinanceAssignmentSource.SECTION) {
                    payload.sectionIds = selectedIds;
                } else if (assignmentSource === FinanceAssignmentSource.COHORT) {
                    payload.cohortIds = selectedIds;
                } else if (assignmentSource === FinanceAssignmentSource.COURSE) {
                    payload.courseIds = selectedIds;
                }
            }

            await onSave(payload);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const isOtherTarget = targetType === FinanceTargetType.OTHER_INCOME || targetType === FinanceTargetType.OTHER_EXPENSE;
    const hasTargets = initialData ? true : isOtherTarget ? Boolean(entityName.trim()) : selectedIds.length > 0;
    const canSubmit = Boolean(title && amount && startDate && hasTargets);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Edit Financial Structure' : 'Create Financial Structure'}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-sm font-semibold text-muted-foreground">
                    Structures are reusable billing templates with target assignments. <DocsLink href="/docs/finance#finance-structures">Read finance structure docs</DocsLink>
                </p>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Target Type</Label>
                        <CustomSelect
                            value={targetType}
                            onChange={handleTargetTypeChange}
                            options={[
                                { value: FinanceTargetType.STUDENT, label: 'Student income' },
                                { value: FinanceTargetType.TEACHER, label: 'Teacher expense' },
                                { value: FinanceTargetType.SUB_ADMIN, label: 'Sub Admin expense' },
                                { value: FinanceTargetType.FINANCE_MANAGER, label: 'Finance Manager expense' },
                                { value: FinanceTargetType.OTHER_INCOME, label: 'Other income' },
                                { value: FinanceTargetType.OTHER_EXPENSE, label: 'Other expense' },
                            ]}
                            disabled={!!initialData}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Assignment</Label>
                        <CustomSelect
                            value={assignmentSource}
                            onChange={(value) => { setAssignmentSource(value as FinanceAssignmentSource); setSelectedIds([]); }}
                            options={assignmentSourceOptions}
                            disabled={!!initialData || isOtherTarget}
                        />
                    </div>
                </div>

                {isOtherTarget ? (
                    <div className="space-y-2">
                        <Label>Entity Name</Label>
                        <Input required={!initialData} value={entityName} onChange={(event) => setEntityName(event.target.value)} placeholder="Vendor, donor, event, or income source" disabled={!!initialData} />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label>Select Targets</Label>
                        <CustomMultiSelect
                            values={selectedIds}
                            onChange={setSelectedIds}
                            options={assignmentOptions}
                            placeholder="Choose one or more targets"
                            disabled={!!initialData}
                        />
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Monthly tuition fee" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <CustomSelect value={category} onChange={(value) => setCategory(value as FinanceCategory)} options={categoryOptions} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" min={0} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Billing Cycle</Label>
                        <CustomSelect value={billingCycle} onChange={(value) => setBillingCycle(value as BillingCycle)} options={cycleOptions} required />
                    </div>
                    {billingCycle !== BillingCycle.ONCE && (
                        <div className="space-y-2">
                            <Label>Due Day (1-28)</Label>
                            <Input type="number" min={1} max={28} value={dueDay} onChange={(event) => setDueDay(event.target.value ? Number(event.target.value) : '')} required />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    </div>
                </div>

                {initialData && (
                    <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                        <Toggle
                            checked={applyToExistingEntries}
                            onCheckedChange={setApplyToExistingEntries}
                            label="Update current outstanding entries"
                            description="Applies this amount and schedule to pending, partial, overdue, and unverified assigned entries only. Paid and cancelled entries stay unchanged."
                            size="md"
                        />
                    </div>
                )}

                <div className="flex justify-end gap-3 border-t border-border pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" disabled={isSaving || !canSubmit}>
                        {isSaving ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Structure')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
