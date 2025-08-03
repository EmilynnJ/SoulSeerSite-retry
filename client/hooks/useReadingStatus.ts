import { useEffect, useState } from "react";
import apiInstance from "../src/lib/api";

export default function useReadingStatus(readingId: number) {
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!readingId) return;
    let interval: NodeJS.Timeout;
    let stopped = false;

    async function poll() {
      try {
        const { data } = await apiInstance.get(`/api/readings/${readingId}`);
        if (!stopped) {
          setStatus(data.status);
          setIsLoading(false);
        }
      } catch {
        if (!stopped) setIsLoading(false);
      }
    }

    poll();
    interval = setInterval(poll, 5000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [readingId]);

  return { status, isLoading };
}