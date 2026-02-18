"use client";

import { useAuth } from "@/app/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Shield, Bell } from "lucide-react";

export default function SettingsPage() {
  const { user, isGuest } = useAuth();

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Guest";
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div className="max-w-2xl space-y-6">
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
              <Input defaultValue={user?.email || ""} disabled />
            </div>
          </div>

          {!isGuest && (
            <Button size="sm">Save Changes</Button>
          )}
        </CardContent>
      </Card>

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
