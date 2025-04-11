import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  PhoneCall, 
  Video, 
  MessageSquare, 
  Clock,
  AlertTriangle,
  ChevronRight,
  Info
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ClientBalance } from './ClientBalance';

interface Reader {
  id: number;
  username: string;
  fullName: string;
  profileImage: string | null;
  bio: string | null;
  ratePerMinute?: number;
}

interface SessionControlsProps {
  reader: Reader;
  onSessionStart: (sessionData: any) => void;
}

const INITIAL_DURATION_OPTIONS = [5, 10, 15, 30]; // minutes

export const SessionControls: React.FC<SessionControlsProps> = ({
  reader,
  onSessionStart
}) => {
  const [sessionType, setSessionType] = useState<'video' | 'audio' | 'chat'>('video');
  const [initialDuration, setInitialDuration] = useState<number>(10);
  const { toast } = useToast();
  
  // Default rate is $5 per minute if not specified by the reader
  const ratePerMinute = reader.ratePerMinute || 500; // cents
  
  // Calculate initial cost
  const initialCost = ratePerMinute * initialDuration;
  
  // Fetch client balance
  const { data: balanceData, isLoading: isLoadingBalance } = useQuery({
    queryKey: ['/api/sessions/balance'],
    retry: 1
  });
  
  // Initialize session
  const { mutate: initializeSession, isPending: isInitializing } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sessions/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          readerId: reader.id,
          type: sessionType,
          initialDuration
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initialize session');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Session initialized',
        description: 'Your reading session is being prepared.',
        variant: 'default'
      });
      
      // Call the parent component to start session
      onSessionStart(data);
    },
    onError: (error: Error) => {
      // Check if it's an insufficient balance error
      if (error.message.includes('Insufficient balance')) {
        toast({
          title: 'Insufficient balance',
          description: 'Please add funds to start this session.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Failed to initialize session',
          description: error.message,
          variant: 'destructive'
        });
      }
    }
  });
  
  // Check if user has sufficient balance
  const currentBalance = balanceData?.balance || 0;
  const hasInsufficientBalance = currentBalance < initialCost;
  
  // Handle session start
  const handleStartSession = () => {
    initializeSession();
  };
  
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Start Pay-Per-Minute Reading</CardTitle>
          <CardDescription>
            Choose your reading type and duration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {/* Session Type Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Reading Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={sessionType === 'video' ? 'default' : 'outline'}
                  onClick={() => setSessionType('video')}
                  className="flex flex-col items-center justify-center py-3 h-auto"
                >
                  <Video className="h-5 w-5 mb-1" />
                  <span className="text-sm">Video</span>
                </Button>
                <Button
                  type="button"
                  variant={sessionType === 'audio' ? 'default' : 'outline'}
                  onClick={() => setSessionType('audio')}
                  className="flex flex-col items-center justify-center py-3 h-auto"
                >
                  <PhoneCall className="h-5 w-5 mb-1" />
                  <span className="text-sm">Voice</span>
                </Button>
                <Button
                  type="button"
                  variant={sessionType === 'chat' ? 'default' : 'outline'}
                  onClick={() => setSessionType('chat')}
                  className="flex flex-col items-center justify-center py-3 h-auto"
                >
                  <MessageSquare className="h-5 w-5 mb-1" />
                  <span className="text-sm">Chat</span>
                </Button>
              </div>
            </div>
            
            {/* Duration Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Initial Duration
              </label>
              <Select
                value={initialDuration.toString()}
                onValueChange={(value) => setInitialDuration(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {INITIAL_DURATION_OPTIONS.map((duration) => (
                    <SelectItem key={duration} value={duration.toString()}>
                      {duration} minutes ({formatCurrency(duration * ratePerMinute / 100)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                You can extend your session later if needed.
              </p>
            </div>
            
            {/* Cost Summary */}
            <div className="bg-muted p-3 rounded-md mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Rate:</span>
                <span className="text-sm">
                  {formatCurrency(ratePerMinute / 100)}/minute
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm font-medium">Initial duration:</span>
                <span className="text-sm">
                  {initialDuration} minutes
                </span>
              </div>
              <div className="flex justify-between items-center mt-1 border-t pt-1">
                <span className="text-sm font-medium">Initial charge:</span>
                <span className="text-sm font-semibold text-primary">
                  {formatCurrency(initialCost / 100)}
                </span>
              </div>
            </div>
            
            {/* Balance Warning */}
            {hasInsufficientBalance && (
              <div className="border border-destructive bg-destructive/10 text-destructive rounded-md p-3 flex gap-2 items-start">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Insufficient balance</p>
                  <p className="text-xs mt-1">
                    Your current balance is {formatCurrency(currentBalance / 100)}. 
                    Please add at least {formatCurrency((initialCost - currentBalance) / 100)} more to start this session.
                  </p>
                </div>
              </div>
            )}
            
            {/* Start Button */}
            <Button
              onClick={handleStartSession}
              disabled={isInitializing || hasInsufficientBalance}
              className="mt-2 w-full"
              size="lg"
            >
              {isInitializing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 mr-2" />
              )}
              Start {initialDuration}-Minute Session
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
            
            {/* About Pay-Per-Minute */}
            <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-md">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                With pay-per-minute readings, you'll only be charged for the actual time spent in the session.
                You can extend or end the session at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Client Balance Card */}
      <ClientBalance />
    </div>
  );
};

export default SessionControls;