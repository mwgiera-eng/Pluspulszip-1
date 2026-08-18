import { useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || "Nie udało się zalogować.");
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,hsl(159_79%_54%_/_0.12),transparent_24rem)]" />
      <div className="relative z-10 w-full max-w-md space-y-6">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4"/>Logowanie użytkownika</Link>
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 grid place-items-center shadow-[0_0_30px_hsl(159_79%_54%_/_0.16)]"><ShieldCheck className="w-6 h-6 text-primary"/></div>
          <div><h1 className="text-2xl font-bold">Panel administratora</h1><p className="text-sm text-muted-foreground mt-1">Dostęp wyłącznie dla kont z rolą administratora.</p></div>
        </div>
        <Card className="p-6 lg:p-8 bg-card/95 backdrop-blur-xl border-border">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="admin-email">Adres e-mail</Label><Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" maxLength={254} required /></div>
            <div className="space-y-1.5"><Label htmlFor="admin-password">Hasło</Label><Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={128} required /></div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" size="lg" disabled={submitting} className="w-full h-12 font-semibold">{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}Zaloguj administratora</Button>
          </form>
        </Card>
        <p className="text-center text-xs text-muted-foreground">+Puls · chroniona strefa administracyjna</p>
      </div>
    </div>
  );
}
