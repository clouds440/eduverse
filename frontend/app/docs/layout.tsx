// app/docs/layout.tsx
import Link from 'next/link';
import {
  Book,
  Settings,
  MessageSquare,
  GraduationCap,
  Users,
  HelpCircle
} from 'lucide-react';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sections = [
    {
      title: 'Getting Started',
      icon: <Book className="w-4 h-4" />,
      links: [
        { name: 'Introduction', href: '/docs#intro' },
        { name: 'Account Setup', href: '/docs#setup' },
        { name: 'Dashboard Overview', href: '/docs#overview' },
      ]
    },
    {
      title: 'Organization',
      icon: <Settings className="w-4 h-4" />,
      links: [
        { name: 'Org Creation', href: '/docs#org-creation' },
        { name: 'Role Management', href: '/docs#roles' },
        { name: 'Branding', href: '/docs#branding' },
      ]
    },
    {
      title: 'Communication',
      icon: <MessageSquare className="w-4 h-4" />,
      links: [
        { name: 'Direct Messaging', href: '/docs#chat' },
        { name: 'School Announcements', href: '/docs#announcements' },
      ]
    },
    {
      title: 'Academic',
      icon: <GraduationCap className="w-4 h-4" />,
      links: [
        { name: 'Creating Assessments', href: '/docs#assessments' },
        { name: 'Grading System', href: '/docs#grading' },
        { name: 'Timetables', href: '/docs#timetables' },
      ]
    },
    {
      title: 'User Portals',
      icon: <Users className="w-4 h-4" />,
      links: [
        { name: 'Teacher Portal', href: '/docs#teachers' },
        { name: 'Student Portal', href: '/docs#students' },
        { name: 'Parent Portal', href: '/docs#parents' },
      ]
    },
    {
      title: 'Support',
      icon: <HelpCircle className="w-4 h-4" />,
      links: [
        { name: 'FAQ', href: '/docs#faq' },
        { name: 'Troubleshooting', href: '/docs#troubleshoot' },
      ]
    }
  ];

  return (
    <div className="flex min-h-full bg-background">
      {/* Docs Sidebar */}
      <aside className="w-72 hidden lg:block border-r border-border sticky top-16 h-full overflow-y-auto py-8 px-6">
        <nav className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h4 className="flex items-center text-xs font-bold text-muted-foreground tracking-wider">
                <span className="mr-2 opacity-70">{section.icon}</span>
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 px-2 py-1.5 rounded-lg block transition-all"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
