"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Shield,
  Bell,
  Phone,
  Loader2,
  CreditCard,
  Monitor,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsTab =
  | "profile"
  | "account"
  | "billing"
  | "appearance"
  | "notifications"
  | "display";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "Profile",       icon: User },
  { id: "account",       label: "Account",       icon: Shield },
  { id: "billing",       label: "Billing",       icon: CreditCard },
  { id: "appearance",    label: "Appearance",    icon: Monitor },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "display",       label: "Display",       icon: SlidersHorizontal },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab]     = useState<SettingsTab>("profile");
  const [theme, setTheme]             = useState<"light" | "dark">("light");
  const [notifyAbout, setNotifyAbout] = useState<"all" | "mentions" | "none">("all");
  const [emailPrefs, setEmailPrefs]   = useState({
    communication: false,
    marketing:     false,
    social:        true,
    security:      true,
  });

  const { user, isGuest, isTelegramConnected, isTelegramStatusLoading, telegramPhone, refreshTelegramStatus } = useAuth();
  const { setConnectTelegramModalOpen } = useUIStore();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Guest";
  const avatarUrl   = user?.user_metadata?.avatar_url;

  return (
    <div className="pt-3 sm:pt-4">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and set e-mail preferences.
        </p>
      </div>

      <div className="flex gap-8">
        {/* Left sidebar nav */}
        <nav className="flex w-44 shrink-0 flex-col gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
                activeTab === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Right content panel */}
        <div className="flex-1 min-w-0">

          {/* Profile */}
          {activeTab === "profile" && (
            <div className="rounded-lg border p-6 space-y-8">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-muted">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90">
                  Upload image
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Username</Label>
                <Input
                  defaultValue={isGuest ? "" : displayName}
                  disabled={isGuest}
                  placeholder={isGuest ? "Guest" : "Your username"}
                />
                <p className="text-sm text-muted-foreground">
                  This is your public display name. It can be your real name or a pseudonym.
                  You can only change this once every 30 days.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Email</Label>
                {isGuest ? (
                  <Input value="" disabled placeholder="No email - guest account" />
                ) : (
                  <Select defaultValue={user?.email ?? undefined}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a verified email to display" />
                    </SelectTrigger>
                    <SelectContent>
                      {user?.email && (
                        <SelectItem value={user.email}>{user.email}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-sm text-muted-foreground">
                  You can manage verified email addresses in your email settings.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Bio</Label>
                <Textarea disabled={isGuest} placeholder="I own a computer." rows={4} />
                <p className="text-sm text-muted-foreground">
                  You can @mention other users and organizations to link to them.
                </p>
              </div>

              {!isGuest && (
                <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90">
                  Update profile
                </Button>
              )}
            </div>
          )}

          {/* Account */}
          {activeTab === "account" && (
            <div className="rounded-lg border p-6 space-y-8">
              {!isGuest && (
                <>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Telegram Storage
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect your Telegram account to store files in your own Saved Messages.
                      </p>
                    </div>
                    {isTelegramStatusLoading ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Checking connection status...</span>
                        </div>
                      </div>
                    ) : isTelegramConnected ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600">Connected</Badge>
                          {telegramPhone && (
                            <span className="text-sm text-muted-foreground">{telegramPhone}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Your uploads are stored in your Telegram Saved Messages.
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isDisconnecting}
                          onClick={async () => {
                            setIsDisconnecting(true);
                            try {
                              await fetch("/api/telegram/disconnect", { method: "POST" });
                              refreshTelegramStatus();
                            } catch {
                              // ignore
                            } finally {
                              setIsDisconnecting(false);
                            }
                          }}
                        >
                          {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Disconnect Telegram
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Link your Telegram account to get unlimited personal cloud storage.
                          Files are stored securely in your own Telegram Saved Messages.
                        </p>
                        <Button size="sm" onClick={() => setConnectTelegramModalOpen(true)}>
                          Connect Telegram
                        </Button>
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Security
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your account security settings.
                  </p>
                </div>
                {isGuest ? (
                  <p className="text-sm text-muted-foreground">
                    Sign up for an account to access security settings.
                  </p>
                ) : (
                  <Button variant="outline" size="sm">Change Password</Button>
                )}
              </div>
            </div>
          )}

          {/* Billing */}
          {activeTab === "billing" && (
            <div className="rounded-lg border p-6">
              <h3 className="text-sm font-semibold">Billing</h3>
              <p className="text-sm text-muted-foreground mt-1">Billing settings coming soon.</p>
            </div>
          )}

          {/* Appearance */}
          {activeTab === "appearance" && (
            <div className="rounded-lg border p-6 space-y-8">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Font</h3>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter">Inter</SelectItem>
                    <SelectItem value="system">System default</SelectItem>
                    <SelectItem value="mono">Monospace</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Set the font you want to use in the dashboard.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Theme</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Select the theme for the dashboard.
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setTheme("light")}
                    className={cn(
                      "rounded-lg border-2 p-1 transition-colors",
                      theme === "light"
                        ? "border-foreground"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="w-36 rounded-md bg-[#f1f5f9] p-2 space-y-1.5">
                      <div className="space-y-1">
                        <div className="h-2 w-4/5 rounded bg-[#cbd5e1]" />
                        <div className="h-2 w-3/5 rounded bg-[#cbd5e1]" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded-full bg-[#cbd5e1]" />
                        <div className="h-2 w-3/5 rounded bg-[#cbd5e1]" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded-full bg-[#cbd5e1]" />
                        <div className="h-2 w-2/5 rounded bg-[#cbd5e1]" />
                      </div>
                    </div>
                    <p className="mt-2 text-center text-xs font-medium">Light</p>
                  </button>

                  <button
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "rounded-lg border-2 p-1 transition-colors",
                      theme === "dark"
                        ? "border-foreground"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="w-36 rounded-md bg-[#1e293b] p-2 space-y-1.5">
                      <div className="space-y-1">
                        <div className="h-2 w-4/5 rounded bg-[#475569]" />
                        <div className="h-2 w-3/5 rounded bg-[#475569]" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded-full bg-[#475569]" />
                        <div className="h-2 w-3/5 rounded bg-[#475569]" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded-full bg-[#475569]" />
                        <div className="h-2 w-2/5 rounded bg-[#475569]" />
                      </div>
                    </div>
                    <p className="mt-2 text-center text-xs font-medium">Dark</p>
                  </button>
                </div>
              </div>

              <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90">
                Update preferences
              </Button>
            </div>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <div className="rounded-lg border p-6 space-y-8">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Notify me about...</h3>
                <div className="space-y-3">
                  {(
                    [
                      { value: "all",      label: "All new messages" },
                      { value: "mentions", label: "Direct messages and mentions" },
                      { value: "none",     label: "Nothing" },
                    ] as const
                  ).map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="notify-about"
                        value={value}
                        checked={notifyAbout === value}
                        onChange={() => setNotifyAbout(value)}
                        className="h-4 w-4 accent-foreground"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Email Notifications</h3>
                {(
                  [
                    {
                      key:         "communication",
                      label:       "Communication emails",
                      description: "Receive emails about your account activity.",
                    },
                    {
                      key:         "marketing",
                      label:       "Marketing emails",
                      description: "Receive emails about new products, features, and more.",
                    },
                    {
                      key:         "social",
                      label:       "Social emails",
                      description: "Receive emails for friend requests, follows, and more.",
                    },
                    {
                      key:         "security",
                      label:       "Security emails",
                      description: "Receive emails about your account security.",
                    },
                  ] as const
                ).map(({ key, label, description }) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 rounded-lg border p-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={emailPrefs[key]}
                      onCheckedChange={(checked) =>
                        setEmailPrefs((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Display */}
          {activeTab === "display" && (
            <div className="rounded-lg border p-6">
              <h3 className="text-sm font-semibold">Display</h3>
              <p className="text-sm text-muted-foreground mt-1">Display settings coming soon.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
