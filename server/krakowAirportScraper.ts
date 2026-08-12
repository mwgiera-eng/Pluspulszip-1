const AIRLINE_CODES: Record<string, string> = {
  'FR': 'Ryanair',
  'W6': 'Wizz Air',
  'LO': 'LOT Polish Airlines',
  'LH': 'Lufthansa',
  'LX': 'Swiss',
  'KL': 'KLM',
  'EZY': 'easyJet',
  'EZS': 'easyJet Switzerland',
  'LS': 'Jet2',
  'A3': 'Aegean Airlines',
  'DY': 'Norwegian',
  'G9': 'Air Arabia',
  'TK': 'Turkish Airlines',
  'QR': 'Qatar Airways',
  'OS': 'Austrian Airlines',
  'SK': 'SAS',
  'U2': 'easyJet',
  'BA': 'British Airways',
  'AF': 'Air France',
  'AZ': 'ITA Airways',
  'EI': 'Aer Lingus',
  'PC': 'Pegasus Airlines',
  'VY': 'Vueling',
  'SN': 'Brussels Airlines',
  'BT': 'airBaltic',
  'PS': 'UIA',
  'OA': 'Olympic Air',
  'XR': 'Corendon Airlines Europe',
  'TO': 'Transavia France',
  'HV': 'Transavia',
  'WZ': 'Wizz Air',
  'DE': 'Condor',
  'X3': 'TUI fly',
  'BY': 'TUI Airways',
  'MT': 'Thomas Cook',
  'EW': 'Eurowings',
  'EN': 'Air Dolomiti',
  'CL': 'Lufthansa CityLine',
};

const ICAO_AIRLINE_TO_IATA: Record<string, string> = {
  'RYR': 'FR', 'WZZ': 'W6', 'LOT': 'LO', 'DLH': 'LH', 'SWR': 'LX',
  'KLM': 'KL', 'EZY': 'EZY', 'EXS': 'LS', 'AEE': 'A3', 'NAX': 'DY',
  'ABY': 'G9', 'THY': 'TK', 'QTR': 'QR', 'AUA': 'OS', 'SAS': 'SK',
  'BAW': 'BA', 'AFR': 'AF', 'AZA': 'AZ', 'EIN': 'EI', 'PGT': 'PC',
  'VLG': 'VY', 'BEL': 'SN', 'BTI': 'BT', 'AUI': 'PS', 'OAL': 'OA',
  'CAI': 'XR', 'TVF': 'TO', 'TRA': 'HV', 'CFG': 'DE', 'TUI': 'X3',
  'TOM': 'BY', 'EWG': 'EW', 'DLA': 'EN', 'CLH': 'CL',
};

const ICAO_AIRPORT_TO_INFO: Record<string, { iata: string; name: string; city: string }> = {
  'EGLL': { iata: 'LHR', name: 'London Heathrow', city: 'London' },
  'EGKK': { iata: 'LGW', name: 'London Gatwick', city: 'London' },
  'EGGW': { iata: 'LTN', name: 'London Luton', city: 'London' },
  'EGSS': { iata: 'STN', name: 'London Stansted', city: 'London' },
  'EGCC': { iata: 'MAN', name: 'Manchester', city: 'Manchester' },
  'EGNX': { iata: 'EMA', name: 'East Midlands', city: 'Nottingham' },
  'EGBB': { iata: 'BHX', name: 'Birmingham', city: 'Birmingham' },
  'EGPH': { iata: 'EDI', name: 'Edinburgh', city: 'Edinburgh' },
  'EGPF': { iata: 'GLA', name: 'Glasgow', city: 'Glasgow' },
  'EGGD': { iata: 'BRS', name: 'Bristol', city: 'Bristol' },
  'EGNJ': { iata: 'HUY', name: 'Humberside', city: 'Humberside' },
  'EGGP': { iata: 'LPL', name: 'Liverpool', city: 'Liverpool' },
  'LFPG': { iata: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris' },
  'LFPO': { iata: 'ORY', name: 'Paris Orly', city: 'Paris' },
  'EHAM': { iata: 'AMS', name: 'Amsterdam', city: 'Amsterdam' },
  'EDDF': { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt' },
  'EDDM': { iata: 'MUC', name: 'Munich', city: 'Munich' },
  'EDDB': { iata: 'BER', name: 'Berlin Brandenburg', city: 'Berlin' },
  'LOWW': { iata: 'VIE', name: 'Vienna', city: 'Vienna' },
  'LSZH': { iata: 'ZRH', name: 'Zurich', city: 'Zurich' },
  'LEMD': { iata: 'MAD', name: 'Madrid Barajas', city: 'Madrid' },
  'LEBL': { iata: 'BCN', name: 'Barcelona', city: 'Barcelona' },
  'LIRF': { iata: 'FCO', name: 'Rome Fiumicino', city: 'Rome' },
  'LIML': { iata: 'LIN', name: 'Milan Linate', city: 'Milan' },
  'LIMC': { iata: 'MXP', name: 'Milan Malpensa', city: 'Milan' },
  'EBBR': { iata: 'BRU', name: 'Brussels', city: 'Brussels' },
  'EKCH': { iata: 'CPH', name: 'Copenhagen', city: 'Copenhagen' },
  'ESSA': { iata: 'ARN', name: 'Stockholm Arlanda', city: 'Stockholm' },
  'ENGM': { iata: 'OSL', name: 'Oslo Gardermoen', city: 'Oslo' },
  'EFHK': { iata: 'HEL', name: 'Helsinki', city: 'Helsinki' },
  'EVRA': { iata: 'RIX', name: 'Riga', city: 'Riga' },
  'EYVI': { iata: 'VNO', name: 'Vilnius', city: 'Vilnius' },
  'UKKK': { iata: 'IEV', name: 'Kyiv Zhuliany', city: 'Kyiv' },
  'UKBB': { iata: 'KBP', name: 'Kyiv Boryspil', city: 'Kyiv' },
  'LTFM': { iata: 'IST', name: 'Istanbul', city: 'Istanbul' },
  'LTBA': { iata: 'IST', name: 'Istanbul Ataturk', city: 'Istanbul' },
  'OMDB': { iata: 'DXB', name: 'Dubai', city: 'Dubai' },
  'OTHH': { iata: 'DOH', name: 'Doha Hamad', city: 'Doha' },
  'EPWA': { iata: 'WAW', name: 'Warsaw Chopin', city: 'Warsaw' },
  'EPGD': { iata: 'GDN', name: 'Gdansk', city: 'Gdansk' },
  'EPWR': { iata: 'WRO', name: 'Wroclaw', city: 'Wroclaw' },
  'EPKK': { iata: 'KRK', name: 'Krakow Balice', city: 'Krakow' },
  'ENGN': { iata: 'SVG', name: 'Stavanger', city: 'Stavanger' },
  'LGAV': { iata: 'ATH', name: 'Athens', city: 'Athens' },
  'LCLK': { iata: 'LCA', name: 'Larnaca', city: 'Larnaca' },
  'GCLP': { iata: 'LPA', name: 'Gran Canaria', city: 'Las Palmas' },
  'GCFV': { iata: 'FUE', name: 'Fuerteventura', city: 'Fuerteventura' },
  'GCTS': { iata: 'TFS', name: 'Tenerife South', city: 'Tenerife' },
  'LMML': { iata: 'MLA', name: 'Malta', city: 'Malta' },
  'LHBP': { iata: 'BUD', name: 'Budapest', city: 'Budapest' },
  'LKPR': { iata: 'PRG', name: 'Prague', city: 'Prague' },
  'LYBE': { iata: 'BEG', name: 'Belgrade', city: 'Belgrade' },
  'LDZA': { iata: 'ZAG', name: 'Zagreb', city: 'Zagreb' },
  'LROP': { iata: 'OTP', name: 'Bucharest', city: 'Bucharest' },
  'LBSF': { iata: 'SOF', name: 'Sofia', city: 'Sofia' },
};

export interface ScrapedFlight {
  time: string;
  destination: string;
  airportCode: string;
  flightNumber: string;
  airlineCode: string;
  airlineName: string;
  status: string;
  type: 'arrival' | 'departure';
}

type FlightSource = 'live' | 'static';

interface FlightsCache {
  arrivals: ScrapedFlight[];
  departures: ScrapedFlight[];
  arrivalsSource: FlightSource;
  departuresSource: FlightSource;
  lastFetched: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: FlightsCache | null = null;

function getAirlineName(code: string): string {
  return AIRLINE_CODES[code] || code;
}

function parseFlightsFromHtml(html: string, type: 'arrival' | 'departure'): ScrapedFlight[] {
  const flights: ScrapedFlight[] = [];

  const rowRegex = /<tr>\s*<th scope="row">\s*(\d{1,2}:\d{2})\s*<\/th>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>([A-Z0-9]+ \d+)<\/td>\s*<td>\s*<span class="flight_status">\s*([\s\S]*?)\s*<\/span>/g;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const time = match[1].trim();
    const directionRaw = match[2].replace(/\s+/g, ' ').trim();
    const flightNumber = match[3].trim();
    const status = match[4].replace(/\s+/g, ' ').trim();

    const codeMatch = directionRaw.match(/\(([A-Z]{3})\)/);
    const airportCode = codeMatch ? codeMatch[1] : '';
    const destination = directionRaw.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim();

    const airlineCode = flightNumber.split(' ')[0];
    const airlineName = getAirlineName(airlineCode);

    flights.push({
      time,
      destination,
      airportCode,
      flightNumber,
      airlineCode,
      airlineName,
      status,
      type,
    });
  }

  return flights;
}

const ENABLE_EXTERNAL_SIGNALS = process.env.ENABLE_EXTERNAL_SIGNALS === "true";

async function fetchFlightsFromKrakowAirport(type: 'arrival' | 'departure'): Promise<ScrapedFlight[] | null> {
  if (!ENABLE_EXTERNAL_SIGNALS) {
    console.log("[AirportScraper] External signals disabled (ENABLE_EXTERNAL_SIGNALS != 'true'). Skipping fetch.");
    return null;
  }

  const slug = type === 'departure' ? 'departures' : 'arrivals';
  const url = `https://www.krakowairport.pl/en/passenger/flights/destinations/${slug}/`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'DNT': '1',
      },
    }, 8000);

    if (!res.ok) {
      console.warn(`[AirportScraper] krakowairport.pl returned ${res.status} for ${slug}`);
      return null;
    }

    const html = await res.text();
    const flights = parseFlightsFromHtml(html, type);
    console.log(`[AirportScraper] Parsed ${flights.length} ${slug} from krakowairport.pl`);
    return flights;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[AirportScraper] krakowairport.pl timed out for ${slug}`);
    } else {
      console.warn(`[AirportScraper] krakowairport.pl fetch error for ${slug}:`, err);
    }
    return null;
  }
}

function unixToPolandTime(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleTimeString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function icaoCallsignToFlight(callsign: string): { airlineCode: string; airlineName: string; flightNumber: string } {
  const raw = callsign.trim().toUpperCase();
  const icaoPrefix = raw.slice(0, 3);
  const iataCode = ICAO_AIRLINE_TO_IATA[icaoPrefix] || raw.slice(0, 2);
  const numericPart = raw.replace(/^[A-Z]+/, '');
  const flightNumber = `${iataCode} ${numericPart}`;
  return {
    airlineCode: iataCode,
    airlineName: getAirlineName(iataCode),
    flightNumber,
  };
}

function icaoAirportToDisplay(icao: string): { airportCode: string; destination: string } {
  const info = ICAO_AIRPORT_TO_INFO[icao?.toUpperCase()];
  if (info) {
    return { airportCode: info.iata, destination: `${info.city.toUpperCase()} (${info.iata})` };
  }
  return { airportCode: icao || '???', destination: icao || 'Unknown' };
}

interface OpenSkyFlight {
  icao24: string;
  firstSeen: number;
  estDepartureAirport: string | null;
  lastSeen: number;
  estArrivalAirport: string | null;
  callsign: string | null;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFlightsFromOpenSky(type: 'arrival' | 'departure'): Promise<ScrapedFlight[]> {
  const now = Math.floor(Date.now() / 1000);
  const begin = now - 12 * 3600;
  const end = now + 6 * 3600;
  const endpoint = type === 'arrival' ? 'arrival' : 'departure';
  const url = `https://opensky-network.org/api/flights/${endpoint}?airport=EPKK&begin=${begin}&end=${end}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'ShiftOptima/1.0',
        'Accept': 'application/json',
      },
    }, 6000);

    if (!res.ok) {
      console.warn(`[AirportScraper] OpenSky returned ${res.status} for ${endpoint}`);
      return [];
    }

    const data: OpenSkyFlight[] = await res.json();
    if (!Array.isArray(data)) return [];

    const flights: ScrapedFlight[] = data
      .filter(f => f.callsign && f.callsign.trim().length > 0)
      .map(f => {
        const { airlineCode, airlineName, flightNumber } = icaoCallsignToFlight(f.callsign!);
        const otherAirport = type === 'arrival' ? f.estDepartureAirport : f.estArrivalAirport;
        const { airportCode, destination } = icaoAirportToDisplay(otherAirport || '');
        const timeTs = type === 'arrival' ? f.lastSeen : f.firstSeen;
        const time = unixToPolandTime(timeTs);
        const statusLabel = type === 'arrival' ? 'Landed' : 'Departed';

        return {
          time,
          destination,
          airportCode,
          flightNumber,
          airlineCode,
          airlineName,
          status: `${statusLabel} ${time}`,
          type,
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    console.log(`[AirportScraper] Fetched ${flights.length} ${endpoint} from OpenSky Network`);
    return flights;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[AirportScraper] OpenSky timed out for ${endpoint}`);
    } else {
      console.warn(`[AirportScraper] OpenSky fetch error for ${endpoint}:`, err);
    }
    return [];
  }
}

// Static KRK schedule: realistic flights that run most days at Krakow Balice.
// Used as a last-resort fallback when both live sources are unavailable.
const STATIC_DEPARTURES: Array<{ time: string; airportCode: string; destination: string; airlineCode: string; flightNumber: string }> = [
  { time: '06:00', airportCode: 'STN', destination: 'LONDON (STN)', airlineCode: 'FR', flightNumber: 'FR 1234' },
  { time: '06:30', airportCode: 'WAW', destination: 'WARSAW (WAW)', airlineCode: 'LO', flightNumber: 'LO 301' },
  { time: '07:10', airportCode: 'LTN', destination: 'LONDON (LTN)', airlineCode: 'W6', flightNumber: 'W6 3501' },
  { time: '07:45', airportCode: 'FRA', destination: 'FRANKFURT (FRA)', airlineCode: 'LH', flightNumber: 'LH 1387' },
  { time: '08:20', airportCode: 'MUC', destination: 'MUNICH (MUC)', airlineCode: 'LH', flightNumber: 'LH 1675' },
  { time: '08:55', airportCode: 'AMS', destination: 'AMSTERDAM (AMS)', airlineCode: 'KL', flightNumber: 'KL 1363' },
  { time: '09:30', airportCode: 'VIE', destination: 'VIENNA (VIE)', airlineCode: 'OS', flightNumber: 'OS 728' },
  { time: '10:05', airportCode: 'BCN', destination: 'BARCELONA (BCN)', airlineCode: 'VY', flightNumber: 'VY 6261' },
  { time: '10:40', airportCode: 'CDG', destination: 'PARIS (CDG)', airlineCode: 'AF', flightNumber: 'AF 1440' },
  { time: '11:15', airportCode: 'LGW', destination: 'LONDON (LGW)', airlineCode: 'FR', flightNumber: 'FR 8142' },
  { time: '11:50', airportCode: 'BRU', destination: 'BRUSSELS (BRU)', airlineCode: 'SN', flightNumber: 'SN 2801' },
  { time: '12:25', airportCode: 'IST', destination: 'ISTANBUL (IST)', airlineCode: 'TK', flightNumber: 'TK 1762' },
  { time: '13:00', airportCode: 'ZRH', destination: 'ZURICH (ZRH)', airlineCode: 'LX', flightNumber: 'LX 1342' },
  { time: '13:35', airportCode: 'MAN', destination: 'MANCHESTER (MAN)', airlineCode: 'FR', flightNumber: 'FR 4412' },
  { time: '14:10', airportCode: 'EMA', destination: 'EAST MIDLANDS (EMA)', airlineCode: 'FR', flightNumber: 'FR 7718' },
  { time: '14:45', airportCode: 'DXB', destination: 'DUBAI (DXB)', airlineCode: 'QR', flightNumber: 'QR 165' },
  { time: '15:20', airportCode: 'OSL', destination: 'OSLO (OSL)', airlineCode: 'DY', flightNumber: 'DY 1422' },
  { time: '15:55', airportCode: 'CPH', destination: 'COPENHAGEN (CPH)', airlineCode: 'SK', flightNumber: 'SK 714' },
  { time: '16:30', airportCode: 'MAD', destination: 'MADRID (MAD)', airlineCode: 'VY', flightNumber: 'VY 6255' },
  { time: '17:05', airportCode: 'LHR', destination: 'LONDON (LHR)', airlineCode: 'BA', flightNumber: 'BA 854' },
  { time: '17:40', airportCode: 'ATH', destination: 'ATHENS (ATH)', airlineCode: 'A3', flightNumber: 'A3 351' },
  { time: '18:15', airportCode: 'PRG', destination: 'PRAGUE (PRG)', airlineCode: 'LO', flightNumber: 'LO 585' },
  { time: '18:50', airportCode: 'ARN', destination: 'STOCKHOLM (ARN)', airlineCode: 'SK', flightNumber: 'SK 726' },
  { time: '19:25', airportCode: 'FCO', destination: 'ROME (FCO)', airlineCode: 'FR', flightNumber: 'FR 6621' },
  { time: '20:00', airportCode: 'STN', destination: 'LONDON (STN)', airlineCode: 'FR', flightNumber: 'FR 1236' },
  { time: '20:35', airportCode: 'LTN', destination: 'LONDON (LTN)', airlineCode: 'W6', flightNumber: 'W6 3503' },
  { time: '21:10', airportCode: 'WAW', destination: 'WARSAW (WAW)', airlineCode: 'LO', flightNumber: 'LO 311' },
  { time: '21:45', airportCode: 'BUD', destination: 'BUDAPEST (BUD)', airlineCode: 'W6', flightNumber: 'W6 2241' },
];

const STATIC_ARRIVALS: Array<{ time: string; airportCode: string; destination: string; airlineCode: string; flightNumber: string }> = [
  { time: '05:50', airportCode: 'STN', destination: 'LONDON (STN)', airlineCode: 'FR', flightNumber: 'FR 1233' },
  { time: '06:25', airportCode: 'LTN', destination: 'LONDON (LTN)', airlineCode: 'W6', flightNumber: 'W6 3500' },
  { time: '07:00', airportCode: 'WAW', destination: 'WARSAW (WAW)', airlineCode: 'LO', flightNumber: 'LO 300' },
  { time: '07:35', airportCode: 'FRA', destination: 'FRANKFURT (FRA)', airlineCode: 'LH', flightNumber: 'LH 1386' },
  { time: '08:10', airportCode: 'MUC', destination: 'MUNICH (MUC)', airlineCode: 'LH', flightNumber: 'LH 1674' },
  { time: '08:45', airportCode: 'AMS', destination: 'AMSTERDAM (AMS)', airlineCode: 'KL', flightNumber: 'KL 1362' },
  { time: '09:20', airportCode: 'VIE', destination: 'VIENNA (VIE)', airlineCode: 'OS', flightNumber: 'OS 727' },
  { time: '09:55', airportCode: 'BCN', destination: 'BARCELONA (BCN)', airlineCode: 'VY', flightNumber: 'VY 6260' },
  { time: '10:30', airportCode: 'CDG', destination: 'PARIS (CDG)', airlineCode: 'AF', flightNumber: 'AF 1441' },
  { time: '11:05', airportCode: 'LGW', destination: 'LONDON (LGW)', airlineCode: 'FR', flightNumber: 'FR 8141' },
  { time: '11:40', airportCode: 'BRU', destination: 'BRUSSELS (BRU)', airlineCode: 'SN', flightNumber: 'SN 2800' },
  { time: '12:15', airportCode: 'IST', destination: 'ISTANBUL (IST)', airlineCode: 'TK', flightNumber: 'TK 1761' },
  { time: '12:50', airportCode: 'ZRH', destination: 'ZURICH (ZRH)', airlineCode: 'LX', flightNumber: 'LX 1343' },
  { time: '13:25', airportCode: 'MAN', destination: 'MANCHESTER (MAN)', airlineCode: 'FR', flightNumber: 'FR 4411' },
  { time: '14:00', airportCode: 'EMA', destination: 'EAST MIDLANDS (EMA)', airlineCode: 'FR', flightNumber: 'FR 7717' },
  { time: '14:35', airportCode: 'DXB', destination: 'DUBAI (DXB)', airlineCode: 'QR', flightNumber: 'QR 164' },
  { time: '15:10', airportCode: 'OSL', destination: 'OSLO (OSL)', airlineCode: 'DY', flightNumber: 'DY 1421' },
  { time: '15:45', airportCode: 'CPH', destination: 'COPENHAGEN (CPH)', airlineCode: 'SK', flightNumber: 'SK 713' },
  { time: '16:20', airportCode: 'MAD', destination: 'MADRID (MAD)', airlineCode: 'VY', flightNumber: 'VY 6254' },
  { time: '16:55', airportCode: 'LHR', destination: 'LONDON (LHR)', airlineCode: 'BA', flightNumber: 'BA 853' },
  { time: '17:30', airportCode: 'ATH', destination: 'ATHENS (ATH)', airlineCode: 'A3', flightNumber: 'A3 350' },
  { time: '18:05', airportCode: 'PRG', destination: 'PRAGUE (PRG)', airlineCode: 'LO', flightNumber: 'LO 584' },
  { time: '18:40', airportCode: 'ARN', destination: 'STOCKHOLM (ARN)', airlineCode: 'SK', flightNumber: 'SK 725' },
  { time: '19:15', airportCode: 'FCO', destination: 'ROME (FCO)', airlineCode: 'FR', flightNumber: 'FR 6620' },
  { time: '19:50', airportCode: 'STN', destination: 'LONDON (STN)', airlineCode: 'FR', flightNumber: 'FR 1235' },
  { time: '20:25', airportCode: 'LTN', destination: 'LONDON (LTN)', airlineCode: 'W6', flightNumber: 'W6 3502' },
  { time: '21:00', airportCode: 'WAW', destination: 'WARSAW (WAW)', airlineCode: 'LO', flightNumber: 'LO 310' },
  { time: '21:35', airportCode: 'BUD', destination: 'BUDAPEST (BUD)', airlineCode: 'W6', flightNumber: 'W6 2240' },
];

function generateStaticFallbackFlights(type: 'arrival' | 'departure'): ScrapedFlight[] {
  const template = type === 'arrival' ? STATIC_ARRIVALS : STATIC_DEPARTURES;

  return template.map(f => ({
    time: f.time,
    destination: f.destination,
    airportCode: f.airportCode,
    flightNumber: f.flightNumber,
    airlineCode: f.airlineCode,
    airlineName: getAirlineName(f.airlineCode),
    status: 'Typical schedule',
    type,
  }));
}

async function fetchFlightsPage(type: 'arrival' | 'departure'): Promise<{ flights: ScrapedFlight[]; source: FlightSource }> {
  const primary = await fetchFlightsFromKrakowAirport(type);
  if (primary !== null && primary.length > 0) {
    return { flights: primary, source: 'live' };
  }

  console.log(`[AirportScraper] Falling back to OpenSky Network for ${type}s`);
  const openSky = await fetchFlightsFromOpenSky(type);
  if (openSky.length > 0) {
    return { flights: openSky, source: 'live' };
  }

  console.log(`[AirportScraper] Both live sources failed for ${type}s — using static schedule fallback`);
  return { flights: generateStaticFallbackFlights(type), source: 'static' };
}

export async function getKrakowAirportFlights(): Promise<{
  arrivals: ScrapedFlight[];
  departures: ScrapedFlight[];
  arrivalsSource: FlightSource;
  departuresSource: FlightSource;
}> {
  if (cache && Date.now() - cache.lastFetched < CACHE_TTL_MS) {
    return {
      arrivals: cache.arrivals,
      departures: cache.departures,
      arrivalsSource: cache.arrivalsSource,
      departuresSource: cache.departuresSource,
    };
  }

  const [depResult, arrResult] = await Promise.all([
    fetchFlightsPage('departure'),
    fetchFlightsPage('arrival'),
  ]);

  cache = {
    arrivals: arrResult.flights,
    departures: depResult.flights,
    arrivalsSource: arrResult.source,
    departuresSource: depResult.source,
    lastFetched: Date.now(),
  };

  return {
    arrivals: cache.arrivals,
    departures: cache.departures,
    arrivalsSource: cache.arrivalsSource,
    departuresSource: cache.departuresSource,
  };
}

export function clearAirportCache(): void {
  cache = null;
}

export function getAirportCacheMeta(): {
  lastFetchedAt: number | null;
  cacheAgeMs: number | null;
  arrivalsCount: number;
  departuresCount: number;
} {
  if (!cache) {
    return {
      lastFetchedAt: null,
      cacheAgeMs: null,
      arrivalsCount: 0,
      departuresCount: 0,
    };
  }

  return {
    lastFetchedAt: cache.lastFetched,
    cacheAgeMs: Date.now() - cache.lastFetched,
    arrivalsCount: cache.arrivals.length,
    departuresCount: cache.departures.length,
  };
}
