"use client";

import { Users } from "lucide-react";

export default function SharedPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shared Files</h1>
        <p className="text-muted-foreground">
          Files shared with you and by you
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No shared files yet</h3>
        <p className="text-muted-foreground text-sm">
          Share files to collaborate with others. This feature is coming in Phase
          2.
        </p>
      </div>
    </div>
  );
}
