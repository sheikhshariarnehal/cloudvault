/**
 * Multi-user TDLib session manager.
 *
 * Manages a pool of TDLib client instances — one per authenticated user,
 * plus a shared bot session for guest uploads and legacy file access.
 *
 * Sessions are persisted to disk by TDLib itself (database + files dirs).
 * On server restart, sessions reload from disk without re-authentication.
 * An LRU eviction policy keeps at most MAX_ACTIVE_SESSIONS user sessions
 * in memory simultaneously (each uses ~50–100 MB RAM).
 */

import tdl from "tdl";
import { getTdjson } from "prebuilt-tdlib";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ROOT = path.resolve(__dirname, "..");

// ── Configuration ────────────────────────────────────────────────────────────

const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_ACTIVE_SESSIONS || "3", 10);

function getApiConfig() {
  const apiId = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  if (!apiId || !apiHash) {
    throw new Error("Missing TELEGRAM_API_ID or TELEGRAM_API_HASH");
  }
  return { apiId, apiHash };
}

function resolvePath(raw: string): string {
  return path.isAbsolute(raw) ? raw : path.join(SERVICE_ROOT, raw);
}

// ── Types ────────────────────────────────────────────────────────────────────

type TDLibClient = ReturnType<typeof tdl.createClient>;

export type SessionState =
  | "initializing"
  | "waiting_phone"
  | "waiting_code"
  | "waiting_password"
  | "waiting_registration"
  | "ready"
  | "closing"
  | "closed";

interface AuthResolvers {
  resolvePhone?: (phone: string) => void;
  rejectPhone?: (err: Error) => void;
  resolveCode?: (code: string) => void;
  rejectCode?: (err: Error) => void;
  resolvePassword?: (password: string) => void;
  rejectPassword?: (err: Error) => void;
  /** Resolved when the entire login() promise settles. */
  loginPromise?: Promise<void>;
}

export interface UserSession {
  userId: string;
  client: TDLibClient;
  state: SessionState;
  lastActivity: number;
  telegramUserId: number | null;
  savedMessagesChatId: number | null;
  authResolvers: AuthResolvers;
  /** Phone number used during auth (stored so we can report it). */
  phone: string | null;
}

// ── Rate limiting for auth attempts ──────────────────────────────────────────
// Max 3 send-code attempts per user per 10 minutes
const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = 3;
const authAttempts = new Map<string, { count: number; windowStart: number }>();

function checkAuthRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(userId);
  if (!entry || now - entry.windowStart > AUTH_RATE_LIMIT_WINDOW_MS) {
    authAttempts.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= AUTH_RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

// ── Session Manager ──────────────────────────────────────────────────────────

class SessionManager {
  private activeSessions = new Map<string, UserSession>();
  private botSession: UserSession | null = null;
  private initialized = false;

  // ── Bot session (always alive, doesn't count toward pool limit) ──────────

  async initBot(): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    if (!botToken) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN");
    }

    const { apiId, apiHash } = getApiConfig();
    const rawDbPath = process.env.TDLIB_DATABASE_PATH || "./tdlib-data";
    const rawFilesPath = process.env.TDLIB_FILES_PATH || "./tdlib-files";
    const databaseDirectory = resolvePath(rawDbPath);
    const filesDirectory = resolvePath(rawFilesPath);

    tdl.configure({ tdjson: getTdjson() });

    const client = tdl.createClient({
      apiId,
      apiHash,
      databaseDirectory,
      filesDirectory,
    });

    client.on("error", (err) => {
      console.error("[SessionManager][Bot] Error:", err);
    });

    await client.login(() => ({
      type: "bot" as const,
      getToken: () => Promise.resolve(botToken),
    }));

    console.log("[SessionManager] Bot authenticated");

    const me = await client.invoke({ _: "getMe" });
    console.log(
      `[SessionManager] Bot: @${(me as any).usernames?.editable_username || (me as any).first_name} (ID: ${(me as any).id})`,
    );

    // Preload storage channel
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    if (channelId) {
      try {
        const chat = await client.invoke({
          _: "getChat",
          chat_id: parseInt(channelId, 10),
        });
        console.log(`[SessionManager] Channel resolved: "${(chat as any).title}" (${channelId})`);
      } catch {
        console.log("[SessionManager] Channel not cached, loading chats...");
        try {
          await client.invoke({
            _: "loadChats",
            chat_list: { _: "chatListMain" },
            limit: 50,
          });
          const chat = await client.invoke({
            _: "getChat",
            chat_id: parseInt(channelId, 10),
          });
          console.log(`[SessionManager] Channel resolved after load: "${(chat as any).title}"`);
        } catch (err2) {
          console.warn(`[SessionManager] Could not preload channel ${channelId}:`, err2);
        }
      }
    }

    this.botSession = {
      userId: "__bot__",
      client,
      state: "ready",
      lastActivity: Date.now(),
      telegramUserId: (me as any).id,
      savedMessagesChatId: null,
      authResolvers: {},
      phone: null,
    };

    this.initialized = true;
  }

  getBotClient(): TDLibClient {
    if (!this.botSession) {
      throw new Error("Bot session not initialized");
    }
    this.botSession.lastActivity = Date.now();
    return this.botSession.client;
  }

  isBotReady(): boolean {
    return this.botSession?.state === "ready";
  }

  // ── User session management ──────────────────────────────────────────────

  private getUserDataDir(userId: string): string {
    const rawDbPath = process.env.TDLIB_DATABASE_PATH || "./tdlib-data";
    const basePath = resolvePath(rawDbPath);
    return path.join(basePath, "users", userId);
  }

  private getUserFilesDir(userId: string): string {
    const rawFilesPath = process.env.TDLIB_FILES_PATH || "./tdlib-files";
    const basePath = resolvePath(rawFilesPath);
    return path.join(basePath, "users", userId);
  }

  /**
   * Check if a user has a persisted TDLib session on disk (previously authenticated).
   */
  hasPersistedSession(userId: string): boolean {
    const dir = this.getUserDataDir(userId);
    return fs.existsSync(dir);
  }

  /**
   * Get an active, ready-to-use session for a user.
   * Reactivates from disk if needed, evicting LRU session if pool is full.
   */
  async getSession(userId: string): Promise<UserSession> {
    // Check active pool first
    const existing = this.activeSessions.get(userId);
    if (existing && existing.state === "ready") {
      existing.lastActivity = Date.now();
      return existing;
    }

    // Check if there's a persisted session on disk
    if (!this.hasPersistedSession(userId)) {
      throw new Error("Telegram not connected. Please connect your Telegram account first.");
    }

    // Need to reactivate — make room if necessary
    await this.ensurePoolCapacity();

    // Create client from persisted session (TDLib auto-restores auth state)
    const session = await this.createUserClient(userId);

    // If TDLib already has a valid session on disk, it will go straight to ready
    // Wait for it to become ready
    if (session.state !== "ready") {
      await this.waitForReady(session, 30000);
    }

    return session;
  }

  /**
   * Get session state for a user (without activating).
   */
  getSessionState(userId: string): { connected: boolean; state: SessionState; telegramUserId: number | null } {
    const active = this.activeSessions.get(userId);
    if (active) {
      return {
        connected: active.state === "ready",
        state: active.state,
        telegramUserId: active.telegramUserId,
      };
    }
    if (this.hasPersistedSession(userId)) {
      return { connected: true, state: "closed", telegramUserId: null };
    }
    return { connected: false, state: "closed", telegramUserId: null };
  }

  // ── Auth flow ────────────────────────────────────────────────────────────

  /**
   * Start the Telegram authentication flow for a user.
   * Creates a TDLib client and sends the phone number.
   * Returns when TDLib is waiting for the auth code.
   */
  async startAuth(userId: string, phone: string): Promise<{ status: string }> {
    if (!checkAuthRateLimit(userId)) {
      throw new Error("Too many auth attempts. Try again in 10 minutes.");
    }

    // Clean up any existing auth-in-progress session
    const existing = this.activeSessions.get(userId);
    if (existing) {
      if (existing.state === "ready") {
        throw new Error("Telegram already connected. Disconnect first to reconnect.");
      }
      // Cancel in-progress auth
      await this.closeSession(userId);
    }

    await this.ensurePoolCapacity();

    const { apiId, apiHash } = getApiConfig();
    const dbDir = this.getUserDataDir(userId);
    const filesDir = this.getUserFilesDir(userId);

    // Clean any stale data from a previous failed auth
    if (fs.existsSync(dbDir)) {
      fs.rmSync(dbDir, { recursive: true, force: true });
    }
    fs.mkdirSync(dbDir, { recursive: true });
    fs.mkdirSync(filesDir, { recursive: true });

    const client = tdl.createClient({
      apiId,
      apiHash,
      databaseDirectory: dbDir,
      filesDirectory: filesDir,
    });

    const session: UserSession = {
      userId,
      client,
      state: "initializing",
      lastActivity: Date.now(),
      telegramUserId: null,
      savedMessagesChatId: null,
      authResolvers: {},
      phone,
    };

    this.activeSessions.set(userId, session);

    client.on("error", (err) => {
      console.error(`[SessionManager][${userId}] Error:`, err);
    });

    // Set up the interactive login using tdl's callback-based API.
    // Each callback returns a promise that we resolve from HTTP handlers.
    const loginPromise = client.login(() => ({
      type: "user" as const,
      getPhoneNumber: (_retry?: boolean) => {
        // Immediately resolve with the phone number provided
        return Promise.resolve(phone);
      },
      getAuthCode: (_retry?: boolean) => {
        session.state = "waiting_code";
        console.log(`[SessionManager][${userId}] Waiting for auth code...`);
        return new Promise<string>((resolve, reject) => {
          session.authResolvers.resolveCode = resolve;
          session.authResolvers.rejectCode = reject;
        });
      },
      getPassword: (_passwordHint: string, _retry?: boolean) => {
        session.state = "waiting_password";
        console.log(`[SessionManager][${userId}] Waiting for 2FA password...`);
        return new Promise<string>((resolve, reject) => {
          session.authResolvers.resolvePassword = resolve;
          session.authResolvers.rejectPassword = reject;
        });
      },
      confirmOnAnotherDevice: (link: string) => {
        console.log(`[SessionManager][${userId}] Confirm on another device: ${link}`);
      },
      getName: () => {
        session.state = "waiting_registration";
        // Should not happen for existing Telegram accounts
        return Promise.reject(new Error("Account registration not supported. Use an existing Telegram account."));
      },
    }));

    session.authResolvers.loginPromise = loginPromise;

    // Wait for TDLib to process the phone number and ask for the code
    // The login promise won't resolve yet — it's waiting for the auth code callback
    // We need to wait until state changes to 'waiting_code' or an error occurs
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for Telegram to send code"));
      }, 30000);

      const check = setInterval(() => {
        if (
          session.state === "waiting_code" ||
          session.state === "waiting_password"
        ) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);

      // If login resolves/rejects early (e.g. phone invalid), catch it
      loginPromise
        .then(() => {
          clearInterval(check);
          clearTimeout(timeout);
          // Login completed without needing code (shouldn't happen for phone auth)
          session.state = "ready";
          resolve();
        })
        .catch((err) => {
          clearInterval(check);
          clearTimeout(timeout);
          reject(err);
        });
    });

    return { status: "code_sent" };
  }

  /**
   * Verify the auth code entered by the user.
   * Returns 'ready' or 'password_required'.
   */
  async verifyCode(userId: string, code: string): Promise<{ status: string; phone?: string | null; telegramUserId?: number | null }> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error("No auth session in progress");
    }
    if (session.state !== "waiting_code") {
      throw new Error(`Invalid state for code verification: ${session.state}`);
    }

    const { resolveCode } = session.authResolvers;
    if (!resolveCode) {
      throw new Error("No code resolver available");
    }

    // Resolve the getAuthCode callback — tdl will send the code to Telegram
    resolveCode(code);
    session.authResolvers.resolveCode = undefined;
    session.authResolvers.rejectCode = undefined;

    // Wait for the next state transition
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for code verification"));
      }, 30000);

      const check = setInterval(() => {
        if (session.state === "waiting_password") {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        } else if (session.state === "ready") {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);

      // If login promise resolves, we're done
      session.authResolvers.loginPromise
        ?.then(() => {
          clearInterval(check);
          clearTimeout(timeout);
          session.state = "ready";
          resolve();
        })
        .catch((err) => {
          clearInterval(check);
          clearTimeout(timeout);
          reject(err);
        });
    });

    const currentState = session.state as SessionState;
    if (currentState === "waiting_password") {
      return { status: "password_required" };
    }

    // Auth complete — finalize
    await this.finalizeAuth(session);
    return { status: "ready", phone: session.phone, telegramUserId: session.telegramUserId };
  }

  /**
   * Verify the 2FA password.
   */
  async verifyPassword(userId: string, password: string): Promise<{ status: string; phone?: string | null; telegramUserId: number | null }> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error("No auth session in progress");
    }
    if (session.state !== "waiting_password") {
      throw new Error(`Invalid state for password verification: ${session.state}`);
    }

    const { resolvePassword } = session.authResolvers;
    if (!resolvePassword) {
      throw new Error("No password resolver available");
    }

    resolvePassword(password);
    session.authResolvers.resolvePassword = undefined;
    session.authResolvers.rejectPassword = undefined;

    // Wait for login to complete
    try {
      await session.authResolvers.loginPromise;
    } catch (err) {
      throw new Error(`Password verification failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    session.state = "ready";
    await this.finalizeAuth(session);

    return { status: "ready", phone: session.phone, telegramUserId: session.telegramUserId };
  }

  /**
   * After successful auth, fetch user info and resolve Saved Messages chat.
   */
  private async finalizeAuth(session: UserSession): Promise<void> {
    const me = await session.client.invoke({ _: "getMe" }) as any;
    session.telegramUserId = me.id;
    session.phone = me.phone_number || session.phone;
    session.lastActivity = Date.now();

    console.log(
      `[SessionManager][${session.userId}] Authenticated as ${me.first_name} ${me.last_name || ""} (ID: ${me.id})`,
    );

    // Resolve Saved Messages chat — it's a private chat with yourself.
    // In TDLib, chat_id for Saved Messages = user's own user ID.
    try {
      const chat = await session.client.invoke({
        _: "createPrivateChat",
        user_id: me.id,
        force: false,
      }) as any;
      session.savedMessagesChatId = chat.id;
      console.log(`[SessionManager][${session.userId}] Saved Messages chat ID: ${chat.id}`);
    } catch (err) {
      console.error(`[SessionManager][${session.userId}] Failed to resolve Saved Messages:`, err);
      // Fallback: use the user ID directly as chat ID (TDLib convention)
      session.savedMessagesChatId = me.id;
    }

    // Clear auth resolvers
    session.authResolvers = {};
  }

  /**
   * Disconnect a user's Telegram account. Destroys the session and deletes persisted data.
   */
  async destroySession(userId: string): Promise<void> {
    const session = this.activeSessions.get(userId);

    if (session) {
      // Reject any pending auth callbacks
      session.authResolvers.rejectCode?.(new Error("Session destroyed"));
      session.authResolvers.rejectPassword?.(new Error("Session destroyed"));

      try {
        // Log out from Telegram (invalidates the session)
        await session.client.invoke({ _: "logOut" });
      } catch {
        // Ignore — may already be closed
      }
      try {
        await session.client.close();
      } catch {
        // Ignore
      }
      this.activeSessions.delete(userId);
    }

    // Delete persisted session data from disk
    const dbDir = this.getUserDataDir(userId);
    const filesDir = this.getUserFilesDir(userId);

    try {
      if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[SessionManager] Failed to clean db dir for ${userId}:`, err);
    }
    try {
      if (fs.existsSync(filesDir)) fs.rmSync(filesDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[SessionManager] Failed to clean files dir for ${userId}:`, err);
    }

    console.log(`[SessionManager] Session destroyed for user ${userId}`);
  }

  // ── Pool management ──────────────────────────────────────────────────────

  private async ensurePoolCapacity(): Promise<void> {
    while (this.activeSessions.size >= MAX_ACTIVE_SESSIONS) {
      await this.evictLRU();
    }
  }

  private async evictLRU(): Promise<void> {
    let oldest: UserSession | null = null;
    for (const session of this.activeSessions.values()) {
      // Don't evict sessions mid-auth
      if (
        session.state === "waiting_code" ||
        session.state === "waiting_password" ||
        session.state === "initializing"
      ) {
        continue;
      }
      if (!oldest || session.lastActivity < oldest.lastActivity) {
        oldest = session;
      }
    }

    if (!oldest) {
      // All sessions are mid-auth; force-evict the oldest one
      for (const session of this.activeSessions.values()) {
        if (!oldest || session.lastActivity < oldest.lastActivity) {
          oldest = session;
        }
      }
    }

    if (oldest) {
      console.log(
        `[SessionManager] Evicting LRU session: ${oldest.userId} (idle ${Math.round((Date.now() - oldest.lastActivity) / 1000)}s)`,
      );
      await this.closeSession(oldest.userId);
    }
  }

  /**
   * Close a session (saves state to disk) without destroying it.
   * The session can be reactivated later from persisted data.
   */
  private async closeSession(userId: string): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (!session) return;

    session.state = "closing";
    session.authResolvers.rejectCode?.(new Error("Session evicted"));
    session.authResolvers.rejectPassword?.(new Error("Session evicted"));

    try {
      await session.client.close();
    } catch {
      // Ignore close errors
    }

    session.state = "closed";
    this.activeSessions.delete(userId);
    console.log(`[SessionManager] Session closed (persisted to disk): ${userId}`);
  }

  /**
   * Create a TDLib client for a user (new or reactivating from disk).
   */
  private async createUserClient(userId: string): Promise<UserSession> {
    const { apiId, apiHash } = getApiConfig();
    const dbDir = this.getUserDataDir(userId);
    const filesDir = this.getUserFilesDir(userId);

    fs.mkdirSync(dbDir, { recursive: true });
    fs.mkdirSync(filesDir, { recursive: true });

    const client = tdl.createClient({
      apiId,
      apiHash,
      databaseDirectory: dbDir,
      filesDirectory: filesDir,
    });

    const session: UserSession = {
      userId,
      client,
      state: "initializing",
      lastActivity: Date.now(),
      telegramUserId: null,
      savedMessagesChatId: null,
      authResolvers: {},
      phone: null,
    };

    this.activeSessions.set(userId, session);

    client.on("error", (err) => {
      console.error(`[SessionManager][${userId}] Error:`, err);
    });

    // For reactivation from disk, TDLib should go straight to ready state.
    // Use login() with a dummy handler — tdl will skip callbacks if already authenticated.
    const loginPromise = client.login(() => ({
      type: "user" as const,
      getPhoneNumber: () =>
        Promise.reject(new Error("Re-authentication required. Please reconnect your Telegram account.")),
      getAuthCode: () =>
        Promise.reject(new Error("Re-authentication required.")),
      getPassword: () =>
        Promise.reject(new Error("Re-authentication required.")),
      confirmOnAnotherDevice: () => {},
      getName: () => Promise.reject(new Error("Registration not supported.")),
    }));

    session.authResolvers.loginPromise = loginPromise;

    try {
      await loginPromise;
      session.state = "ready";
      // Fetch user info
      const me = await client.invoke({ _: "getMe" }) as any;
      session.telegramUserId = me.id;
      session.phone = me.phone_number || null;

      // Resolve Saved Messages
      try {
        const chat = await session.client.invoke({
          _: "createPrivateChat",
          user_id: me.id,
          force: false,
        }) as any;
        session.savedMessagesChatId = chat.id;
      } catch {
        session.savedMessagesChatId = me.id;
      }

      console.log(
        `[SessionManager] Reactivated session for ${userId} (Telegram: ${me.first_name}, chat: ${session.savedMessagesChatId})`,
      );
    } catch (err) {
      // Session on disk is invalid — user needs to re-authenticate
      console.warn(
        `[SessionManager] Failed to reactivate session for ${userId}:`,
        err instanceof Error ? err.message : err,
      );
      this.activeSessions.delete(userId);
      // Clean up invalid session data
      try {
        if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
      } catch { /* ignore */ }
      throw new Error("Telegram session expired. Please reconnect your Telegram account.");
    }

    return session;
  }

  /**
   * Wait for a session to reach 'ready' state.
   */
  private waitForReady(session: UserSession, timeoutMs: number): Promise<void> {
    if (session.state === "ready") return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(check);
        reject(new Error("Session activation timeout"));
      }, timeoutMs);

      const check = setInterval(() => {
        if (session.state === "ready") {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        } else if (session.state === "closed" || session.state === "closing") {
          clearInterval(check);
          clearTimeout(timeout);
          reject(new Error("Session closed unexpectedly"));
        }
      }, 100);
    });
  }

  // ── Convenience: resolve client + chatId for a request ───────────────────

  /**
   * Resolve the appropriate TDLib client and chat ID for a file operation.
   *
   * @param storageType  'bot' | 'user'
   * @param userId       Supabase user ID (required if storageType='user')
   * @param telegramChatId  Stored chat_id from DB (for bot files, falls back to env)
   */
  async resolveClientAndChat(
    storageType: string,
    userId?: string,
    telegramChatId?: number | null,
  ): Promise<{ client: TDLibClient; chatId: number; actualStorageType: string; sessionExpired?: boolean }> {
    if (storageType === "user" && userId) {
      try {
        const session = await this.getSession(userId);
        const chatId = telegramChatId || session.savedMessagesChatId;
        if (!chatId) {
          throw new Error("Could not resolve Saved Messages chat ID");
        }
        return { client: session.client, chatId, actualStorageType: "user" };
      } catch (err) {
        console.warn(
          `[SessionManager] User ${userId} session unavailable (${err instanceof Error ? err.message : err}), falling back to bot channel`,
        );
        // fall through to bot — flag that user session expired
        const client = this.getBotClient();
        const chatId = parseInt(process.env.TELEGRAM_CHANNEL_ID || "0", 10);
        if (!chatId) {
          throw new Error("TELEGRAM_CHANNEL_ID not configured");
        }
        return { client, chatId, actualStorageType: "bot", sessionExpired: true };
      }
    }

    // Default: bot session
    const client = this.getBotClient();
    const chatId = parseInt(process.env.TELEGRAM_CHANNEL_ID || "0", 10);
    if (!chatId) {
      throw new Error("TELEGRAM_CHANNEL_ID not configured");
    }
    return { client, chatId, actualStorageType: "bot" };
  }

  // ── Shutdown ─────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    console.log(`[SessionManager] Shutting down ${this.activeSessions.size} user session(s) + bot...`);

    const closePromises: Promise<void>[] = [];

    for (const [userId] of this.activeSessions) {
      closePromises.push(this.closeSession(userId));
    }

    if (this.botSession) {
      closePromises.push(
        this.botSession.client.close().catch(() => {}),
      );
    }

    await Promise.allSettled(closePromises);
    this.activeSessions.clear();
    this.botSession = null;
    console.log("[SessionManager] All sessions closed");
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats(): {
    botReady: boolean;
    activeSessions: number;
    maxSessions: number;
    sessions: Array<{ userId: string; state: SessionState; idleSec: number }>;
  } {
    return {
      botReady: this.isBotReady(),
      activeSessions: this.activeSessions.size,
      maxSessions: MAX_ACTIVE_SESSIONS,
      sessions: Array.from(this.activeSessions.values()).map((s) => ({
        userId: s.userId,
        state: s.state,
        idleSec: Math.round((Date.now() - s.lastActivity) / 1000),
      })),
    };
  }
}

// ── Singleton export ─────────────────────────────────────────────────────────

export const sessionManager = new SessionManager();
