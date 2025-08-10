import { useEffect } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import { useLocation } from "react-router-dom";

export default function useWebSocketNotifications() {
  const { isAuthenticated } = useAuthContext();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) return;
    let ws: WebSocket | null = null;

    function handleMessage(e: MessageEvent) {
      try {
        const data = JSON.parse(e.data);
        switch (data.type) {
          case "new_reading_request":
            alert("New reading request received!");
            break;
          case "minute_billed":
            alert(`Minute billed: ${data.minutes}`);
            break;
          // Add more cases as needed
          default:
            break;
        }
      } catch {}
    }

    ws = new WebSocket(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`);
    ws.addEventListener("message", handleMessage);

    return () => {
      ws?.close();
    };
    // Only re-run on auth/location change
    // eslint-disable-next-line
  }, [isAuthenticated, location.pathname]);
}