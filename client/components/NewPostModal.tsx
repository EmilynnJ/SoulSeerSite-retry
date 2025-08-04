import React, { useState } from "react";
import toast from "react-hot-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

export default function NewPostModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, content }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Thread posted!");
      setTitle("");
      setContent("");
      onClose();
    } else {
      toast.error("Failed to post.");
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-celestial rounded-xl shadow-xl p-8 max-w-lg w-full">
        <h2 className="font-heading text-2xl text-pink mb-4">New Thread</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full px-4 py-2 rounded bg-black text-white border border-gold font-body"
            placeholder="Title"
            value={title}
            minLength={3}
            maxLength={128}
            required
            onChange={e => setTitle(e.target.value)}
          />
          <ReactQuill theme="snow" value={content} onChange={setContent} />
          <div className="flex gap-3 justify-end">
            <button
              className="bg-gray-700 text-white px-5 py-2 rounded-full"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="bg-pink text-white px-8 py-2 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
              type="submit"
              disabled={loading}
            >
              {loading ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}