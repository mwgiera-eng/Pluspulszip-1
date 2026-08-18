const DEFAULT_API_URL = "https://pluspulszip-1.onrender.com";
const TRUSTED_API_ORIGINS = new Set([DEFAULT_API_URL]);

function upstreamOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
  const url = new URL(configured);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) throw new Error("Invalid API origin");
  if (!local && !TRUSTED_API_ORIGINS.has(url.origin)) throw new Error("Untrusted API origin");
  return url.origin;
}

function boundedHours(value: string | null): number {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? Math.max(0, Math.min(12, Math.round(parsed))) : 0;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hours = boundedHours(url.searchParams.get("hoursAhead"));
    const upstream = `${upstreamOrigin()}/api/hex-heat?hoursAhead=${hours}&minutesAhead=0`;
    const response = await fetch(upstream, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return Response.json({ message: "Map data unavailable" }, { status: 502 });
    }
    return new Response(await response.text(), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": hours === 0 ? "public, max-age=30, stale-while-revalidate=60" : "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ message: "Map data unavailable" }, { status: 502 });
  }
}
