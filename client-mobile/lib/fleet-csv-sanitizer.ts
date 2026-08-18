import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Location from "expo-location";

export type FleetSanitizedTrip = {
  tripId: string;
  pickupGeohash: string;
  dropoffGeohash: string;
  startEpoch: number;
  netIncome: number;
  distanceKm: number;
  timeSlot: number;
  dayOfWeek: number;
};

export type FleetSanitizationResult = {
  trips: FleetSanitizedTrip[];
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  errors: { rowNumber: number; field: string; message: string }[];
  removedFields: string[];
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 50_000;
const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const identityFile = new File(Paths.document, "pluspuls-fleet-identities.json");

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("de-DE").replace(/[_.-]+/g, " ").replace(/\s+/g, " ");
}

function delimiterFor(firstLine: string) {
  const count = (delimiter: string) => {
    let quoted = false, total = 0;
    for (let index = 0; index < firstLine.length; index += 1) {
      if (firstLine[index] === '"') quoted = !quoted;
      else if (!quoted && firstLine[index] === delimiter) total += 1;
    }
    return total;
  };
  return [[";", count(";")], ["\t", count("\t")], [",", count(",")]].sort((left, right) => Number(right[1]) - Number(left[1]))[0]![0] as string;
}

function parseCsv(source: string) {
  const delimiter = delimiterFor(source.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let current: string[] = [], field = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      current.push(field); field = "";
    } else if (!quoted && (character === "\r" || character === "\n")) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      current.push(field); field = "";
      if (current.some((value) => value.trim())) rows.push(current);
      current = [];
      if (rows.length > MAX_ROWS + 1) throw new Error(`Plik może zawierać maksymalnie ${MAX_ROWS} przejazdów.`);
    } else field += character;
  }
  if (field || current.length) { current.push(field); if (current.some((value) => value.trim())) rows.push(current); }
  if (quoted) throw new Error("Plik CSV zawiera niedomknięte pole tekstowe.");
  return rows;
}

function parseNumber(value: string) {
  const compact = value.trim().replace(/\s/g, "");
  const separator = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
  const normalized = separator >= 0
    ? `${compact.slice(0, separator).replace(/[.,]/g, "")}.${compact.slice(separator + 1).replace(/[.,]/g, "")}`
    : compact;
  const parsed = Number(normalized.replace(/[^0-9+.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGermanDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(day) || date.getMonth() !== Number(month) - 1 || Number(hour) > 23 || Number(minute) > 59) return null;
  return date;
}

function encodeGeohash(latitude: number, longitude: number, precision = 5) {
  let output = "", bits = 0, bit = 0, even = true;
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  while (output.length < precision) {
    if (even) {
      const middle = (minLng + maxLng) / 2;
      if (longitude >= middle) { bits = (bits << 1) | 1; minLng = middle; } else { bits <<= 1; maxLng = middle; }
    } else {
      const middle = (minLat + maxLat) / 2;
      if (latitude >= middle) { bits = (bits << 1) | 1; minLat = middle; } else { bits <<= 1; maxLat = middle; }
    }
    even = !even; bit += 1;
    if (bit === 5) { output += GEOHASH_BASE32[bits]; bits = 0; bit = 0; }
  }
  return output;
}

function haversineKm(left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitude = radians(right.latitude - left.latitude), longitude = radians(right.longitude - left.longitude);
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dangerousCell(value: string) {
  return /^[=+@\t\r]/.test(value.trim());
}

async function geocode(address: string, cache: Map<string, { latitude: number; longitude: number } | null>) {
  const key = address.trim().toLocaleLowerCase("pl-PL");
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const results = await Location.geocodeAsync(/polsk|poland/i.test(address) ? address : `${address}, Polska`);
    const first = results[0];
    const value = first && Number.isFinite(first.latitude) && Number.isFinite(first.longitude)
      ? { latitude: first.latitude, longitude: first.longitude }
      : null;
    cache.set(key, value); return value;
  } catch { cache.set(key, null); return null; }
}

function readCoordinates(row: string[], latitudeIndex: number, longitudeIndex: number) {
  if (latitudeIndex < 0 || longitudeIndex < 0) return null;
  const latitude = parseNumber(row[latitudeIndex] ?? ""), longitude = parseNumber(row[longitudeIndex] ?? "");
  return latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}

export async function getAnonymousDriverId(displayName: string) {
  const key = displayName.trim().toLocaleLowerCase("pl-PL");
  if (!key) throw new Error("Wpisz pseudonim kierowcy.");
  let values: Record<string, string> = {};
  try { if (identityFile.exists) values = JSON.parse(await identityFile.text()) as Record<string, string>; } catch { values = {}; }
  if (!values[key]) {
    values[key] = Crypto.randomUUID();
    identityFile.create({ intermediates: true, overwrite: true });
    identityFile.write(JSON.stringify(values));
  }
  return values[key]!;
}

export async function digestTrips(trips: FleetSanitizedTrip[]) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(trips));
}

export async function sanitizeFleetCsv(source: string, sizeBytes: number, onProgress?: (done: number, total: number) => void): Promise<FleetSanitizationResult> {
  if (sizeBytes > MAX_FILE_BYTES || source.length > MAX_FILE_BYTES) throw new Error("Plik floty może mieć maksymalnie 10 MB.");
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error("Plik nie zawiera przejazdów.");
  const headers = rows[0]!.map(normalizeHeader);
  const column = (...aliases: string[]) => headers.findIndex((header) => aliases.some((alias) => header === normalizeHeader(alias)));
  const dateIndex = column("Datum der Fahrt", "Ride date", "Trip date", "start time");
  const pickupIndex = column("Abholadresse", "Pickup", "Pick-up", "Startadresse", "pickup address");
  const dropoffIndex = column("Zieladresse", "Absetzadresse", "Dropoff", "Drop-off", "Destination", "Adresse des Empfängers");
  const netIndex = column("Preis (ohne MwSt.)", "Net", "Net income", "Price excl VAT");
  const taxIndex = column("MwSt.", "MwSt", "VAT", "Tax");
  const totalIndex = column("Preis gesamt", "Total", "Gross");
  const distanceIndex = column("Strecke (km)", "Distanz (km)", "Kilometer", "Mileage", "Distance", "distanceKm");
  const pickupLatIndex = column("pickup lat", "pickup latitude", "start lat");
  const pickupLngIndex = column("pickup lng", "pickup lon", "pickup longitude", "start lng");
  const dropoffLatIndex = column("dropoff lat", "dropoff latitude", "destination lat");
  const dropoffLngIndex = column("dropoff lng", "dropoff lon", "dropoff longitude", "destination lng");
  if (dateIndex < 0 || netIndex < 0 || (pickupIndex < 0 && pickupLatIndex < 0) || (dropoffIndex < 0 && dropoffLatIndex < 0)) {
    throw new Error("Brakuje wymaganych pól przejazdu: czas, odbiór, cel lub dochód netto.");
  }

  const errors: FleetSanitizationResult["errors"] = [], trips: FleetSanitizedTrip[] = [];
  const cache = new Map<string, { latitude: number; longitude: number } | null>();
  const dataRows = rows.slice(1, MAX_ROWS + 1);
  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index]!, rowNumber = index + 2;
    onProgress?.(index, dataRows.length);
    if (row.some(dangerousCell)) { errors.push({ rowNumber, field: "security", message: "Odrzucono potencjalną formułę CSV." }); continue; }
    const date = parseGermanDate(row[dateIndex] ?? ""), netIncome = parseNumber(row[netIndex] ?? "");
    const tax = taxIndex >= 0 ? parseNumber(row[taxIndex] ?? "") : null, total = totalIndex >= 0 ? parseNumber(row[totalIndex] ?? "") : null;
    if (!date || netIncome === null || netIncome <= 0 || netIncome > 100_000) { errors.push({ rowNumber, field: "trip", message: "Niepoprawna data lub kwota netto." }); continue; }
    if (tax !== null && total !== null && Math.abs(netIncome + tax - total) > 0.03) { errors.push({ rowNumber, field: "price", message: "Suma netto i VAT nie zgadza się z kwotą całkowitą." }); continue; }

    const pickup = readCoordinates(row, pickupLatIndex, pickupLngIndex) ?? await geocode(row[pickupIndex] ?? "", cache);
    const dropoff = readCoordinates(row, dropoffLatIndex, dropoffLngIndex) ?? await geocode(row[dropoffIndex] ?? "", cache);
    if (!pickup || !dropoff) { errors.push({ rowNumber, field: "route", message: "Nie udało się zlokalizować odbioru lub celu." }); continue; }
    const suppliedDistance = distanceIndex >= 0 ? parseNumber(row[distanceIndex] ?? "") : null;
    const distanceKm = suppliedDistance && suppliedDistance >= 0.1 && suppliedDistance <= 500 ? suppliedDistance : haversineKm(pickup, dropoff);
    if (!Number.isFinite(distanceKm) || distanceKm < 0.1 || distanceKm > 500) { errors.push({ rowNumber, field: "distance", message: "Niepoprawny przebieg przejazdu." }); continue; }
    trips.push({
      tripId: Crypto.randomUUID(), pickupGeohash: encodeGeohash(pickup.latitude, pickup.longitude), dropoffGeohash: encodeGeohash(dropoff.latitude, dropoff.longitude),
      startEpoch: Math.floor(date.getTime() / 1000), netIncome: Math.round(netIncome * 100) / 100, distanceKm: Math.round(distanceKm * 100) / 100,
      timeSlot: date.getHours(), dayOfWeek: date.getDay(),
    });
  }
  onProgress?.(dataRows.length, dataRows.length);
  if (!trips.length) throw new Error(errors[0]?.message ?? "Żaden przejazd nie przeszedł walidacji.");
  return {
    trips, totalRows: dataRows.length, acceptedRows: trips.length, rejectedRows: dataRows.length - trips.length, errors: errors.slice(0, 25),
    removedFields: ["numery faktur", "nazwy i dane pasażerów", "dane firmowe i podatkowe", "dokładne adresy odbioru i celu", "identyfikatory platformy"],
  };
}
