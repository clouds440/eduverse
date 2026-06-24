'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { DocsLink } from '@/components/ui/DocsLink';
import { FinancialEntry } from '@/types';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { moneySubtract } from '@/lib/money';

interface ClaimPaidModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: FinancialEntry;
    onSubmit: (data: { claimedAmount?: number; paymentMethod?: string; receiptUrl?: string; referenceNumber?: string; note?: string; attachmentFiles?: File[] }) => Promise<void>;
}

export function ClaimPaidModal({ isOpen, onClose, entry, onSubmit }: ClaimPaidModalProps) {
    const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
    const remainingAmount = moneySubtract(entry.amount, entry.paidAmount);
    const [claimedAmount, setClaimedAmount] = useState<number>(remainingAmount);
    const [receiptUrl, setReceiptUrl] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [note, setNote] = useState('');
    const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setAttachmentFiles([]);
    }, [isOpen, entry.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await onSubmit({ claimedAmount: Number(claimedAmount), paymentMethod, receiptUrl, referenceNumber, note, attachmentFiles });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Claim Payment">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-info/10 text-info p-4 rounded-xl border border-info/20 text-sm font-medium">
                    Claiming <strong>{entry.title}</strong> sends it for admin verification. <DocsLink href="/docs/finance#payment-claims" className="text-info">Read payment rules</DocsLink>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 text-sm">
                    <span className="font-semibold text-muted-foreground">Remaining balance</span>
                    <FinancialAmount amount={remainingAmount} currency={entry.currency} className="text-right" />
                </div>

                <div className="space-y-2">
                    <Label>Amount Claimed</Label>
                    <Input
                        type="number"
                        step="0.01"
                        min={0.01}
                        max={remainingAmount}
                        required
                        value={claimedAmount}
                        onChange={(e) => setClaimedAmount(Number(e.target.value))}
                    />
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
                    <Label>Receipt URL</Label>
                    <Input
                        placeholder="Link to screenshot or uploaded proof"
                        value={receiptUrl}
                        onChange={(e) => setReceiptUrl(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Attachment</Label>
                    <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        onChange={(event) => setAttachmentFiles(Array.from(event.target.files || []))}
                    />
                    {attachmentFiles.length > 0 && (
                        <p className="text-xs font-semibold text-muted-foreground">
                            {attachmentFiles.map((file) => file.name).join(', ')}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Transaction Reference</Label>
                    <Input
                        placeholder="Bank reference, receipt number, or cash memo"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Note</Label>
                    <Input
                        placeholder="Short note for finance staff"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || claimedAmount <= 0 || claimedAmount > remainingAmount}>
                        {isSubmitting ? 'Submitting...' : 'Submit Claim'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
