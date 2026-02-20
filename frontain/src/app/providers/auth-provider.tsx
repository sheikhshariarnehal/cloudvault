"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { getGuestSessionId } from "@/lib/guest-session";

interface AuthContextType {
  user: User | null;
  guestSessionId: string | null;
  isGuest: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  guestSessionId: null,
  isGuest: false,
  isLoading: true,
  signOut: async () => {},
});

/**
 * Ensures the authenticated user has a corresponding public.users profile.
 * The DB trigger handles this on signup, but this is a safety net for:
 * - Users created before the trigger existed
 * - Edge cases where the trigger might fail
 */
async function ensureUserProfile(supabase: ReturnType<typeof createClient>, user: User) {
  try {
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      const displayName =
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "User";

      await supabase.from("users").insert({
        id: user.id,
        email: user.email,
        display_name: displayName,
        avatar_url: user.user_metadata?.avatar_url || null,
      });
    }
  } catch {
    // Profile already exists or creation failed silently — either way, don't block auth
    console.warn("ensureUserProfile: could not verify/create profile");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // Ensure the user has a public.users profile
          await ensureUserProfile(supabase, currentUser);
        } else {
          // Create guest session for unauthenticated users
          setGuestSessionId(getGuestSessionId());
        }
      } catch (error) {
        console.error("Auth session error:", error);
        // Fall back to guest mode on error
        setGuestSessionId(getGuestSessionId());
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        setGuestSessionId(null);
        // Ensure profile on any auth state change (login, token refresh, etc.)
        await ensureUserProfile(supabase, currentUser);
      } else {
        setGuestSessionId(getGuestSessionId());
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isGuest = !user && !!guestSessionId;

  return (
    <AuthContext.Provider
      value={{ user, guestSessionId, isGuest, isLoading, signOut }}
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
