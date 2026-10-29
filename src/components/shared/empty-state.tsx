import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-stone-200 rounded-2xl bg-cream-50/50">
      <div className="w-14 h-14 rounded-2xl bg-cream-200 text-stone-500 flex items-center justify-center mb-4">
        {icon || <FolderOpen className="w-7 h-7" />}
      </div>
      <h3 className="text-stone-800 font-bold font-cairo text-base">{title}</h3>
      <p className="text-stone-500 text-sm mt-1 max-w-sm">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          type="button"
          className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-forest-800 hover:bg-forest-900 rounded-lg shadow-sm transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
