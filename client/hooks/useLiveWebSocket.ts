import { useEffect, useRef, useState } from "react";

export default function useLiveWebSocket(streamKey: string) {
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!streamKey) return;
    let ws: WebSocket | null = null;
    let alive = true;

    function connect() {
      ws = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
      );
      wsRef.current = ws;
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "join_live", streamKey }));
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "viewer_count_update") {
            setViewerCount(data.viewerCount || 0);
          }
          if (data.type === "live_chat_message") {
            setChatMessages((msgs) => [
              ...msgs,
              {
                message: data.message,
                sender: data.sender || "User",
                timestamp: data.timestamp,
              },
            ]);
          }
        } catch {}
      };
      ws.onclose = () => {
        if (alive) setTimeout(connect, 2000);
      };
    }
    connect();

    return () => {
      alive = false;
      ws?.send(JSON.stringify({ type: "leave_live", streamKey }));
      ws?.close();
      wsRef.current = null;
    };
  }, [streamKey]);

  function sendChat(message: string) {
    wsRef.current?.send(
      JSON.stringify({
        type: "live_chat_message",
        streamKey,
        message,
        sender: "You",
      })
    );
  }

  return { viewerCount, chatMessages, sendChat };
}