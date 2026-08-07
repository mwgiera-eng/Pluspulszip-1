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
                {/* Google "G" logo */}
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#fff" fillOpacity=".9"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#fff" fillOpacity=".75"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#fff" fillOpacity=".6"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#fff" fillOpacity=".9"/>
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
