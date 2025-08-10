import React, { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { SignedIn, useUser } from "@clerk/clerk-react";

export default function PostDetail() {
  const { id } = useParams();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["forumPost", id],
    queryFn: async () => {
      const res = await fetch(`/api/forum/posts/${id}`);
      return res.ok ? await res.json() : null;
    },
    enabled: !!id,
  });
  const [comment, setComment] = useState("");
  const { user } = useUser();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // WS subscribe to new_forum_comment for live updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let alive = true;
    function connect() {
      ws = new WebSocket(
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
      );
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "new_forum_comment" && data.comment?.postId === Number(id)) {
            refetch();
          }
        } catch {}
      };
      ws.onclose = () => { if (alive) setTimeout(connect, 2000); };
    }
    connect();
    return () => { alive = false; ws?.close(); }
  }, [id, refetch]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    const res = await fetch(`/api/forum/posts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: comment }),
    });
    if (res.ok) {
      toast.success("Comment posted!");
      setComment("");
      refetch();
    } else {
      toast.error("Failed to post comment.");
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.comments?.length]);

  if (isLoading || !data)
    return (
      <div className="min-h-screen flex items-center justify-center bg-celestial">
        <div className="text-gold text-lg">Loading...</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-celestial py-12 px-4 flex flex-col items-center">
      <div className="bg-black bg-opacity-90 rounded-2xl shadow-xl p-8 max-w-3xl w-full">
        <h1 className="font-heading text-2xl text-pink mb-3">{data.title}</h1>
        <div className="text-xs text-white/60 mb-4">
          Posted {new Date(data.createdAt).toLocaleString()}
        </div>
        <div className="markdown-body font-body text-white mb-8">
          <ReactMarkdown>{data.content}</ReactMarkdown>
        </div>
        <div className="font-bold text-pink mb-2">Comments</div>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {(data.comments || []).map((c: any) => (
            <div key={c.id} className="bg-celestial rounded p-3">
              <div className="text-white">{c.content}</div>
              <div className="text-xs text-white/60">{new Date(c.createdAt).toLocaleString()}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <SignedIn>
          <form
            className="flex gap-3 mt-6"
            onSubmit={submitComment}
          >
            <input
              className="flex-1 rounded-full bg-celestial border border-gold px-4 py-2 text-white font-body"
              placeholder="Write a comment..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              minLength={2}
              maxLength={512}
              required
            />
            <button
              className="bg-pink text-white px-4 py-2 rounded-full font-bold hover:bg-gold hover:text-black transition"
              type="submit"
            >
              Send
            </button>
          </form>
        </SignedIn>
      </div>
    </div>
  );
}