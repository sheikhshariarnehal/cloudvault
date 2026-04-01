import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { formatBytes, formatDate } from "@/lib/admin/format";

type RecentActivityItem = {
  id: string;
  name: string;
  userName: string;
  avatarUrl: string | null;
  sizeBytes: number;
  createdAt: string;
};

type RecentActivityProps = {
  items: RecentActivityItem[];
};

export function RecentActivity({ items }: RecentActivityProps) {

  return (
    <div className="space-y-4 sm:space-y-5">
      {items.map((item) => {
        const avatarSrc = item.avatarUrl?.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.userName)}`;

        return (
          <div key={item.id} className="flex items-start gap-3 sm:items-center">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarSrc} alt="Avatar" />
              <AvatarFallback>{item.userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium leading-none">{item.userName}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-1">
                Uploaded {item.name} · {formatDate(item.createdAt)}
              </p>
            </div>
            <div className="ml-auto shrink-0 text-sm font-medium">+{formatBytes(item.sizeBytes)}</div>
          </div>
        );
      })}
    </div>
  );
}
