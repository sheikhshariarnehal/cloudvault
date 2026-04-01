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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Telegram from "@/components/ui/Telegram";
import { Loader2, KeyRound, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";

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
      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        className="w-[calc(100vw-1.5rem)] max-w-[22rem] sm:max-w-md rounded-2xl border p-3 sm:p-4"
      >
        <DialogHeader className="items-center gap-1.5 text-center sm:gap-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            {step === "success" ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : step === "password" ? (
              <Lock className="h-6 w-6 text-[#032b2b]" />
            ) : step === "code" ? (
              <KeyRound className="h-6 w-6 text-[#032b2b]" />
            ) : (
              <Telegram className="h-12 w-12" />
            )}
          </div>
          <DialogTitle className="text-center text-[1.9rem] font-semibold leading-[1.15] tracking-tight">
            {step === "success" ? "Telegram Connected" : step === "phone" ? "Verify phone number" : step === "code" ? "Check your messages" : "Two-Factor Authentication"}
          </DialogTitle>
          <DialogDescription className="mx-auto max-w-full text-center text-sm leading-relaxed text-muted-foreground">
            {step === "phone" && "Enter your Telegram account number to connect storage. Files you upload will be stored in that Telegram account."}
            {step === "code" && "We've sent a code to your Telegram app. Please enter it below."}
            {step === "password" && "Your account has Two-Factor Authentication enabled. Enter your password."}
            {step === "success" && "Your Telegram account is now linked. All new uploads will be stored in your Saved Messages."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1.5 sm:space-y-4 sm:py-2">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {step === "phone" && (
            <div className="space-y-3">
              <fieldset className="rounded-xl border border-slate-300/80 bg-slate-50/80 px-2 pb-2 pt-1 transition-colors duration-200 focus-within:border-[#032b2b]/40 sm:px-2.5 sm:pb-2.5">
                <legend className="px-1 text-[11px] font-semibold tracking-wide text-slate-600">Mobile</legend>
                <div className="flex items-center px-1">
                  <div className="w-[96px] shrink-0 sm:w-[108px]">
                    <Label htmlFor="country" className="sr-only">Country</Label>
                    <Select
                      value={countryCode}
                      onValueChange={(value) => setCountryCode(value ?? "+880")}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="country" className="[&_[data-country-name]]:hidden h-10 rounded-none border-0 bg-transparent px-2 text-base font-semibold shadow-none outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {COUNTRY_OPTIONS.map((option) => (
                          <SelectItem key={option.code} value={option.code} className="cursor-pointer">
                            <span className="mr-2 font-medium">{option.code}</span>
                            <span data-country-name className="text-muted-foreground text-sm">{option.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="h-5 w-px bg-slate-300/90" />

                  <div className="min-w-0 flex-1">
                    <Label htmlFor="phone" className="sr-only">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, handleSendCode)}
                      disabled={isLoading}
                      autoFocus
                      className="h-10 rounded-none border-0 bg-transparent px-2.5 text-base shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0 placeholder:text-muted-foreground/70"
                    />
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-3 flex flex-col items-center justify-center">
              <Label htmlFor="code" className="sr-only">Verification Code</Label>
              <InputOTP
                id="code"
                maxLength={5}
                pattern={REGEXP_ONLY_DIGITS}
                value={code}
                onChange={setCode}
                onKeyDown={(e) => handleKeyDown(e, handleVerifyCode)}
                disabled={isLoading}
                autoFocus
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="h-12 w-12 rounded-xl border text-xl font-medium sm:h-14 sm:w-14 sm:text-2xl" />
                  <InputOTPSlot index={1} className="h-12 w-12 rounded-xl border text-xl font-medium sm:h-14 sm:w-14 sm:text-2xl" />
                  <InputOTPSlot index={2} className="h-12 w-12 rounded-xl border text-xl font-medium sm:h-14 sm:w-14 sm:text-2xl" />
                  <InputOTPSlot index={3} className="h-12 w-12 rounded-xl border text-xl font-medium sm:h-14 sm:w-14 sm:text-2xl" />
                  <InputOTPSlot index={4} className="h-12 w-12 rounded-xl border text-xl font-medium sm:h-14 sm:w-14 sm:text-2xl" />
                </InputOTPGroup>
              </InputOTP>
            </div>
          )}

          {step === "password" && (
            <div className="space-y-3">
              <Label htmlFor="password" className="sr-only">Two-Factor Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleVerifyPassword)}
                disabled={isLoading}
                autoFocus
                className="h-11 w-full rounded-lg text-base focus-visible:ring-2 focus-visible:ring-[#032b2b]/20"
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-0.5 sm:mt-1 sm:justify-center">
          {step === "phone" && (
            <Button
              onClick={handleSendCode}
              disabled={!phone.trim() || isLoading}
              className="h-11 w-full rounded-xl bg-blue-600 text-base font-semibold text-white transition-all hover:bg-blue-700"
            >
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Send Code
            </Button>
          )}
          {step === "code" && (
            <Button onClick={handleVerifyCode} disabled={!code.trim() || isLoading} className="h-11 w-full rounded-xl bg-blue-600 text-base font-semibold text-white transition-all hover:bg-blue-700">
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Verify Code
            </Button>
          )}
          {step === "password" && (
            <Button onClick={handleVerifyPassword} disabled={!password || isLoading} className="h-11 w-full rounded-xl bg-blue-600 text-base font-semibold text-white transition-all hover:bg-blue-700">
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Submit Password
            </Button>
          )}
          {step === "success" && (
            <Button onClick={() => handleClose(false)} className="h-11 w-full rounded-xl bg-blue-600 text-base font-semibold text-white transition-all hover:bg-blue-700">
              Continue to Dashboard
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
