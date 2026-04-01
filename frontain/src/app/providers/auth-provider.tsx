"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { getGuestSessionId } from "@/lib/guest-session";

// ============================================================================
// Telegram status cache - prevents skeleton flash on page refresh
// ============================================================================
const TELEGRAM_STATUS_CACHE_KEY = "ndrive_telegram_status";
const TELEGRAM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TELEGRAM_STATUS_FETCH_TIMEOUT_MS = 8000;

interface TelegramStatusCache {
  connected: boolean;
  phone: string | null;
  timestamp: number;
  userId: string;
}

function getCachedTelegramStatus(userId: string): { connected: boolean; phone: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TELEGRAM_STATUS_CACHE_KEY);
    if (!raw) return null;
    const cached: TelegramStatusCache = JSON.parse(raw);
    // Only use cache if it belongs to the same user and is fresh
    if (cached.userId !== userId) return null;
    if (Date.now() - cached.timestamp > TELEGRAM_CACHE_TTL_MS) return null;
    return { connected: cached.connected, phone: cached.phone };
  } catch {
    return null;
  }
}

function setCachedTelegramStatus(userId: string, connected: boolean, phone: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const cache: TelegramStatusCache = {
      connected,
      phone,
      timestamp: Date.now(),
      userId,
    };
    localStorage.setItem(TELEGRAM_STATUS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore localStorage errors
  }
}

function clearTelegramStatusCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TELEGRAM_STATUS_CACHE_KEY);
  } catch {}
}

interface AuthContextType {
  user: User | null;
  guestSessionId: string | null;
  isGuest: boolean;
  isLoading: boolean;
  isTelegramConnected: boolean;
  isTelegramStatusLoading: boolean;
  telegramPhone: string | null;
  signOut: () => Promise<void>;
  refreshTelegramStatus: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  guestSessionId: null,
  isGuest: false,
  isLoading: true,
  isTelegramConnected: false,
  isTelegramStatusLoading: true,
  telegramPhone: null,
  signOut: async () => {},
  refreshTelegramStatus: () => {},
});

/**
 * Ensures the authenticated user has a corresponding public.users profile.
 * The DB trigger handles this on signup, but this is a safety net for:
 * - Users created before the trigger existed
 * - Edge cases where the trigger might fail
 */
async function ensureUserProfile(supabase: ReturnType<typeof createClient>, user: User) {
  try {
    const displayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User";

    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null;

    // Upsert keeps profile rows in sync for users created before/after trigger,
    // and refreshes missing avatar/name data from the auth provider metadata.
    const { error } = await supabase.from("users").upsert(
      {
        id: user.id,
        email: user.email,
        display_name: displayName,
        avatar_url: avatarUrl,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn("ensureUserProfile: upsert failed", error.message);
    }
  } catch {
    // Profile sync failed silently — don't block auth flow
    console.warn("ensureUserProfile: could not sync profile");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Initialize telegram status from cache to prevent skeleton flash
  const [isTelegramStatusLoading, setIsTelegramStatusLoading] = useState(true);
  const [isTelegramConnected, setIsTelegramConnected] = useState(false);
  const [telegramPhone, setTelegramPhone] = useState<string | null>(null);
  const supabase = createClient();
  const statusReqRef = useRef<Promise<void> | null>(null);

  const fetchTelegramStatus = async (userId: string, skipLoadingState = false) => {
    if (statusReqRef.current) return statusReqRef.current;

    // Only show loading state if we don't have cached data
    if (!skipLoadingState) {
      setIsTelegramStatusLoading(true);
    }
    
    statusReqRef.current = (async () => {
      try {
        const res = await fetch("/api/telegram/status", {
          signal: AbortSignal.timeout(TELEGRAM_STATUS_FETCH_TIMEOUT_MS),
        });
        if (res.ok) {
          const data = await res.json();
          const connected = !!data.connected;
          const phone = data.phone || null;
          setIsTelegramConnected(connected);
          setTelegramPhone(phone);
          // Cache the status for next page load
          setCachedTelegramStatus(userId, connected, phone);
        } else {
          setIsTelegramConnected(false);
          setTelegramPhone(null);
          setCachedTelegramStatus(userId, false, null);
        }
      } catch {
        // Non-fatal — keep existing state to avoid false disconnected UI on transient failures.
      } finally {
        setIsTelegramStatusLoading(false);
        statusReqRef.current = null;
      }
    })();
    return statusReqRef.current;
  };

  const refreshTelegramStatus = () => {
    if (user?.id) {
      fetchTelegramStatus(user.id);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        // First try local session (fast, from cookies)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        let currentUser = session?.user ?? null;

        // If no local session, try getUser() which validates server-side
        // and refreshes expired tokens using the refresh token cookie
        if (!currentUser) {
          const {
            data: { user: refreshedUser },
          } = await supabase.auth.getUser();
          currentUser = refreshedUser;
        }

        setUser(currentUser);

        if (currentUser) {
          // Ensure the user has a public.users profile (fire-and-forget — don't block auth loading)
          ensureUserProfile(supabase, currentUser);
          
          // CACHE-FIRST: Try to load Telegram status from cache for instant display
          const cachedStatus = getCachedTelegramStatus(currentUser.id);
          if (cachedStatus) {
            // Use cached status immediately - no skeleton flash!
            setIsTelegramConnected(cachedStatus.connected);
            setTelegramPhone(cachedStatus.phone);
            setIsTelegramStatusLoading(false);
            // Refresh in background (skip loading state since we have cached data)
            fetchTelegramStatus(currentUser.id, true);
          } else {
            // No cache - fetch with loading state
            fetchTelegramStatus(currentUser.id, false);
          }
        } else {
          // Create guest session for unauthenticated users
          setGuestSessionId(getGuestSessionId());
          setIsTelegramStatusLoading(false);
        }
      } catch (error) {
        console.error("Auth session error:", error);
        // Fall back to guest mode on error
        setGuestSessionId(getGuestSessionId());
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        setGuestSessionId(null);
        // Ensure profile on any auth state change (fire-and-forget — don't block renders)
        ensureUserProfile(supabase, currentUser);
        
        // Check cache first for telegram status
        const cachedStatus = getCachedTelegramStatus(currentUser.id);
        if (cachedStatus) {
          setIsTelegramConnected(cachedStatus.connected);
          setTelegramPhone(cachedStatus.phone);
          setIsTelegramStatusLoading(false);
          fetchTelegramStatus(currentUser.id, true);
        } else {
          fetchTelegramStatus(currentUser.id, false);
        }
      } else {
        setGuestSessionId(getGuestSessionId());
        setIsTelegramStatusLoading(false);
        clearTelegramStatusCache();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsTelegramConnected(false);
    setIsTelegramStatusLoading(false);
    setTelegramPhone(null);
    clearTelegramStatusCache();
  };

  const isGuest = !user && !!guestSessionId;

  return (
    <AuthContext.Provider
      value={{ user, guestSessionId, isGuest, isLoading, isTelegramConnected, isTelegramStatusLoading, telegramPhone, signOut, refreshTelegramStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
