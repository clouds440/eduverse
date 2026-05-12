'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { FinanceCategory, BillingCycle, FinancialStructure, Student, Teacher, FinanceTargetType, PaginatedResponse } from '@/types';
import { api } from '@/lib/api';
import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';

interface StructureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<FinancialStructure>) => Promise<void>;
    initialData?: FinancialStructure | null;
}

export function StructureModal({ isOpen, onClose, onSave, initialData }: StructureModalProps) {
    const { token } = useAuth();
    
    const [targetType, setTargetType] = useState<FinanceTargetType>(FinanceTargetType.STUDENT);
    const [targetId, setTargetId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<FinanceCategory>(FinanceCategory.TUITION);
    const [amount, setAmount] = useState<number>(0);
    const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);
    const [dueDay, setDueDay] = useState<number | ''>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);

    // Reset or populate state
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setTargetType(initialData.teacherId ? FinanceTargetType.TEACHER : FinanceTargetType.STUDENT);
                setTargetId(initialData.teacherId || initialData.studentId || '');
                setTitle(initialData.title);
                setCategory(initialData.category);
                setAmount(initialData.amount);
                setBillingCycle(initialData.billingCycle);
                setDueDay(initialData.dueDay || '');
                setStartDate(initialData.startDate.split('T')[0]);
                setEndDate(initialData.endDate ? initialData.endDate.split('T')[0] : '');
            } else {
                setTargetType(FinanceTargetType.STUDENT);
                setTargetId('');
                setTitle('');
                setCategory(FinanceCategory.TUITION);
                setAmount(0);
                setBillingCycle(BillingCycle.MONTHLY);
                setDueDay('');
                setStartDate(new Date().toISOString().split('T')[0]);
                setEndDate('');
            }
        }
    }, [isOpen, initialData]);

    const { data: studentsRes } = useSWR<PaginatedResponse<Student>>(
        isOpen && targetType === FinanceTargetType.STUDENT && token ? ['students', token] : null,
        ([, t]) => api.org.getStudents(t as string, { limit: 1000 })
    );

    const { data: teachersRes } = useSWR<PaginatedResponse<Teacher>>(
        isOpen && targetType === FinanceTargetType.TEACHER && token ? ['teachers', token] : null,
        ([, t]) => api.org.getTeachers(t as string, { limit: 1000 })
    );

    const targetOptions = targetType === FinanceTargetType.STUDENT
        ? (studentsRes?.data || []).map(s => ({ value: s.id, label: `${s.user.name} (${s.registrationNumber || s.user.email})` }))
        : (teachersRes?.data || []).map(t => ({ value: t.id, label: t.user.name }));

    const categoryOptions = Object.values(FinanceCategory).map(c => ({ value: c, label: c }));
    const cycleOptions = Object.values(BillingCycle).map(c => ({ value: c, label: c }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            await onSave({
                title,
                studentId: targetType === FinanceTargetType.STUDENT ? targetId : null,
                teacherId: targetType === FinanceTargetType.TEACHER ? targetId : null,
                category,
                amount: Number(amount),
                billingCycle,
                dueDay: dueDay ? Number(dueDay) : null,
                startDate: new Date(startDate).toISOString(),
                endDate: endDate ? new Date(endDate).toISOString() : null,
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "Edit Financial Structure" : "Create Financial Structure"}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Target Type</Label>
                        <CustomSelect
                            value={targetType}
                            onChange={(val) => { setTargetType(val as FinanceTargetType); setTargetId(''); }}
                            options={[
                                { value: FinanceTargetType.STUDENT, label: 'Student' },
                                { value: FinanceTargetType.TEACHER, label: 'Teacher' }
                            ]}
                            disabled={!!initialData}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Select {targetType === FinanceTargetType.STUDENT ? 'Student' : 'Teacher'}</Label>
                        <CustomSelect
                            value={targetId}
                            onChange={setTargetId}
                            options={targetOptions}
                            searchable
                            placeholder={`Search ${targetType.toLowerCase()}...`}
                            disabled={!!initialData}
                            required
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Title (e.g. "Monthly Tuition Fee")</Label>
                    <Input required value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <CustomSelect value={category} onChange={(val) => setCategory(val as FinanceCategory)} options={categoryOptions} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" min={0} step="0.01" required value={amount} onChange={e => setAmount(Number(e.target.value))} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Billing Cycle</Label>
                        <CustomSelect value={billingCycle} onChange={(val) => setBillingCycle(val as BillingCycle)} options={cycleOptions} required />
                    </div>
                    {billingCycle !== BillingCycle.ONCE && (
                        <div className="space-y-2">
                            <Label>Due Day (1-28)</Label>
                            <Input type="number" min={1} max={28} value={dueDay} onChange={e => setDueDay(e.target.value ? Number(e.target.value) : '')} required />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>End Date (Optional)</Label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" disabled={isSaving || !targetId}>
                        {isSaving ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Structure')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
