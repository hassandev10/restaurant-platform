import React from "react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  amount: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  className,
  size = "md",
  label,
}) => {
  const sizeClasses = {
    sm: "text-sm font-semibold",
    md: "text-base font-bold",
    lg: "text-lg md:text-xl font-bold",
    xl: "text-2xl md:text-3xl font-extrabold tracking-tight",
  };

  return (
    <div className={cn("inline-flex items-baseline gap-1 text-forest-900", className)}>
      {label && <span className="text-xs text-stone-500 font-normal">{label}</span>}
      <span className={cn(sizeClasses[size], "tabular-nums")}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
};
