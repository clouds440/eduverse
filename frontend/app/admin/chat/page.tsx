import { Metadata } from 'next';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { PageShell, ResourcePanel } from '@/components/ui/PageShell';

export const metadata: Metadata = {
    title: 'Platform Chat | EduVerse',
    description: 'Internal real-time communication platform for admins',
};

export default function AdminChatPage() {
    return (
        <PageShell>
            <ResourcePanel className="overflow-hidden">
                <ChatLayout />
            </ResourcePanel>
        </PageShell>
    );
}
