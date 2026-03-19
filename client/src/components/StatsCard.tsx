import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  trendValue,
  className 
}: StatsCardProps) {
  return (
    <div className={cn(
      "bg-card rounded-xl p-3 md:p-5 border border-border/50 shadow-lg shadow-black/5",
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <h3 className="text-lg md:text-2xl font-bold mt-1 text-foreground tracking-tight truncate">{value}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="p-2 md:p-3 bg-secondary rounded-lg md:rounded-xl shrink-0">
          <Icon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        </div>
      </div>
      
      {trend && (
        <div className="mt-2 md:mt-4 flex items-center gap-2 flex-wrap">
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            trend === 'up' ? "bg-emerald-500/10 text-emerald-500" : 
            trend === 'down' ? "bg-red-500/10 text-red-500" : 
            "bg-gray-500/10 text-gray-400"
          )}>
            {trend === 'up' ? '+' : trend === 'down' ? '-' : ''} {trendValue}
          </span>
          <span className="text-xs text-muted-foreground hidden md:inline">vs last period</span>
        </div>
      )}
    </div>
  );
}
