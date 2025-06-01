import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'wouter';
import { useAuth } from '../hooks/use-auth';
import { useWebSocket } from '../hooks/use-websocket'; // Ensure this path is correct
import { useWebRTC, WebRTCMessage } from '../hooks/use-webrtc'; // Ensure WebRTCMessage is exported or define here
import { Reading, User } from '@shared/schema';

// Define ChatMessage interface
interface ChatMessage {
  id?: string; // Optional client-side ID for list keys, or server ID if persisted
  readingId: string;
  senderId: string;
  senderName: string; // To display who sent the message
  text: string;
  timestamp: number;
}
// Define SendMessageFunction type alias from useWebRTC hook if not already globally available
// Assuming WebRTCMessage is imported from use-webrtc or defined there.
// If ChatMessage needs to be part of WebRTCMessage union, that should be defined in use-webrtc.tsx
type SendMessageFunction = (message: WebRTCMessage | { type: 'chat_message', readingId: string, senderId: string, senderName: string, message: string, timestamp: number }) => void;


// Actual API call functions
const fetchReadingDetailsFromApi = async (readingId: string): Promise<Reading | null> => {
  try {
    console.log(`Fetching reading details for ${readingId}...`);
    const response = await fetch(`/api/readings/${readingId}`);
    if (!response.ok) {
      console.error(`Failed to fetch reading details for ${readingId}: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error("Error body:", errorBody);
      return null;
    }
    const data = await response.json();
    return data as Reading;
  } catch (error) {
    console.error(`Error in fetchReadingDetailsFromApi for ${readingId}:`, error);
    return null;
  }
};

const fetchUserDetailsFromApi = async (userId: string): Promise<User | null> => {
  try {
    console.log(`Fetching user details for ${userId}...`);
    // Note: Server currently has /api/readers/:id. If clients need fetching, a generic /api/users/:id might be better.
    // For now, this will work if the other participant is usually a reader, or if IDs are interchangeable.
    // Or, the Reading object from the first API call should ideally contain all necessary participant display info.
    const response = await fetch(`/api/readers/${userId}`); // Using /api/readers/:id as a placeholder for general user details
    if (!response.ok) {
      // Attempt /api/user if the above fails and it's potentially the current user (though less likely needed for 'otherParticipant')
      // This part is a bit speculative without knowing the exact user fetching strategy for non-reader clients.
      // For now, we rely on /api/readers/:id or direct info from readingDetails.
      console.error(`Failed to fetch user (reader) details for ${userId}: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error("Error body:", errorBody);
      return null;
    }
    const data = await response.json();
    return data as User;
  } catch (error) {
    console.error(`Error in fetchUserDetailsFromApi for ${userId}:`, error);
    return null;
  }
};

const ReadingSessionPage: React.FC = () => {
  const params = useParams<{ id?: string }>(); // Make id optional for initial check
  const readingId = params.id;
  const { currentUser } = useAuth();
  const { sendMessage, lastMessage, connectionStatus } = useWebSocket();
  const webRTC = useWebRTC();

  const [readingDetails, setReadingDetails] = useState<Reading | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<User | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatDisplayRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Reading Details & Determine Participants
  useEffect(() => {
    if (!readingId || !currentUser?.id) {
      setError("Reading ID or user information is missing.");
      setSessionStatus("Error: Missing reading or user information.");
      return;
    }

    const loadReadingAndParticipantDetails = async () => {
      setSessionStatus("Loading session details...");
      try {
        const details = await fetchReadingDetailsFromApi(readingId);
        if (!details) {
          setError(`Reading session ${readingId} not found.`);
          setSessionStatus(`Error: Reading ${readingId} not found.`);
          return;
        }
        setReadingDetails(details);

        const otherPId = currentUser.id.toString() === details.clientId.toString() ? details.readerId.toString() : details.clientId.toString();
        const otherPDetails = await fetchUserDetailsFromApi(otherPId);
        if (!otherPDetails) {
          setError(`Other participant (ID: ${otherPId}) not found.`);
          setSessionStatus(`Error: Other participant not found.`);
          return;
        }
        setOtherParticipant(otherPDetails);
        setSessionStatus("Session details loaded. Initializing call environment...");
        console.log(`Session details loaded. Current user: ${currentUser.id}, Other participant: ${otherPId}`);

      } catch (err) {
        console.error('Error loading reading/participant details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load session details.');
        setSessionStatus("Error loading session details.");
      }
    };

    loadReadingAndParticipantDetails();
  }, [readingId, currentUser]);

  // 2. Initialize useWebRTC and Local Media
  useEffect(() => {
    if (readingId && currentUser && otherParticipant && sendMessage && webRTC.initializePeerConnection) {
      setSessionStatus("Initializing WebRTC peer connection...");
      webRTC.initializePeerConnection(
        readingId,
        currentUser.id.toString(),
        otherParticipant.id.toString(),
        sendMessage as SendMessageFunction // Cast if WebRTCMessage is more specific
      ).then(() => {
        setSessionStatus("Peer connection initialized. Requesting media access...");
        return webRTC.startLocalMedia();
      }).then(() => {
        setSessionStatus("Local media ready. Waiting for call signal...");
      }).catch(err => {
        console.error("Error during WebRTC init or local media start:", err);
        setError(err.message || "Failed to initialize WebRTC or start media.");
        setSessionStatus("Error initializing call.");
      });
    }
  }, [currentUser, otherParticipant, readingId, sendMessage, webRTC.initializePeerConnection, webRTC.startLocalMedia, webRTC.createOfferAndSend, readingDetails]);


  // 3. Assign Streams to Video Elements
  useEffect(() => {
    if (localVideoRef.current && webRTC.localStream) {
      console.log("Assigning local stream to video element");
      localVideoRef.current.srcObject = webRTC.localStream;
    }
  }, [webRTC.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && webRTC.remoteStream) {
      console.log("Assigning remote stream to video element");
      remoteVideoRef.current.srcObject = webRTC.remoteStream;
    }
  }, [webRTC.remoteStream]);

  // 4. WebSocket Message Handling
  useEffect(() => {
    if (lastMessage && readingId && currentUser && otherParticipant && sendMessage) {
      const message = (typeof lastMessage === 'string' ? JSON.parse(lastMessage) : lastMessage) as WebRTCMessage;

      if (message.readingId !== readingId) return;
      if (message.recipientId !== currentUser.id.toString()) {
        // console.log("Received a WebRTC message not intended for me:", message);
        return;
      }


      console.log('Received WebSocket message for WebRTC:', message.type);

      switch (message.type) {
        // WebRTC Cases
        case 'webrtc_offer':
          setSessionStatus("Receiving call...");
          webRTC.handleReceivedOffer(message.payload, message.readingId, message.senderId, currentUser.id.toString(), sendMessage as SendMessageFunction);
          break;
        case 'webrtc_answer':
          setSessionStatus("Call connected!");
          webRTC.handleReceivedAnswer(message.payload);
          break;
        case 'webrtc_ice_candidate':
          webRTC.handleReceivedIceCandidate(message.payload);
          break;
        case 'webrtc_end_call':
          setSessionStatus("Call ended by other user.");
          webRTC.closeConnection();
          setError("Call ended.");
          break;
        case 'CALL_SETUP_READY':
          if (message.offerInitiatorId === currentUser.id.toString()) {
            setSessionStatus("Reader accepted. Initiating call...");
            console.log(`CALL_SETUP_READY: Current user ${currentUser.id} is offer initiator. Creating offer for ${otherParticipant?.id}.`);
            if (otherParticipant) {
              webRTC.createOfferAndSend(readingId, otherParticipant.id.toString(), currentUser.id.toString(), sendMessage as SendMessageFunction);
            }
          } else {
            setSessionStatus("Reader accepted. Waiting for call to be initiated by client...");
            console.log(`CALL_SETUP_READY: Current user ${currentUser?.id} is NOT offer initiator. Waiting for offer from ${message.offerInitiatorId}.`);
          }
          break;
        // Chat Message Case
        case 'chat_message':
          if (message.readingId === readingId) {
            const newChatMessage: ChatMessage = {
              readingId: message.readingId,
              senderId: message.senderId,
              senderName: message.senderName || 'User', // Fallback senderName
              text: message.message, // Server sends 'message' for text content
              timestamp: message.timestamp || Date.now(),
            };
            setChatMessages(prevMessages => [...prevMessages, newChatMessage]);
          }
          break;
        default:
          break;
      }
    }
  }, [lastMessage, readingId, currentUser, otherParticipant, webRTC, sendMessage]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatDisplayRef.current) {
      chatDisplayRef.current.scrollTop = chatDisplayRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // 5. Call Controls Handlers
  const handleSendChatMessage = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (chatInput.trim() === '' || !currentUser || !readingId || !sendMessage) return;

    const payload = {
      type: 'chat_message',
      readingId: readingId,
      senderId: currentUser.id.toString(),
      senderName: currentUser.username || currentUser.fullName || "Me",
      message: chatInput.trim(), // server expects 'message' field for chat text
      timestamp: Date.now()
    };
    sendMessage(payload);

    // Optimistic update: Add message to local state immediately
    // This provides a better UX. Ensure server doesn't echo back the sender's own message
    // or handle potential duplicates if it does (e.g. via message ID if available later)
    setChatMessages(prevMessages => [...prevMessages, {
      ...payload,
      text: payload.message,
      senderName: "Me"
    }]);
    setChatInput('');
  };

  const handleEndCall = useCallback(() => {
    if (readingId && currentUser && otherParticipant && sendMessage) {
      webRTC.closeConnection(sendMessage as SendMessageFunction, readingId, currentUser.id.toString(), otherParticipant.id.toString());
    } else {
      webRTC.closeConnection(); // Fallback for local cleanup
    }
    setSessionStatus("Call ended.");
  }, [webRTC, sendMessage, readingId, otherParticipant, currentUser]);


  // Initial UI States
  if (!readingId) return <p>No reading ID specified.</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!readingDetails || !currentUser || !otherParticipant) {
    return <div><p>{sessionStatus}</p><p>Loading session, please wait...</p></div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Reading Session: {readingId}</h1>
      <p>Status: <span style={{ fontWeight: 'bold' }}>{sessionStatus}</span></p>
      <p>WebSocket: {connectionStatus}</p>
      <p>User: {currentUser.username} ({currentUser.id}) | Other: {otherParticipant.username} ({otherParticipant.id})</p>

      <div style={{ display: 'flex', gap: '20px', margin: '20px 0' }}>
        <div style={{ border: '1px solid #ccc', padding: '10px' }}>
          <h2>My Video ({webRTC.isMuted ? "Muted" : "Unmuted"}, {webRTC.isCameraOff ? "Cam Off" : "Cam On"})</h2>
          {webRTC.localStream ? (
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '320px', height: '240px', backgroundColor: '#000' }} />
          ) : <p>No local camera/mic stream.</p>}
        </div>
        <div style={{ border: '1px solid #ccc', padding: '10px' }}>
          <h2>Remote Video</h2>
          {webRTC.remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '320px', height: '240px', backgroundColor: '#000' }} />
          ) : <p>{webRTC.isCallActive ? "Waiting for remote video..." : "Remote video not available."}</p>}
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

      {/* Placeholder for Chat (can be a separate component) */}
      <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px', maxWidth: '680px', margin: 'auto' }}>
        <h2>Chat</h2>
        <div ref={chatDisplayRef} style={{ height: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px', marginBottom: '10px', borderRadius: '4px', background: '#f9f9f9' }}>
          {chatMessages.map((msg, index) => (
            <div
              key={msg.id || index}
              style={{
                marginBottom: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.senderId === currentUser?.id.toString() ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{ fontSize: '0.75em', color: '#555', marginBottom: '2px' }}>
                {msg.senderId === currentUser?.id.toString() ? "Me" : msg.senderName}
                {' @ '}
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '15px',
                  backgroundColor: msg.senderId === currentUser?.id.toString() ? '#007bff' : '#e9ecef',
                  color: msg.senderId === currentUser?.id.toString() ? 'white' : 'black',
                  maxWidth: '75%',
                  wordWrap: 'break-word',
                  textAlign: 'left',
                  borderBottomLeftRadius: msg.senderId !== currentUser?.id.toString() ? '0px' : '15px',
                  borderBottomRightRadius: msg.senderId === currentUser?.id.toString() ? '0px' : '15px',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {chatMessages.length === 0 && <p style={{textAlign: 'center', color: '#888'}}>No messages yet. Start the conversation!</p>}
        </div>
        <form onSubmit={handleSendChatMessage} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            style={{ flexGrow: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ccc' }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                handleSendChatMessage();
                e.preventDefault(); // Prevents newline in some browsers
              }
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: '#007bff',
              color: 'white',
              cursor: 'pointer'
            }}
            disabled={!sendMessage || chatInput.trim() === ''}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReadingSessionPage;

[end of client/src/pages/ReadingSessionPage.tsx]
