import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

type CardVariant = "green" | "purple" | "blue" | "amber" | "default";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  /** "green" marks a monetary value (teal per design system); others render neutral */
  variant?: CardVariant;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  className,
  variant = "default",
}: StatsCardProps) {
  // Design system: color only where it carries meaning — teal for money, neutral otherwise
  const isMoney = variant === "green";

  return (
    <div className={cn(
      "bg-card rounded-2xl p-3 md:p-5 border border-border",
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
          <h3 className={cn(
            "text-xl md:text-2xl font-bold mt-1 tracking-tight truncate tabular-nums",
            isMoney ? "text-primary" : "text-foreground"
          )}>{value}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="p-2 md:p-2.5 rounded-xl bg-secondary shrink-0">
          <Icon className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
        </div>
      </div>

      {trend && (
        <div className="mt-2 md:mt-3 flex items-center gap-2 flex-wrap">
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums",
            trend === "up" ? "bg-primary/10 text-primary" :
            trend === "down" ? "bg-destructive/10 text-destructive" :
            "bg-secondary text-muted-foreground"
          )}>
            {trend === "up" ? "+" : trend === "down" ? "-" : ""}{trendValue}
          </span>
          <span className="text-xs text-muted-foreground hidden md:inline">vs last period</span>
        </div>
      )}
    </div>
  );
}
