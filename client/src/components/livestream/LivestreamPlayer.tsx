import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  Heart, 
  MessageSquare, 
  Send, 
  Users, 
  Gift, 
  DollarSign, 
  ThumbsUp,
  Sparkles,
  Clock,
  Loader2
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
  isGift?: boolean;
  giftValue?: number;
  giftType?: string;
}

interface Gift {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  value: number;
  animation?: string;
}

interface LivestreamPlayerProps {
  livestreamId: string;
  title: string;
  readerName: string;
  readerAvatar?: string;
  readerDescription?: string;
  viewerCount?: number;
  isAuthenticated: boolean;
  userId?: string;
  username?: string;
  userAvatar?: string;
  onLoginPrompt?: () => void;
}

// Available gifts for viewers to send
const AVAILABLE_GIFTS: Gift[] = [
  {
    id: 'gift-1',
    name: 'Crystal Ball',
    description: 'A mystic crystal ball to aid the psychic',
    icon: <Sparkles className="h-4 w-4" />,
    value: 100, // $1.00
    animation: 'animate-sparkle'
  },
  {
    id: 'gift-2',
    name: 'Energy Boost',
    description: 'Send positive energy to the reader',
    icon: <ThumbsUp className="h-4 w-4" />,
    value: 200, // $2.00
    animation: 'animate-pulse'
  },
  {
    id: 'gift-3',
    name: 'Celestial Star',
    description: 'A rare celestial star for cosmic guidance',
    icon: <Sparkles className="h-4 w-4" />,
    value: 500, // $5.00
    animation: 'animate-glow'
  },
  {
    id: 'gift-4',
    name: 'Spiritual Rose',
    description: 'A symbol of love and gratitude',
    icon: <Heart className="h-4 w-4" />,
    value: 1000, // $10.00
    animation: 'animate-float'
  }
];

export const LivestreamPlayer: React.FC<LivestreamPlayerProps> = ({
  livestreamId,
  title,
  readerName,
  readerAvatar,
  readerDescription,
  viewerCount = 0,
  isAuthenticated,
  userId,
  username,
  userAvatar,
  onLoginPrompt
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [currentViewers, setCurrentViewers] = useState(viewerCount);
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  
  // Function to generate a unique ID
  const generateId = () => Math.random().toString(36).substring(2, 15);
  
  // Connect to WebSocket and video stream when component mounts
  useEffect(() => {
    // Connect to livestream
    const connectToLivestream = async () => {
      try {
        setIsLoading(true);
        
        // Get the livestream token from the server
        const tokenResponse = await fetch('/api/livekit/livestream-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            livestreamId,
            isPublisher: false 
          })
        });
        
        if (!tokenResponse.ok) {
          const error = await tokenResponse.json();
          throw new Error(error.error || 'Failed to connect to livestream');
        }
        
        const tokenData = await tokenResponse.json();
        
        // Initialize video player with livestream
        if (videoRef.current && tokenData.playbackUrl) {
          videoRef.current.src = tokenData.playbackUrl;
          videoRef.current.onloadeddata = () => {
            setIsLoading(false);
            setIsConnected(true);
          };
          
          videoRef.current.onerror = () => {
            setError('Failed to load livestream video');
            setIsLoading(false);
          };
          
          // Start playing
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
            
            // Many browsers require user interaction before playing video with sound
            if (err.name === 'NotAllowedError') {
              // Set a muted state and try again
              videoRef.current!.muted = true;
              videoRef.current!.play().catch(e => {
                setError('Video playback error. Please try refreshing the page.');
                setIsLoading(false);
              });
            } else {
              setError('Video playback error. Please try refreshing the page.');
              setIsLoading(false);
            }
          });
        }
        
        // Connect to chat WebSocket if authenticated
        if (isAuthenticated && userId && username) {
          connectToChat();
        } else {
          // Still set as connected even without chat
          setIsLoading(false);
          setIsConnected(true);
        }
        
        // Simulate changing viewer count to demonstrate real-time updates
        const viewerInterval = setInterval(() => {
          const randomChange = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
          setCurrentViewers(prev => Math.max(1, prev + randomChange));
        }, 10000);
        
        return () => {
          clearInterval(viewerInterval);
        };
      } catch (err: any) {
        console.error('Failed to connect to livestream:', err);
        setError(err.message || 'Failed to connect to livestream');
        setIsLoading(false);
      }
    };
    
    // Connect to chat via WebSocket
    const connectToChat = () => {
      try {
        // Close existing connection if any
        if (socketRef.current) {
          socketRef.current.close();
        }
        
        // Connect to WebSocket
        const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/livestream/${livestreamId}`);
        socketRef.current = socket;
        
        socket.onopen = () => {
          console.log('WebSocket connection established for livestream chat');
          
          // Send join message
          socket.send(JSON.stringify({
            type: 'join',
            livestreamId,
            userId,
            username
          }));
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'message') {
              const newMessage: ChatMessage = {
                id: data.id || generateId(),
                userId: data.userId,
                username: data.username,
                userAvatar: data.userAvatar,
                content: data.content,
                timestamp: new Date(data.timestamp || Date.now()),
                isGift: data.isGift,
                giftValue: data.giftValue,
                giftType: data.giftType
              };
              
              setMessages(prevMessages => [...prevMessages, newMessage]);
              
              // If it's a gift, show animation
              if (data.isGift && data.giftType) {
                const gift = AVAILABLE_GIFTS.find(g => g.id === data.giftType);
                if (gift && gift.animation) {
                  showGiftAnimation(gift.animation);
                }
              }
            } else if (data.type === 'history') {
              if (Array.isArray(data.messages)) {
                const formattedMessages = data.messages.map((msg: any) => ({
                  id: msg.id || generateId(),
                  userId: msg.userId,
                  username: msg.username,
                  userAvatar: msg.userAvatar,
                  content: msg.content,
                  timestamp: new Date(msg.timestamp || Date.now()),
                  isGift: msg.isGift,
                  giftValue: msg.giftValue,
                  giftType: msg.giftType
                }));
                
                setMessages(formattedMessages);
              }
            } else if (data.type === 'viewers') {
              setCurrentViewers(data.count);
            } else if (data.type === 'system') {
              // Handle system messages (user joined/left, etc.)
              toast({
                title: 'Livestream Update',
                description: data.content,
                variant: 'default'
              });
            }
          } catch (err) {
            console.error('Error processing WebSocket message:', err);
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          toast({
            title: 'Chat Connection Error',
            description: 'Failed to connect to chat. Messages may not be displayed.',
            variant: 'destructive'
          });
        };
        
        socket.onclose = () => {
          console.log('WebSocket connection closed');
          // Attempt to reconnect after a delay
          setTimeout(connectToChat, 3000);
        };
        
        // Cleanup function
        return () => {
          socket.close();
        };
      } catch (err) {
        console.error('Failed to establish WebSocket connection:', err);
      }
    };
    
    connectToLivestream();
    
    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [livestreamId, isAuthenticated, userId, username, toast]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Send a chat message
  const sendMessage = async () => {
    if (!messageInput.trim() || !isAuthenticated || !socketRef.current) {
      if (!isAuthenticated && onLoginPrompt) {
        onLoginPrompt();
      }
      return;
    }
    
    setIsSendingMessage(true);
    
    try {
      const messageData = {
        type: 'message',
        livestreamId,
        userId,
        username,
        userAvatar,
        content: messageInput.trim(),
        timestamp: new Date().toISOString()
      };
      
      socketRef.current.send(JSON.stringify(messageData));
      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
      toast({
        title: 'Failed to Send Message',
        description: 'Your message could not be sent. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSendingMessage(false);
    }
  };
  
  // Send a gift
  const sendGift = async (gift: Gift) => {
    if (!isAuthenticated) {
      if (onLoginPrompt) {
        onLoginPrompt();
      }
      return;
    }
    
    setIsSendingGift(true);
    setSelectedGift(gift);
    
    try {
      // First, create a payment for the gift
      const paymentResponse = await fetch('/api/livestreams/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          livestreamId,
          giftId: gift.id,
          amount: gift.value
        })
      });
      
      if (!paymentResponse.ok) {
        const error = await paymentResponse.json();
        throw new Error(error.error || 'Failed to send gift');
      }
      
      // Send gift message via WebSocket
      if (socketRef.current) {
        const giftMessage = {
          type: 'message',
          livestreamId,
          userId,
          username,
          userAvatar,
          content: `Sent a ${gift.name}!`,
          isGift: true,
          giftValue: gift.value,
          giftType: gift.id,
          timestamp: new Date().toISOString()
        };
        
        socketRef.current.send(JSON.stringify(giftMessage));
      }
      
      // Show gift animation
      if (gift.animation) {
        showGiftAnimation(gift.animation);
      }
      
      toast({
        title: 'Gift Sent!',
        description: `You sent a ${gift.name} worth $${(gift.value / 100).toFixed(2)}!`,
        variant: 'default'
      });
    } catch (err: any) {
      console.error('Error sending gift:', err);
      toast({
        title: 'Failed to Send Gift',
        description: err.message || 'Your gift could not be sent. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSendingGift(false);
      setSelectedGift(null);
    }
  };
  
  // Show gift animation
  const showGiftAnimation = (animation: string) => {
    setActiveGiftAnimation(animation);
    setTimeout(() => {
      setActiveGiftAnimation(null);
    }, 3000);
  };
  
  // Handle sending message with Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Render chat messages
  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
          <p>No messages yet.</p>
          <p className="text-sm mt-1">
            Be the first to say something!
          </p>
        </div>
      );
    }
    
    return messages.map((message) => (
      <div key={message.id} className="mb-3 group">
        <div className="flex items-start">
          <Avatar className="h-6 w-6 mr-2 flex-shrink-0">
            <AvatarImage src={message.userAvatar} />
            <AvatarFallback>
              {message.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline">
              <span className="font-medium text-sm truncate">
                {message.username}
              </span>
              <span className="ml-2 text-xs text-muted-foreground hidden group-hover:inline">
                {formatDistanceToNow(message.timestamp, { addSuffix: true })}
              </span>
            </div>
            
            <div className={`text-sm mt-1 ${message.isGift ? 'text-primary font-medium' : ''}`}>
              {message.isGift && (
                <Badge variant="outline" className="mr-1 bg-primary/10">
                  <Gift className="h-3 w-3 mr-1" /> 
                  ${(message.giftValue! / 100).toFixed(2)}
                </Badge>
              )}
              {message.content}
            </div>
          </div>
        </div>
      </div>
    ));
  };
  
  // Render gift options
  const renderGifts = () => {
    return (
      <div className="grid grid-cols-2 gap-3">
        {AVAILABLE_GIFTS.map((gift) => (
          <Card 
            key={gift.id} 
            className={`cursor-pointer hover:border-primary transition-colors ${selectedGift?.id === gift.id ? 'border-primary bg-primary/5' : ''}`}
            onClick={() => sendGift(gift)}
          >
            <CardContent className="p-3 flex flex-col items-center text-center">
              <div className="bg-primary/10 p-2 rounded-full mb-2 flex items-center justify-center">
                {gift.icon}
              </div>
              <h4 className="text-sm font-medium">{gift.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{gift.description}</p>
              <Badge variant="outline" className="mt-2">
                <DollarSign className="h-3 w-3 mr-1" />
                {(gift.value / 100).toFixed(2)}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Connecting to livestream...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="w-full border-destructive">
        <CardContent className="p-6">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Video Player */}
      <Card className="md:col-span-2 overflow-hidden">
        <div className="relative w-full">
          {/* Video Player */}
          <video 
            ref={videoRef}
            className="w-full aspect-video bg-black"
            controls
          />
          
          {/* Gift Animation Overlay */}
          {activeGiftAnimation && (
            <div className={`absolute inset-0 pointer-events-none flex items-center justify-center ${activeGiftAnimation}`}>
              <div className="p-4 bg-primary/20 backdrop-blur-sm rounded-full">
                <Gift className="h-12 w-12 text-primary animate-bounce" />
              </div>
            </div>
          )}
          
          {/* Live Badge */}
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <Badge variant="destructive" className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
              LIVE
            </Badge>
            
            <Badge variant="outline" className="bg-background/80 flex items-center gap-1">
              <Users className="h-3 w-3 mr-1" />
              {currentViewers}
            </Badge>
          </div>
        </div>
        
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center justify-between">
            {title}
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3 mr-1" />
              LIVE NOW
            </Badge>
          </CardTitle>
          <CardDescription className="flex items-center">
            <Avatar className="h-6 w-6 mr-2">
              <AvatarImage src={readerAvatar} alt={readerName} />
              <AvatarFallback>{readerName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {readerName}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {readerDescription || `Join ${readerName} for a live spiritual reading session. Send messages and gifts to interact!`}
          </p>
        </CardContent>
      </Card>
      
      {/* Chat and Gifts */}
      <Card>
        <Tabs defaultValue="chat" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="gifts" className="flex items-center gap-1">
              <Gift className="h-4 w-4" />
              Gifts
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat" className="m-0">
            <ScrollArea className="h-[300px] p-4">
              {renderMessages()}
              <div ref={messagesEndRef} />
            </ScrollArea>
            
            <CardFooter className="flex border-t p-3">
              {isAuthenticated ? (
                <div className="flex w-full items-center space-x-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 min-h-10 max-h-32"
                    disabled={isSendingMessage}
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={!messageInput.trim() || isSendingMessage}
                    size="icon"
                  >
                    {isSendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={onLoginPrompt} 
                  variant="outline" 
                  className="w-full"
                >
                  Log in to chat
                </Button>
              )}
            </CardFooter>
          </TabsContent>
          
          <TabsContent value="gifts" className="m-0">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center">
                <Gift className="h-4 w-4 mr-2" />
                Send a Gift to {readerName}
              </h3>
              
              {isAuthenticated ? (
                <>
                  <p className="text-xs text-muted-foreground mb-4">
                    Show your appreciation with a gift! All gifts directly support the reader.
                  </p>
                  
                  {isSendingGift ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                      <p className="text-sm">Processing your gift...</p>
                    </div>
                  ) : (
                    renderGifts()
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Gift className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-sm text-center mb-4">
                    Log in to send gifts to {readerName}
                  </p>
                  <Button onClick={onLoginPrompt} variant="outline">
                    Log in
                  </Button>
                </div>
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default LivestreamPlayer;