import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Map, ShieldCheck, Zap, UserPlus, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";

export default function Login({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Unable to continue");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.href = "/";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-secondary border-r border-border overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[150px]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-8"><div className="p-2 bg-primary rounded-lg"><Map className="w-6 h-6 text-primary-foreground" /></div><h1 className="text-2xl font-bold font-mono">ShiftOptima</h1></div>
          <h2 className="text-5xl font-bold leading-tight tracking-tight mb-6">Drive smarter,<br/><span className="text-primary">earn more.</span></h2>
          <p className="text-xl text-muted-foreground max-w-md leading-relaxed">Real-time demand analytics and strategic positioning for professional ride-hailing drivers in Poland.</p>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-8 mt-12">
          <Feature icon={<Zap className="w-5 h-5 text-yellow-500" />} title="Surge Predictor" text="Know where demand is building before it happens." />
          <Feature icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />} title="Private by design" text="Your earnings and location data remain in your account." />
          <Feature icon={<UserPlus className="w-5 h-5 text-sky-400" />} title="Create an account" text="Start your trial after your access request is approved." />
          <Feature icon={<Map className="w-5 h-5 text-violet-400" />} title="Preview available" text="Browse the live map and zone data without an account." />
        </div>
        <p className="text-xs text-muted-foreground mt-12">&copy; {new Date().getFullYear()} ShiftOptima Analytics. Independent of all ride-hailing platforms.</p>
      </div>

      <div className="flex flex-col items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-md relative z-10 space-y-6">
          <div className="text-center"><h3 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h3><p className="text-muted-foreground text-sm mt-2">{mode === "login" ? "Sign in to your ShiftOptima workspace." : "Request access to the professional driver platform."}</p></div>
          <Card className="p-6 sm:p-8 shadow-2xl bg-card/80" data-testid="card-login">
            <form className="space-y-4" onSubmit={submit}>
              {mode === "register" && <div className="grid grid-cols-2 gap-3"><Field name="firstName" label="First name" autoComplete="given-name" /><Field name="lastName" label="Last name" autoComplete="family-name" /></div>}
              <Field name="email" label="Email" type="email" autoComplete="email" />
              <Field name="password" label="Password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} hint={mode === "register" ? "At least 10 characters" : undefined} />
              {error && <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</p>}
              <Button size="lg" className="w-full" disabled={submitting} data-testid="button-login">{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}</Button>
            </form>
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="w-full text-sm text-primary mt-5 hover:underline">{mode === "login" ? "New to ShiftOptima? Create an account" : "Already have an account? Sign in"}</button>
            <p className="text-xs text-center text-muted-foreground border-t mt-5 pt-5">ShiftOptima is an independent analytics tool and is not affiliated with any ride-hailing platform.</p>
          </Card>
          <Button variant="outline" className="w-full" asChild><Link href="/">Browse live map without signing in</Link></Button>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  return <Login initialMode="register" />;
}

function Field({ name, label, hint, ...props }: { name: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} required {...props} />{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div><div className="w-10 h-10 rounded-full bg-background border flex items-center justify-center mb-3">{icon}</div><h3 className="font-semibold">{title}</h3><p className="text-sm text-muted-foreground mt-1">{text}</p></div>;
}
