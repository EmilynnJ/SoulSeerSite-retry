import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Conversation } from '@/pages/messages-page';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversation: Conversation) => void;
}

export const NewConversationDialog: React.FC<NewConversationDialogProps> = ({
  open,
  onOpenChange,
  onConversationCreated
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch users for the command pallette
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/users'],
    enabled: open,
    staleTime: 60000 // Cache for 1 minute
  });

  // Create a new conversation
  const createConversationMutation = useMutation({
    mutationFn: (otherUserId: number) => {
      return apiRequest('/api/conversations', {
        method: 'POST',
        data: { otherUserId }
      });
    },
    onSuccess: (data) => {
      onConversationCreated(data);
      onOpenChange(false);
      toast({
        title: 'Conversation created',
        description: 'You can now start messaging',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create conversation',
        description: error.message || 'Please try again later',
        variant: 'destructive'
      });
    }
  });

  // Handle user selection
  const handleUserSelect = (userId: number) => {
    setSelectedUserId(userId);
  };

  // Handle conversation creation
  const handleCreateConversation = () => {
    if (selectedUserId) {
      createConversationMutation.mutate(selectedUserId);
    }
  };

  // Filter users based on search query
  const filteredUsers = users?.filter(u => 
    u.id !== user?.id && // Don't show current user
    (
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Select a user to start a conversation with
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Command>
            <CommandInput 
              placeholder="Search users..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {isLoadingUsers ? (
                <div className="flex justify-center items-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <CommandEmpty>No users found</CommandEmpty>
                  <CommandGroup heading="Users">
                    {filteredUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        onSelect={() => handleUserSelect(user.id)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profileImage || ''} alt={user.username} />
                          <AvatarFallback>
                            {(user.fullName || user.username || 'U').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.fullName || user.username}</p>
                          {user.role && (
                            <p className="text-xs text-muted-foreground">{user.role}</p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateConversation}
            disabled={!selectedUserId || createConversationMutation.isPending}
          >
            {createConversationMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Start Conversation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};