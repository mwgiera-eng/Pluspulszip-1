import { Link, useLocation } from "wouter";
import { LayoutDashboard, Map as MapIcon, Wallet, Settings, LogOut, Menu, Bell, Calendar, CreditCard, Crown, Lock, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Day Planner", icon: Calendar, href: "/planner" },
  { label: "Live Map", icon: MapIcon, href: "/map" },
  { label: "Earnings", icon: Wallet, href: "/earnings" },
  { label: "Notifications", icon: Bell, href: "/notifications" },
  { label: "Subscription", icon: CreditCard, href: "/subscription" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

const PREMIUM_PATHS = ["/planner", "/earnings", "/notifications"];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user, subscriptionInfo, isPremium } = useAuth();
  const [open, setOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border/10">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-400">
          +Puls
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Driver Intelligence</p>
        {subscriptionInfo && !isPremium && subscriptionInfo.status === "trial" && subscriptionInfo.trialDaysLeft !== null && (
          <Badge variant="outline" className="mt-2 text-xs border-amber-500/30 text-amber-400" data-testid="badge-trial">
            <Clock className="w-3 h-3 mr-1" /> Trial: {subscriptionInfo.trialDaysLeft}d left
          </Badge>
        )}
        {isPremium && subscriptionInfo?.status === "active" && (
          <Badge variant="outline" className="mt-2 text-xs border-primary/30 text-primary" data-testid="badge-premium">
            <Crown className="w-3 h-3 mr-1" /> Premium
          </Badge>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          const isLocked = !isPremium && PREMIUM_PATHS.includes(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  isLocked && "opacity-60"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "animate-pulse" : "group-hover:scale-110 transition-transform")} />
                <span className="font-medium flex-1">{item.label}</span>
                {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/10">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border">
                <span className="font-mono text-xs font-bold">{user?.firstName?.[0] || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 border-destructive/20 text-destructive"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </>
        ) : (
          <Button 
            variant="default" 
            className="w-full justify-start gap-2"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login"
          >
            Log In
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Tablet Trigger (shown between md and lg — mobile uses BottomNav instead) */}
      <div className="hidden md:flex lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="secondary" className="rounded-full shadow-lg border border-border">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 bg-card border-r-border">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 flex-col bg-card border-r border-border h-screen sticky top-0">
        <NavContent />
      </div>
    </>
  );
}
