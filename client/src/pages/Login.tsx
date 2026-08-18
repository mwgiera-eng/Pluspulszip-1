import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Zap, MapPin, Loader2 } from "lucide-react";

type Mode = "register" | "login";

export default function Login({ initialMode = "register" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === "register") {
      if (!firstName.trim() || !lastName.trim()) return setError("Podaj imię i nazwisko.");
      if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return setError("Hasło: minimum 10 znaków, mała i wielka litera oraz cyfra.");
      }
      if (password !== password2) return setError("Hasła nie są identyczne.");
      if (!termsAccepted || !privacyAccepted) return setError("Zaakceptuj warunki i potwierdź informację o prywatności.");
    }

    setSubmitting(true);
    try {
      const url = mode === "register" ? "/api/register" : "/api/login/password";
      const body = mode === "register"
        ? { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, termsAccepted, privacyAccepted }
        : { email: email.trim(), password };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const issue = Array.isArray(data.issues) ? data.issues[0]?.message : null;
        setError(issue || data.message || "Nie udało się kontynuować.");
        return;
      }
      window.location.href = mode === "register" ? "/pending" : "/";
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[radial-gradient(circle_at_50%_42%,hsl(159_79%_54%_/_0.14),transparent_20rem),hsl(224_30%_8%)] border-r border-primary/15 overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[linear-gradient(115deg,transparent_0%,hsl(188_90%_50%_/_0.08)_48%,transparent_49%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10"><div className="w-11 h-11 rounded-2xl bg-primary text-background grid place-items-center text-2xl font-black shadow-[0_0_30px_hsl(159_79%_54%_/_0.55)]">+</div><h1 className="text-2xl font-bold">Puls</h1></div>
          <h2 className="text-5xl font-bold leading-tight tracking-tight mb-6">Czytaj miasto<br/><span className="text-primary drop-shadow-[0_0_18px_hsl(159_79%_54%_/_0.5)]">zanim ruszy.</span></h2>
          <p className="text-xl text-muted-foreground max-w-md leading-relaxed">Jedno konto do mapy, planera i inteligentnych sygnałów +Puls.</p>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-8">
          <div><Zap className="w-6 h-6 text-primary mb-3"/><h3 className="font-semibold">Sygnały na żywo</h3><p className="text-sm text-muted-foreground mt-1">Ruch, wydarzenia, lotnisko i pogoda w jednym rytmie.</p></div>
          <div><MapPin className="w-6 h-6 text-primary mb-3"/><h3 className="font-semibold">Kraków + Balice</h3><p className="text-sm text-muted-foreground mt-1">Kontekst zaprojektowany pod realne decyzje kierowców.</p></div>
        </div>
        <p className="relative z-10 text-xs text-muted-foreground">+Puls · niezależne narzędzie dla kierowców</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-7">
          <div className="text-center space-y-2">
            <div className="lg:hidden mx-auto mb-4 w-10 h-10 rounded-xl bg-primary text-background grid place-items-center text-xl font-black">+</div>
            <h3 className="text-2xl font-bold">{mode === "register" ? "Utwórz konto +Puls" : "Zaloguj się do +Puls"}</h3>
            <p className="text-muted-foreground text-sm">{mode === "register" ? "Po rejestracji konto oczekuje na zatwierdzenie administratora." : "Wróć do swojego kokpitu."}</p>
          </div>

          <Card className="p-6 lg:p-8 border-border bg-card/95 backdrop-blur-xl">
            <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary mb-5">
              <button type="button" onClick={() => { setMode("register"); setError(null); }} className={`h-10 rounded-lg text-sm font-semibold transition-colors ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Rejestracja</button>
              <button type="button" onClick={() => { setMode("login"); setError(null); }} className={`h-10 rounded-lg text-sm font-semibold transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Logowanie</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="firstName">Imię</Label><Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={80} required /></div><div className="space-y-1.5"><Label htmlFor="lastName">Nazwisko</Label><Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" maxLength={80} required /></div></div>}
              <div className="space-y-1.5"><Label htmlFor="email">Adres e-mail</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required /></div>
              <div className="space-y-1.5"><Label htmlFor="password">Hasło</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} maxLength={128} required />{mode === "register" && <p className="text-[11px] text-muted-foreground">Min. 10 znaków, wielka i mała litera oraz cyfra.</p>}</div>
              {mode === "register" && <div className="space-y-1.5"><Label htmlFor="password2">Powtórz hasło</Label><Input id="password2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" maxLength={128} required /></div>}

              {mode === "register" && <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 text-sm"><Checkbox checked={termsAccepted} onCheckedChange={(value) => setTermsAccepted(value === true)} className="mt-0.5"/><span>Akceptuję <Link href="/trust/terms" className="text-primary hover:underline">Warunki korzystania</Link>.</span></label>
                <label className="flex items-start gap-3 text-sm"><Checkbox checked={privacyAccepted} onCheckedChange={(value) => setPrivacyAccepted(value === true)} className="mt-0.5"/><span>Potwierdzam zapoznanie się z <Link href="/trust/privacy" className="text-primary hover:underline">informacją o prywatności</Link>.</span></label>
              </div>}

              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" size="lg" disabled={submitting} className="w-full h-12 text-base font-semibold neon-button">{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}{mode === "register" ? "Utwórz konto" : "Zaloguj się"}</Button>
            </form>

            <div className="mt-5 pt-5 border-t border-border/60 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary"/>Sesja chroniona cookie HTTP-only</span>
              <Link href="/admin/login" className="hover:text-foreground">Administrator</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  return <Login initialMode="register" />;
}
