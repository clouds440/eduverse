'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { EntryStatus, FinancialEntry, PaymentClaimStatus } from '@/types';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { DocsLink } from '@/components/ui/DocsLink';
import { Badge } from '@/components/ui/Badge';
import { FinanceAttachments } from '@/components/finance/FinanceAttachments';

interface ConfirmPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: FinancialEntry;
    onConfirm: (data: { paidAmount?: number; claimId?: string; attachmentFiles?: File[] }) => Promise<void>;
}

export function ConfirmPaymentModal({ isOpen, onClose, entry, onConfirm }: ConfirmPaymentModalProps) {
    const remainingAmount = Math.max(0, Number(entry.amount || 0) - Number(entry.paidAmount || 0));
    const latestClaim = useMemo(
        () => entry.claims?.find((claim) => claim.status === PaymentClaimStatus.PENDING) || entry.claims?.[0] || null,
        [entry.claims],
    );
    const isFullyPaid = entry.status === EntryStatus.PAID || remainingAmount <= 0;
    const [paidAmount, setPaidAmount] = useState<number>(latestClaim?.claimedAmount || remainingAmount);
    const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        setPaidAmount(latestClaim?.claimedAmount || remainingAmount);
        setAttachmentFiles([]);
    }, [latestClaim?.claimedAmount, remainingAmount]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isFullyPaid) return;
        try {
            setIsConfirming(true);
            await onConfirm({ paidAmount: Number(paidAmount), claimId: latestClaim?.id, attachmentFiles });
            onClose();
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirm Payment">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-card p-4 rounded-lg border border-border space-y-2">
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
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining</span>
                        <FinancialAmount amount={remainingAmount} currency={entry.currency} className="font-bold" />
                    </div>
                </div>

                {isFullyPaid ? (
                    <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-sm font-bold text-success">
                        Fully paid. Another confirmation is restricted for this entry.
                    </div>
                ) : (
                    <p className="text-sm font-semibold text-muted-foreground">
                        Confirm only payments you have verified. <DocsLink href="/docs/finance#payment-confirmation">Read payment verification docs</DocsLink>
                    </p>
                )}

                {latestClaim ? (
                    <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 text-xs text-warning">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="font-black">Latest Payment Claim</p>
                            <Badge variant={latestClaim.status === PaymentClaimStatus.PENDING ? 'warning' : latestClaim.status === PaymentClaimStatus.CONFIRMED ? 'success' : 'error'} size="sm">
                                {latestClaim.status}
                            </Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <p><span className="font-bold">Who:</span> {latestClaim.claimedBy?.name || latestClaim.claimedBy?.email || 'Unknown user'}</p>
                            <p><span className="font-bold">When:</span> {new Date(latestClaim.claimedAt).toLocaleString()}</p>
                            <p><span className="font-bold">What:</span> <FinancialAmount amount={latestClaim.claimedAmount} currency={entry.currency} /></p>
                            <p><span className="font-bold">How:</span> {latestClaim.paymentMethod || entry.paymentMethod || 'Not provided'}</p>
                            <p><span className="font-bold">Reference:</span> {latestClaim.referenceNumber || 'Not provided'}</p>
                            <p><span className="font-bold">Why:</span> {latestClaim.note || 'No note'}</p>
                        </div>
                        {latestClaim.receiptUrl && <p className="mt-2 break-all"><span className="font-bold">Receipt:</span> <a href={latestClaim.receiptUrl} target="_blank" className="underline">{latestClaim.receiptUrl}</a></p>}
                        <FinanceAttachments attachments={latestClaim.attachments} />
                    </div>
                ) : entry.paymentMethod && (
                    <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 text-xs text-warning">
                        <p className="mb-1 font-bold">Legacy Claim Details</p>
                        <p>Method: {entry.paymentMethod}</p>
                        {entry.receiptUrl && <p className="break-all">Receipt/reference: <a href={entry.receiptUrl} target="_blank" className="underline">{entry.receiptUrl}</a></p>}
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
                        disabled={isFullyPaid}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Leave as default to confirm the remaining full amount.</p>
                </div>

                <div className="space-y-2">
                    <Label>Confirmation Attachment</Label>
                    <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        onChange={(event) => setAttachmentFiles(Array.from(event.target.files || []))}
                        disabled={isFullyPaid}
                    />
                    {attachmentFiles.length > 0 && (
                        <p className="text-xs font-semibold text-muted-foreground">
                            {attachmentFiles.map((file) => file.name).join(', ')}
                        </p>
                    )}
                </div>

                {entry.transactions && entry.transactions.length > 0 && (
                    <div className="rounded-lg border border-border p-4">
                        <p className="mb-2 text-xs font-black uppercase text-muted-foreground">Prior confirmed transactions</p>
                        <div className="space-y-2">
                            {entry.transactions.slice(0, 3).map((transaction) => (
                                <div key={transaction.id} className="flex items-center justify-between gap-3 text-xs font-semibold">
                                    <span>{new Date(transaction.createdAt).toLocaleString()} • {transaction.paymentMethod || 'System'}</span>
                                    <FinancialAmount amount={transaction.amount} currency={transaction.currency} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="secondary" onClick={onClose} disabled={isConfirming}>Cancel</Button>
                    <Button type="submit" disabled={isConfirming || isFullyPaid || paidAmount <= 0 || paidAmount > remainingAmount}>
                        {isConfirming ? 'Confirming...' : 'Confirm Payment'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
