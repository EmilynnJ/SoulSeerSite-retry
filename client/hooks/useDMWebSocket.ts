import { useEffect } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function useDMWebSocket(userId: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    let ws: WebSocket | null = null;
    let alive = true;

    function connect() {
      ws = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
      );
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "authenticate", userId }));
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "new_dm") {
            toast.success("New message received!");
            queryClient.invalidateQueries(["conversations"]);
            queryClient.invalidateQueries(["messages", data.message.senderId]);
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
      ws?.close();
    };
  }, [userId, queryClient]);
}