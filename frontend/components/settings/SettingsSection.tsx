import { isValidElement, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function renderSectionIcon(
  icon: ElementType<{ className?: string }> | ReactNode,
  className: string,
) {
  if (isValidElement(icon)) return icon;

  if (
    typeof icon === "function" ||
    (typeof icon === "object" && icon !== null && "$$typeof" in icon)
  ) {
    const Icon = icon as ElementType<{ className?: string }>;
    return <Icon className={className} aria-hidden="true" />;
  }

  return icon;
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  action,
  className,
  contentClassName,
  id,
}: {
  icon: React.ElementType<{ className?: string }> | ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border/60 bg-background/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-primary">
            {renderSectionIcon(Icon, "h-4 w-4")}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-foreground sm:text-base">
              {title}
            </h2>
            {description && (
              <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && (
          <div className="flex shrink-0 justify-start sm:justify-end">
            {action}
          </div>
        )}
      </div>
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </section>
  );
}
