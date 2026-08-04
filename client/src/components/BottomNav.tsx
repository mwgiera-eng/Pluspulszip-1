import { useLocation } from "wouter";
import { LayoutDashboard, Map as MapIcon, Wallet, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeLink } from "@/lib/SafeLink";

const BOTTOM_NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Map", icon: MapIcon, href: "/map" },
  { label: "Earnings", icon: Wallet, href: "/earnings" },
  { label: "Planner", icon: Calendar, href: "/planner" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden bg-card border-t border-border/50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="bottom-nav"
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const isActive = location === item.href;
        return (
          <SafeLink key={item.href} href={item.href} className="flex-1">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`tab-${item.label.toLowerCase()}`}
            >
              <item.icon
                className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")}
              />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </div>
          </SafeLink>
        );
      })}
    </nav>
  );
}
