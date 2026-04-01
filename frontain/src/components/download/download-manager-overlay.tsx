"use client";

import { useEffect, useState } from "react";
import { DownloadSpeedometer } from "@/components/share/download-speedometer";
import {
  cancelManagedDownload,
  getDownloadState,
  subscribeDownloadState,
  type DownloadState,
} from "@/lib/download-manager";

export function DownloadManagerOverlay() {
  const [state, setState] = useState<DownloadState | null>(getDownloadState());

  useEffect(() => {
    return subscribeDownloadState(setState);
  }, []);

  return <DownloadSpeedometer state={state} onCancel={cancelManagedDownload} />;
}
