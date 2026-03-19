interface KrakowEvent {
  id: string;
  title: string;
  venueName: string;
  venueKey: string | null;
  startDate: Date;
  endDate: Date | null;
  category: string;
  estimatedEndHour: number | null;
  expectedCrowdSize: "small" | "medium" | "large" | "massive";
  surgeMultiplier: number;
  source: string;
}

interface ActiveEventInfo {
  event: KrakowEvent;
  status: "upcoming" | "ongoing" | "ending_soon" | "just_ended";
  minutesUntilSurge: number;
  surgeTip: string;
}

const VENUE_MAPPING: Record<string, { key: string; lat: number; lng: number }> = {
  "tauron arena": { key: "tauronArena", lat: 50.0675, lng: 19.9917 },
  "tauron arena krakow": { key: "tauronArena", lat: 50.0675, lng: 19.9917 },
  "tauron arena kraków": { key: "tauronArena", lat: 50.0675, lng: 19.9917 },
  "hala forum": { key: "halaForum", lat: 50.0188, lng: 19.963 },
  "forum przestrzenie": { key: "halaForum", lat: 50.0188, lng: 19.963 },
  "ice kraków": { key: "iceKrakow", lat: 50.0475, lng: 19.9265 },
  "ice krakow": { key: "iceKrakow", lat: 50.0475, lng: 19.9265 },
  "ice congress centre": { key: "iceKrakow", lat: 50.0475, lng: 19.9265 },
  "teatr bagatela": { key: "teatrBagatela", lat: 50.063, lng: 19.935 },
  "teatr slowackiego": { key: "teatrSlowackiego", lat: 50.0636, lng: 19.9367 },
  "filharmonia krakowska": { key: "filharmonia", lat: 50.0581, lng: 19.9359 },
  "main square": { key: "mainSquare", lat: 50.0614, lng: 19.9366 },
  "rynek główny": { key: "mainSquare", lat: 50.0614, lng: 19.9366 },
  "rynek glowny": { key: "mainSquare", lat: 50.0614, lng: 19.9366 },
  "kazimierz": { key: "kazimierzDistrict", lat: 50.0526, lng: 19.9455 },
  "stare miasto": { key: "mainSquare", lat: 50.0614, lng: 19.9366 },
  "wawel": { key: "wawel", lat: 50.054, lng: 19.9354 },
  "galeria krakowska": { key: "mainStation", lat: 50.0656, lng: 19.9472 },
  "bonarka city center": { key: "galeriaBonarka", lat: 50.0283, lng: 19.9536 },
};

function matchVenue(text: string): string | null {
  const normalized = text.toLowerCase().trim();
  for (const [key, val] of Object.entries(VENUE_MAPPING)) {
    if (normalized.includes(key)) return val.key;
  }
  return null;
}

const eventsCache: KrakowEvent[] = [];
let lastEventsFetch = 0;
let lastFetchFailed = false;
const EVENTS_CACHE_TTL = 6 * 60 * 60 * 1000;
const EVENTS_RETRY_TTL = 30 * 60 * 1000;

async function fetchKrakowTravelEvents(): Promise<KrakowEvent[]> {
  try {
    const url = "https://www.krakow.travel/en/wydarzenia";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,pl;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log("[KrakowEvents] HTTP", response.status, "from krakow.travel");
      return [];
    }

    const html = await response.text();
    const events: KrakowEvent[] = [];

    const articlePattern = /<article>([\s\S]*?)<\/article>/gi;
    let articleMatch: RegExpExecArray | null;

    let i = 0;
    while ((articleMatch = articlePattern.exec(html)) !== null && i < 60) {
      const block = articleMatch[1];

      const titleMatch = block.match(/<h5[^>]*class=['"]title['"][^>]*>([\s\S]*?)<\/h5>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
      if (!title || title.length < 3) continue;

      const dateMatch = block.match(/<span[^>]*class=['"]address['"][^>]*>([\s\S]*?)<\/span>/i);
      const dateText = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, "").trim() : null;
      if (!dateText) continue;

      let startDate: Date | null = null;
      let endDate: Date | null = null;

      const rangeMatch = dateText.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})\s*[-–]\s*\w+\s+(\w+)\s+(\d{1,2}),\s+(\d{4})/i);
      if (rangeMatch) {
        startDate = parseTextDate(rangeMatch[1], rangeMatch[2], rangeMatch[3]);
        endDate = parseTextDate(rangeMatch[4], rangeMatch[5], rangeMatch[6]);
      } else {
        const singleMatch = dateText.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})(?:,\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i);
        if (singleMatch) {
          startDate = parseTextDate(singleMatch[1], singleMatch[2], singleMatch[3]);
          if (startDate && singleMatch[4] && singleMatch[6]) {
            let hour = parseInt(singleMatch[4]);
            const minute = parseInt(singleMatch[5] || "0");
            const meridiem = singleMatch[6].toUpperCase();
            if (meridiem === "PM" && hour !== 12) hour += 12;
            if (meridiem === "AM" && hour === 12) hour = 0;
            startDate = new Date(
              startDate.getFullYear(),
              startDate.getMonth(),
              startDate.getDate(),
              hour,
              minute,
            );
          }
        }
      }

      if (!startDate) continue;

      const venueKey = matchVenue(title);

      let crowdSize: "small" | "medium" | "large" | "massive" = "medium";
      const titleLower = title.toLowerCase();
      if (titleLower.includes("festival") || titleLower.includes("festiwal")) crowdSize = "massive";
      else if (titleLower.includes("concert") || titleLower.includes("koncert") || titleLower.includes("jazz") || titleLower.includes("music")) crowdSize = "large";
      else if (titleLower.includes("theatre") || titleLower.includes("teatr") || titleLower.includes("opera")) crowdSize = "medium";
      else if (titleLower.includes("exhibition") || titleLower.includes("wystawa")) crowdSize = "small";

      const surgeMap = { small: 1.1, medium: 1.3, large: 1.5, massive: 2.0 };

      events.push({
        id: `krakow-travel-${i}-${startDate.getTime()}`,
        title,
        venueName: title,
        venueKey,
        startDate,
        endDate,
        category: guessCategory(title),
        estimatedEndHour: guessEndHour(title, startDate),
        expectedCrowdSize: crowdSize,
        surgeMultiplier: surgeMap[crowdSize],
        source: "krakow.travel",
      });
      i++;
    }

    return events;
  } catch (err) {
    console.error("[KrakowEvents] Fetch error:", err);
    return [];
  }
}

function parseTextDate(month: string, day: string, year: string): Date | null {
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const m = months[month.toLowerCase()];
  if (m === undefined) return null;
  return new Date(parseInt(year), m, parseInt(day));
}

function guessCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("jazz") || t.includes("concert") || t.includes("koncert") || t.includes("music")) return "concert";
  if (t.includes("festival") || t.includes("festiwal")) return "festival";
  if (t.includes("theatre") || t.includes("teatr") || t.includes("theater")) return "theatre";
  if (t.includes("exhibition") || t.includes("wystawa")) return "exhibition";
  if (t.includes("sport") || t.includes("match") || t.includes("mecz")) return "sport";
  if (t.includes("conference") || t.includes("congress") || t.includes("konferencja")) return "conference";
  return "event";
}

function guessEndHour(title: string, startDate: Date): number | null {
  const startHour = startDate.getHours();
  const cat = guessCategory(title);
  let durationHours: number;
  switch (cat) {
    case "concert": durationHours = 3; break;
    case "festival": durationHours = 4; break;
    case "theatre": durationHours = 2; break;
    case "sport": durationHours = 2; break;
    case "conference": durationHours = 8; break;
    case "exhibition": durationHours = 6; break;
    default: durationHours = 3;
  }
  if (startHour > 0) {
    return Math.min(startHour + durationHours, 24);
  }
  switch (cat) {
    case "concert": return 23;
    case "festival": return 23;
    case "theatre": return 22;
    case "sport": return 22;
    case "conference": return 18;
    case "exhibition": return 18;
    default: return 22;
  }
}

export async function refreshEvents(): Promise<void> {
  const now = Date.now();
  const ttl = lastFetchFailed ? EVENTS_RETRY_TTL : EVENTS_CACHE_TTL;
  if (now - lastEventsFetch < ttl) return;

  console.log("[KrakowEvents] Fetching events from krakow.travel...");
  const fetched = await fetchKrakowTravelEvents();

  if (fetched.length > 0) {
    eventsCache.length = 0;
    eventsCache.push(...fetched);
    lastEventsFetch = now;
    lastFetchFailed = false;
    console.log(`[KrakowEvents] Cached ${fetched.length} events`);
  } else {
    console.log("[KrakowEvents] No events parsed, will retry in 30 min");
    lastEventsFetch = now;
    lastFetchFailed = true;
  }
}

export function getActiveEvents(now?: Date): ActiveEventInfo[] {
  const current = now || new Date();
  const results: ActiveEventInfo[] = [];

  for (const event of eventsCache) {
    const eventStart = event.startDate;
    const eventEnd = event.endDate || new Date(eventStart.getTime() + 24 * 60 * 60 * 1000);

    const isToday = current.toDateString() === eventStart.toDateString() ||
      (current >= eventStart && current <= eventEnd);

    if (!isToday) {
      const tomorrow = new Date(current);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = tomorrow.toDateString() === eventStart.toDateString();
      if (!isTomorrow) continue;

      results.push({
        event,
        status: "upcoming",
        minutesUntilSurge: Math.round((eventStart.getTime() - current.getTime()) / 60000),
        surgeTip: `Tomorrow: ${event.title} at ${event.venueName}. Pre-position early.`,
      });
      continue;
    }

    const polandHour = getPolandHour(current);
    const endHour = event.estimatedEndHour || 22;

    if (polandHour < endHour - 2) {
      results.push({
        event,
        status: "ongoing",
        minutesUntilSurge: (endHour - polandHour) * 60,
        surgeTip: `${event.title} ongoing. Surge expected ~${endHour}:00 when it ends.`,
      });
    } else if (polandHour >= endHour - 2 && polandHour < endHour) {
      results.push({
        event,
        status: "ending_soon",
        minutesUntilSurge: (endHour - polandHour) * 60,
        surgeTip: `${event.title} ending soon! Head to ${event.venueName} for ${event.expectedCrowdSize} crowd surge.`,
      });
    } else if (polandHour >= endHour && polandHour < endHour + 1) {
      results.push({
        event,
        status: "just_ended",
        minutesUntilSurge: 0,
        surgeTip: `${event.title} just ended! ${event.expectedCrowdSize} crowd leaving ${event.venueName}. SURGE NOW!`,
      });
    }
  }

  return results;
}

export function getEventVenueKeys(): Set<string> {
  const now = new Date();
  const active = getActiveEvents(now);
  const keys = new Set<string>();
  for (const info of active) {
    if (info.event.venueKey) {
      keys.add(info.event.venueKey);
    }
  }
  return keys;
}

export function hasActiveEventAt(venueKey: string): boolean {
  return getEventVenueKeys().has(venueKey);
}

function getPolandHour(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    hour: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find(p => p.type === "hour");
  return parseInt(hourPart?.value || "12");
}

export function startEventsRefreshLoop(): void {
  refreshEvents().catch(err => console.error("[KrakowEvents] Initial refresh error:", err));
  setInterval(() => {
    refreshEvents().catch(err => console.error("[KrakowEvents] Refresh error:", err));
  }, EVENTS_RETRY_TTL);
}

export function getAllCachedEvents(): KrakowEvent[] {
  return [...eventsCache];
}

export function getEventsCacheMeta(): {
  lastFetchedAt: number | null;
  lastFetchFailed: boolean;
  cacheSize: number;
} {
  return {
    lastFetchedAt: lastEventsFetch || null,
    lastFetchFailed,
    cacheSize: eventsCache.length,
  };
}
