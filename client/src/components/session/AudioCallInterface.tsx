import React, { useState, useEffect, useRef } from 'react';
import { FiMic, FiMicOff, FiPhoneOff, FiPhone, FiVolume2, FiVolumeX, FiAlertCircle } from 'react-icons/fi';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { useNavigate } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { SessionTimer } from './SessionTimer';
import { cn } from '@/lib/utils';
import apiRequest from '@/lib/apiRequest';

interface AudioCallInterfaceProps {
  sessionId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isReader: boolean;
  readerId: string;
  readerName: string;
  readerAvatar?: string;
  onEndSession: () => void;
  onError?: (error: string) => void;
}

export const AudioCallInterface: React.FC<AudioCallInterfaceProps> = ({
  sessionId,
  userId,
  userName,
  userAvatar,
  isReader,
  readerId,
  readerName,
  readerAvatar,
  onEndSession,
  onError
}) => {
  const [zegoEngine, setZegoEngine] = useState<ZegoExpressEngine | null>(null);
  const [roomId, setRoomId] = useState<string>(`audio_${sessionId}`);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioLevelTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  // Initialize the Zego engine and join room
  useEffect(() => {
    let engine: ZegoExpressEngine | null = null;
    let token: string = '';
    let appID: number = 0;
    
    const initializeCall = async () => {
      try {
        setIsConnecting(true);
        setError(null);
        
        // Fetch token from backend
        const response = await apiRequest(`/api/sessions/token`, {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            roomId,
            userId,
            userName,
            type: 'audio'
          })
        });
        
        if (!response || !response.token) {
          throw new Error('Failed to obtain token');
        }
        
        token = response.token;
        appID = response.appID;
        
        // Initialize Zego engine
        engine = new ZegoExpressEngine(appID, response.serverSecret);
        setZegoEngine(engine);
        
        // Register event listeners
        engine.on('roomStateUpdate', (roomID, state, errorCode, extendedData) => {
          console.log(`Room state update: ${roomID}, state: ${state}, error: ${errorCode}`);
          if (state === 'CONNECTED') {
            setIsConnected(true);
            setIsConnecting(false);
            setConnectionStatus('connected');
          } else if (state === 'DISCONNECTED') {
            setIsConnected(false);
            setConnectionStatus('disconnected');
          } else if (state === 'CONNECTING') {
            setConnectionStatus('connecting');
          }
          
          if (errorCode !== 0) {
            setError(`Room connection error: ${errorCode}`);
            if (onError) onError(`Connection error: ${errorCode}`);
          }
        });
        
        engine.on('roomStreamUpdate', async (roomID, updateType, streamList, extendedData) => {
          console.log(`Room stream update: ${roomID}, type: ${updateType}, streams: ${streamList.length}`);
          
          if (updateType === 'ADD') {
            // Play the remote audio stream
            for (const stream of streamList) {
              if (stream.user.userID !== userId) {
                await engine.startPlayingStream(stream.streamID);
                console.log(`Started playing stream: ${stream.streamID}`);
              }
            }
          }
        });
        
        engine.on('roomUserUpdate', (roomID, updateType, userList) => {
          console.log(`Room user update: ${roomID}, type: ${updateType}, users: ${userList.length}`);
        });
        
        // Join the room
        await engine.loginRoom(roomId, token, { userID: userId, userName: userName });
        
        // Publish local audio stream
        await engine.startPublishingStream(`${userId}_audio`);
        
        // Start monitoring audio levels
        startAudioLevelMonitoring(engine);
        
        console.log('Successfully joined audio room:', roomId);
      } catch (err) {
        console.error('Error initializing audio call:', err);
        setError(`Failed to initialize call: ${err.message}`);
        setIsConnecting(false);
        setIsConnected(false);
        if (onError) onError(err.message);
      }
    };
    
    initializeCall();
    
    // Cleanup on component unmount
    return () => {
      if (audioLevelTimerRef.current) {
        clearInterval(audioLevelTimerRef.current);
      }
      
      if (engine) {
        engine.stopPublishingStream();
        engine.logoutRoom(roomId);
        engine.destroy();
      }
    };
  }, [sessionId, userId, userName, roomId]);
  
  // Start monitoring audio levels
  const startAudioLevelMonitoring = (engine: ZegoExpressEngine) => {
    if (audioLevelTimerRef.current) {
      clearInterval(audioLevelTimerRef.current);
    }
    
    audioLevelTimerRef.current = window.setInterval(() => {
      if (engine) {
        const localLevels = engine.getCapturedSoundLevelList();
        const remoteLevels = engine.getRemoteSoundLevelList();
        
        let maxLevel = 0;
        
        // Get local audio level
        for (const level of Object.values(localLevels)) {
          if (level > maxLevel) maxLevel = level;
        }
        
        // Get remote audio level
        for (const level of Object.values(remoteLevels)) {
          if (level > maxLevel) maxLevel = level;
        }
        
        setAudioLevel(maxLevel * 100); // Convert to percentage
      }
    }, 200);
  };
  
  // Toggle mute
  const toggleMute = () => {
    if (zegoEngine) {
      zegoEngine.mutePublishStreamAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };
  
  // Toggle speaker
  const toggleSpeaker = () => {
    if (zegoEngine) {
      zegoEngine.setPlayVolume(!isSpeakerOn ? 100 : 0);
      setIsSpeakerOn(!isSpeakerOn);
    }
  };
  
  // Handle ending the call
  const handleEndCall = async () => {
    try {
      if (zegoEngine) {
        zegoEngine.stopPublishingStream();
        await zegoEngine.logoutRoom(roomId);
      }
    } catch (err) {
      console.error('Error ending call:', err);
    }
    
    onEndSession();
  };
  
  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader className="bg-primary/5 flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex flex-col space-y-1">
          <CardTitle className="text-lg font-medium">
            Audio Call with {isReader ? userId : readerName}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {isConnected ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500">
                Connected
              </Badge>
            ) : isConnecting ? (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                Connecting...
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-500">
                Disconnected
              </Badge>
            )}
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <SessionTimer
            sessionId={sessionId}
            userId={userId}
            isReader={isReader}
            onTimeEnd={handleEndCall}
            showNotifications={true}
            className="text-sm"
            iconSize={14}
          />
        </div>
      </CardHeader>
      <CardContent className="p-6 flex flex-col items-center justify-center space-y-8">
        {error && (
          <div className="bg-red-500/10 text-red-500 p-3 text-sm flex items-center space-x-2 w-full rounded-md">
            <FiAlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="relative">
          <Avatar className="h-32 w-32 border-4 border-primary/20">
            <AvatarImage 
              src={isReader ? userAvatar : readerAvatar} 
              alt={isReader ? userName : readerName} 
            />
            <AvatarFallback className="text-4xl">
              {(isReader ? userName : readerName).substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          {/* Pulsing ring animation when connected */}
          {isConnected && (
            <div className="absolute inset-0 rounded-full">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-20"></span>
            </div>
          )}
        </div>
        
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-1">
            {isReader ? userName : readerName}
          </h3>
          <p className="text-muted-foreground text-sm">
            {connectionStatus === 'connected' ? 'Call in progress' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 'Call ended'}
          </p>
        </div>
        
        {/* Audio level indicator */}
        <div className="w-full">
          <Progress value={audioLevel} className="h-2" />
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="p-4 flex justify-center space-x-4">
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "rounded-full h-12 w-12",
            isMuted ? "bg-red-500/10 text-red-500" : "bg-primary/10"
          )}
          onClick={toggleMute}
          disabled={!isConnected}
        >
          {isMuted ? <FiMicOff className="h-5 w-5" /> : <FiMic className="h-5 w-5" />}
        </Button>
        
        <Button 
          variant="destructive" 
          size="icon"
          className="rounded-full h-14 w-14"
          onClick={handleEndCall}
        >
          <FiPhoneOff className="h-6 w-6" />
        </Button>
        
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "rounded-full h-12 w-12",
            !isSpeakerOn ? "bg-red-500/10 text-red-500" : "bg-primary/10"
          )}
          onClick={toggleSpeaker}
          disabled={!isConnected}
        >
          {isSpeakerOn ? <FiVolume2 className="h-5 w-5" /> : <FiVolumeX className="h-5 w-5" />}
        </Button>
      </CardFooter>
    </Card>
  );
};