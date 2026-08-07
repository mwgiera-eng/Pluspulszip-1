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
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, { card: string; icon: string; iconText: string; value: string }> = {
  green: {
    card: "bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-transparent border-emerald-500/25 shadow-emerald-500/10",
    icon: "bg-emerald-500/20 border border-emerald-500/20",
    iconText: "text-emerald-400",
    value: "text-emerald-50",
  },
  purple: {
    card: "bg-gradient-to-br from-violet-500/20 via-violet-600/10 to-transparent border-violet-500/25 shadow-violet-500/10",
    icon: "bg-violet-500/20 border border-violet-500/20",
    iconText: "text-violet-400",
    value: "text-violet-50",
  },
  blue: {
    card: "bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-transparent border-blue-500/25 shadow-blue-500/10",
    icon: "bg-blue-500/20 border border-blue-500/20",
    iconText: "text-blue-400",
    value: "text-blue-50",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border-amber-500/25 shadow-amber-500/10",
    icon: "bg-amber-500/20 border border-amber-500/20",
    iconText: "text-amber-400",
    value: "text-amber-50",
  },
  default: {
    card: "bg-card border-border/50 shadow-black/5",
    icon: "bg-secondary",
    iconText: "text-primary",
    value: "text-foreground",
  },
};

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
  const styles = variantStyles[variant];

  return (
    <div className={cn(
      "rounded-2xl p-3 md:p-5 border shadow-lg",
      styles.card,
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <h3 className={cn(
            "text-xl md:text-2xl font-bold mt-1 tracking-tight truncate",
            styles.value
          )}>{value}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className={cn("p-2 md:p-2.5 rounded-xl shrink-0", styles.icon)}>
          <Icon className={cn("w-4 h-4 md:w-5 md:h-5", styles.iconText)} />
        </div>
      </div>

      {trend && (
        <div className="mt-2 md:mt-3 flex items-center gap-2 flex-wrap">
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            trend === "up" ? "bg-emerald-500/15 text-emerald-400" :
            trend === "down" ? "bg-red-500/15 text-red-400" :
            "bg-white/5 text-muted-foreground"
          )}>
            {trend === "up" ? "+" : trend === "down" ? "-" : ""}{trendValue}
          </span>
          <span className="text-xs text-muted-foreground hidden md:inline">vs last period</span>
        </div>
      )}
    </div>
  );
}
