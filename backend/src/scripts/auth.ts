/**
 * One-time interactive Telegram authentication script.
 *
 * Run with:  npm run auth
 *
 * After successful login, copy the printed session string
 * into TELEGRAM_SESSION in your .env file.
 */
import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";

const API_ID = parseInt(process.env.TELEGRAM_API_ID || "", 10);
const API_HASH = process.env.TELEGRAM_API_HASH || "";

if (!API_ID || !API_HASH) {
  console.error(
    "Set TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables before running this script."
  );
  process.exit(1);
}

(async () => {
  console.log("Starting Telegram authentication...\n");

  const session = new StringSession("");
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Enter your phone number: "),
    password: async () => await input.text("Enter your 2FA password (if any): "),
    phoneCode: async () => await input.text("Enter the code you received: "),
    onError: (err) => console.error("Auth error:", err),
  });

  console.log("\n✅ Authentication successful!\n");
  console.log("Your session string (copy this into TELEGRAM_SESSION in .env):\n");
  console.log(client.session.save());
  console.log();

  await client.disconnect();
})();
