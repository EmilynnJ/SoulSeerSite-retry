import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { SignedIn, useUser } from "@clerk/clerk-react";
import NewPostModal from "../components/NewPostModal";
import toast from "react-hot-toast";

export default function Community() {
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const { data: posts, isLoading } = useQuery({
    queryKey: ["forumPosts", page],
    queryFn: async () => {
      const res = await fetch(`/api/forum/posts?page=${page}&pageSize=10`);
      return res.ok ? await res.json() : [];
    },
    keepPreviousData: true,
  });

  return (
    <div className="min-h-screen bg-celestial py-12 px-4 flex flex-col items-center">
      <h1 className="font-heading text-4xl text-pink mb-6">Community Forum</h1>
      <SignedIn>
        <button
          className="bg-pink text-white px-6 py-2 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition mb-6"
          onClick={() => setModalOpen(true)}
        >
          New Post
        </button>
        <NewPostModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </SignedIn>
      {isLoading ? (
        <div className="text-gold">Loading threads...</div>
      ) : !posts || posts.length === 0 ? (
        <div className="text-gold">No threads found.</div>
      ) : (
        <div className="w-full max-w-3xl flex flex-col gap-6">
          {posts.map((post: any) => (
            <Link
              to={`/community/${post.id}`}
              key={post.id}
              className="bg-black bg-opacity-80 rounded-xl p-5 shadow hover:shadow-glow transition group"
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="font-heading text-xl text-pink group-hover:underline">
                  {post.title}
                </span>
                <span className="text-xs text-gold ml-auto">
                  {post.commentCount} comments
                </span>
              </div>
              <div className="font-body text-white text-sm mb-1">
                {post.content.slice(0, 100)}{post.content.length > 100 ? "..." : ""}
              </div>
              <div className="text-xs text-white/60">
                {new Date(post.createdAt).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-8">
        <button
          className="bg-gold text-black px-4 py-2 rounded font-bold"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="text-white font-bold">{page}</span>
        <button
          className="bg-gold text-black px-4 py-2 rounded font-bold"
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}