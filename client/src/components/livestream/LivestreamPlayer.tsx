import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { FiSend, FiUsers, FiGift, FiX, FiAlertCircle, FiHeart } from 'react-icons/fi';
import { 
  Card, 
  CardContent, 
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import apiRequest from '@/lib/apiRequest';

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

export const LivestreamPlayer: React.FC<LivestreamPlayerProps> = ({
  livestreamId,
  title,
  readerName,
  readerAvatar,
  readerDescription,
  viewerCount: initialViewerCount = 0,
  isAuthenticated,
  userId,
  username,
  userAvatar,
  onLoginPrompt
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(initialViewerCount);
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const [currentGiftAnimation, setCurrentGiftAnimation] = useState<{
    username: string;
    giftName: string;
    giftIcon: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Available gifts
  const gifts: Gift[] = [
    {
      id: 'gift-1',
      name: 'Crystal Ball',
      description: 'A mystical crystal ball to enhance their vision',
      icon: <span className="text-2xl">🔮</span>,
      value: 100, // $1.00
      animation: 'fade-in'
    },
    {
      id: 'gift-2',
      name: 'Energy Boost',
      description: 'Send positive energy to boost their reading',
      icon: <span className="text-2xl">✨</span>,
      value: 200, // $2.00
      animation: 'pulse'
    },
    {
      id: 'gift-3',
      name: 'Celestial Star',
      description: 'A celestial star to brighten their day',
      icon: <span className="text-2xl">⭐</span>,
      value: 500, // $5.00
      animation: 'spin'
    },
    {
      id: 'gift-4',
      name: 'Spiritual Rose',
      description: 'A beautiful spiritual rose to show appreciation',
      icon: <span className="text-2xl">🌹</span>,
      value: 1000, // $10.00
      animation: 'float'
    }
  ];

  // Connect to the WebSocket server
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    
    const socketInstance = io('/livestream', {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to livestream server');
      setIsConnected(true);
      setError(null);

      // Join the livestream
      socketInstance.emit('join', {
        livestreamId,
        userId,
        username
      });
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setIsConnected(false);
      setError('Failed to connect to livestream server. Please try again.');
    });

    socketInstance.on('error', (data) => {
      console.error('Socket error:', data);
      setError(data.message || 'An error occurred');
    });

    socketInstance.on('history', (data) => {
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
        scrollToBottom();
      }
    });

    socketInstance.on('message', (message: ChatMessage) => {
      setMessages((prevMessages) => [...prevMessages, message]);
      scrollToBottom();
    });

    socketInstance.on('viewers', (data) => {
      setViewerCount(data.count || 0);
    });
    
    socketInstance.on('gift', (data) => {
      console.log('Gift received:', data);
      
      // Show gift animation
      setCurrentGiftAnimation({
        username: data.username,
        giftName: data.giftName,
        giftIcon: data.giftIcon
      });
      
      // Hide animation after a few seconds
      setTimeout(() => {
        setCurrentGiftAnimation(null);
      }, 5000);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from livestream server');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    // Cleanup on component unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [isAuthenticated, livestreamId, userId, username]);

  // Scroll to the bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Send a message
  const sendMessage = () => {
    if (!socket || !inputValue.trim() || !isConnected || !isAuthenticated) {
      if (!isAuthenticated && onLoginPrompt) {
        onLoginPrompt();
      }
      return;
    }

    socket.emit('message', {
      content: inputValue.trim()
    });

    setInputValue('');
    inputRef.current?.focus();
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Handle input key press (Enter to send)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  // Send a gift
  const sendGift = async (gift: Gift) => {
    if (!socket || !isConnected || !isAuthenticated) {
      if (!isAuthenticated && onLoginPrompt) {
        onLoginPrompt();
      }
      return;
    }

    try {
      socket.emit('gift', {
        giftId: gift.id,
        amount: 1
      });
      
      toast({
        title: 'Gift Sent!',
        description: `You sent a ${gift.name} to ${readerName}`,
      });
      
      setShowGiftDialog(false);
    } catch (error) {
      console.error('Error sending gift:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send gift. Please try again.',
      });
    }
  };

  // Calculate time from timestamp
  const formatTimestamp = (timestamp?: Date) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Gift animation overlay */}
      {currentGiftAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-float bg-black/40 text-white p-6 rounded-xl text-center">
            <div className="text-4xl mb-2">{currentGiftAnimation.giftIcon}</div>
            <div className="text-xl font-bold">{currentGiftAnimation.username}</div>
            <div>sent a {currentGiftAnimation.giftName}!</div>
          </div>
        </div>
      )}
      
      <Card className="shadow-lg">
        <CardHeader className="bg-primary/5 pb-3">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col space-y-1">
              <CardTitle className="text-lg font-medium">
                {title}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={readerAvatar} alt={readerName} />
                    <AvatarFallback>{readerName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>{readerName}</span>
                  <Badge variant="outline" className="ml-2 flex items-center gap-1">
                    <FiUsers className="h-3 w-3" />
                    <span>{viewerCount}</span>
                  </Badge>
                </div>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 grid md:grid-cols-3">
          <div className="md:col-span-2 bg-black flex items-center justify-center h-[400px]">
            {/* Video Player would go here */}
            <div className="text-white text-center p-4">
              <div className="text-4xl mb-4">🔮</div>
              <h2 className="text-xl font-bold mb-2">Live Reading in Progress</h2>
              <p className="max-w-md mx-auto">{readerDescription || `Join ${readerName} for spiritual insights and guidance.`}</p>
            </div>
          </div>
          <div className="md:col-span-1 flex flex-col border-l">
            {error && (
              <div className="bg-red-500/10 text-red-500 p-3 text-sm flex items-center space-x-2">
                <FiAlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            
            <ScrollArea className="flex-1 h-[320px]">
              <div className="p-4 space-y-4">
                {messages.map((message, index) => {
                  if (message.isGift) {
                    // Gift message
                    return (
                      <div 
                        key={message.id || index} 
                        className="text-center py-1 px-2 bg-purple-500/10 text-purple-500 rounded-md"
                      >
                        <p className="text-sm">
                          <strong>{message.username}</strong> sent a gift: {message.content}
                        </p>
                      </div>
                    );
                  }
                  
                  // Regular message
                  const isCurrentUser = message.userId === userId;
                  
                  return (
                    <div key={message.id || index} className="flex items-start gap-2">
                      <Avatar className="h-6 w-6 mt-1">
                        <AvatarImage src={message.userAvatar} alt={message.username} />
                        <AvatarFallback>{message.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium">
                            {message.username}
                            {isCurrentUser && <span className="ml-1 text-xs opacity-50">(You)</span>}
                          </p>
                          <span className="text-xs opacity-50">{formatTimestamp(message.timestamp)}</span>
                        </div>
                        <p className="text-sm break-words">{message.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            <div className="p-3 border-t">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  placeholder={isAuthenticated ? "Type a message..." : "Sign in to chat"}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  disabled={!isAuthenticated || !isConnected}
                  className="flex-1"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!isAuthenticated || !isConnected || !inputValue.trim()}
                  size="icon"
                >
                  <FiSend className="h-4 w-4" />
                </Button>
                
                <Dialog open={showGiftDialog} onOpenChange={setShowGiftDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      disabled={!isAuthenticated}
                      className="text-pink-500"
                    >
                      <FiGift className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send a Gift to {readerName}</DialogTitle>
                      <DialogDescription>
                        Show your appreciation with a gift. Gifts support the reader directly.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                      {gifts.map((gift) => (
                        <div 
                          key={gift.id}
                          className="flex flex-col items-center p-4 border rounded-lg hover:border-primary cursor-pointer"
                          onClick={() => sendGift(gift)}
                        >
                          <div className="text-3xl mb-2">{gift.icon}</div>
                          <div className="font-medium">{gift.name}</div>
                          <div className="text-sm text-muted-foreground">{gift.description}</div>
                          <Badge variant="outline" className="mt-2">
                            ${(gift.value / 100).toFixed(2)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};