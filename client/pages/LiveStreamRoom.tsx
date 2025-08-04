import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Hls from "hls.js";
import useLiveWebSocket from "../hooks/useLiveWebSocket";
import { SignedIn } from "@clerk/clerk-react";
import GiftToolbar from "../components/GiftToolbar";
import GiftOverlay from "../components/GiftOverlay";

export default function LiveStreamRoom() {
  const { streamKey } = useParams();
  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // WS
  const {
    viewerCount,
    chatMessages,
    sendChat,
    giftEvents,
  } = useLiveWebSocket(streamKey || "");

  useEffect(() => {
    async function fetchStream() {
      const res = await fetch(`/api/livestreams/${streamKey}`);
      if (res.ok) {
        setStream(await res.json());
      }
      setLoading(false);
    }
    fetchStream();
  }, [streamKey]);

  // HLS player
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!stream?.muxPlaybackId || !videoRef.current) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(`https://stream.mux.com/${stream.muxPlaybackId}.m3u8`);
      hls.attachMedia(videoRef.current);
      return () => hls.destroy();
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = `https://stream.mux.com/${stream.muxPlaybackId}.m3u8`;
    }
  }, [stream?.muxPlaybackId]);

  // Chat input
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-8 px-2">
      <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8">
        <div className="flex-1 flex flex-col">
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="w-full h-[320px] md:h-[480px] bg-black"
              controls
              autoPlay
              playsInline
              muted
            />
            <div className="absolute top-2 right-2 bg-black bg-opacity-70 rounded-full px-4 py-1 flex items-center gap-2">
              <span className="text-pink font-bold text-sm">LIVE</span>
              <span className="text-gold font-bold text-xs">{viewerCount} viewers</span>
            </div>
          </div>
          <div className="mt-3 text-white font-heading text-2xl">{stream?.reader?.fullName}</div>
          <div className="text-gold font-body text-sm mb-2">{(stream?.reader?.specialties || []).join(", ")}</div>
        </div>
        {/* Chat sidebar */}
        <div className="w-full md:w-80 bg-black bg-opacity-70 rounded-xl p-4 flex flex-col">
          <div className="font-bold text-pink mb-2">Live Chat</div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-gold font-bold">{msg.sender}:</span>
                <span className="text-white">{msg.message}</span>
                <span className="text-xs text-white/60">{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex mt-2 gap-2"
            onSubmit={e => {
              e.preventDefault();
              if (!input.trim()) return;
              sendChat(input);
              setInput("");
            }}
          >
            <input
              className="flex-1 rounded-full bg-celestial border border-gold px-4 py-2 text-white font-body"
              placeholder="Type message..."
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button
              className="bg-pink text-white px-4 py-2 rounded-full font-bold hover:bg-gold hover:text-black transition"
              type="submit"
            >
              Send
            </button>
          </form>
          <SignedIn>
            <GiftToolbar streamKey={streamKey || ""} />
          </SignedIn>
        </div>
      </div>
      <GiftOverlay events={giftEvents} />
    </div>
  );
}