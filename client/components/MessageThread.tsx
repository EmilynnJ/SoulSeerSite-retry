import React, { useRef, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function MessageThread({ userId }: { userId: number }) {
  const [input, setInput] = useState("");
  const queryClient = useQueryClient();
  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", userId],
    queryFn: async () => {
      const res = await fetch(`/api/messages/${userId}`, { credentials: "include" });
      return res.ok ? await res.json() : [];
    },
    enabled: !!userId,
  });
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/messages/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Send failed");
      return res.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries(["messages", userId]);
      queryClient.invalidateQueries(["conversations"]);
    },
  });

  // Mark as read on load
  useEffect(() => {
    if (!messages) return;
    messages
      .filter((m: any) => !m.read && m.receiverId === userId)
      .forEach((m: any) => {
        fetch(`/api/messages/${m.id}/read`, { method: "POST", credentials: "include" });
      });
    // eslint-disable-next-line
  }, [messages, userId]);

  const threadEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="text-gold">Loading...</div>
        ) : (
          (messages || []).map((m: any) => (
            <div
              key={m.id}
              className={`flex ${m.senderId === userId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-2xl font-body text-base break-words ${
                  m.senderId === userId
                    ? "bg-pink text-white rounded-br-sm"
                    : "bg-gray-800 text-gold rounded-bl-sm"
                }`}
              >
                {m.content}
                <span className="block text-xs text-white/60 mt-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={threadEndRef} />
      </div>
      <form
        className="flex gap-2 mt-2"
        onSubmit={e => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMutation.mutate(input);
        }}
      >
        <input
          className="flex-1 px-4 py-2 rounded-full bg-celestial text-white font-body border border-gold focus:outline-none"
          placeholder="Type your message..."
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="px-5 py-2 rounded-full bg-pink text-white font-bold shadow-glow hover:bg-gold hover:text-black transition disabled:bg-gray-400"
          disabled={!input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}