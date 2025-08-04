import { WebSocketServer } from "ws";
import { storage } from "./storage.js";

export function setupLiveWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  // Map: streamKey -> Set of ws
  const streamRooms = new Map<string, Set<any>>();

  wss.on("connection", (ws) => {
    ws.on("message", async (raw) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // ---- LIVE STREAM NAMESPACE ----
      if (data.type === "join_live") {
        const { streamKey } = data;
        ws.streamKey = streamKey;
        if (!streamRooms.has(streamKey)) streamRooms.set(streamKey, new Set());
        streamRooms.get(streamKey)!.add(ws);
        // Increment viewer count in DB
        const res = await storage.updateLivestreamViewerCount(streamKey, +1);
        broadcastToRoom(streamKey, {
          type: "viewer_count_update",
          streamKey,
          viewerCount: res?.viewerCount || 1,
        });
      }
      if (data.type === "leave_live") {
        const { streamKey } = data;
        if (ws.streamKey && streamRooms.has(ws.streamKey)) {
          streamRooms.get(ws.streamKey)!.delete(ws);
          const res = await storage.updateLivestreamViewerCount(ws.streamKey, -1);
          broadcastToRoom(ws.streamKey, {
            type: "viewer_count_update",
            streamKey: ws.streamKey,
            viewerCount: res?.viewerCount || 0,
          });
          ws.streamKey = undefined;
        }
      }
      if (data.type === "live_chat_message") {
        const { streamKey, message, sender } = data;
        broadcastToRoom(streamKey, {
          type: "live_chat_message",
          streamKey,
          message,
          sender,
          timestamp: Date.now(),
        });
      }
    });

    ws.on("close", async () => {
      if (ws.streamKey && streamRooms.has(ws.streamKey)) {
        streamRooms.get(ws.streamKey)!.delete(ws);
        const res = await storage.updateLivestreamViewerCount(ws.streamKey, -1);
        broadcastToRoom(ws.streamKey, {
          type: "viewer_count_update",
          streamKey: ws.streamKey,
          viewerCount: res?.viewerCount || 0,
        });
      }
    });
  });

  function broadcastToRoom(streamKey: string, msg: any) {
    if (!streamRooms.has(streamKey)) return;
    for (const ws of streamRooms.get(streamKey)!) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {}
    }
  }
}