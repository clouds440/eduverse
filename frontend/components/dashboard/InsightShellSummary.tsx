'use client';

import type { DashboardInsights } from '@/types';

export default function InsightShellSummary({ insights }: { insights: DashboardInsights }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">{insights.headline.eyebrow}</p>
          <h1 className="mt-2 text-2xl font-black text-foreground">{insights.headline.title}</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold text-muted-foreground">{insights.headline.subtitle}</p>
        </div>
        {insights.spotlight && (
          <a href={insights.spotlight.href || '#'} className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm font-bold text-foreground transition hover:border-primary/45">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Spotlight</span>
            <span className="mt-1 block">{insights.spotlight.title}</span>
            {insights.spotlight.meta && <span className="mt-1 block text-xs text-muted-foreground">{insights.spotlight.meta}</span>}
          </a>
        )}
      </div>
      {insights.summaryCards.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {insights.summaryCards.map((card) => (
            <a key={card.id} href={card.href || '#'} className="rounded-lg border border-border/70 bg-background/70 p-3 transition hover:border-primary/35">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-foreground">{card.value}</p>
              {card.detail && <p className="mt-1 text-xs font-semibold text-muted-foreground">{card.detail}</p>}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
