import { DashboardInsights } from '@/types';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { Loading } from '@/components/ui/Loading';

export default function Overview({
    insights,
}: {
    insights: DashboardInsights | null;
}) {
    if (!insights) {
        return <Loading size="lg" />;
    }
    return <InsightsOverview insights={insights} />;
}
