import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, MapPin, Radio, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Zone { zoneName: string; profitScore: number; lat: number; lng: number; demandLevel?: string; surgeMultiplier?: number; }
interface Response { zones?: Zone[]; cells?: { lat:number; lng:number; radius:number; score:number }[]; }

export function NextMoveCard({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, isError } = useQuery<Response>({
    queryKey: ["/api/zone-profit-heat", "next-move"],
    queryFn: async () => {
      const res = await fetch("/api/zone-profit-heat", { credentials: "include" });
      if (!res.ok) throw new Error("heat");
      return res.json();
    },
    refetchInterval: 60000,
  });
  const top = data?.zones?.slice().sort((a,b) => b.profitScore - a.profitScore)[0];
  const score = top?.profitScore;
  const name = top?.zoneName;

  return (
    <section className={cn("relative overflow-hidden rounded-2xl border border-primary/35 bg-[radial-gradient(circle_at_90%_10%,hsl(159_79%_54%_/_0.18),transparent_42%),hsl(224_30%_10%)] p-4 md:p-5 neon-surface", compact && "p-3")} data-testid="card-next-move">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_hsl(159_79%_54%_/_0.25)]"><Sparkles className="h-4 w-4" /></div>
          <div><p className="font-mono text-[10px] font-bold tracking-[.22em] text-primary">NEXT MOVE</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Najlepszy ruch teraz</p></div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-primary"><span className="live-dot h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> LIVE</div>
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">{isLoading ? "Skanuję miasto…" : isError || !name ? "Dane chwilowo niedostępne" : `Jedź w stronę ${name}`}</p>
          <p className="mt-1 text-xs text-muted-foreground">{isError || !name ? "Spróbuj ponownie za chwilę" : "Najwyższy przewidywany potencjał zarobku w Krakowie"}</p>
        </div>
        {score !== undefined && (
          <div className="shrink-0 text-right"><p className="font-mono text-3xl font-bold text-primary drop-shadow-[0_0_12px_hsl(159_79%_54%_/_0.55)]">{Math.round(score)}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">profit score /100</p></div>
        )}
      </div>
      {top && (
        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {top.demandLevel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-1 text-[10px] text-sky-200"><Radio className="h-3 w-3" />Popyt: {top.demandLevel === "surge" ? "surge" : top.demandLevel === "high" ? "wysoki" : top.demandLevel === "medium" ? "średni" : "niski"}</span>
          )}
          {top.surgeMultiplier !== undefined && Number(top.surgeMultiplier) > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] text-amber-200"><Users className="h-3 w-3" />{Number(top.surgeMultiplier)}x mnożnik</span>
          )}
        </div>
      )}
      <button className="neon-button relative mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-background transition-opacity hover:opacity-90" onClick={() => window.location.href = "/map"} data-testid="button-next-move">
        Otwórz mapę <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
      <MapPin className="absolute bottom-4 right-5 h-12 w-12 text-primary/10" />
    </section>
  );
}