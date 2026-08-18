import { File, Paths } from "expo-file-system";

export type ShiftSetup = { region: string; startHour: number };
const SETUP_FILE = new File(Paths.document, "pluspuls-shift.json");

export async function readShiftSetup(): Promise<ShiftSetup | null> {
  try {
    if (!SETUP_FILE.exists) return null;
    const value = JSON.parse(await SETUP_FILE.text()) as Partial<ShiftSetup>;
    if (typeof value.region !== "string" || !Number.isInteger(value.startHour) || value.startHour! < 0 || value.startHour! > 23) return null;
    return { region: value.region.slice(0, 80), startHour: value.startHour! };
  } catch { return null; }
}

export function writeShiftSetup(setup: ShiftSetup) {
  if (!SETUP_FILE.exists) SETUP_FILE.create({ intermediates: true, overwrite: true });
  SETUP_FILE.write(JSON.stringify(setup));
}
