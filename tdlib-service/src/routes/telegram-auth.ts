/**
 * Telegram account authentication routes.
 *
 * Handles the interactive login flow:
 *   1. POST /send-code     — send phone number, get code via Telegram
 *   2. POST /verify-code   — submit the received auth code
 *   3. POST /verify-password — submit 2FA password (if enabled)
 *   4. GET  /status/:userId — check connection status
 *   5. POST /disconnect     — disconnect Telegram account
 */

import { Router, Request, Response } from "express";
import { sessionManager } from "../session-manager.js";

const router = Router();

// ── POST /api/telegram/send-code ─────────────────────────────────────────────
router.post("/send-code", async (req: Request, res: Response) => {
  const { userId, phone } = req.body;

  if (!userId || !phone) {
    res.status(400).json({ error: "userId and phone are required" });
    return;
  }

  // Basic phone format validation (international format starting with +)
  const cleanPhone = phone.replace(/[\s\-()]/g, "");
  if (!/^\+\d{7,15}$/.test(cleanPhone)) {
    res.status(400).json({ error: "Invalid phone number format. Use international format: +1234567890" });
    return;
  }

  try {
    const result = await sessionManager.startAuth(userId, cleanPhone);
    res.json(result);
  } catch (err) {
    console.error(`[TelegramAuth] send-code error for ${userId}:`, err);
    const msg = err instanceof Error ? err.message : "Failed to send code";
    const status = msg.includes("Too many") ? 429 : 500;
    res.status(status).json({ error: msg });
  }
});

// ── POST /api/telegram/verify-code ───────────────────────────────────────────
router.post("/verify-code", async (req: Request, res: Response) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    res.status(400).json({ error: "userId and code are required" });
    return;
  }

  // Sanitize code: digits only, 5-6 chars
  const cleanCode = String(code).replace(/\D/g, "");
  if (cleanCode.length < 4 || cleanCode.length > 8) {
    res.status(400).json({ error: "Invalid code format" });
    return;
  }

  try {
    const result = await sessionManager.verifyCode(userId, cleanCode);
    res.json(result);
  } catch (err) {
    console.error(`[TelegramAuth] verify-code error for ${userId}:`, err);
    const msg = err instanceof Error ? err.message : "Code verification failed";
    res.status(400).json({ error: msg });
  }
});

// ── POST /api/telegram/verify-password ───────────────────────────────────────
router.post("/verify-password", async (req: Request, res: Response) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    res.status(400).json({ error: "userId and password are required" });
    return;
  }

  try {
    const result = await sessionManager.verifyPassword(userId, password);
    res.json(result);
  } catch (err) {
    console.error(`[TelegramAuth] verify-password error for ${userId}:`, err);
    const msg = err instanceof Error ? err.message : "Password verification failed";
    res.status(400).json({ error: msg });
  }
});

// ── GET /api/telegram/status/:userId ─────────────────────────────────────────
router.get("/status/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const state = sessionManager.getSessionState(userId);
  res.json(state);
});

// ── POST /api/telegram/disconnect ────────────────────────────────────────────
router.post("/disconnect", async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    await sessionManager.destroySession(userId);
    res.json({ status: "disconnected" });
  } catch (err) {
    console.error(`[TelegramAuth] disconnect error for ${userId}:`, err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Disconnect failed",
    });
  }
});

export default router;
