"use client";

import { useState, useCallback } from "react";
import { useUIStore } from "@/store/ui-store";
import { useAuth } from "@/app/providers/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, KeyRound, Lock, CheckCircle2, AlertCircle } from "lucide-react";

type Step = "phone" | "code" | "password" | "success" | "error";

const COUNTRY_OPTIONS = [
  { code: "+880", label: "Bangladesh" },
  { code: "+1", label: "United States" },
  { code: "+44", label: "United Kingdom" },
  { code: "+91", label: "India" },
  { code: "+971", label: "UAE" },
];

export function ConnectTelegramModal() {
  const { connectTelegramModalOpen, setConnectTelegramModalOpen } = useUIStore();
  const { refreshTelegramStatus } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+880");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setStep("phone");
    setCountryCode("+880");
    setPhone("");
    setCode("");
    setPassword("");
    setError("");
    setIsLoading(false);
  }, []);

  const handleClose = (open: boolean) => {
    if (!open) {
      reset();
    }
    setConnectTelegramModalOpen(open);
  };

  const handleSendCode = async () => {
    if (!phone.trim()) return;
    setIsLoading(true);
    setError("");

    const rawPhone = phone.trim();
    const digitsOnly = rawPhone.replace(/\D/g, "");
    const normalizedPhone = rawPhone.startsWith("+")
      ? `+${digitsOnly}`
      : `${countryCode}${digitsOnly.replace(/^0+/, "")}`;

    try {
      const res = await fetch("/api/telegram/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send code");
        return;
      }

      setStep("code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/telegram/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }

      if (data.status === "password_required") {
        setStep("password");
      } else if (data.status === "ready") {
        setStep("success");
        refreshTelegramStatus();
      } else {
        setError("Unexpected response");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (!password) return;
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/telegram/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid password");
        return;
      }

      setStep("success");
      refreshTelegramStatus();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === "Enter" && !isLoading) handler();
  };

  return (
    <Dialog open={connectTelegramModalOpen} onOpenChange={handleClose}>
      <DialogContent className={step === "phone" ? "sm:max-w-2xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
            {step === "success" ? "Telegram Connected" : step === "phone" ? "Verify phone number" : "Connect Telegram"}
          </DialogTitle>
          <DialogDescription>
            {step === "phone" && "We use phone verification to keep your account secure. Enter your number to receive a one-time Telegram code."}
            {step === "code" && "Enter the code sent to your Telegram app."}
            {step === "password" && "Your account has Two-Factor Authentication enabled. Enter your password."}
            {step === "success" && "Your Telegram account is now linked. All new uploads will be stored in your Saved Messages."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-md p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {step === "phone" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    disabled={isLoading}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code} ({option.label})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="1712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleSendCode)}
                    disabled={isLoading}
                    autoFocus
                    className="h-11"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Bangladesh (+880) is selected by default. You can still paste a full international number starting with +.
              </p>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-2">
              <Label htmlFor="code" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Verification Code
              </Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleVerifyCode)}
                disabled={isLoading}
                autoFocus
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Check your Telegram app for the login code
              </p>
            </div>
          )}

          {step === "password" && (
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Two-Factor Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your 2FA password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleVerifyPassword)}
                disabled={isLoading}
                autoFocus
              />
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm text-muted-foreground text-center">
                Your files will now be stored directly in your Telegram account.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "phone" && (
            <Button
              onClick={handleSendCode}
              disabled={!phone.trim() || isLoading}
              className="w-full bg-[#032b2b] text-white hover:bg-[#043737]"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          )}
          {step === "code" && (
            <Button onClick={handleVerifyCode} disabled={!code.trim() || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Code
            </Button>
          )}
          {step === "password" && (
            <Button onClick={handleVerifyPassword} disabled={!password || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Password
            </Button>
          )}
          {step === "success" && (
            <Button onClick={() => handleClose(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
