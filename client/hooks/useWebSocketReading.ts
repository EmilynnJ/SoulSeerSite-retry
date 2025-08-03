import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import toast from "react-hot-toast";

type Message = {
  text: string;
  mine: boolean;
  timestamp: number;
};

export default function useWebSocketReading(readingId: number) {
  const { user } = useAuthContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [minutes, setMinutes] = useState(0);
  const [cost, setCost] = useState(0);
  const [balance, setBalance] = useState(0);
  const [status, setStatus] = useState<"waiting"|"active"|"ended">("waiting");
  const [readerName, setReaderName] = useState<string>("Psychic");
  const [rate, setRate] = useState<number>(100);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let alive = true;

    function doConnect() {
      ws = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
      );
      wsRef.current = ws;
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "join_reading", readingId }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "session_ready":
              if (data.mode === "chat") {
                setStatus("active");
                setReaderName(data.readerName || "Psychic");
                setRate(Number(data.pricePerMinute || 100));
                toast.success("Session started!");
              }
              break;
            case "reading_chat_message":
              setMessages((msgs) =>
                [
                  ...msgs,
                  {
                    text: data.message,
                    mine: data.senderId === user?.id,
                    timestamp: data.timestamp,
                  },
                ].slice(-100)
              );
              break;
            case "minute_billed":
              setMinutes(data.minutes || 0);
              setCost(data.minutes * (data.pricePerMinute || rate || 100));
              toast(
                `Minute billed: ${data.minutes} (${((data.minutes * (data.pricePerMinute || rate || 100))/100).toFixed(2)} USD)`,
                { icon: "⏳" }
              );
              break;
            case "ACCOUNT_BALANCE_UPDATED":
              setBalance(data.newBalance || 0);
              break;
            case "session_end":
              setStatus("ended");
              toast.error(
                "Session ended: " +
                  (data.reason === "insufficient_balance"
                    ? "Insufficient balance"
                    : data.reason === "normal"
                    ? "Session complete"
                    : "Disconnected")
              );
              break;
            case "error":
              toast.error(data.message || "Error in session");
              break;
          }
        } catch {}
      };
      ws.onerror = (e) => {
        toast.error("WebSocket error.");
      };
      ws.onclose = () => {
        if (alive) {
          toast.error("Connection lost. Trying to reconnect...");
          setTimeout(doConnect, 2000);
        }
      };
    }
    doConnect();

    return () => {
      alive = false;
      ws?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line
  }, [readingId, user?.id]);

  const sendMessage = (text: string) => {
    wsRef.current?.send(
      JSON.stringify({
        type: "reading_chat_message",
        readingId,
        message: text,
      })
    );
  };

  return {
    messages,
    sendMessage,
    minutes,
    cost,
    balance,
    status,
    readerName,
    rate,
  };
}