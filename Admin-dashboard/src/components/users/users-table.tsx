"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBytes, formatDate } from "@/lib/admin/format";

type UserRow = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  storageUsedBytes: number;
  storageLimitBytes: number;
  isPremium: boolean;
  telegramConnected: boolean;
  createdAt: string;
};

type UsersTableProps = {
  users: UserRow[];
};

export function UsersTable({ users }: UsersTableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Storage</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const avatarSrc = user.avatarUrl?.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.displayName)}`;

            return (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarSrc} alt={user.displayName} />
                      <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{user.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {user.telegramConnected ? (
                    <Badge variant="default" className="gap-1 bg-indigo-500 hover:bg-indigo-600">
                      <ShieldCheck className="h-3 w-3" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not Connected</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col gap-1 w-[120px]">
                    <span className="text-sm">{formatBytes(user.storageUsedBytes)} / {formatBytes(user.storageLimitBytes)}</span>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${user.storageLimitBytes > 0 ? (user.storageUsedBytes / user.storageLimitBytes) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {user.isPremium ? (
                    <Badge variant="secondary" className="text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30">
                      Premium
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Free</Badge>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(user.createdAt)}</div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>View profile</DropdownMenuItem>
                      <DropdownMenuItem>View files</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Adjust storage limit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Suspend user</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
