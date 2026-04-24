import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  stats?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, stats, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {description && (
          <p className="text-text-secondary mt-1">{description}</p>
        )}
      </div>
      {(stats || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {stats}
          {actions}
        </div>
      )}
    </div>
  );
}
