import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "حدث خطأ ما",
  message,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-red-50/70 border border-red-200/80 my-6",
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-red-900 mb-1">{title}</h3>
      <p className="text-sm text-red-700 max-w-sm mb-4 leading-relaxed">
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
