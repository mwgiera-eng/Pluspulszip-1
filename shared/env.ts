export function getEnv(name: string, required = false, defaultValue?: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v === null) {
    if (defaultValue !== undefined) return defaultValue;
    if (required) throw new Error(`Missing required env var: ${name}`);
    return undefined;
  }
  return v;
}

export function getEnvString(name: string, defaultValue = ""): string {
  return getEnv(name) ?? defaultValue;
}
