import "dotenv/config";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireNumericEnv(name: string, fallback?: string): number {
  const raw = requireEnv(name, fallback);
  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${name} must be numeric, got: "${raw}"`);
  }
  return num;
}

export const config = {
  PORT: requireNumericEnv("PORT", "3001"),
  API_KEY: requireEnv("API_KEY"),

  TELEGRAM_API_ID: requireNumericEnv("TELEGRAM_API_ID"),
  TELEGRAM_API_HASH: requireEnv("TELEGRAM_API_HASH"),
  TELEGRAM_SESSION: requireEnv("TELEGRAM_SESSION"),
  TELEGRAM_CHAT_ID: requireEnv("TELEGRAM_CHAT_ID", "me"),

  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),

  ALLOWED_ORIGIN: requireEnv("ALLOWED_ORIGIN"),
  TEMP_DIR: requireEnv("TEMP_DIR", "/tmp/cloudvault"),
} as const;
