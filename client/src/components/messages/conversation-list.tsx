import React from 'react';
import { Conversation } from '@/pages/messages-page';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: number;
  onSelectConversation: (conversation: Conversation) => void;
  currentUserId?: number;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  currentUserId
}) => {
  // Process conversations to add otherUser property
  const processedConversations = conversations.map(conversation => {
    // Ensure the conversation has the correct structure
    return conversation;
  });

  return (
    <div className="divide-y">
      {processedConversations.map((conversation) => {
        const isActive = conversation.id === activeConversationId;
        const hasUnreadMessages = conversation.lastMessage && 
                                  !conversation.lastMessage.isRead && 
                                  conversation.otherUser?.id !== currentUserId;
        
        return (
          <div
            key={conversation.id}
            className={cn(
              "p-4 hover:bg-primary-dark/20 cursor-pointer transition-colors",
              isActive && "bg-primary-dark/30",
              hasUnreadMessages && "bg-primary-dark/10"
            )}
            onClick={() => onSelectConversation(conversation)}
          >
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage 
                  src={conversation.otherUser?.profileImage || ''} 
                  alt={conversation.otherUser?.fullName || conversation.otherUser?.username || 'User'} 
                />
                <AvatarFallback>
                  {(conversation.otherUser?.fullName || conversation.otherUser?.username || 'U').charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className={cn(
                    "font-medium truncate",
                    hasUnreadMessages && "font-semibold"
                  )}>
                    {conversation.otherUser?.fullName || conversation.otherUser?.username}
                  </h3>
                  {conversation.lastMessageAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
                
                {conversation.lastMessage && (
                  <p className={cn(
                    "text-sm text-muted-foreground truncate",
                    hasUnreadMessages && "text-foreground font-medium"
                  )}>
                    {conversation.lastMessage.content}
                    {hasUnreadMessages && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-accent"></span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};