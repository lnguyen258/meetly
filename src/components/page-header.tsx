import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <header className="mb-4">
      {breadcrumb && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-xs text-muted">
          {breadcrumb.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              {b.href ? (
                <Link href={b.href} className="link">
                  {b.label}
                </Link>
              ) : (
                b.label
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-brand/15 text-brand">
        <Icon className="size-5" />
      </span>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
