import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, Phone, PhoneOff, Volume, Volume2, VolumeX } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

interface AudioCallInterfaceProps {
  sessionId: string;
  roomId: string;
  readerName: string;
  readerAvatar?: string;
  onEndCall?: () => void;
}

export const AudioCallInterface: React.FC<AudioCallInterfaceProps> = ({
  sessionId,
  roomId,
  readerName,
  readerAvatar,
  onEndCall
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  
  // Reference to hold ZegoCloud instance
  const zegoRef = useRef<any>(null);
  // AudioContext for audio visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  // Call timer
  useEffect(() => {
    let timer: number | null = null;
    
    if (isConnected) {
      timer = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isConnected]);
  
  // Format call duration as mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Initialize ZegoCloud as soon as the component mounts
  useEffect(() => {
    const initZego = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check for browser compatibility and audio permissions
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Initialize audio analyzer for visualizing audio
          const audioContext = new AudioContext();
          const analyser = audioContext.createAnalyser();
          const microphone = audioContext.createMediaStreamSource(stream);
          microphone.connect(analyser);
          analyser.fftSize = 256;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;
          dataArrayRef.current = dataArray;
          
          // Start audio visualization
          animateAudio();
          
          // Don't stop the stream as we need it for the call
        } catch (mediaError: any) {
          console.error('Media permission error:', mediaError);
          if (mediaError.name === 'NotAllowedError') {
            throw new Error('Microphone permission denied. Please allow access in your browser settings.');
          } else if (mediaError.name === 'NotFoundError') {
            throw new Error('No microphone found. Please connect a device and try again.');
          } else {
            throw new Error(`Media device error: ${mediaError.message}`);
          }
        }
        
        // Load ZegoCloud SDK dynamically
        const { ZegoExpressEngine } = await import('zego-express-engine-webrtc')
          .catch(e => {
            console.error('Failed to load ZegoCloud SDK:', e);
            throw new Error('Failed to load audio call service. Please check your internet connection.');
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
              throw new Error(`Failed to connect to audio room: ${e.message}`);
            });
          
          // Bind events with better error handling
          zegoRef.current.on('roomStateUpdate', (roomID: string, state: string, errorCode: number) => {
            console.log(`Room state updated: ${roomID}, state: ${state}, errorCode: ${errorCode}`);
            setIsConnected(state === 'CONNECTED');
            
            if (state === 'CONNECTED') {
              setIsLoading(false);
            }
            
            if (errorCode !== 0) {
              console.error(`Room error: ${errorCode}`);
            }
          });
          
          zegoRef.current.on('roomUserUpdate', (roomID: string, updateType: string, userList: any[]) => {
            console.log(`User update in room ${roomID}: ${updateType}`, userList);
            
            // Show notification when reader joins/leaves
            if (userList.length > 0) {
              const userAction = updateType === 'ADD' ? 'joined' : 'left';
              console.log(`User ${userList[0].userName} has ${userAction} the session`);
            }
          });
          
          // Publish audio-only stream
          const streamID = `${roomId}_${userId}`;
          console.log(`Publishing audio stream: ${streamID}`);
          await zegoRef.current.startPublishingStream(streamID, {
            camera: {
              video: false,
              audio: true
            }
          }).catch(e => {
            console.error('Publishing error:', e);
            throw new Error(`Failed to start audio streaming: ${e.message}`);
          });
          
          console.log('ZegoCloud initialized successfully');
          setIsLoading(false);
          setIsConnected(true);
        }
      } catch (err: any) {
        console.error('Failed to initialize audio call:', err);
        
        // Detailed error information
        let errorMessage = err.message || 'Failed to initialize the audio call';
        
        setError(errorMessage);
        setIsLoading(false);
      }
    };
    
    // Function to visualize audio levels
    const animateAudio = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      
      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume level from frequency data
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Scale to 0-100 for the progress bar
      const scaledLevel = Math.min(100, average * 2);
      setAudioLevel(scaledLevel);
      
      // Continue animation loop
      requestAnimationFrame(animateAudio);
    };
    
    // Initialize audio call
    initZego();
    
    // Cleanup function
    return () => {
      if (zegoRef.current) {
        zegoRef.current.stopPublishingStream();
        zegoRef.current.logoutRoom(roomId);
        zegoRef.current = null;
      }
      
      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [sessionId, roomId]);
  
  // Toggle mute
  const toggleMute = () => {
    if (!zegoRef.current) return;
    
    try {
      if (isMuted) {
        zegoRef.current.mutePublishStreamAudio(false);
      } else {
        zegoRef.current.mutePublishStreamAudio(true);
      }
      setIsMuted(!isMuted);
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  };
  
  // Toggle speaker
  const toggleSpeaker = () => {
    try {
      // In a real implementation, we would switch audio output devices
      // For now, we just toggle the state
      setIsSpeakerOn(!isSpeakerOn);
    } catch (err) {
      console.error('Failed to toggle speaker:', err);
    }
  };
  
  // Handle ending the call
  const handleEndCall = () => {
    if (zegoRef.current) {
      zegoRef.current.stopPublishingStream();
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
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Connecting to call...</p>
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
            <PhoneOff className="h-4 w-4 mr-2" /> End Call
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardContent className="p-6 flex flex-col items-center">
        {/* Call Status */}
        <div className="text-sm text-muted-foreground mb-2">
          {isConnected ? 'Call in progress' : 'Connecting...'}
        </div>
        
        {/* Timer */}
        <div className="text-xl font-bold mb-6">
          {formatDuration(callDuration)}
        </div>
        
        {/* Avatar */}
        <div className="relative mb-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={readerAvatar} alt={readerName} />
            <AvatarFallback className="text-lg">
              {readerName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          {/* Pulsating ring for active call */}
          <span className={`absolute inset-0 rounded-full ${isConnected ? 'animate-pulse-ring' : ''}`} />
        </div>
        
        {/* Name */}
        <h3 className="text-lg font-medium mb-2">{readerName}</h3>
        <p className="text-sm text-muted-foreground mb-6">Spiritual Advisor</p>
        
        {/* Audio Visualization */}
        <div className="w-full max-w-xs mb-6">
          <Progress value={isMuted ? 0 : audioLevel} className="h-2" />
          <p className="text-xs text-center mt-1 text-muted-foreground">
            {isMuted ? 'Microphone muted' : 'Audio level'}
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="border-t p-4 flex justify-center">
        <div className="flex gap-4">
          <Button
            onClick={toggleMute}
            variant={isMuted ? "outline" : "secondary"}
            size="icon"
            className="h-12 w-12 rounded-full"
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            onClick={handleEndCall}
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
          >
            <Phone className="h-5 w-5" />
          </Button>
          
          <Button
            onClick={toggleSpeaker}
            variant={isSpeakerOn ? "secondary" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
          >
            {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default AudioCallInterface;