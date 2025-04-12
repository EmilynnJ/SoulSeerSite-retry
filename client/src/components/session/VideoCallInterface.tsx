import React, { useEffect, useState, useRef } from 'react';
import { Loader2, Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface VideoCallInterfaceProps {
  sessionId: string;
  roomId: string;
  sessionType: 'video' | 'audio' | 'chat';
  onEndCall?: () => void;
}

export const VideoCallInterface: React.FC<VideoCallInterfaceProps> = ({
  sessionId,
  roomId,
  sessionType,
  onEndCall
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(sessionType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // References to HTML elements
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  
  // Reference to hold ZegoCloud instance
  const zegoRef = useRef<any>(null);

  // Initialize ZegoCloud as soon as the component mounts
  useEffect(() => {
    const initZego = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check for browser compatibility
        if (typeof navigator.mediaDevices === 'undefined' || 
            typeof navigator.mediaDevices.getUserMedia === 'undefined') {
          throw new Error('Your browser does not support WebRTC. Please use a modern browser like Chrome or Firefox.');
        }

        // Check if camera and microphone permissions are granted
        try {
          await navigator.mediaDevices.getUserMedia({ 
            video: sessionType === 'video', 
            audio: true 
          });
          console.log('Media permissions granted');
        } catch (mediaError: any) {
          console.error('Media permission error:', mediaError);
          if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
            throw new Error('Camera or microphone permission denied. Please allow access in your browser settings.');
          } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
            throw new Error('No camera or microphone found. Please connect a device and try again.');
          } else {
            throw new Error(`Media device error: ${mediaError.message}`);
          }
        }

        // Load ZegoCloud SDK dynamically
        const { ZegoExpressEngine } = await import('zego-express-engine-webrtc')
          .catch(e => {
            console.error('Failed to load ZegoCloud SDK:', e);
            throw new Error('Failed to load video call service. Please check your internet connection.');
          });
        
        // Create the Zego instance if it doesn't exist
        if (!zegoRef.current) {
          console.log('Requesting token for session:', sessionId, 'room:', roomId);
          
          // Get the token from the server
          const tokenResponse = await fetch('/api/sessions/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sessionId, roomId })
          });
          
          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('Token response error:', errorData);
            throw new Error(errorData.error || errorData.details || 'Failed to get authentication token');
          }
          
          const tokenData = await tokenResponse.json();
          console.log('Token received successfully');
          
          if (!tokenData.success || !tokenData.token) {
            console.error('Invalid token response:', tokenData);
            throw new Error('Invalid authentication response from server');
          }
          
          const { token, appID, userId, username } = tokenData;
          
          // Initialize ZegoCloud
          console.log(`Initializing ZegoCloud with appID: ${appID}`);
          zegoRef.current = new ZegoExpressEngine(appID, 'production');
          
          // Log into the room with the token
          console.log(`Logging into room: ${roomId}`);
          await zegoRef.current.loginRoom(roomId, token, { userID: userId, userName: username })
            .catch(e => {
              console.error('Room login error:', e);
              throw new Error(`Failed to connect to video room: ${e.message}`);
            });
          
          // Bind events with better error handling
          zegoRef.current.on('roomStateUpdate', (roomID: string, state: string, errorCode: number, extendedData: string) => {
            console.log(`Room state updated: ${roomID}, state: ${state}, errorCode: ${errorCode}`);
            setIsConnected(state === 'CONNECTED');
            
            if (errorCode !== 0) {
              console.error(`Room error: ${errorCode}, data: ${extendedData}`);
              // Don't set error state here, just log it to avoid interruption
            }
          });
          
          zegoRef.current.on('roomUserUpdate', (roomID: string, updateType: string, userList: any[]) => {
            console.log(`User update in room ${roomID}: ${updateType}`, userList);
            
            // Show toast or UI indicator when another user joins/leaves
            if (userList.length > 0) {
              const userAction = updateType === 'ADD' ? 'joined' : 'left';
              console.log(`User ${userList[0].userName} has ${userAction} the session`);
            }
          });
          
          zegoRef.current.on('roomStreamUpdate', async (roomID: string, updateType: string, streamList: any[]) => {
            console.log(`Stream update in room ${roomID}: ${updateType}`, streamList);
            
            if (updateType === 'ADD' && streamList.length > 0) {
              // Play remote streams when they arrive
              for (const stream of streamList) {
                if (remoteVideoRef.current) {
                  console.log(`Playing remote stream: ${stream.streamID}`);
                  try {
                    await zegoRef.current.startPlayingStream(
                      stream.streamID,
                      {
                        container: remoteVideoRef.current
                      }
                    );
                  } catch (playError) {
                    console.error(`Error playing stream ${stream.streamID}:`, playError);
                    // Don't throw here, just log the error to avoid interrupting the session
                  }
                }
              }
            }
          });
          
          // Start local preview for video calls
          if (sessionType === 'video' && localVideoRef.current) {
            console.log('Starting local video preview');
            await zegoRef.current.startPreview({
              container: localVideoRef.current
            }).catch(e => {
              console.error('Preview error:', e);
              // Don't throw here to allow audio-only fallback
            });
          }
          
          // Publish stream
          const streamID = `${roomId}_${userId}`;
          console.log(`Publishing stream: ${streamID}`);
          await zegoRef.current.startPublishingStream(streamID, {
            camera: {
              video: sessionType === 'video',
              audio: true
            }
          }).catch(e => {
            console.error('Publishing error:', e);
            throw new Error(`Failed to start streaming: ${e.message}`);
          });
          
          console.log('ZegoCloud initialized successfully');
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to initialize ZegoCloud:', err);
        
        // Detailed error information
        let errorMessage = err.message || 'Failed to initialize the video call';
        
        // Add more specific error messaging
        if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
          errorMessage = 'Camera or microphone permission denied. Please allow access in your browser settings.';
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
        } else if (errorMessage.includes('token') || errorMessage.includes('authentication')) {
          errorMessage = 'Authentication failed. Please try refreshing the page or contact support.';
        } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('DevicesNotFoundError')) {
          errorMessage = 'No camera or microphone found. Please connect a device and try again.';
        }
        
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initZego();

    // Cleanup function
    return () => {
      if (zegoRef.current) {
        zegoRef.current.stopPublishingStream();
        zegoRef.current.stopPreview();
        zegoRef.current.logoutRoom(roomId);
        zegoRef.current = null;
      }
    };
  }, [roomId, sessionId, sessionType]);

  // Handle toggling video
  const toggleVideo = async () => {
    if (!zegoRef.current) return;
    
    try {
      if (isVideoEnabled) {
        await zegoRef.current.mutePublishStreamVideo(true);
      } else {
        await zegoRef.current.mutePublishStreamVideo(false);
      }
      setIsVideoEnabled(!isVideoEnabled);
    } catch (err) {
      console.error('Failed to toggle video:', err);
    }
  };

  // Handle toggling audio
  const toggleAudio = async () => {
    if (!zegoRef.current) return;
    
    try {
      if (isAudioEnabled) {
        await zegoRef.current.mutePublishStreamAudio(true);
      } else {
        await zegoRef.current.mutePublishStreamAudio(false);
      }
      setIsAudioEnabled(!isAudioEnabled);
    } catch (err) {
      console.error('Failed to toggle audio:', err);
    }
  };

  // Handle ending the call
  const handleEndCall = () => {
    if (zegoRef.current) {
      zegoRef.current.stopPublishingStream();
      zegoRef.current.stopPreview();
      zegoRef.current.logoutRoom(roomId);
      zegoRef.current = null;
    }
    
    if (onEndCall) {
      onEndCall();
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Connecting to session...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-destructive">
        <CardContent className="p-6">
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={onEndCall} variant="destructive" className="w-full">
            <PhoneOff className="h-4 w-4 mr-2" /> End Session
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6 relative">
        <div className="grid grid-cols-1 gap-4">
          {/* Remote Video (Full Size) */}
          <div 
            ref={remoteVideoRef}
            className="bg-muted w-full h-[300px] rounded-md overflow-hidden relative"
          />
          
          {/* Local Video (Small Overlay) */}
          {sessionType === 'video' && (
            <div 
              ref={localVideoRef}
              className="absolute bottom-8 right-8 w-32 h-24 bg-black rounded-md overflow-hidden border-2 border-background shadow-lg"
            />
          )}
          
          {/* Connection Status */}
          {!isConnected && (
            <div className="absolute top-8 left-0 right-0 flex justify-center">
              <div className="bg-background/80 text-foreground px-3 py-1 rounded-full text-sm flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Waiting for the other participant...
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="border-t p-4">
        <div className="flex justify-center gap-3 w-full">
          {sessionType === 'video' && (
            <Button
              onClick={toggleVideo}
              variant={isVideoEnabled ? "default" : "outline"}
              size="icon"
              className="h-10 w-10 rounded-full"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          )}
          
          <Button
            onClick={toggleAudio}
            variant={isAudioEnabled ? "default" : "outline"}
            size="icon"
            className="h-10 w-10 rounded-full"
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          
          <Button
            onClick={handleEndCall}
            variant="destructive"
            size="icon"
            className="h-10 w-10 rounded-full"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default VideoCallInterface;