import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "جاري التحميل...",
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center",
        className
      )}
    >
      <Loader2 className="w-9 h-9 animate-spin text-forest-700 mb-3" />
      <p className="text-sm font-medium text-stone-600">{message}</p>
    </div>
  );
};
