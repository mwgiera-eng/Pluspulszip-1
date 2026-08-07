import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Map, ShieldCheck, Zap, Users } from "lucide-react";

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
            Jedź mądrzej,<br />
            <span className="text-primary">zarabiaj więcej.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-md leading-relaxed">
            Analityka popytu w czasie rzeczywistym i inteligentne pozycjonowanie dla kierowców ride-hailing w Polsce.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-8 mt-12">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <h3 className="font-semibold text-lg">Surge Predictor</h3>
            <p className="text-sm text-muted-foreground">Wiedz, gdzie będzie surge, zanim to się stanie.</p>
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
              <Users className="w-5 h-5 text-sky-400" />
            </div>
            <h3 className="font-semibold text-lg">Szybki start</h3>
            <p className="text-sm text-muted-foreground">Jedno kliknięcie — zaloguj się Google i korzystaj od razu.</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center mb-4">
              <Map className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-semibold text-lg">Mapa na żywo</h3>
            <p className="text-sm text-muted-foreground">Strefy, heat-mapy i trasy w czasie rzeczywistym dla Krakowa.</p>
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
              Zaloguj się kontem Google i zacznij zarabiać więcej.
            </p>
          </div>

          <Card className="p-8 border-border shadow-2xl bg-card/50 backdrop-blur-sm" data-testid="card-login">
            <div className="space-y-4">
              {/* Google sign-in button */}
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all flex items-center justify-center gap-3"
                onClick={handleLogin}
                data-testid="button-login"
              >
                {/* Official Google "G" logo colours */}
                <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                Sprawdź sam!
              </Button>

              <p className="text-xs text-center text-muted-foreground border border-border/40 rounded-lg px-4 py-2.5 bg-muted/20" data-testid="text-disclaimer">
                PlusPuls jest niezależnym narzędziem analitycznym. Nie jest powiązany z Bolt Technology OÜ, Uber Technologies Inc. ani żadną inną platformą ride-hailing.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
