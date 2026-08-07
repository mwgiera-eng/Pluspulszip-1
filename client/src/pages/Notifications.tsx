import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Plane, Calendar, Flame, Navigation, DollarSign, Clock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface NotificationPrefs {
  airportInfo: boolean;
  events: boolean;
  hotZones: boolean;
  relocate: boolean;
  bestEarnings: boolean;
  frequency: string;
}

const NOTIFICATION_TYPES = [
  {
    key: "airportInfo" as const,
    label: "Airport Flight Waves",
    description: "Alerts when major arrival or departure waves hit Balice Airport",
    icon: Plane,
    color: "text-muted-foreground",
  },
  {
    key: "events" as const,
    label: "Events & Concerts",
    description: "Surge demand when Tauron Arena, ICE Kraków, EXPO are active",
    icon: Calendar,
    color: "text-destructive",
  },
  {
    key: "hotZones" as const,
    label: "Hot Zones",
    description: "Zones hitting high or surge demand — accept every ride",
    icon: Flame,
    color: "text-destructive",
  },
  {
    key: "relocate" as const,
    label: "Relocation Tips",
    description: "Move suggestions to a better-earning zone",
    icon: Navigation,
    color: "text-primary",
  },
  {
    key: "bestEarnings" as const,
    label: "Top Earning Opportunities",
    description: "Highest-priority tips for maximum earnings right now",
    icon: DollarSign,
    color: "text-amber-400",
  },
];

const FREQUENCIES = [
  { value: "realtime", label: "Real-time", description: "Instant alerts" },
  { value: "hourly", label: "Hourly", description: "Digest per hour" },
  { value: "daily", label: "Daily", description: "Morning summary" },
  { value: "off", label: "Off", description: "No notifications" },
];

function getPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return (window as any).Notification.permission as NotificationPermission;
}

async function requestPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return (window as any).Notification.requestPermission() as Promise<NotificationPermission>;
}

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    getPermissionState()
  );
  const [requesting, setRequesting] = useState(false);

  const { data: prefs, isLoading } = useQuery<NotificationPrefs>({
    queryKey: ["/api/notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notification-preferences", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const [localPrefs, setLocalPrefs] = useState<NotificationPrefs>({
    airportInfo: true, events: true, hotZones: true,
    relocate: true, bestEarnings: true, frequency: "hourly",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (prefs) {
      setLocalPrefs(prefs);
      setDirty(false);
    }
  }, [prefs]);

  const mutation = useMutation({
    mutationFn: async (data: NotificationPrefs) => {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
      toast({ title: "Preferences saved" });
      setDirty(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save preferences", variant: "destructive" });
    },
  });

  const handleRequestPermission = async () => {
    setRequesting(true);
    const result = await requestPermission();
    setPermission(result);
    setRequesting(false);
    if (result === "granted") {
      toast({ title: "Notifications enabled", description: "You will now receive alerts from ShiftOptima." });
    } else if (result === "denied") {
      toast({
        title: "Permission denied",
        description: "Enable notifications in your browser settings to receive alerts.",
        variant: "destructive",
      });
    }
  };

  const togglePref = (key: keyof NotificationPrefs) => {
    setLocalPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const setFrequency = (value: string) => {
    setLocalPrefs(prev => ({ ...prev, frequency: value }));
    setDirty(true);
  };

  const isActive = permission === "granted" && localPrefs.frequency !== "off";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-notifications-title">
              Notifications
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">Choose what alerts you receive and how often</p>
          </div>

          {/* Permission Status Card */}
          <Card
            className={cn(
              "border",
              permission === "granted"
                ? "border-primary/30 bg-primary/5"
                : permission === "denied"
                ? "border-destructive/30 bg-destructive/5"
                : "border-amber-500/30 bg-amber-500/5"
            )}
            data-testid="card-permission-status"
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  {permission === "granted" ? (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  ) : permission === "denied" ? (
                    <BellOff className="w-5 h-5 text-destructive shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {permission === "granted"
                        ? isActive ? "Notifications active" : "Notifications granted but turned off"
                        : permission === "denied"
                        ? "Notifications blocked"
                        : permission === "unsupported"
                        ? "Not supported in this browser"
                        : "Notifications not yet enabled"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {permission === "granted"
                        ? isActive
                          ? "You'll receive real-time alerts from ShiftOptima"
                          : "Set frequency to anything other than 'Off' to receive alerts"
                        : permission === "denied"
                        ? "Go to browser Settings > Notifications and allow this site"
                        : permission === "unsupported"
                        ? "Try opening this page in Chrome or Safari"
                        : "Tap the button to allow ShiftOptima to send you alerts"}
                    </p>
                  </div>
                </div>

                {permission === "default" && (
                  <Button
                    onClick={handleRequestPermission}
                    disabled={requesting}
                    size="sm"
                    className="shrink-0"
                    data-testid="button-enable-notifications"
                  >
                    {requesting ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Requesting...</>
                    ) : (
                      <><Bell className="w-3.5 h-3.5 mr-1.5" />Enable Notifications</>
                    )}
                  </Button>
                )}

                {permission === "granted" && (
                  <Badge
                    className="bg-primary/15 text-primary border-0 shrink-0"
                    data-testid="badge-notifications-active"
                  >
                    {isActive ? "Active" : "Paused"}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    Notification Types
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {NOTIFICATION_TYPES.map((type) => (
                    <div
                      key={type.key}
                      className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-secondary/50 transition-colors"
                      data-testid={`row-notification-${type.key}`}
                    >
                      <div className="flex items-center gap-3">
                        <type.icon className={cn("w-5 h-5", type.color)} />
                        <div>
                          <p className="text-sm font-medium">{type.label}</p>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={localPrefs[type.key] as boolean}
                        onCheckedChange={() => togglePref(type.key)}
                        data-testid={`switch-${type.key}`}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    Frequency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {FREQUENCIES.map((freq) => (
                      <button
                        key={freq.value}
                        onClick={() => setFrequency(freq.value)}
                        className={cn(
                          "flex flex-col items-center p-3 rounded-xl border transition-all text-center",
                          localPrefs.frequency === freq.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                        )}
                        data-testid={`button-frequency-${freq.value}`}
                      >
                        <span className="text-sm font-medium">{freq.label}</span>
                        <span className="text-xs mt-0.5 opacity-70">{freq.description}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {dirty && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => mutation.mutate(localPrefs)}
                    disabled={mutation.isPending}
                    className="shadow-none shadow-primary/20"
                    data-testid="button-save-notifications"
                  >
                    {mutation.isPending ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
