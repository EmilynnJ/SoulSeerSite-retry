import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MessageList } from '../components/messages/message-list';
import { ConversationList } from '../components/messages/conversation-list';
import { NewConversationDialog } from '../components/messages/new-conversation-dialog';

export interface Conversation {
  id: number;
  user1Id: number;
  user2Id: number;
  lastMessageAt: string;
  createdAt: string;
  otherUser?: {
    id: number;
    username: string;
    fullName: string | null;
    profileImage: string | null;
    role: string;
  };
  lastMessage?: {
    content: string;
    createdAt: string;
    isRead: boolean;
  };
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  recipientId: number;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);

  // Fetch conversations for the current user
  const { 
    data: conversations, 
    isLoading: isLoadingConversations,
    error: conversationsError
  } = useQuery({
    queryKey: ['/api/conversations'],
    enabled: !!user,
    staleTime: 10000, // Refresh every 10 seconds
    refetchInterval: 10000
  });

  // Fetch messages for the active conversation
  const { 
    data: messages, 
    isLoading: isLoadingMessages,
    error: messagesError
  } = useQuery({
    queryKey: ['/api/conversations', activeConversation?.id, 'messages'],
    enabled: !!activeConversation?.id,
    staleTime: 5000, // Refresh every 5 seconds
    refetchInterval: 5000
  });

  // Fetch unread message count
  const {
    data: unreadCount
  } = useQuery({
    queryKey: ['/api/messages/unread-count'],
    enabled: !!user,
    staleTime: 10000,
    refetchInterval: 10000
  });

  // Send a new message
  const sendMessageMutation = useMutation({
    mutationFn: async (newMessage: { conversationId: number, content: string }) => {
      const response = await apiRequest('/api/messages', {
        method: 'POST',
        data: newMessage
      });
      return response;
    },
    onSuccess: () => {
      // Clear input field
      setMessageText('');
      // Invalidate queries to refresh the message list
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', activeConversation?.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send message',
        description: error.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Mark messages as read when a conversation is opened
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const response = await apiRequest(`/api/messages/${messageId}/read`, {
        method: 'PATCH'
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate queries to refresh the message list and unread count
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    }
  });

  // Handle sending a new message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || !activeConversation) return;
    
    sendMessageMutation.mutate({
      conversationId: activeConversation.id,
      content: messageText
    });
  };

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (messages && messages.length > 0 && user) {
      // Find unread messages sent to the current user
      const unreadMessages = messages.filter(
        (msg: Message) => !msg.isRead && msg.recipientId === user.id
      );
      
      // Mark each unread message as read
      unreadMessages.forEach((msg: Message) => {
        markAsReadMutation.mutate(msg.id);
      });
    }
  }, [messages, user]);

  return (
    <div className="container mx-auto py-6 cosmic-bg min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-cinzel text-accent">Messages</h1>
        <Button 
          onClick={() => setIsNewConversationOpen(true)}
          variant="default"
          size="sm"
          className="bg-accent hover:bg-accent/80 text-primary-foreground"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>

      {!user ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl mb-4">Please log in to view your messages</h2>
          <p className="mb-4">You need to be logged in to access your conversations.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Conversation List */}
          <div className="md:col-span-1">
            <Card className="h-[600px] flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Conversations
                  {unreadCount?.count > 0 && (
                    <span className="ml-2 bg-accent text-primary-foreground text-xs rounded-full px-2 py-1">
                      {unreadCount.count}
                    </span>
                  )}
                </h2>
              </div>
              
              <ScrollArea className="flex-1">
                {isLoadingConversations ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[200px]" />
                          <Skeleton className="h-4 w-[160px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : conversationsError ? (
                  <div className="p-4 text-red-500">
                    Failed to load conversations
                  </div>
                ) : conversations?.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <p className="mb-2">No conversations yet</p>
                    <p className="text-sm">
                      Start a new conversation by clicking the button above
                    </p>
                  </div>
                ) : (
                  <ConversationList 
                    conversations={conversations}
                    activeConversationId={activeConversation?.id}
                    onSelectConversation={setActiveConversation}
                    currentUserId={user?.id}
                  />
                )}
              </ScrollArea>
            </Card>
          </div>
          
          {/* Message Thread */}
          <div className="md:col-span-2">
            <Card className="h-[600px] flex flex-col">
              {activeConversation ? (
                <>
                  <div className="p-4 border-b flex items-center">
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarImage 
                        src={activeConversation.otherUser?.profileImage || ''} 
                        alt={activeConversation.otherUser?.fullName || activeConversation.otherUser?.username || 'User'} 
                      />
                      <AvatarFallback>
                        {(activeConversation.otherUser?.fullName || activeConversation.otherUser?.username || 'U').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">
                        {activeConversation.otherUser?.fullName || activeConversation.otherUser?.username}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {activeConversation.otherUser?.role}
                      </p>
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1 p-4">
                    {isLoadingMessages ? (
                      <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                            <Skeleton className={`h-[60px] w-[80%] rounded-md`} />
                          </div>
                        ))}
                      </div>
                    ) : messagesError ? (
                      <div className="text-red-500 text-center p-4">
                        Failed to load messages
                      </div>
                    ) : messages?.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                        <div>
                          <p className="mb-2">No messages yet</p>
                          <p className="text-sm">
                            Send a message to start the conversation
                          </p>
                        </div>
                      </div>
                    ) : (
                      <MessageList 
                        messages={messages} 
                        currentUserId={user?.id}
                      />
                    )}
                  </ScrollArea>
                  
                  <form onSubmit={handleSendMessage} className="p-4 border-t">
                    <div className="flex space-x-2">
                      <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type your message..."
                        disabled={sendMessageMutation.isPending}
                      />
                      <Button 
                        type="submit" 
                        size="icon"
                        disabled={!messageText.trim() || sendMessageMutation.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-center p-4">
                  <div>
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
                    <p className="text-muted-foreground max-w-md">
                      Select a conversation from the list or start a new one to begin messaging
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
      
      <NewConversationDialog 
        open={isNewConversationOpen}
        onOpenChange={setIsNewConversationOpen}
        onConversationCreated={(conversation) => {
          setActiveConversation(conversation);
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        }}
      />
    </div>
  );
};

export default MessagesPage;