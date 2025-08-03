import React, { useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useWebRTC from "../hooks/useWebRTC";
import useReadingStatus from "../hooks/useReadingStatus";
import { useAuthContext } from "../auth/AuthProvider";

export default function VideoSession() {
  const { readingId } = useParams();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { status, isLoading } = useReadingStatus(Number(readingId));

  // TODO: Get recipientId, type ('voice'|'video'), rate, readerName from reading or query
  // For now, mock recipientId and type (should fetch from backend)
  const recipientId = 2; // Replace with real
  const type: "voice" | "video" = "video"; // Replace with real

  const {
    localStream,
    remoteStream,
    connected,
    toggleMic,
    toggleCam,
    mic,
    cam,
    sendEndCall,
  } = useWebRTC({
    readingId: Number(readingId),
    recipientId,
    type,
    initiator: true, // TODO: decide based on user role/client/reader
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // If session ends, redirect to summary (placeholder)
  useEffect(() => {
    if (status === "ended") {
      setTimeout(() => navigate("/dashboard/readings?ended=" + readingId), 1500);
    }
  }, [status, navigate, readingId]);

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center justify-center px-1 pt-10">
      <div className="w-full max-w-2xl bg-black/90 rounded-2xl shadow-xl flex flex-col h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-pink">
          <div>
            <div className="font-heading text-xl text-pink">Psychic (Live)</div>
            <div className="text-gold font-body text-sm">
              {type === "video" ? "Video" : "Voice"} Reading
            </div>
          </div>
          <div className="text-white font-body flex flex-col items-end text-xs">
            <span>
              <span className="text-pink font-bold">--</span> min
            </span>
            <span>
              <span className="text-gold font-bold">$--</span> total
            </span>
            <span>
              Bal: <span className="text-green-400 font-bold">$--</span>
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center relative">
          {/* Remote video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full rounded-xl bg-black ${
              !remoteStream ? "opacity-40" : ""
            }`}
            style={{ minHeight: 300 }}
          />
          {/* Local PiP */}
          {type === "video" && localStream && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-32 h-32 rounded-lg border-4 border-gold shadow-lg bg-black"
            />
          )}
          {type === "voice" && (
            <div className="absolute bottom-4 right-4 w-32 h-32 rounded-lg border-4 border-gold shadow-lg bg-black flex items-center justify-center text-white">
              <span className="font-heading text-4xl">🎤</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-t border-pink">
          <div className="flex gap-3">
            <button
              className={`px-4 py-2 rounded-full font-bold ${
                mic
                  ? "bg-pink text-white"
                  : "bg-gray-700 text-gold border border-gold"
              }`}
              onClick={toggleMic}
            >
              {mic ? "Mute" : "Unmute"}
            </button>
            {type === "video" && (
              <button
                className={`px-4 py-2 rounded-full font-bold ${
                  cam
                    ? "bg-pink text-white"
                    : "bg-gray-700 text-gold border border-gold"
                }`}
                onClick={toggleCam}
              >
                {cam ? "Camera Off" : "Camera On"}
              </button>
            )}
          </div>
          <button
            className="px-5 py-2 rounded-full bg-gold text-black font-bold shadow-glow hover:bg-pink hover:text-white transition"
            onClick={sendEndCall}
          >
            End Call
          </button>
        </div>
      </div>
    </div>
  );
}