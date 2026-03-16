import tdl from "tdl";
import { getTdjson } from "prebuilt-tdlib";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Service root = two levels up from dist/ or src/
const SERVICE_ROOT = path.resolve(__dirname, "..");

let clientInstance: ReturnType<typeof tdl.createClient> | null = null;
let isReady = false;

/**
 * TDLib client configuration
 */
interface TDLibConfig {
  apiId: number;
  apiHash: string;
  botToken: string;
  databasePath: string;
  filesPath: string;
}

function getConfig(): TDLibConfig {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

  // Resolve paths relative to service root so they work regardless of cwd
  const rawDbPath = process.env.TDLIB_DATABASE_PATH || "./tdlib-data";
  const rawFilesPath = process.env.TDLIB_FILES_PATH || "./tdlib-files";
  const databasePath = path.isAbsolute(rawDbPath)
    ? rawDbPath
    : path.join(SERVICE_ROOT, rawDbPath);
  const filesPath = path.isAbsolute(rawFilesPath)
    ? rawFilesPath
    : path.join(SERVICE_ROOT, rawFilesPath);

  if (!apiId || !apiHash || !botToken) {
    throw new Error(
      "Missing required env vars: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_BOT_TOKEN"
    );
  }

  return { apiId, apiHash, botToken, databasePath, filesPath };
}

/**
 * Initialize and return the TDLib client singleton.
 * Authenticates as a bot using the provided bot token.
 */
export async function getTDLibClient(): Promise<
  ReturnType<typeof tdl.createClient>
> {
  if (clientInstance && isReady) {
    return clientInstance;
  }

  if (clientInstance) {
    // Client exists but not ready — wait for it
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (isReady && clientInstance) {
          clearInterval(interval);
          resolve(clientInstance);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("TDLib client initialization timeout"));
      }, 30000);
    });
  }

  const config = getConfig();

  // Set the path to the prebuilt TDLib shared library
  tdl.configure({ tdjson: getTdjson() });

  clientInstance = tdl.createClient({
    apiId: config.apiId,
    apiHash: config.apiHash,
    databaseDirectory: config.databasePath,
    filesDirectory: config.filesPath,
  });

  // Handle auth flow for bot accounts
  clientInstance.on("error", (err) => {
    console.error("[TDLib Error]", err);
  });

  try {
    await clientInstance.login(() => ({
      type: "bot" as const,
      getToken: () => Promise.resolve(config.botToken),
    }));

    isReady = true;
    console.log("[TDLib] ✅ Bot authenticated successfully");

    // Log session info
    const me = await clientInstance.invoke({ _: "getMe" });
    console.log(
      `[TDLib] Logged in as: @${me.usernames?.editable_username || me.first_name} (ID: ${me.id})`
    );

    // Preload the storage channel into TDLib's local chat database.
    // Without this, sendMessage returns "Chat not found" even if the bot is admin.
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    if (channelId) {
      try {
        const chat = await clientInstance.invoke({
          _: "getChat",
          chat_id: parseInt(channelId, 10),
        });
        console.log(`[TDLib] ✅ Channel resolved: "${chat.title}" (${channelId})`);
      } catch {
        // Chat not in local DB yet — try loading it from the server
        console.log("[TDLib] Channel not cached, loading chats from server...");
        try {
          // Load the chat list so TDLib fetches the bot's chats from Telegram
          await clientInstance.invoke({
            _: "loadChats",
            chat_list: { _: "chatListMain" },
            limit: 50,
          });
          // Try getChat again after loading
          const chat = await clientInstance.invoke({
            _: "getChat",
            chat_id: parseInt(channelId, 10),
          });
          console.log(`[TDLib] ✅ Channel resolved after load: "${chat.title}" (${channelId})`);
        } catch (err2) {
          console.warn(
            `[TDLib] ⚠️  Could not preload channel ${channelId}: ${err2}. ` +
            `Make sure the bot is an admin in the channel.`
          );
        }
      }
    }

    return clientInstance;
  } catch (err) {
    clientInstance = null;
    isReady = false;
    throw new Error(`TDLib authentication failed: ${err}`);
  }
}

/**
 * Gracefully close the TDLib client
 */
export async function closeTDLibClient(): Promise<void> {
  if (clientInstance) {
    try {
      await clientInstance.close();
    } catch {
      // Ignore close errors
    }
    clientInstance = null;
    isReady = false;
    console.log("[TDLib] Client closed");
  }
}

/**
 * Check if the client is connected and ready
 */
export function isClientReady(): boolean {
  return isReady && clientInstance !== null;
}
