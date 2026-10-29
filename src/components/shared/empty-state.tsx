import React from "react";
import { LucideIcon, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = UtensilsCrossed,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-cream-50/60 border border-cream-200/80 my-4",
        className
      )}
    >
      <div className="w-14 h-14 rounded-full bg-forest-50 border border-forest-100 flex items-center justify-center text-forest-700 mb-4 shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-bold text-stone-800 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-stone-500 max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
