import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNavigate } from 'wouter';
import { FiSend, FiX, FiAlertCircle, FiClock } from 'react-icons/fi';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { SessionTimer } from './SessionTimer';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id?: string;
  type: 'message' | 'system' | 'history' | 'join' | 'leave' | 'error';
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  content?: string;
  timestamp?: string;
  messages?: ChatMessage[];
}

interface ChatInterfaceProps {
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

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  // Generate a unique room ID based on the session ID
  const roomId = `chat_${sessionId}`;

  // Connect to the WebSocket server
  useEffect(() => {
    const socketInstance = io('/chat', {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to chat server');
      setIsConnected(true);
      setError(null);

      // Join the chat room
      socketInstance.emit('join', {
        roomId,
        sessionId,
        userId,
        userName
      });
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setIsConnected(false);
      setError('Failed to connect to chat server. Please try again.');
      if (onError) onError('Connection error');
    });

    socketInstance.on('error', (data) => {
      console.error('Socket error:', data);
      setError(data.message || 'An error occurred');
      if (onError) onError(data.message || 'Socket error');
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

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from chat server');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    // Cleanup on component unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [sessionId, userId, userName, roomId]);

  // Scroll to the bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Send a message
  const sendMessage = () => {
    if (!socket || !inputValue.trim() || !isConnected) return;

    socket.emit('message', {
      content: inputValue.trim(),
      senderAvatar: userAvatar
    });

    setInputValue('');
    inputRef.current?.focus();
  };

  // Handle input change and typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Could add typing indicator logic here
    if (e.target.value.trim() && !isTyping) {
      setIsTyping(true);
      // socket.emit('typing', { roomId, userId, userName });
      
      // Turn off typing indicator after a delay
      setTimeout(() => setIsTyping(false), 2000);
    }
  };

  // Handle input key press (Enter to send)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Calculate time from timestamp
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format content with line breaks
  const formatContent = (content?: string) => {
    if (!content) return '';
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  // Handle session end
  const handleEndSession = () => {
    if (socket) {
      socket.disconnect();
    }
    onEndSession();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader className="bg-primary/5 flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex flex-col space-y-1">
          <CardTitle className="text-lg font-medium">
            Chat Session with {isReader ? userId : readerName}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {isConnected ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500">
                Connected
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
            onTimeEnd={handleEndSession}
            showNotifications={true}
            className="text-sm"
            iconSize={14}
          />
          <Button variant="ghost" size="icon" onClick={handleEndSession}>
            <FiX className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error && (
          <div className="bg-red-500/10 text-red-500 p-3 text-sm flex items-center space-x-2">
            <FiAlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
        <ScrollArea className="h-[400px] p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FiClock className="h-8 w-8 mb-2" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => {
                if (message.type === 'system') {
                  return (
                    <div 
                      key={message.id || index} 
                      className="text-center text-sm text-muted-foreground py-1"
                    >
                      {message.content}
                    </div>
                  );
                }
                
                const isCurrentUser = message.senderId === userId;
                const sender = isCurrentUser ? userName : (message.senderName || 'Unknown');
                const avatar = isCurrentUser ? userAvatar : (
                  message.senderId === readerId ? readerAvatar : message.senderAvatar
                );
                
                return (
                  <div 
                    key={message.id || index} 
                    className={cn(
                      "flex items-start gap-2",
                      isCurrentUser ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatar} alt={sender} />
                      <AvatarFallback>{sender.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "rounded-lg px-3 py-2 max-w-[75%]",
                      isCurrentUser 
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <div className="text-xs opacity-70 mb-1">
                        <span className="font-medium">{sender}</span>
                        <span className="ml-2">{formatTimestamp(message.timestamp)}</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {formatContent(message.content)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <Separator />
      <CardFooter className="p-4">
        <div className="flex w-full items-end gap-2">
          <Textarea
            ref={inputRef}
            placeholder="Type your message..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            className="flex-1 min-h-[60px] max-h-[120px]"
            disabled={!isConnected}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!isConnected || !inputValue.trim()}
            size="icon"
            className="h-[60px]"
          >
            <FiSend className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};