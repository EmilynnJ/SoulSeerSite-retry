import { useState, useCallback, useEffect, useRef } from 'react';

// Standard WebRTC RTCIceServer type
interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Payload for offer/answer
interface SDPPayload {
  type: RTCSdpType; // 'offer' | 'answer'
  sdp: string | undefined;
}

// Payload for ICE candidates
interface IceCandidatePayload {
  candidate: RTCIceCandidateInit | undefined;
  // sdpMid?: string | null; // Optional, often included
  // sdpMLineIndex?: number | null; // Optional, often included
}

// Message types for WebSocket communication
interface WebRTCOfferMessage {
  type: 'webrtc_offer';
  payload: SDPPayload;
  readingId: string;
  recipientId: string;
  senderId: string;
}

interface WebRTCAnswerMessage {
  type: 'webrtc_answer';
  payload: SDPPayload;
  readingId: string;
  recipientId: string;
  senderId: string;
}

interface WebRTCIceCandidateMessage {
  type: 'webrtc_ice_candidate';
  payload: IceCandidatePayload;
  readingId: string;
  recipientId: string;
  senderId: string;
}

interface WebRTCEndCallMessage {
  type: 'webrtc_end_call';
  readingId: string;
  recipientId: string; // User to notify about the call ending
  senderId: string;   // User who initiated the end call
}

type WebRTCMessage =
  | WebRTCOfferMessage
  | WebRTCAnswerMessage
  | WebRTCIceCandidateMessage
  | WebRTCEndCallMessage;

type SendMessageFunction = (message: WebRTCMessage) => void;

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  // iceServers state is removed as it's fetched and used directly in initializePeerConnection

  const initializePeerConnection = useCallback(async (
    readingId: string,
    currentUserId: string,
    recipientUserId: string,
    sendMessage: SendMessageFunction
  ) => {
    console.log(`Initializing Peer Connection for reading: ${readingId}, from ${currentUserId} to ${recipientUserId}`);
    try {
      const response = await fetch(`/api/webrtc/config/${readingId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ICE server configuration: ${response.status} ${response.statusText}`);
      }
      const configFromServer = await response.json();
      const fetchedIceServers: RTCIceServerConfig[] = configFromServer.iceServers || [];
      console.log('Fetched ICE Servers:', fetchedIceServers);

      const pc = new RTCPeerConnection({ iceServers: fetchedIceServers });
      peerConnectionRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Generated ICE candidate:', event.candidate);
          sendMessage({
            type: 'webrtc_ice_candidate',
            payload: { candidate: event.candidate.toJSON() },
            readingId,
            senderId: currentUserId,
            recipientId: recipientUserId,
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('Remote track received:', event.streams[0]);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
            // Handle cases where there are no streams or stream[0] is undefined
            // Potentially add individual tracks if event.track is available
            if (event.track) {
                const newStream = new MediaStream();
                newStream.addTrack(event.track);
                setRemoteStream(newStream);
            }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (peerConnectionRef.current) {
          console.log(`ICE Connection State: ${peerConnectionRef.current.iceConnectionState}`);
          const currentState = peerConnectionRef.current.iceConnectionState;
          if (currentState === 'connected' || currentState === 'completed') {
            setIsCallActive(true);
          } else if (currentState === 'failed' || currentState === 'disconnected' || currentState === 'closed') {
            setIsCallActive(false);
            // Consider calling closeConnection() here if 'failed'
            if(currentState === 'failed') {
                console.warn('ICE connection failed. Closing connection.');
                // closeConnection(); // Be cautious with automatic close on failed, might be temporary
            }
          }
        }
      };

      pc.onsignalingstatechange = () => {
        if (peerConnectionRef.current) {
          console.log(`Signaling State: ${peerConnectionRef.current.signalingState}`);
        }
      };

      pc.onnegotiationneeded = () => {
        console.log('Negotiation needed. This typically means an offer should be created if this client is the initiator.');
        // This event can be tricky. Usually, the initiator creates the offer.
        // If this fires on the callee side unexpectedly, it might indicate an issue.
        // For now, just logging. Offer creation is explicitly called by the component.
      };

      if (localStream) {
        localStream.getTracks().forEach(track => {
          console.log('Adding local track to new peer connection:', track.kind);
          try {
            peerConnectionRef.current?.addTrack(track, localStream);
          } catch (e) {
            console.error('Error adding track:', e);
          }
        });
      }

    } catch (error) {
      console.error('Error initializing PeerConnection:', error);
      // Consider setting an error state to be displayed in the UI
    }
  }, [localStream]); // localStream dependency is important here

  const startLocalMedia = useCallback(async () => {
    console.log('Attempting to start local media...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      // setIsCallActive(true); // Call becomes active when ICE connection is 'connected'/'completed'
      console.log('Local media stream obtained:', stream);

      if (peerConnectionRef.current) {
        stream.getTracks().forEach(track => {
          console.log('Adding local track to existing peer connection:', track.kind);
           try {
            peerConnectionRef.current!.addTrack(track, stream);
          } catch (e) {
            console.error('Error adding track to existing PC:', e);
          }
        });
      }
    } catch (error) {
      console.error('Error accessing local media:', error);
      // Potentially set an error state
    }
  }, []);

  const createOfferAndSend = useCallback(async (readingId: string, recipientId: string, currentUserId: string, sendMessage: SendMessageFunction) => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized. Cannot create offer.');
      return;
    }
    if (!localStream) {
        console.warn('Local stream not available. Starting local media before creating offer.');
        // await startLocalMedia(); // This might cause issues if startLocalMedia is not completing fast enough
                               // or if it also tries to add tracks to a PC that's in the middle of negotiation.
                               // It's generally better to ensure local media is started before initiating an offer.
        // For now, we'll proceed assuming local media should ideally be ready.
        // If not, the offer might be created without local tracks initially, which might require renegotiation.
    }
    console.log(`Creating offer for reading ${readingId}, from ${currentUserId} to ${recipientId}`);
    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('Offer created and local description set.');
      if (peerConnectionRef.current.localDescription) {
        sendMessage({
          type: 'webrtc_offer',
          payload: { sdp: peerConnectionRef.current.localDescription.sdp, type: peerConnectionRef.current.localDescription.type },
          readingId,
          senderId: currentUserId,
          recipientId,
        });
      } else {
        console.error('Local description is null after setLocalDescription.');
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [localStream]); // localStream dependency

  const handleReceivedOffer = useCallback(async (offerData: SDPPayload, readingId: string, remoteUserId: string, currentUserId: string, sendMessage: SendMessageFunction) => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized. Cannot handle offer.');
      // Consider initializing PC here if it's the callee and PC is not ready.
      // This might involve calling initializePeerConnection.
      return;
    }
     if (!localStream) {
        console.warn('Local stream not available when handling offer. Starting local media.');
        // await startLocalMedia(); // Similar caution as in createOfferAndSend
    }
    console.log(`Handling received offer for reading ${readingId} from ${remoteUserId}`);
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offerData));
      console.log('Remote description (offer) set.');
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('Answer created and local description set.');
      if (peerConnectionRef.current.localDescription) {
        sendMessage({
          type: 'webrtc_answer',
          payload: { sdp: peerConnectionRef.current.localDescription.sdp, type: peerConnectionRef.current.localDescription.type },
          readingId,
          senderId: currentUserId,
          recipientId: remoteUserId,
        });
      } else {
         console.error('Local description is null after creating answer.');
      }
    } catch (error) {
      console.error('Error handling received offer:', error);
    }
  }, [localStream]); // localStream dependency

  const handleReceivedAnswer = useCallback(async (answerData: SDPPayload) => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized. Cannot handle answer.');
      return;
    }
    console.log('Handling received answer.');
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answerData));
      console.log('Remote description (answer) set. Call should be active if ICE completes.');
      // isCallActive will be set by oniceconnectionstatechange
    } catch (error) {
      console.error('Error handling received answer:', error);
    }
  }, []);

  const handleReceivedIceCandidate = useCallback(async (candidateData: IceCandidatePayload) => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized. Cannot add ICE candidate.');
      return;
    }
    if (!candidateData.candidate) {
        console.warn('Received empty ICE candidate payload.');
        return;
    }
    console.log('Adding received ICE candidate:', candidateData.candidate);
    try {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
      console.log('ICE candidate added.');
    } catch (error) {
      console.error('Error adding received ICE candidate:', error);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
        console.log(track.enabled ? 'Unmuted audio' : 'Muted audio');
      });
    } else {
      console.warn("toggleMute: Local stream not available.");
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsCameraOff(!track.enabled);
        console.log(track.enabled ? 'Camera ON' : 'Camera OFF');
      });
    } else {
        console.warn("toggleCamera: Local stream not available.");
    }
  }, [localStream]);

  const closeConnection = useCallback((
    sendMessage?: SendMessageFunction,
    readingId?: string,
    currentUserId?: string,
    recipientUserId?: string
  ) => {
    console.log('Closing WebRTC connection...');
    if (sendMessage && readingId && currentUserId && recipientUserId) {
      sendMessage({
        type: 'webrtc_end_call',
        readingId,
        senderId: currentUserId,
        recipientId: recipientUserId,
      });
      console.log('Sent webrtc_end_call message.');
    }

    localStream?.getTracks().forEach(track => track.stop());
    // Remote stream tracks are managed by the browser when the connection closes or tracks are removed.
    // No explicit remoteStream.getTracks().forEach(track => track.stop()) is usually needed.

    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.onsignalingstatechange = null;
      peerConnectionRef.current.onnegotiationneeded = null;
      if (peerConnectionRef.current.signalingState !== 'closed') {
        peerConnectionRef.current.close();
      }
      peerConnectionRef.current = null;
      console.log('PeerConnection closed and cleared.');
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    setIsMuted(false);
    setIsCameraOff(false);
    console.log('WebRTC states reset.');
  }, [localStream]); // Removed remoteStream from deps as it's not directly manipulated for stopping tracks here

  useEffect(() => {
    // Main cleanup function
    return () => {
      console.log('useWebRTC hook unmounting. Performing cleanup...');
      // Call closeConnection without signaling other peer, as component is unmounting.
      // Signaling might be desired if unmount means "leaving the call page".
      // For a simple unmount (e.g. navigating away), local cleanup is primary.
      closeConnection();
    };
  }, [closeConnection]);

  return {
    localStream,
    remoteStream,
    isCallActive,
    isMuted,
    isCameraOff,
    peerConnection: peerConnectionRef.current,
    initializePeerConnection,
    startLocalMedia,
    createOfferAndSend,
    handleReceivedOffer,
    handleReceivedAnswer,
    handleReceivedIceCandidate,
    toggleMute,
    toggleCamera,
    closeConnection,
  };
};

// SDP Payload should include type and sdp. Example: { type: offer.type, sdp: offer.sdp }
// ICE Candidate Payload should be the candidate object itself. Example: { candidate: event.candidate.toJSON() }
// When sending offers/answers, use .toJSON() on localDescription.
// When creating RTCSessionDescription for remote descriptions, use new RTCSessionDescription(sdpPayload).
// When adding ICE candidates, use new RTCIceCandidate(candidatePayload.candidate).
