"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useUIStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Shield, Bell, Phone, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { user, isGuest, isTelegramConnected, telegramPhone, refreshTelegramStatus } = useAuth();
  const { setConnectTelegramModalOpen } = useUIStore();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Guest";
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div className="pt-3 sm:pt-4 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{displayName}</p>
              <p className="text-sm text-muted-foreground">
                {user?.email || "Guest mode"}
              </p>
              {isGuest && <Badge variant="secondary" className="mt-1">Guest</Badge>}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Display Name</Label>
              <Input defaultValue={displayName} disabled={isGuest} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              {isGuest ? (
                <div className="flex items-center gap-2">
                  <Input value="" disabled placeholder="No email — guest account" className="text-muted-foreground" />
                  <Badge variant="outline" className="shrink-0 text-xs">Guest</Badge>
                </div>
              ) : (
                <Input defaultValue={user?.email || ""} disabled />
              )}
            </div>
          </div>

          {!isGuest && (
            <Button size="sm">Save Changes</Button>
          )}
        </CardContent>
      </Card>

      {/* Telegram Connection Section */}
      {!isGuest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Telegram Storage
            </CardTitle>
            <CardDescription>
              Connect your Telegram account to store files in your own Saved Messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTelegramConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">Connected</Badge>
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
                <Button
                  size="sm"
                  onClick={() => setConnectTelegramModalOpen(true)}
                >
                  Connect Telegram
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGuest ? (
            <p className="text-sm text-muted-foreground">
              Sign up for an account to access security settings.
            </p>
          ) : (
            <Button variant="outline" size="sm">
              Change Password
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notification settings coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
