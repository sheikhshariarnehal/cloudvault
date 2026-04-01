"use client";

import { useCallback, useState } from "react";

export function useAuthAction(defaultErrorMessage: string) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setError("");
      setIsLoading(true);

      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : defaultErrorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [defaultErrorMessage]
  );

  return { error, setError, isLoading, run };
}
