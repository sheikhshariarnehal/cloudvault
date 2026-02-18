import { config } from "./config/env";
import { createApp } from "./app";
import { initTelegramClient, disconnectTelegramClient } from "./services/telegram.service";

async function main(): Promise<void> {
  console.log("[Server] Initializing Telegram client...");
  await initTelegramClient();

  const app = createApp();

  const server = app.listen(config.PORT, () => {
    console.log(`[Server] CloudVault backend listening on port ${config.PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Server] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectTelegramClient();
      console.log("[Server] Shutdown complete");
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      console.error("[Server] Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
