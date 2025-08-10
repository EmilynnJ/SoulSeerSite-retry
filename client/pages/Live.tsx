import React from "react";
import { useQuery } from "@tanstack/react-query";
import LiveCard from "../components/LiveCard";
import { useNavigate } from "react-router-dom";

export default function Live() {
  const { data: streams, isLoading } = useQuery({
    queryKey: ["activeLivestreams"],
    queryFn: async () => {
      const res = await fetch("/api/livestreams/active");
      return res.ok ? await res.json() : [];
    },
    refetchInterval: 15000,
  });
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-celestial py-12 px-4 flex flex-col items-center">
      <h1 className="font-heading text-4xl text-pink mb-8">Live Streams</h1>
      {isLoading ? (
        <div className="text-gold">Loading live streams...</div>
      ) : !streams || streams.length === 0 ? (
        <div className="text-gold">No live streams right now.</div>
      ) : (
        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {streams.map((stream: any) => (
            <LiveCard
              key={stream.id}
              stream={stream}
              onClick={() => navigate(`/live/${stream.muxStreamKey}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}