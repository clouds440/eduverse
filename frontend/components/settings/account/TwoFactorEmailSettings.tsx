'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Mail, MonitorCheck, Send, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
    E2EEDeviceTrustStatus,
    TwoFactorMethod,
    type ContactEmailStatus,
    type LinkedAccount,
    type TrustedEncryptionDevice,
    type TwoFactorLoginMethod,
} from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsSection } from '../SettingsSection';
import { Toggle } from '@/components/ui/Toggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useUserSettings } from '@/context/UserSettingsContext';
import { useContactEmailChangeConfirmation } from '@/hooks/useContactEmailChangeConfirmation';
import { ContactEmailChangeDialog } from '../ContactEmailChangeDialog';

export interface TwoFactorEmailSettingsProps {
    googleAccount?: LinkedAccount | null;
}

export function TwoFactorEmailSettings({
    googleAccount,
}: TwoFactorEmailSettingsProps = {}) {
    const { token } = useAuth();
    const { settings, update: updateSettings } = useUserSettings();
    const [status, setStatus] = useState<ContactEmailStatus | null>(null);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState<'save' | 'send' | 'verify' | 'google' | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [trustedDevices, setTrustedDevices] = useState<TrustedEncryptionDevice[]>([]);
    const [pendingToggle, setPendingToggle] = useState<TwoFactorLoginMethod | null>(null);
    const [linkedGoogle, setLinkedGoogle] = useState<LinkedAccount | null>(googleAccount ?? null);
    const emailChangeConfirmation = useContactEmailChangeConfirmation(token);

    useEffect(() => {
        if (!token) return;
        Promise.all([
            api.auth.getContactEmail(token),
            api.e2ee.getMyDevices(token),
            Promise.resolve(googleAccount ? [googleAccount] : []),
        ])
            .then(([next, devices, linkedAccounts]) => {
                setStatus(next);
                setEmail(next.contactEmail || '');
                setTrustedDevices(devices.devices.filter((device) => device.trustStatus === E2EEDeviceTrustStatus.TRUSTED && !device.revokedAt));
                setLinkedGoogle(linkedAccounts.find((account) => account.provider === 'google') || null);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load contact email.'))
            .finally(() => setLoading(false));
    }, [googleAccount, token]);

    const run = async (kind: 'save' | 'send' | 'verify') => {
        if (!token) return;
        setAction(kind);
        setError(null);
        setMessage(null);
        try {
            if (kind === 'save') {
                const next = await api.auth.updateContactEmail(email, token);
                setStatus(next);
                setMessage('Verification code sent to your contact email.');
            } else if (kind === 'send') {
                const result = await api.auth.resendContactEmailVerification(token);
                setMessage(result.message);
            } else {
                const result = await api.auth.verifyContactEmail(code, token);
                const next = await api.auth.getContactEmail(token);
                setStatus(next);
                setCode('');
                setMessage(result.message);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update contact email.');
        } finally {
            setAction(null);
        }
    };

    const verified = Boolean(status?.contactEmailVerifiedAt);
    const emailChangeAuthorized = Boolean(
        !verified ||
        (status?.changeAuthorizedUntil &&
            new Date(status.changeAuthorizedUntil) > new Date()),
    );
    const emailChanged = email.trim().toLowerCase() !== (status?.contactEmail || '').toLowerCase();
    const emailEnabled = settings?.emailTwoFactorEnabled || false;
    const deviceEnabled = settings?.deviceTwoFactorEnabled || false;
    const hasTrustedDevice = trustedDevices.length > 0;
    const enabledCount = Number(emailEnabled) + Number(deviceEnabled);
    const pendingMethodIsEnabled = pendingToggle === TwoFactorMethod.EMAIL ? emailEnabled : deviceEnabled;
    const toggleConfirmationDescription = pendingToggle === TwoFactorMethod.EMAIL
        ? pendingMethodIsEnabled
            ? `Email codes will no longer be accepted during sign-in.${deviceEnabled ? ' You can still approve sign-ins from a trusted browser.' : ' This will turn off your only extra sign-in check.'}`
            : `After password sign-in, a code will be sent to ${status?.contactEmail || 'your verified contact email'}. Keep access to this inbox${deviceEnabled ? '.' : ' or you could be locked out of your account.'}`
        : pendingToggle === TwoFactorMethod.DEVICE
            ? pendingMethodIsEnabled
                ? `Trusted browsers will no longer be able to approve new sign-ins.${emailEnabled ? ' You can still sign in with a code sent to your contact email.' : ' This will turn off your only extra sign-in check.'}`
                : `The trusted browsers listed here will be able to approve new sign-ins. If you lose access to all of them${emailEnabled ? ', use your email code instead.' : ', you could be locked out of your account.'}`
            : '';

    const toggleMethod = async (method: TwoFactorLoginMethod) => {
        if (!token) return;
        const key = method === TwoFactorMethod.EMAIL ? 'emailTwoFactorEnabled' : 'deviceTwoFactorEnabled';
        const enabling = !settings[key];
        setAction('save');
        setError(null);
        try {
            await updateSettings({ [key]: enabling });
            setMessage(`${method === TwoFactorMethod.EMAIL ? 'Email' : 'Trusted browser'} verification ${enabling ? 'enabled' : 'disabled'}.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update two-factor authentication.');
        } finally {
            setAction(null);
            setPendingToggle(null);
        }
    };

    const applyLinkedGoogleEmail = async () => {
        if (!token) return;
        setAction('google');
        setError(null);
        try {
            const next = await api.auth.useLinkedGoogleContactEmail(token);
            setStatus(next);
            setEmail(next.contactEmail || '');
            if (settings?.emailTwoFactorEnabled) {
                setMessage('Your linked Google email is now used for email sign-in verification.');
            } else {
                setMessage('Your linked Google email is ready for sign-in verification.');
                setPendingToggle(TwoFactorMethod.EMAIL);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to use the linked Google email.');
        } finally {
            setAction(null);
        }
    };

    const handleUseGoogleEmail = async () => {
        if (verified && !emailChangeAuthorized) {
            try {
                await emailChangeConfirmation.request(async (authorizedUntil) => {
                    setStatus((current) => current
                        ? { ...current, changeAuthorizedUntil: authorizedUntil }
                        : current);
                    await applyLinkedGoogleEmail();
                });
            } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : 'Unable to confirm your current email.');
            }
            return;
        }
        await applyLinkedGoogleEmail();
    };

    const unlockEmailChange = async () => {
        await emailChangeConfirmation.request((authorizedUntil) => {
            setStatus((current) => current
                ? { ...current, changeAuthorizedUntil: authorizedUntil }
                : current);
        });
    };

    return (
        <SettingsSection
            icon={ShieldCheck}
            id="two-factor-email"
            title="Two-step verification"
            description="Require an extra check after password sign-in. You can keep one or both options enabled."
            action={enabledCount > 0
                ? <Badge variant="success" size="md" icon={ShieldCheck}>{enabledCount} enabled</Badge>
                : <Badge variant="secondary" size="md">Off</Badge>}
        >
            <div className="space-y-4">
                <div className={`rounded-lg border px-4 py-3 ${enabledCount > 0 ? 'border-success/25 bg-success/5' : 'border-warning/25 bg-warning/5'}`}>
                    <p className="text-sm font-black text-foreground">
                        {enabledCount > 0 ? 'Your account has an extra sign-in check' : 'Extra sign-in protection is off'}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
                        {enabledCount > 0
                            ? 'Password sign-ins must complete one of your enabled options. Google sign-in is already verified by Google.'
                            : 'Enable an option below. Keep access to at least one enabled option to avoid being locked out.'}
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className={`rounded-xl border p-4 ${emailEnabled ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-background/55'}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Mail className="h-5 w-5" /></div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm font-black text-foreground">Email code</h3>
                                        <Badge variant={verified ? 'success' : 'warning'} size="sm">
                                            {verified ? 'Ready' : 'Setup needed'}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
                                        Receive a six-digit code at your verified contact email.
                                    </p>
                                </div>
                            </div>
                            <Toggle
                                checked={emailEnabled}
                                onCheckedChange={() => setPendingToggle(TwoFactorMethod.EMAIL)}
                                disabled={loading || !verified}
                                label={emailEnabled ? 'On' : 'Off'}
                                size="sm"
                            />
                        </div>
                        <div className="mt-4 rounded-lg border border-border/60 bg-card/70 px-3 py-2.5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Verification email</p>
                            <p className="mt-1 truncate text-sm font-bold text-foreground">{status?.contactEmail || 'Not added'}</p>
                        </div>
                        <details className="group mt-3 rounded-lg border border-border/70 bg-card/55" open={!verified}>
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
                                <p className="text-xs font-black text-foreground">{verified ? 'Change verification email' : 'Set up verification email'}</p>
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="space-y-3 border-t border-border/60 p-3">
                                <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
                                    {status?.managedByOrganization
                                        ? 'This is your organization contact email. Change it from the organization Profile tab.'
                                        : 'This address receives your sign-in codes and can differ from your login email.'}
                                </p>
                                <div className="space-y-2">
                                    <label htmlFor="two-factor-contact-email" className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">Contact email</label>
                                    <Input id="two-factor-contact-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="security@example.com" disabled={loading || Boolean(status?.managedByOrganization) || !emailChangeAuthorized} />
                                    {!status?.managedByOrganization && (
                                        verified && !emailChangeAuthorized ? (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => void unlockEmailChange().catch((requestError) => {
                                                    setError(requestError instanceof Error ? requestError.message : 'Unable to confirm your current email.');
                                                })}
                                                loadingId={emailChangeConfirmation.isRequesting ? 'request-contact-email-change' : undefined}
                                                className="w-full"
                                            >
                                                Change contact email
                                            </Button>
                                        ) : (
                                            <Button type="button" onClick={() => void run('save')} disabled={!email.trim() || (!emailChanged && Boolean(status?.contactEmail))} loadingId={action === 'save' ? 'contact-email-save' : undefined} className="w-full">
                                                {status?.contactEmail ? 'Update email' : 'Add email'}
                                            </Button>
                                        )
                                    )}
                                </div>

                                {linkedGoogle?.email && linkedGoogle.email.toLowerCase() !== (status?.contactEmail || '').toLowerCase() && (
                                    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                                        <p className="text-xs font-black text-foreground">Use linked Google email</p>
                                        <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{linkedGoogle.email}</p>
                                        <Button type="button" variant="secondary" onClick={() => void handleUseGoogleEmail()} disabled={Boolean(action)} className="mt-2 w-full">Use this email</Button>
                                    </div>
                                )}

                                {status?.contactEmail && !verified && !emailChanged && (
                                    <div className="space-y-2 rounded-lg border border-warning/25 bg-warning/5 p-3">
                                        <p className="text-xs font-bold text-foreground">Enter the code sent to your email</p>
                                        <Input aria-label="Contact email verification code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="6-digit code" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button type="button" onClick={() => void run('verify')} disabled={code.length !== 6} loadingId={action === 'verify' ? 'contact-email-verify' : undefined}>Verify</Button>
                                            <Button type="button" variant="secondary" icon={Send} onClick={() => void run('send')} loadingId={action === 'send' ? 'contact-email-send' : undefined}>Resend</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </details>
                    </div>

                    <div className={`rounded-xl border p-4 ${deviceEnabled ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-background/55'}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="rounded-lg bg-primary/10 p-2 text-primary"><MonitorCheck className="h-5 w-5" /></div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm font-black text-foreground">Trusted browser</h3>
                                        <Badge variant={hasTrustedDevice ? 'success' : 'warning'} size="sm">
                                            {hasTrustedDevice ? 'Ready' : 'Setup needed'}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
                                        Approve a new sign-in from a browser you already trust.
                                    </p>
                                </div>
                            </div>
                            <Toggle
                                checked={deviceEnabled}
                                onCheckedChange={() => setPendingToggle(TwoFactorMethod.DEVICE)}
                                disabled={loading || !hasTrustedDevice}
                                label={deviceEnabled ? 'On' : 'Off'}
                                size="sm"
                            />
                        </div>
                        <div className="mt-4 rounded-lg border border-border/60 bg-card/70 px-3 py-2.5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                {hasTrustedDevice ? 'Browsers used for verification' : 'No trusted browsers'}
                            </p>
                            {hasTrustedDevice ? (
                                <ul className="mt-2 space-y-2">
                                    {trustedDevices.map((device) => (
                                        <li key={device.id} className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
                                            <MonitorCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                                            <span className="truncate">{device.displayName || device.browser || 'Trusted browser'}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">Trust a browser in Devices &amp; sessions below first.</p>
                            )}
                        </div>
                    </div>
                </div>

                {message && <p className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-xs font-bold text-success">{message}</p>}
                {error && <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs font-bold text-danger">{error}</p>}
            </div>
            <ConfirmDialog
                isOpen={Boolean(pendingToggle)}
                onClose={() => setPendingToggle(null)}
                onConfirm={() => pendingToggle && toggleMethod(pendingToggle)}
                title={`${pendingToggle && settings?.[pendingToggle === TwoFactorMethod.EMAIL ? 'emailTwoFactorEnabled' : 'deviceTwoFactorEnabled'] ? 'Disable' : 'Enable'} ${pendingToggle === TwoFactorMethod.EMAIL ? 'email' : 'trusted-browser'} verification?`}
                description={toggleConfirmationDescription}
                confirmText={pendingToggle && settings?.[pendingToggle === TwoFactorMethod.EMAIL ? 'emailTwoFactorEnabled' : 'deviceTwoFactorEnabled'] ? 'Disable' : 'Enable'}
                isDestructive={Boolean(pendingToggle && settings?.[pendingToggle === TwoFactorMethod.EMAIL ? 'emailTwoFactorEnabled' : 'deviceTwoFactorEnabled'])}
                loadingId="two-factor-toggle"
            />
            <ContactEmailChangeDialog
                isOpen={emailChangeConfirmation.isOpen}
                currentEmail={status?.contactEmail || 'your current contact email'}
                code={emailChangeConfirmation.code}
                error={emailChangeConfirmation.error}
                isConfirming={emailChangeConfirmation.isConfirming}
                onCodeChange={emailChangeConfirmation.setCode}
                onConfirm={emailChangeConfirmation.confirm}
                onClose={emailChangeConfirmation.close}
            />
        </SettingsSection>
    );
}
