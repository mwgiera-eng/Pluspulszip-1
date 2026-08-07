import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Map, ArrowRight, ShieldCheck, Zap, UserPlus } from "lucide-react";
import { Link } from "wouter";

export default function Login() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
      {/* Left Panel: Hero */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-secondary border-r border-border overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[150px]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <div className="p-2 bg-primary rounded-lg">
              <Map className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold font-mono">+Puls</h1>
          </div>
          
          <h2 className="text-5xl font-bold leading-tight tracking-tight mb-6">
            Drive smarter,<br/>
            <span className="text-primary">earn more.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-md leading-relaxed">
            Invite-only real-time demand analytics and strategic positioning for professional ride-hailing drivers in Poland.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-8 mt-12">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <h3 className="font-semibold text-lg">Surge Predictor</h3>
            <p className="text-sm text-muted-foreground">Know where the surge will be before it happens.</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="font-semibold text-lg">Otwarta platforma</h3>
            <p className="text-sm text-muted-foreground">Każdy kierowca może dołączyć — bez zaproszenia, bez czekania.</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center mb-4">
              <UserPlus className="w-5 h-5 text-sky-400" />
            </div>
            <h3 className="font-semibold text-lg">Dołącz bez rejestracji</h3>
            <p className="text-sm text-muted-foreground">Zaloguj się kontem Replit i od razu korzystaj z pełnej wersji.</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center mb-4">
              <Map className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-semibold text-lg">Podgląd bez konta</h3>
            <p className="text-sm text-muted-foreground">Sprawdź mapę na żywo i dane stref bez logowania.</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-12">
          &copy; 2024 PlusPuls Analytics. Niezależne narzędzie — bez powiązań z Bolt, Uber ani żadną platformą.
        </p>
      </div>

      {/* Right Panel: Auth */}
      <div className="flex flex-col items-center justify-center p-8 lg:p-12 relative">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />

        <div className="w-full max-w-md relative z-10 space-y-8">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="p-2 bg-primary rounded-lg">
                <Map className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold font-mono">+Puls</span>
            </div>
            <h3 className="text-2xl font-bold">Dołącz do PlusPuls</h3>
            <p className="text-muted-foreground text-sm">
              Platforma dla kierowców w Polsce. Zaloguj się kontem Replit i zacznij zarabiać więcej.
            </p>
          </div>

          <Card className="p-8 border-border shadow-2xl bg-card/50 backdrop-blur-sm" data-testid="card-login">
            <div className="space-y-6">
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                onClick={handleLogin}
                data-testid="button-login"
              >
                Sprawdź sam!
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-xs text-center text-muted-foreground border border-border/40 rounded-lg px-4 py-2.5 bg-muted/20" data-testid="text-disclaimer">
                PlusPuls jest niezależnym narzędziem analitycznym. Nie jest powiązany z Bolt Technology OÜ, Uber Technologies Inc. ani żadną inną platformą ride-hailing.
              </p>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="lg"
                className="w-full h-11 text-sm font-medium"
                asChild
                data-testid="button-preview"
              >
                <Link href="/">Sprawdź sam!</Link>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Secure Access</span>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Masz już konto? Wejdziesz od razu do panelu. Nowi użytkownicy są zatwierdzani automatycznie.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
