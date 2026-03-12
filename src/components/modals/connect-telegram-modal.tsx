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

export function ConnectTelegramModal() {
  const { connectTelegramModalOpen, setConnectTelegramModalOpen } = useUIStore();
  const { refreshTelegramStatus } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setStep("phone");
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

    try {
      const res = await fetch("/api/telegram/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
            {step === "success" ? "Telegram Connected" : "Connect Telegram"}
          </DialogTitle>
          <DialogDescription>
            {step === "phone" && "Enter your phone number to link your Telegram account. Files will be stored in your Saved Messages."}
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
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleSendCode)}
                disabled={isLoading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g. +1 for US)
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
            <Button onClick={handleSendCode} disabled={!phone.trim() || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Code
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
