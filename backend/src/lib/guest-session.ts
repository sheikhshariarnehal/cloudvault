"use client";

import { v4 as uuidv4 } from "uuid";

const GUEST_SESSION_KEY = "cloudvault_guest_session_id";
const GUEST_SESSION_EXPIRY_KEY = "cloudvault_guest_session_expiry";
const GUEST_EXPIRY_DAYS = 90;

export function getGuestSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  const expiry = localStorage.getItem(GUEST_SESSION_EXPIRY_KEY);

  if (sessionId && expiry) {
    const expiryDate = new Date(expiry);
    if (expiryDate > new Date()) {
      return sessionId;
    }
    // Session expired, clean up
    clearGuestSession();
  }

  // Create new session
  sessionId = uuidv4();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + GUEST_EXPIRY_DAYS);

  localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  localStorage.setItem(GUEST_SESSION_EXPIRY_KEY, expiryDate.toISOString());

  return sessionId;
}

export function hasGuestSession(): boolean {
  if (typeof window === "undefined") return false;
  const sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  const expiry = localStorage.getItem(GUEST_SESSION_EXPIRY_KEY);

  if (!sessionId || !expiry) return false;
  return new Date(expiry) > new Date();
}

export function clearGuestSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_SESSION_KEY);
  localStorage.removeItem(GUEST_SESSION_EXPIRY_KEY);
}

export function getGuestSessionData(): { id: string; expiresAt: string } | null {
  if (typeof window === "undefined") return null;
  const sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  const expiry = localStorage.getItem(GUEST_SESSION_EXPIRY_KEY);

  if (!sessionId || !expiry) return null;
  if (new Date(expiry) <= new Date()) {
    clearGuestSession();
    return null;
  }

  return { id: sessionId, expiresAt: expiry };
}

export function exportGuestFileList(files: { name: string; size: number; created_at: string }[]): void {
  const data = JSON.stringify(files, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cloudvault-guest-files.json";
  a.click();
  URL.revokeObjectURL(url);
}
