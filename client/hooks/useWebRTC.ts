import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import toast from "react-hot-toast";
import apiInstance from "../src/lib/api";

type WebRTCOpts = {
  readingId: number;
  recipientId: number;
  type: "voice" | "video";
  initiator: boolean;
};

export default function useWebRTC({
  readingId,
  recipientId,
  type,
  initiator,
}: WebRTCOpts) {
  const { user } = useAuthContext();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(type === "video");
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Permission and ICE config, then setup
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pc: RTCPeerConnection | null = null;
    let stopped = false;

    async function init() {
      try {
        // 1. getUserMedia
        const local = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === "video",
        });
        if (stopped) return;
        setLocalStream(local);

        // 2. TURN/STUN config
        const { data } = await apiInstance.get(`/api/webrtc/config/${readingId}`);
        const iceServers = data.iceServers;
        pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        // 3. WS signaling
        ws = new WebSocket(
          `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
        );
        wsRef.current = ws;

        // 4. Add tracks
        local.getTracks().forEach((track) => pc!.addTrack(track, local));
        pc.ontrack = (e) => {
          setRemoteStream((prev) => {
            if (!prev) {
              const ms = new window.MediaStream();
              ms.addTrack(e.track);
              return ms;
            } else {
              prev.addTrack(e.track);
              return prev;
            }
          });
        };

        // 5. ICE candidate
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            ws!.send(
              JSON.stringify({
                type: "signal_ice",
                readingId,
                recipientId,
                payload: e.candidate,
              })
            );
          }
        };

        ws.onopen = async () => {
          // Offer/answer
          if (initiator) {
            const offer = await pc!.createOffer();
            await pc!.setLocalDescription(offer);
            ws!.send(
              JSON.stringify({
                type: "signal_offer",
                readingId,
                recipientId,
                payload: offer,
              })
            );
          }
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "signal_offer" && !initiator) {
              await pc!.setRemoteDescription(new RTCSessionDescription(data.payload));
              const answer = await pc!.createAnswer();
              await pc!.setLocalDescription(answer);
              ws!.send(
                JSON.stringify({
                  type: "signal_answer",
                  readingId,
                  recipientId: data.senderId,
                  payload: answer,
                })
              );
            } else if (data.type === "signal_answer" && initiator) {
              await pc!.setRemoteDescription(new RTCSessionDescription(data.payload));
            } else if (data.type === "signal_ice") {
              await pc!.addIceCandidate(new RTCIceCandidate(data.payload));
            } else if (data.type === "session_end") {
              toast.error("Session ended");
              cleanup();
            } else if (data.type === "session_resumed") {
              toast.success("Reconnected");
            }
          } catch (err) {
            toast.error("WebRTC error: " + (err as any)?.message);
          }
        };

        ws.onerror = () => {
          toast.error("WebSocket error");
        };
        ws.onclose = () => {
          if (!stopped) toast.error("Connection closed");
        };

        setConnected(true);
      } catch (err: any) {
        toast.error(
          "Permission or connection error: " + (err?.message || "Unknown")
        );
      }
    }

    function cleanup() {
      ws?.close();
      pc?.close();
      setLocalStream(null);
      setRemoteStream(null);
      setConnected(false);
    }

    init();

    return () => {
      stopped = true;
      cleanup();
    };
    // eslint-disable-next-line
  }, [readingId, recipientId, type, initiator]);

  // Mute/unmute
  const toggleMic = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMic((m) => !m);
    }
  }, [localStream]);
  const toggleCam = useCallback(() => {
    if (localStream && type === "video") {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setCam((c) => !c);
    }
  }, [localStream, type]);
  const sendEndCall = () => {
    wsRef.current?.send(
      JSON.stringify({
        type: "session_end",
        readingId,
      })
    );
  };

  return {
    localStream,
    remoteStream,
    connected,
    toggleMic,
    toggleCam,
    mic,
    cam,
    sendEndCall,
  };
}