import { useState, useCallback, useEffect, useRef } from 'react';

// Define a basic RTCIceServer type if not available globally or from a library
interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Define types for messaging payloads (can be expanded or moved to a shared types file)
interface WebRTCOfferPayload {
  type: 'webrtc_offer';
  sdp: RTCSessionDescriptionInit | null | undefined;
  readingId: string;
  recipientId: string;
  senderId: string;
}

interface WebRTCAnswerPayload {
  type: 'webrtc_answer';
  sdp: RTCSessionDescriptionInit | null | undefined;
  readingId: string;
  recipientId: string;
  senderId: string;
}

interface WebRTCIceCandidatePayload {
  type: 'webrtc_ice_candidate';
  candidate: RTCIceCandidateInit | null | undefined;
  readingId: string;
  recipientId: string;
  senderId: string;
}

interface WebRTCEndCallPayload {
  type: 'webrtc_end_call';
  readingId: string;
  recipientId: string;
  senderId: string;
}

type WebRTCMessage = WebRTCOfferPayload | WebRTCAnswerPayload | WebRTCIceCandidatePayload | WebRTCEndCallPayload;

// Type for the sendMessage function passed to the hook
type SendMessageFunction = (payload: WebRTCMessage) => void;


export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [iceServers, setIceServers] = useState<RTCIceServerConfig[]>([]);

  const initializePeerConnection = useCallback(async (readingId: string, currentUserId: string, recipientUserId: string, sendMessage: SendMessageFunction) => {
    console.log('Initializing Peer Connection for reading:', readingId);
    try {
      const response = await fetch(`/api/webrtc/config/${readingId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ICE server configuration: ${response.statusText}`);
      }
      const config = await response.json();
      setIceServers(config.iceServers);
      console.log('Fetched ICE Servers:', config.iceServers);

      const pc = new RTCPeerConnection({ iceServers: config.iceServers });
      peerConnectionRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Generated ICE candidate:', event.candidate);
          sendMessage({
            type: 'webrtc_ice_candidate',
            candidate: event.candidate.toJSON(), // Send as JSON
            readingId,
            recipientId: recipientUserId,
            senderId: currentUserId,
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('Remote track received:', event.streams[0]);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`ICE Connection State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setIsCallActive(true);
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
          setIsCallActive(false);
        }
      };

      pc.onsignalingstatechange = () => {
        console.log(`Signaling State: ${pc.signalingState}`);
      };

      // If localStream already exists, add its tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          console.log('Adding local track to new peer connection:', track);
          pc.addTrack(track, localStream);
        });
      }


    } catch (error) {
      console.error('Error initializing PeerConnection:', error);
    }
  }, [localStream]); // Add localStream as dependency

  const startLocalMedia = useCallback(async () => {
    console.log('Starting local media...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsCallActive(true); // Or set based on connection state
      console.log('Local media stream obtained:', stream);

      if (peerConnectionRef.current) {
        stream.getTracks().forEach(track => {
          console.log('Adding track to existing peer connection:', track);
          peerConnectionRef.current!.addTrack(track, stream);
        });
      }
    } catch (error) {
      console.error('Error accessing local media:', error);
    }
  }, []);

  const createOfferAndSend = useCallback(async (readingId: string, recipientId: string, senderId: string, sendMessage: SendMessageFunction) => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized for creating offer.');
      return;
    }
    console.log(`Creating offer for reading ${readingId} to ${recipientId}`);
    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('Offer created and local description set:', offer);
      sendMessage({
        type: 'webrtc_offer',
        sdp: peerConnectionRef.current.localDescription?.toJSON(),
        readingId,
        recipientId,
        senderId,
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, []);

  const handleReceivedOffer = useCallback(async (offerSdp: RTCSessionDescriptionInit, readingId: string, senderId: string, recipientId: string, sendMessage: SendMessageFunction) => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized for handling offer.');
      // Potentially initialize PC here if it's the callee
      return;
    }
    console.log(`Handling received offer for reading ${readingId} from ${senderId}`);
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offerSdp));
      console.log('Remote description (offer) set.');
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('Answer created and local description set:', answer);
      sendMessage({
        type: 'webrtc_answer',
        sdp: peerConnectionRef.current.localDescription?.toJSON(),
        readingId,
        recipientId: senderId, // Send answer back to the offerer
        senderId: recipientId, // Current user is the sender of the answer
      });
    } catch (error) {
      console.error('Error handling received offer:', error);
    }
  }, []);

  const handleReceivedAnswer = useCallback(async (answerSdp: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized for handling answer.');
      return;
    }
    console.log('Handling received answer.');
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answerSdp));
      console.log('Remote description (answer) set.');
      setIsCallActive(true); // Call is now fully active
    } catch (error) {
      console.error('Error handling received answer:', error);
    }
  }, []);

  const handleReceivedIceCandidate = useCallback(async (candidateInit: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized for handling ICE candidate.');
      return;
    }
    console.log('Handling received ICE candidate:', candidateInit);
    try {
      const candidate = new RTCIceCandidate(candidateInit);
      await peerConnectionRef.current.addIceCandidate(candidate);
      console.log('ICE candidate added.');
    } catch (error) {
      console.error('Error adding received ICE candidate:', error);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(audioTrack.enabled ? 'Unmuted' : 'Muted');
      }
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
        console.log(videoTrack.enabled ? 'Camera ON' : 'Camera OFF');
      }
    }
  }, [localStream]);

  const closeConnection = useCallback((sendMessage?: SendMessageFunction, readingId?: string, recipientId?: string, senderId?: string) => {
    console.log('Closing WebRTC connection.');
    if (sendMessage && readingId && recipientId && senderId) {
      sendMessage({
        type: 'webrtc_end_call',
        readingId,
        recipientId,
        senderId,
      });
      console.log('Sent webrtc_end_call message.');
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      console.log('Local stream tracks stopped.');
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
       console.log('Remote stream tracks stopped.');
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.onsignalingstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log('PeerConnection closed.');
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    setIsMuted(false);
    setIsCameraOff(false);
    console.log('WebRTC states reset.');
  }, [localStream, remoteStream]);

  useEffect(() => {
    // Cleanup function to be called when the component unmounts
    return () => {
      // closeConnection(); // Avoid passing sendMessage etc. here directly as they might be stale
      // A more robust cleanup might involve signaling the other peer if the call is active
      // For now, just local cleanup
      if (peerConnectionRef.current) {
          console.log('Cleaning up PeerConnection on unmount.');
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
      }
      if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          console.log('Stopped local stream tracks on unmount.');
      }
       setLocalStream(null);
       setRemoteStream(null);
       setIsCallActive(false);
    };
  }, [localStream]); // Add localStream to dependencies for cleanup

  return {
    localStream,
    remoteStream,
    isCallActive,
    isMuted,
    isCameraOff,
    peerConnection: peerConnectionRef.current, // Expose the current PC instance
    initializePeerConnection,
    startLocalMedia,
    createOfferAndSend,
    handleReceivedOffer,
    handleReceivedAnswer,
    handleReceivedIceCandidate, // This is for receiving, direct sending is in onicecandidate
    toggleMute,
    toggleCamera,
    closeConnection,
  };
};

// Note: The `handleIceCandidate` function as initially described for *sending* candidates
// is effectively integrated into the `pc.onicecandidate` handler within `initializePeerConnection`.
// `handleReceivedIceCandidate` is for *receiving* candidates from the other peer.
