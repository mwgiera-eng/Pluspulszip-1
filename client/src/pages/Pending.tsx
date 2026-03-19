import { Clock, LogOut, Mail, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function Pending() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6" data-testid="page-pending">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Registration Pending</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your account is under review. You will receive full access once the administrator approves your registration.
          </p>
        </div>

        <Card className="border-border bg-card/60">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium text-sm truncate" data-testid="text-pending-name">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
            </div>
            {user?.email && (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-sm truncate" data-testid="text-pending-email">{user.email}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shrink-0" />
              <p className="text-xs text-amber-300">Awaiting administrator approval</p>
            </div>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => logout()}
          data-testid="button-pending-signout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
