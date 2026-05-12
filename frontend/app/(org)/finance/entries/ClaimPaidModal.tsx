'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { FinancialEntry } from '@/types';

interface ClaimPaidModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: FinancialEntry;
    onSubmit: (data: { paymentMethod?: string; receiptUrl?: string }) => Promise<void>;
}

export function ClaimPaidModal({ isOpen, onClose, entry, onSubmit }: ClaimPaidModalProps) {
    const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
    const [receiptUrl, setReceiptUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await onSubmit({ paymentMethod, receiptUrl });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Claim Payment">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-info/10 text-info p-4 rounded-xl border border-info/20 text-sm font-medium">
                    You are claiming payment for <strong>{entry.title}</strong>. This will notify the administration for verification.
                </div>

                <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <select
                        className="w-full px-4 py-3 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-semibold text-sm"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CASH">Cash Deposit</option>
                        <option value="CARD">Credit/Debit Card</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label>Receipt URL / Transaction ID (Optional)</Label>
                    <Input
                        placeholder="Link to screenshot or transaction ID"
                        value={receiptUrl}
                        onChange={(e) => setReceiptUrl(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Claim'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
