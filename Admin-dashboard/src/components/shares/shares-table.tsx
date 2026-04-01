"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, MoreHorizontal, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/admin/format";

type ShareRow = {
  id: string;
  targetName: string;
  targetType: "file" | "folder";
  owner: string;
  downloads: number;
  expiresAt: string | null;
  isActive: boolean;
  isPasswordProtected: boolean;
};

type SharesTableProps = {
  shares: ShareRow[];
};

export function SharesTable({ shares }: SharesTableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Target</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Downloads</TableHead>
            <TableHead>Security</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shares.map((share) => (
            <TableRow key={share.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span>{share.targetName}</span>
                  <span className="text-xs text-muted-foreground capitalize">{share.targetType}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{share.owner}</TableCell>
              <TableCell>{share.downloads}</TableCell>
              <TableCell>
                {share.isPasswordProtected ? (
                  <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <ShieldCheck className="h-3 w-3" /> Password
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{share.expiresAt ? formatDate(share.expiresAt) : "Never"}</TableCell>
              <TableCell>
                {share.isActive ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Revoked</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem>View Target</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {share.isActive && (
                      <DropdownMenuItem className="text-destructive">Revoke Link</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
