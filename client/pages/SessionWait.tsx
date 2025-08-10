import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useReadingStatus from "../hooks/useReadingStatus";

export default function SessionWait() {
  const { readingId } = useParams();
  const navigate = useNavigate();
  const { status, isLoading } = useReadingStatus(Number(readingId));

  const [type, setType] = React.useState<"chat" | "voice" | "video">("chat");
  // Fetch reading for type
  useEffect(() => {
    if (readingId) {
      apiInstance
        .get(`/api/readings/${readingId}`)
        .then((res) => setType(res.data.type));
    }
  }, [readingId]);
  useEffect(() => {
    if (status === "in_progress") {
      if (type === "chat") {
        navigate(`/readings/session/${readingId}/chat`, { replace: true });
      } else {
        navigate(`/readings/session/${readingId}/video`, { replace: true });
      }
    }
  }, [status, navigate, readingId, type]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-celestial">
      <div className="bg-black bg-opacity-80 rounded-xl shadow-xl p-8 flex items-center gap-8">
        <div>
          <svg className="animate-spin h-16 w-16 text-pink" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
        <div>
          <h1 className="font-heading text-3xl text-pink mb-4">Connecting...</h1>
          <div className="text-gold font-body text-lg">
            {isLoading ? "Checking session status..." : "Waiting for reader to accept..."}
          </div>
        </div>
      </div>
    </div>
  );
}