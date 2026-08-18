import { Link } from "wouter";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AccountDeletion() {
  const { user, isLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    if (!password || confirmation !== "DELETE") return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation: "DELETE" }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Account deletion failed.");
      window.location.href = "/login";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account deletion failed.");
    } finally {
      setDeleting(false);
    }
  };
  return <main className="min-h-screen bg-background text-foreground px-4 py-12">
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/" className="font-mono text-lg font-bold"><span className="text-primary">+</span>Puls</Link>
      <section className="rounded-3xl border border-border bg-card p-6 md:p-9">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10"><Trash2 className="h-7 w-7 text-destructive" /></div>
        <h1 className="mt-6 text-3xl font-bold">Delete your PlusPuls account</h1>
        <p className="mt-3 leading-7 text-muted-foreground">Sign in, open Settings, choose Delete account, enter your password and type DELETE. The same option is available in the Android app under More → Settings.</p>
        <div className="mt-6 rounded-2xl border border-border/70 bg-background/50 p-5">
          <h2 className="font-semibold">Data removed</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your profile, sessions, trips, earnings, notification preferences, driver activity, recommendations and PlusPuls payment records are deleted. Provider records that must legally be retained outside PlusPuls may follow their own retention duties.</p>
        </div>
        {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Checking session…</p> : user && user.role !== "admin" ? <div className="mt-6 space-y-3"><Input type="password" autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" aria-label="Password to confirm account deletion" /><Input maxLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm" />{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button variant="destructive" disabled={deleting || !password || confirmation !== "DELETE"} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete account permanently"}</Button></div> : <div className="mt-6 flex flex-wrap gap-3"><Link href="/login" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Sign in to delete</Link><Link href="/trust/privacy" className="rounded-xl border border-border px-5 py-3 font-semibold">Privacy notice</Link></div>}
        <p className="mt-6 flex gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Password confirmation and an active authenticated session are required. Administrator accounts use a separate ownership-transfer process.</p>
      </section>
    </div>
  </main>;
}
