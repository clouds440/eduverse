'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { FinancialEntry } from '@/types';
import { FinancialAmount } from '@/components/finance/FinancialAmount';

interface ConfirmPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: FinancialEntry;
    onConfirm: (data: { paidAmount?: number }) => Promise<void>;
}

export function ConfirmPaymentModal({ isOpen, onClose, entry, onConfirm }: ConfirmPaymentModalProps) {
    const remainingAmount = entry.amount - entry.paidAmount;
    const [paidAmount, setPaidAmount] = useState<number>(remainingAmount);
    const [isConfirming, setIsConfirming] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsConfirming(true);
            await onConfirm({ paidAmount: Number(paidAmount) });
            onClose();
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirm Payment">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-card p-4 rounded-xl border border-border space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Title</span>
                        <span className="font-bold">{entry.title}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Expected</span>
                        <FinancialAmount amount={entry.amount} currency={entry.currency} className="font-bold" />
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Already Paid</span>
                        <FinancialAmount amount={entry.paidAmount} currency={entry.currency} className="text-success font-bold" />
                    </div>
                </div>

                {entry.paymentMethod && (
                    <div className="bg-warning/10 text-warning p-4 rounded-xl border border-warning/20 text-xs">
                        <p className="font-bold mb-1">User Claimed Payment:</p>
                        <p>Method: {entry.paymentMethod}</p>
                        {entry.receiptUrl && <p>Receipt: <a href={entry.receiptUrl} target="_blank" className="underline">{entry.receiptUrl}</a></p>}
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Amount to Confirm Now</Label>
                    <Input 
                        type="number" 
                        step="0.01" 
                        min={0.01} 
                        max={remainingAmount} 
                        required 
                        value={paidAmount} 
                        onChange={(e) => setPaidAmount(Number(e.target.value))} 
                    />
                    <p className="text-xs text-muted-foreground mt-1">Leave as default to confirm the remaining full amount.</p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="secondary" onClick={onClose} disabled={isConfirming}>Cancel</Button>
                    <Button type="submit" disabled={isConfirming}>
                        {isConfirming ? 'Confirming...' : 'Confirm Payment'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
