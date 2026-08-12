import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Loader2, Crown, Lock } from "lucide-react";
import { Link, useLocation } from "wouter";

import Dashboard from "@/pages/Dashboard";
import Earnings from "@/pages/Earnings";
import MapPage from "@/pages/MapPage";
import Settings from "@/pages/Settings";
import Subscription from "@/pages/Subscription";
import Login, { Register } from "@/pages/Login";
import NotFound from "@/pages/not-found";
import Notifications from "@/pages/Notifications";
import Admin from "@/pages/Admin";
import DayPlanner from "@/pages/DayPlanner";
import Pending from "@/pages/Pending";
import AccountTypeSetup from "@/pages/AccountTypeSetup";

function PublicBanner() {
  return (
    <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap" data-testid="banner-public">
      <p className="text-xs text-primary font-medium">
        Viewing ShiftOptima in read-only mode — live map and zone data available.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/login">
          <button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md font-semibold hover:bg-primary/90 transition-colors" data-testid="button-banner-signin">
            Register / Sign In
          </button>
        </Link>
      </div>
    </div>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (user && (user.status === "approved" || user.status == null)) {
    return <Component />;
  }

  return <Component isPublic={!user} publicBanner={<PublicBanner />} />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, isLoading } = useAuth();
  const isFullyAuthenticated = !!(user && user.status === "approved");
  useHeartbeat(isFullyAuthenticated);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!user.accountType) {
    return <AccountTypeSetup />;
  }

  if (user.status === "pending") {
    return <Pending />;
  }

  if (user.status === "rejected") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6" data-testid="page-rejected">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-4xl">&#x26D4;</div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground text-sm">Your registration was not approved. Contact the administrator if you believe this is an error.</p>
          <button onClick={() => window.location.href = "/api/logout"} className="text-xs text-muted-foreground underline mt-4">Sign out</button>
        </div>
      </div>
    );
  }

  return <Component />;
}

function AdminRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Login />;
  if (user.role !== "admin") return <div className="flex h-screen items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold">Unauthorized</h1><p className="text-muted-foreground">Administrator access is required.</p></div></div>;
  return <Admin />;
}

function PremiumGate() {
  const { subscriptionInfo } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6" data-testid="premium-gate">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Premium Feature</h1>
        <p className="text-muted-foreground text-sm">
          {subscriptionInfo?.status === "expired"
            ? "Your free trial has ended. Subscribe to unlock all premium features."
            : "This feature requires a premium subscription."}
        </p>
        <button
          onClick={() => setLocation("/subscription")}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          data-testid="button-upgrade"
        >
          <Crown className="w-4 h-4" />
          Upgrade to Premium - 9.99 PLN/month
        </button>
      </div>
    </div>
  );
}

function PremiumRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isPremium } = useAuth();

  return (
    <ProtectedRoute component={isPremium ? Component : () => <PremiumGate />} />
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login">{() => <Login />}</Route>
      <Route path="/register">{() => <Register />}</Route>

      <Route path="/">
        <PublicRoute component={Dashboard} />
      </Route>
      <Route path="/map">
        <PublicRoute component={MapPage} />
      </Route>

      <Route path="/planner">
        <PremiumRoute component={DayPlanner} />
      </Route>
      <Route path="/earnings">
        <PremiumRoute component={Earnings} />
      </Route>
      <Route path="/notifications">
        <PremiumRoute component={Notifications} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/subscription">
        <ProtectedRoute component={Subscription} />
      </Route>
      <Route path="/admin" component={AdminRoute} />

      <Route component={NotFound} />
    </Switch>
  );
}

function NotificationRunner() {
  usePushNotifications();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <BottomNav />
        <InstallPrompt />
        <NotificationRunner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
