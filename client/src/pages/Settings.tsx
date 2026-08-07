import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Bell, Info, Phone, Download, CreditCard, Crown } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { InstallGuideDialog, detectPlatform, getPlatformLabel, isStandalone } from "@/components/InstallPrompt";

export default function Settings() {
  const { user, subscriptionInfo } = useAuth();
  const [, setLocation] = useLocation();
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const platform = detectPlatform(false);
  const alreadyInstalled = isStandalone();

  const handleVersionTap = useCallback(() => {
    tapCountRef.current += 1;

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setLocation("/admin");
      return;
    }

    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);
  }, [setLocation]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight" data-testid="text-settings-title">Settings</h2>
            <p className="text-muted-foreground mt-1">Configure your ShiftOptima experience</p>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="text-sm font-medium" data-testid="text-user-name">{user.firstName} {user.lastName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm font-medium" data-testid="text-user-email">{user.email}</span>
                  </div>
                  {user.phoneNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Phone</span>
                      <span className="text-sm font-medium flex items-center gap-1.5" data-testid="text-user-phone">
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        {user.phoneNumber}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant="secondary" data-testid="badge-account-status">Active</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">Log in to manage your account settings</p>
                  <Button onClick={() => window.location.href = "/api/login"} data-testid="button-settings-login">
                    Log In
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-subscription">
            <CardHeader className="flex flex-row items-center gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {subscriptionInfo?.status === "trial" && "Free Trial"}
                    {subscriptionInfo?.status === "active" && (
                      <><Crown className="w-3.5 h-3.5 text-amber-400" /> Premium Active</>
                    )}
                    {subscriptionInfo?.status === "expired" && "Trial Expired"}
                    {!subscriptionInfo && "Loading..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscriptionInfo?.status === "trial" && `${subscriptionInfo.trialDaysLeft} days remaining`}
                    {subscriptionInfo?.status === "active" && subscriptionInfo.subscriptionExpiresAt && `Renews ${new Date(subscriptionInfo.subscriptionExpiresAt).toLocaleDateString()}`}
                    {subscriptionInfo?.status === "expired" && "Upgrade to unlock all features"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={subscriptionInfo?.status === "expired" ? "default" : "outline"}
                  onClick={() => setLocation("/subscription")}
                  data-testid="button-manage-subscription"
                  className="shrink-0"
                >
                  {subscriptionInfo?.status === "expired" ? "Upgrade" : "Manage"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Region</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Operating City</p>
                  <p className="text-sm text-muted-foreground">Demand data and zones are optimized for this area</p>
                </div>
                <Badge data-testid="badge-region">Krakow, Poland</Badge>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-install-app">
            <CardHeader className="flex flex-row items-center gap-3">
              <Download className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Install App</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Add to Home Screen</p>
                  <p className="text-sm text-muted-foreground">
                    {alreadyInstalled
                      ? "Running as installed app"
                      : `Detected: ${getPlatformLabel(platform)}`}
                  </p>
                </div>
                {alreadyInstalled ? (
                  <Badge className="bg-primary/15 text-primary border-0 shrink-0" data-testid="badge-installed">
                    Already installed
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setInstallGuideOpen(true)}
                    data-testid="button-install-app"
                    className="shrink-0"
                  >
                    Install
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-refresh</p>
                  <p className="text-sm text-muted-foreground">Recommendations update every 30 seconds</p>
                </div>
                <Badge variant="secondary" data-testid="badge-auto-refresh">Enabled</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Info className="w-5 h-5 text-muted-foreground" />
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Version</span>
                  <span
                    className="text-sm font-medium cursor-default select-none"
                    onClick={handleVersionTap}
                    data-testid="text-about-version"
                  >
                    1.4.0
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Designed by</span>
                  <span className="text-sm font-medium" data-testid="text-about-designer">Mateusz Giera</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Developed by</span>
                  <span className="text-sm font-medium" data-testid="text-about-developer">Codeinside</span>
                </div>
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <p className="text-xs text-muted-foreground text-center" data-testid="text-about-license">MIT license | All rights reserved | Codeinside</p>
                  <p className="text-xs text-muted-foreground text-center" data-testid="text-about-disclaimer">Not affiliated with Bolt Technology OÜ, Uber Technologies Inc., or any ride-hailing platform.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <InstallGuideDialog
        open={installGuideOpen}
        onClose={() => setInstallGuideOpen(false)}
        platform={platform}
      />
    </div>
  );
}
