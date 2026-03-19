import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Users, ShieldAlert, BarChart3, Loader2, Clock, CheckCircle, XCircle, UserCheck, Car, Building2, Radio, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/models/auth";

type ActiveUser = User & { nearestZone: string | null };

function minutesAgo(ts: string | Date | null | undefined): number {
  if (!ts) return Infinity;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

function StatusDot({ minsAgo }: { minsAgo: number }) {
  if (minsAgo < 5) return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_theme(colors.emerald.400)]" data-testid="dot-online" />;
  if (minsAgo < 15) return <span className="inline-block w-2 h-2 rounded-full bg-amber-400" data-testid="dot-idle" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40" data-testid="dot-away" />;
}

function ActiveUsersPanel() {
  const { data: active, isLoading } = useQuery<ActiveUser[]>({
    queryKey: ["/api/admin/active-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/active-users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
    retry: false,
  });

  const onlineCount = active?.filter(u => minutesAgo(u.lastSeenAt) < 5).length ?? 0;

  return (
    <Card data-testid="card-active-users">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-emerald-400" />
          Active Users
          {!isLoading && (
            <Badge
              variant="secondary"
              className={`ml-1 text-xs ${onlineCount > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}
              data-testid="badge-online-count"
            >
              {onlineCount} online now
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !active || active.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground" data-testid="text-no-active">
            <Radio className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm">No users currently active</p>
            <p className="text-xs text-muted-foreground/60">Activity within the last 30 minutes will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((u) => {
              const mins = minutesAgo(u.lastSeenAt);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border border-border/50"
                  data-testid={`row-active-user-${u.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusDot minsAgo={mins} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate" data-testid={`text-active-name-${u.id}`}>
                          {u.firstName} {u.lastName}
                        </span>
                        <AccountTypeBadge accountType={u.accountType} companyName={u.companyName} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {u.nearestZone ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {u.nearestZone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">No GPS</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {mins < 1 ? "just now" : `${mins}m ago`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountTypeBadge({ accountType, companyName }: { accountType: string | null | undefined; companyName?: string | null }) {
  if (!accountType) return null;
  if (accountType === "provider") {
    return (
      <span className="inline-flex items-center gap-1">
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-violet-500/10 text-violet-400 border-violet-500/20">
          <Building2 className="w-2.5 h-2.5 mr-0.5" />Fleet
        </Badge>
        {companyName && <span className="text-[10px] text-muted-foreground">{companyName}</span>}
      </span>
    );
  }
  return (
    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
      <Car className="w-2.5 h-2.5 mr-0.5" />Driver
    </Badge>
  );
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.length <= 4) return "***" + phone;
  return phone.slice(0, -4).replace(/\d/g, "*") + phone.slice(-4);
}

function PendingUsersPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pending, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users/pending"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users/pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/admin/users/${userId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "User approved", description: "They can now access ShiftOptima." });
    },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/admin/users/${userId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User rejected", description: "Their access has been denied." });
    },
    onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
  });

  const pendingCount = pending?.length ?? 0;

  return (
    <Card data-testid="card-pending-registrations">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-amber-400" />
          Pending Registrations
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-400 text-xs ml-1">
              {pendingCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : pendingCount === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
            <CheckCircle className="w-8 h-8 text-emerald-400/50" />
            <p className="text-sm">No pending registrations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending!.map((u) => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border border-border/50" data-testid={`card-pending-user-${u.id}`}>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate" data-testid={`text-pending-name-${u.id}`}>
                      {u.firstName} {u.lastName}
                    </p>
                    <AccountTypeBadge accountType={(u as any).accountType} companyName={(u as any).companyName} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{maskPhone(u.phoneNumber)}</span>
                    {u.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => approveMutation.mutate(u.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    data-testid={`button-approve-${u.id}`}
                  >
                    {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => rejectMutation.mutate(u.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    data-testid={`button-reject-${u.id}`}
                  >
                    {rejectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { user } = useAuth();

  const { data: stats } = useQuery<{ userCount: number }>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Forbidden");
      return res.json();
    },
    retry: false,
  });

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Forbidden");
      return res.json();
    },
    retry: false,
  });

  if (error) {
    return (
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="flex flex-col items-center py-12 space-y-4">
              <ShieldAlert className="w-12 h-12 text-destructive" />
              <h2 className="text-xl font-bold" data-testid="text-admin-denied">Access Denied</h2>
              <p className="text-muted-foreground text-center text-sm">
                You don't have admin privileges. Contact the system administrator.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-admin-title">Admin Console</h2>
            <p className="text-muted-foreground mt-1 text-sm">System administration and user management</p>
          </div>

          <PendingUsersPanel />

          <ActiveUsersPanel />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-admin-user-count">{stats?.userCount ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-admin-active-count">
                      {users?.filter(u => u.status === "approved").length ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/10 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-admin-admin-count">
                      {users?.filter(u => u.role === "admin").length ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Admins</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                All Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Name</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Type</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Email</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Phone</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Role</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users?.map((u, idx) => (
                        <tr key={u.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors" data-testid={`row-user-${idx}`}>
                          <td className="py-2.5 px-3 font-medium">
                            <div>{u.firstName} {u.lastName}</div>
                            {(u as any).companyName && <div className="text-[10px] text-muted-foreground">{(u as any).companyName}</div>}
                          </td>
                          <td className="py-2.5 px-3">
                            <AccountTypeBadge accountType={(u as any).accountType} />
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{u.email}</td>
                          <td className="py-2.5 px-3">
                            {u.phoneNumber ? (
                              <span className="text-emerald-400">{maskPhone(u.phoneNumber)}</span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                              {u.role || "user"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                u.status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : u.status === "rejected"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                              data-testid={`badge-status-${idx}`}
                            >
                              {u.status || "pending"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
