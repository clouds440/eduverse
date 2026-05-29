import { Metadata } from 'next';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { RouteBreadcrumbs } from '@/components/ui/PageShell';

export const metadata: Metadata = {
    title: 'Chat | EduVerse',
    description: 'Internal real-time communication platform',
};

export default function ChatPage() {
    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col gap-2 overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
                <ChatLayout />
            </div>
        </div>
    );
}
