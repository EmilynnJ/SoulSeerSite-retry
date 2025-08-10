import React from "react";
import { useQuery } from "@tanstack/react-query";

export default function ConversationList({ activeUserId, onSelect }: { activeUserId: number | null; onSelect: (userId: number) => void }) {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/messages/conversations", { credentials: "include" });
      return res.ok ? await res.json() : [];
    },
  });

  return (
    <div className="w-full">
      <h2 className="font-heading text-lg text-pink mb-2">Conversations</h2>
      {isLoading ? (
        <div className="text-gold">Loading...</div>
      ) : !conversations || conversations.length === 0 ? (
        <div className="text-gold">No conversations yet.</div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c: any) => (
            <li
              key={c.userId}
              onClick={() => onSelect(c.userId)}
              className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-pink/20 ${activeUserId === c.userId ? "bg-pink/30" : ""}`}
            >
              <img
                src={c.user.profileImage || "https://i.pravatar.cc/40"}
                className="w-8 h-8 rounded-full object-cover border border-gold"
                alt={c.user.fullName}
              />
              <div className="flex-1">
                <div className="font-bold text-white">{c.user.fullName}</div>
                <div className="text-xs text-white/70 truncate">{c.last.content.slice(0, 40)}</div>
              </div>
              {c.unread > 0 && (
                <span className="bg-gold text-black text-xs rounded-full px-2 font-bold">{c.unread}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}