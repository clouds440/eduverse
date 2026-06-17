import { Metadata } from 'next';
import { ChatLayout } from '@/components/chat/ChatLayout';

export const metadata: Metadata = {
    title: 'Platform Chat | EduVerse',
    description: 'Internal real-time communication platform for admins',
};

export default function AdminChatPage() {
    return (
        <div className="h-full min-h-0 overflow-hidden">
            <ChatLayout />
        </div>
    );
}
