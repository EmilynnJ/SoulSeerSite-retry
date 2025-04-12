import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Send, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  isReader: boolean;
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  sessionId: string;
  roomId: string;
  readerId: string;
  readerName: string;
  readerAvatar?: string;
  clientId: string;
  clientName: string;
  clientAvatar?: string;
  onError?: (error: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  sessionId,
  roomId,
  readerId,
  readerName,
  readerAvatar,
  clientId,
  clientName,
  clientAvatar,
  onError
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Function to generate a unique ID for messages
  const generateId = () => Math.random().toString(36).substring(2, 15);

  // Connect to WebSocket when component mounts
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        // Close existing socket if any
        if (socketRef.current) {
          socketRef.current.close();
        }

        setIsConnecting(true);
        
        // Create WebSocket connection
        const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/chat/${roomId}`);
        
        // Store socket reference
        socketRef.current = socket;
        
        // WebSocket event listeners
        socket.onopen = () => {
          console.log('WebSocket connection established');
          setIsConnecting(false);
          setError(null);
          
          // Send join message
          socket.send(JSON.stringify({
            type: 'join',
            sessionId,
            userId: clientId,
            userName: clientName,
            roomId
          }));
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'message') {
              const newMessage: Message = {
                id: data.id || generateId(),
                sessionId,
                senderId: data.senderId,
                senderName: data.senderName,
                senderAvatar: data.senderAvatar,
                isReader: data.senderId === readerId,
                content: data.content,
                timestamp: new Date(data.timestamp || Date.now())
              };
              
              setMessages(prevMessages => [...prevMessages, newMessage]);
            } else if (data.type === 'history') {
              // Handle message history
              if (Array.isArray(data.messages)) {
                const formattedMessages = data.messages.map((msg: any) => ({
                  id: msg.id || generateId(),
                  sessionId,
                  senderId: msg.senderId,
                  senderName: msg.senderName,
                  senderAvatar: msg.senderAvatar,
                  isReader: msg.senderId === readerId,
                  content: msg.content,
                  timestamp: new Date(msg.timestamp || Date.now())
                }));
                
                setMessages(formattedMessages);
              }
            } else if (data.type === 'system') {
              // Handle system messages (like user joined/left)
              toast({
                title: 'System Message',
                description: data.content,
                variant: 'default',
                duration: 3000
              });
            } else if (data.type === 'error') {
              setError(data.content);
              if (onError) {
                onError(data.content);
              }
            }
          } catch (err) {
            console.error('Error processing WebSocket message:', err);
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error. Please try refreshing the page.');
          if (onError) {
            onError('Chat connection error');
          }
        };
        
        socket.onclose = (event) => {
          console.log('WebSocket connection closed:', event.code, event.reason);
          setIsConnecting(true);
          
          // Attempt to reconnect unless explicitly closed by us
          if (!event.wasClean) {
            toast({
              title: 'Connection Lost',
              description: 'Attempting to reconnect...',
              variant: 'destructive',
              duration: 3000
            });
            
            // Reconnect after a delay
            setTimeout(connectWebSocket, 3000);
          }
        };
        
        // Clean up function
        return () => {
          socket.close();
        };
      } catch (err) {
        console.error('Failed to establish WebSocket connection:', err);
        setError('Failed to connect to chat. Please try refreshing the page.');
        setIsConnecting(false);
        if (onError) {
          onError('Failed to connect to chat');
        }
      }
    };
    
    connectWebSocket();
    
    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [sessionId, roomId, clientId, clientName, readerId, onError, toast]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message function
  const sendMessage = () => {
    if (!messageInput.trim() || isLoading || !socketRef.current) return;
    
    setIsLoading(true);
    
    const messageData = {
      type: 'message',
      id: generateId(),
      sessionId,
      senderId: clientId,
      senderName: clientName,
      senderAvatar: clientAvatar,
      content: messageInput.trim(),
      timestamp: new Date().toISOString()
    };
    
    try {
      socketRef.current.send(JSON.stringify(messageData));
      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
      toast({
        title: 'Failed to Send',
        description: 'Your message could not be sent. Please try again.',
        variant: 'destructive',
        duration: 3000
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sending message with Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Render message bubbles
  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
          <p>No messages yet.</p>
          <p className="text-sm mt-2">
            Start your conversation with {readerName}. Your session timer has started.
          </p>
        </div>
      );
    }

    return messages.map((message, index) => {
      const isClient = message.senderId === clientId;
      const showAvatar = index === 0 || 
                        messages[index - 1].senderId !== message.senderId;
      
      return (
        <div
          key={message.id}
          className={`flex ${isClient ? 'justify-end' : 'justify-start'} mb-4`}
        >
          {!isClient && showAvatar && (
            <Avatar className="mr-2 flex-shrink-0">
              <AvatarImage src={message.senderAvatar} alt={message.senderName} />
              <AvatarFallback>
                {message.senderName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}

          <div className={`${isClient ? 'order-2' : 'order-1'} max-w-[75%]`}>
            {showAvatar && (
              <p className={`text-xs text-muted-foreground mb-1 ${isClient ? 'text-right' : 'text-left'}`}>
                {message.senderName}
              </p>
            )}
            
            <div
              className={`rounded-lg p-3 ${
                isClient 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <p className={`text-xs ${isClient ? 'text-primary-foreground/80' : 'text-muted-foreground'} mt-1`}>
                {formatDistanceToNow(message.timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>

          {isClient && showAvatar && (
            <Avatar className="ml-2 flex-shrink-0">
              <AvatarImage src={clientAvatar} alt={clientName} />
              <AvatarFallback>
                {clientName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      );
    });
  };

  return (
    <Card className="w-full">
      <CardContent className="p-0 flex flex-col">
        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="m-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Connection Status */}
        {isConnecting && (
          <div className="bg-muted p-2 text-sm flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Connecting to chat...
          </div>
        )}
        
        {/* Chat Session Info */}
        <div className="p-3 border-b flex items-center">
          <Avatar className="mr-2">
            <AvatarImage src={readerAvatar} alt={readerName} />
            <AvatarFallback>{readerName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{readerName}</p>
            <p className="text-xs text-muted-foreground">Pay-per-minute chat reading</p>
          </div>
        </div>
        
        {/* Messages Area */}
        <ScrollArea className="h-[300px] p-4" ref={messagesContainerRef}>
          <div className="flex flex-col space-y-4">
            {renderMessages()}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <Separator />
      
      <CardFooter className="p-3">
        <div className="flex w-full items-center space-x-2">
          <Textarea
            placeholder="Type your message here..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-10 max-h-32"
            disabled={isLoading || isConnecting}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!messageInput.trim() || isLoading || isConnecting}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ChatInterface;