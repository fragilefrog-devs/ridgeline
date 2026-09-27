import React from 'react';
import { LucideIcon } from 'lucide-react';
import { AIIcon } from './AIIcon';

interface EmptyStateProps {
  icon: LucideIcon | typeof AIIcon;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon | typeof AIIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon | typeof AIIcon;
  };
  tip?: string;
  badge?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tip,
  badge,
}) => {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white/80 p-8 sm:p-12 text-center shadow-xs">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 border border-neutral-200 shadow-2xs">
        <Icon className="h-7 w-7 text-neutral-700" />
      </div>

      {badge && (
        <span className="inline-block mt-4 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-200">
          {badge}
        </span>
      )}

      <h3 className="mt-3 text-sm sm:text-base font-bold text-neutral-900">
        {title}
      </h3>

      <p className="mt-1.5 max-w-md mx-auto text-xs text-neutral-500 leading-relaxed">
        {description}
      </p>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
          >
            {primaryAction.icon && <primaryAction.icon className="h-3.5 w-3.5" />}
            <span>{primaryAction.label}</span>
          </button>
        )}

        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition-colors shadow-2xs cursor-pointer"
          >
            {secondaryAction.icon && <secondaryAction.icon className="h-3.5 w-3.5" />}
            <span>{secondaryAction.label}</span>
          </button>
        )}
      </div>

      {/* Optional Pro-Tip */}
      {tip && (
        <div className="mt-6 pt-4 border-t border-neutral-100 max-w-sm mx-auto">
          <p className="text-[11px] text-neutral-400">
            <span className="font-semibold text-neutral-600">How it works: </span>
            {tip}
          </p>
        </div>
      )}
    </div>
  );
};
