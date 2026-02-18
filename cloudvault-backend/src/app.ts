import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/env";
import { apiKeyMiddleware } from "./middleware/apiKey.middleware";
import { errorHandlerMiddleware } from "./middleware/errorHandler.middleware";
import router from "./routes";

export function createApp(): express.Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.ALLOWED_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-API-Key"],
    })
  );

  // JSON body parser (for non-file JSON bodies only)
  app.use(express.json({ limit: "1mb" }));

  // API key guard (skips /health)
  app.use(apiKeyMiddleware);

  // Routes
  app.use(router);

  // Global error handler (must be last)
  app.use(errorHandlerMiddleware);

  return app;
}
