import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'wouter'; // Assuming wouter is used as per previous context
import { useAuth } from '../hooks/use-auth';
import { useWebSocket } from '../hooks/use-websocket'; // Assuming this hook exists
import { useWebRTC } from '../hooks/use-webrtc';
// import { Reading } from '@shared/schema'; // Assuming Reading type is available

// Placeholder for Reading type if not imported from shared schema yet
interface Reading {
  id: string;
  clientId: string; // or number
  readerId: string; // or number
  // other fields...
}

// Placeholder UI Components (can be actual components later)
const VideoPlayer: React.FC<{ stream: MediaStream | null, muted?: boolean }> = ({ stream, muted }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return <video ref={videoRef} autoPlay muted={muted} playsInline style={{ width: '300px', border: '1px solid black' }} />;
};

const CallControls: React.FC<{
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
  isMuted: boolean;
  isCameraOff: boolean;
  isCallActive: boolean;
}> = ({ onToggleMute, onToggleCamera, onEndCall, isMuted, isCameraOff, isCallActive }) => {
  return (
    <div>
      <button onClick={onToggleMute}>{isMuted ? 'Unmute' : 'Mute'}</button>
      <button onClick={onToggleCamera}>{isCameraOff ? 'Cam On' : 'Cam Off'}</button>
      <button onClick={onEndCall} disabled={!isCallActive}>End Call</button>
    </div>
  );
};

// Placeholder fetchReadingDetails function
const fetchReadingDetails = async (id: string): Promise<Reading | null> => {
  console.log(`Fetching reading details for ${id}... (Placeholder)`);
  // Replace with actual API call
  // Example: const response = await fetch(`/api/readings/${id}`);
  // if (!response.ok) throw new Error('Failed to fetch reading details');
  // return response.json();

  // For now, returning a mock after a delay
  return new Promise(resolve => setTimeout(() => {
    // Simulate fetching based on who the current user is (mocking)
    // This logic needs to be robust based on actual API and user roles
    const mockReaderId = "reader123";
    const mockClientId = "client456";
    let otherUser = '';
    // This is a very simplified mock. In reality, you'd get this from useAuth().currentUser
    const currentMockUserId = Math.random() > 0.5 ? mockReaderId : mockClientId;

    if (currentMockUserId === mockReaderId) {
        otherUser = mockClientId;
    } else {
        otherUser = mockReaderId;
    }

    resolve({
        id,
        clientId: mockClientId,
        readerId: mockReaderId,
        // otherParticipantId: otherUser // This would be determined dynamically
    });
  }, 1000));
};


const ReadingSessionPage: React.FC = () => {
  const params = useParams();
  const readingId = params.readingId;
  const { currentUser } = useAuth();
  const { sendMessage, lastMessage } = useWebSocket(); // Assuming lastMessage for incoming messages
  const webRTC = useWebRTC();

  const [readingDetails, setReadingDetails] = useState<Reading | null>(null);
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState<boolean>(false); // For call initiation logic
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Effect for initializing the session: fetching reading details, determining participants
  useEffect(() => {
    if (!readingId || !currentUser) return;

    const initSession = async () => {
      try {
        const details = await fetchReadingDetails(readingId);
        if (!details) {
          setError(`Reading session ${readingId} not found.`);
          return;
        }
        setReadingDetails(details);

        const otherId = currentUser.id.toString() === details.clientId ? details.readerId : details.clientId;
        setOtherParticipantId(otherId);
        console.log(`Session initialized. Current user: ${currentUser.id}, Other participant: ${otherId}`);

        // Simulate a "call accepted" or "ready" signal to kick off WebRTC
        // In a real app, this might come from WebSocket after both users join the page
        // For now, we'll assume the client (non-reader) initiates the offer after this setup.
        if (currentUser.id.toString() !== details.readerId) { // Client initiates
             // setIsSessionReady(true); // This would trigger offer creation
        }
         // Reader waits for offer.
         // For testing, we can auto-trigger for the client
         if (currentUser.role === 'client' && sendMessage) {
             console.log("Client is ready, preparing to initialize and send offer.");
             // This is a placeholder for a "user_ready_for_call" type message
             // or directly calling initialize and then createOffer
             setIsSessionReady(true);
         }


      } catch (err) {
        console.error('Error initializing session:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize session.');
      }
    };
    initSession();
  }, [readingId, currentUser]);

  // Effect for WebRTC initialization once other participant is known and sendMessage is available
  useEffect(() => {
    if (readingId && currentUser && otherParticipantId && sendMessage && webRTC.initializePeerConnection) {
        console.log(`Initializing peer connection for reading ${readingId}, user ${currentUser.id} to ${otherParticipantId}`);
        webRTC.initializePeerConnection(readingId, currentUser.id.toString(), otherParticipantId, sendMessage as SendMessageFunction);
    }
  }, [readingId, currentUser, otherParticipantId, sendMessage, webRTC.initializePeerConnection]);


  // Effect for starting local media once peer connection is initialized (or earlier if preferred)
  useEffect(() => {
    if (peerConnectionRef.current || webRTC.peerConnection) { // Check if PC is initialized
        webRTC.startLocalMedia();
    }
  }, [webRTC.startLocalMedia, webRTC.peerConnection]); // Depend on peerConnection being set


  // Effect for handling incoming WebSocket messages for WebRTC signaling
  useEffect(() => {
    if (lastMessage && readingDetails && currentUser && otherParticipantId && sendMessage) {
      try {
        const message = typeof lastMessage === 'string' ? JSON.parse(lastMessage) : lastMessage;

        if (message.readingId !== readingId) {
          // console.log("WebSocket message for a different reading, ignoring.");
          return;
        }

        console.log('Received WebSocket message:', message.type, message);

        switch (message.type) {
          case 'webrtc_offer':
            if (message.recipientId === currentUser.id.toString()) {
              console.log("Handling received WebRTC offer from:", message.senderId);
              webRTC.handleReceivedOffer(message.payload.sdp, readingId!, message.senderId, currentUser.id.toString(), sendMessage as SendMessageFunction);
            }
            break;
          case 'webrtc_answer':
            if (message.recipientId === currentUser.id.toString()) {
              console.log("Handling received WebRTC answer from:", message.senderId);
              webRTC.handleReceivedAnswer(message.payload.sdp);
            }
            break;
          case 'webrtc_ice_candidate':
            if (message.recipientId === currentUser.id.toString()) {
              console.log("Handling received WebRTC ICE candidate from:", message.senderId);
              webRTC.handleReceivedIceCandidate(message.payload.candidate);
            }
            break;
          case 'webrtc_end_call':
             if (message.recipientId === currentUser.id.toString() || message.senderId === currentUser.id.toString()) {
                console.log("Received end call signal from:", message.senderId);
                webRTC.closeConnection(); // Local cleanup
                // UI update to show call ended
                setError("Call ended by other user.");
             }
            break;
          // Example of a custom message to trigger call initiation
          case 'reader_accepted_call': // Or 'user_joined_session', 'call_initiate_request'
            if (readingDetails && currentUser?.id.toString() === readingDetails.clientId && otherParticipantId) {
              console.log("Reader accepted, client creating offer.");
              webRTC.createOfferAndSend(readingId!, otherParticipantId, currentUser.id.toString(), sendMessage as SendMessageFunction);
            }
            setIsSessionReady(true);
            break;
          default:
            // console.log('Received unhandled WebSocket message type:', message.type);
            break;
        }
      } catch (e) {
        console.error("Error processing WebSocket message:", e);
      }
    }
  }, [lastMessage, readingId, readingDetails, currentUser, otherParticipantId, webRTC, sendMessage]);

  // Assign streams to video elements
  useEffect(() => {
    if (localVideoRef.current && webRTC.localStream) {
      localVideoRef.current.srcObject = webRTC.localStream;
    }
  }, [webRTC.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && webRTC.remoteStream) {
      remoteVideoRef.current.srcObject = webRTC.remoteStream;
    }
  }, [webRTC.remoteStream]);

  const handleEndCall = () => {
    if (currentUser && readingId && otherParticipantId && sendMessage) {
      webRTC.closeConnection(sendMessage as SendMessageFunction, readingId, otherParticipantId, currentUser.id.toString());
    } else {
      webRTC.closeConnection(); // Fallback for local cleanup if context is missing
    }
    setError("Call ended.");
  };

  // Placeholder for initiating call if current user is client and session is ready
  // This might be triggered by a button or automatically after initialization
  useEffect(() => {
      if (isSessionReady && readingId && currentUser && otherParticipantId && sendMessage && currentUser.role === 'client' && webRTC.peerConnection && webRTC.peerConnection.signalingState === 'stable') {
          console.log(`Client is ready, creating and sending offer to ${otherParticipantId}`);
          webRTC.createOfferAndSend(readingId, otherParticipantId, currentUser.id.toString(), sendMessage as SendMessageFunction);
          setIsSessionReady(false); // Reset after attempting to send offer
      }
  }, [isSessionReady, readingId, currentUser, otherParticipantId, sendMessage, webRTC]);


  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!readingDetails || !currentUser || !readingId) return <p>Loading session details...</p>;
  if (!otherParticipantId) return <p>Waiting for other participant details...</p>;
   // if (!webRTC.peerConnection) return <p>Initializing WebRTC...</p>; // Could be too flickery

  return (
    <div style={{ padding: '20px' }}>
      <h1>Reading Session: {readingId}</h1>
      <p>Your User ID: {currentUser.id} | Role: {currentUser.role}</p>
      <p>Other Participant ID: {otherParticipantId}</p>
      <p>Call Status: {webRTC.isCallActive ? 'Active' : 'Inactive'}</p>
      <p>Local Stream: {webRTC.localStream ? 'Present' : 'Not Present'}</p>
      <p>Remote Stream: {webRTC.remoteStream ? 'Present' : 'Not Present'}</p>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h2>My Video</h2>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '320px', height: '240px', border: '1px solid #ccc', backgroundColor: '#000' }} />
        </div>
        <div>
          <h2>Remote Video</h2>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '320px', height: '240px', border: '1px solid #ccc', backgroundColor: '#000' }} />
        </div>
      </div>

      <CallControls
        onToggleMute={webRTC.toggleMute}
        onToggleCamera={webRTC.toggleCamera}
        onEndCall={handleEndCall}
        isMuted={webRTC.isMuted}
        isCameraOff={webRTC.isCameraOff}
        isCallActive={webRTC.isCallActive}
      />

      {/* Placeholder for ChatWindow */}
      <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '10px', minHeight: '100px' }}>
        <p>Chat Window Placeholder</p>
      </div>
    </div>
  );
};

export default ReadingSessionPage;
