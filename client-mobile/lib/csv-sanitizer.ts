const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5_000;

export type SanitizedCsvResult = {
  csv: string;
  acceptedRows: number;
  rejectedRows: number;
  removedFields: string[];
  distanceAvailable: false;
};

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
}

function countDelimiter(line: string, delimiter: string) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) count += 1;
  }
  return count;
}

function parseCsv(source: string) {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = countDelimiter(firstLine, ";") > countDelimiter(firstLine, ",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      row.push(field); field = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) throw new Error(`Plik może zawierać maksymalnie ${MAX_ROWS} wierszy.`);
    } else field += character;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (quoted) throw new Error("Plik CSV zawiera niedomknięte pole tekstowe.");
  return rows;
}

function decimal(value: string) {
  const compact = value.replace(/\s/g, "");
  const separator = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
  const normalized = separator >= 0
    ? `${compact.slice(0, separator).replace(/[.,]/g, "")}.${compact.slice(separator + 1).replace(/[.,]/g, "")}`
    : compact;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100_000 ? parsed : null;
}

function hourBucket(value: string) {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour));
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day) || Number(hour) > 23) return null;
  return `${day}.${month}.${year} ${hour}:00`;
}

function coarsePickupArea(value: string) {
  const postal = value.match(/\b(3\d)-(\d)\d{2}\b/);
  if (postal) return `Kraków ${postal[1]}-${postal[2]}xx`;
  return "Kraków · strefa nieznana";
}

function quote(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function sanitizeEarningsCsv(source: string, sizeBytes: number): SanitizedCsvResult {
  if (sizeBytes > MAX_FILE_BYTES || source.length > MAX_FILE_BYTES) throw new Error("Plik CSV może mieć maksymalnie 5 MB.");
  const rows = parseCsv(source);
  if (rows.length < 2) throw new Error("Plik CSV nie zawiera danych przejazdów.");
  const headers = rows[0]!.map(normalizeHeader);
  const column = (...names: string[]) => headers.findIndex((header) => names.some((name) => header === normalizeHeader(name)));
  const tripDateIndex = column("Datum der Fahrt", "Trip date", "Ride date");
  const pickupIndex = column("Abholadresse", "Pickup", "Pick-up");
  const netIndex = column("Preis (ohne MwSt.)", "Price (excl. VAT)", "Net");
  if ([tripDateIndex, pickupIndex, netIndex].some((index) => index < 0)) {
    throw new Error("Brakuje wymaganych kolumn: Datum der Fahrt, Abholadresse lub Preis (ohne MwSt.).");
  }

  const output = [["Datum der Fahrt", "Abholadresse", "Preis (ohne MwSt.)", "Preis gesamt"].map(quote).join(",")];
  let rejectedRows = 0;
  for (const row of rows.slice(1)) {
    const date = hourBucket(row[tripDateIndex] ?? "");
    const net = decimal(row[netIndex] ?? "");
    if (!date || net === null) { rejectedRows += 1; continue; }
    const area = coarsePickupArea(row[pickupIndex] ?? "");
    output.push([date, area, net.toFixed(2), net.toFixed(2)].map(quote).join(","));
  }
  if (output.length === 1) throw new Error("Żaden wiersz nie przeszedł lokalnej walidacji.");

  return {
    csv: `${output.join("\n")}\n`,
    acceptedRows: output.length - 1,
    rejectedRows,
    removedFields: ["numery faktur", "dane pasażerów", "adresy odbiorców", "dane firmowe i podatkowe", "dokładne adresy odbioru", "minuty przejazdu"],
    distanceAvailable: false,
  };
}
