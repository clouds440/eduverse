'use client';

import { MailPage } from '@/components/mail/MailPage';
import { MailCategory } from '@/types';

export default function AdminPublicTicketsPage() {
    return (
        <MailPage
            localStorageKey="edu-admin-public-mail-limit"
            fixedCategory={MailCategory.PUBLIC_CONTACT}
            title="Public Tickets"
        />
    );
}
