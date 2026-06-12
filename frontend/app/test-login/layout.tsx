import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Test Login',
    robots: {
        index: false,
        follow: false,
    },
};

export default function TestLoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
