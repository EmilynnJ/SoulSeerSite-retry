import React, { useRef, useEffect } from 'react';
import { Message } from '@/pages/messages-page';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MessageListProps {
  messages: Message[];
  currentUserId?: number;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isCurrentUser = message.senderId === currentUserId;
        
        return (
          <div 
            key={message.id} 
            className={cn(
              "flex",
              isCurrentUser ? "justify-end" : "justify-start"
            )}
          >
            <div 
              className={cn(
                "max-w-[80%] rounded-lg p-3",
                isCurrentUser 
                  ? "bg-accent/80 text-accent-foreground" 
                  : "bg-primary-dark/40 text-primary-foreground"
              )}
            >
              <div className="flex flex-col">
                <p className="break-words">{message.content}</p>
                <span className={cn(
                  "text-xs mt-1",
                  isCurrentUser ? "text-accent-foreground/70" : "text-primary-foreground/70"
                )}>
                  {format(new Date(message.createdAt), 'h:mm a')}
                  {isCurrentUser && (
                    <span className="ml-2">
                      {message.isRead ? '• Read' : '• Sent'}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {/* Empty div for scrolling to the bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
};