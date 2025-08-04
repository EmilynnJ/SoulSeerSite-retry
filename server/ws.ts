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
      // --- GIFT BROADCAST ---
      if (data.type === "new_gift") {
        const { streamKey, giftId, sender, animation, viewerCount } = data;
        broadcastToRoom(streamKey, {
          type: "new_gift",
          giftId,
          sender,
          animation,
          viewerCount,
        });
      }

      // --- FORUM EVENTS ---
      if (data.type === "new_forum_post") {
        // Global broadcast
        for (const room of streamRooms.values()) {
          for (const ws of room) {
            try {
              ws.send(JSON.stringify(data));
            } catch {}
          }
        }
      }
      if (data.type === "new_forum_comment") {
        // Global broadcast
        for (const room of streamRooms.values()) {
          for (const ws of room) {
            try {
              ws.send(JSON.stringify(data));
            } catch {}
          }
        }
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

  // User-level DM notification
  const userSockets: Map<number, Set<any>> = new Map();

  (global as any).websocket = {
    ...((global as any).websocket || {}),
    notifyUser: (userId: number, msg: any) => {
      const set = userSockets.get(userId);
      if (set) {
        for (const ws of set) {
          try {
            ws.send(JSON.stringify(msg));
          } catch {}
        }
      }
    },
    broadcastToRoom,
  };

  // Track userId <=> ws mapping for DMs (requires authenticate handshake)
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (data.type === "authenticate" && data.userId) {
        ws.userId = data.userId;
        if (!userSockets.has(ws.userId)) userSockets.set(ws.userId, new Set());
        userSockets.get(ws.userId)!.add(ws);
      }
      // ...other handlers...
    });

    ws.on("close", () => {
      if (ws.userId && userSockets.has(ws.userId)) {
        userSockets.get(ws.userId)!.delete(ws);
        if (userSockets.get(ws.userId)!.size === 0) userSockets.delete(ws.userId);
      }
    });
  });
}