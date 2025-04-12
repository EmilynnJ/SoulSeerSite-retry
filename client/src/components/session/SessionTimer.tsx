import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  DollarSign, 
  PauseCircle, 
  PlayCircle, 
  StopCircle,
  AlertCircle,
  Plus,
  Loader2
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatDuration } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Pre-defined extension options
const EXTENSION_OPTIONS = [5, 10, 15, 30]; // minutes

interface SessionTimerProps {
  sessionId: string;
  initialSessionData: {
    minuteRate: number;
    initialDuration: number;
    remainingMinutes: number;
    billedMinutes: number;
  };
  onSessionEnd?: () => void;
}

export const SessionTimer: React.FC<SessionTimerProps> = ({
  sessionId,
  initialSessionData,
  onSessionEnd
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [sessionData, setSessionData] = useState(initialSessionData);
  const [showExtendOptions, setShowExtendOptions] = useState(false);
  const [needsExtension, setNeedsExtension] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { minuteRate, initialDuration, remainingMinutes, billedMinutes } = sessionData;
  
  // Calculate values for display
  const totalSeconds = initialDuration * 60;
  const remainingSeconds = Math.max(0, remainingMinutes * 60 - elapsedSeconds % 60);
  const percentRemaining = (remainingSeconds / (initialDuration * 60)) * 100;
  
  // Calculate cost so far
  const currentCost = (billedMinutes + Math.floor(elapsedSeconds / 60)) * minuteRate / 100;
  
  // Update session on server (heartbeat)
  const { mutate: updateSession, isPending: isUpdating } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sessions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId,
          elapsedMinutes: Math.floor(elapsedSeconds / 60)
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update session');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update local session data with server response
      setSessionData({
        ...sessionData,
        remainingMinutes: data.session.remainingMinutes,
        billedMinutes: data.session.billedMinutes
      });
      
      // Check if we need to show extension warning
      if (data.needsMoreFunds) {
        setNeedsExtension(true);
        
        // Only show toast if we haven't already
        if (!showExtendOptions) {
          toast({
            title: 'Session time running out',
            description: 'Please extend your session to continue.',
            variant: 'destructive'
          });
          setShowExtendOptions(true);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Session update failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Extend session
  const { mutate: extendSession, isPending: isExtending } = useMutation({
    mutationFn: async (additionalMinutes: number) => {
      const response = await fetch('/api/sessions/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId,
          additionalMinutes
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extend session');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update local session data with server response
      setSessionData({
        ...sessionData,
        initialDuration: data.session.initialDuration,
        remainingMinutes: data.session.remainingMinutes
      });
      
      // Reset extension UI
      setNeedsExtension(false);
      setShowExtendOptions(false);
      
      toast({
        title: 'Session extended',
        description: `Your session has been extended by ${data.additionalMinutes} minutes.`,
        variant: 'default'
      });
      
      // Invalidate balance query
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/balance'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to extend session',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // End session
  const { mutate: endSession, isPending: isEnding } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId,
          reason: 'User ended session'
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to end session');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Session ended',
        description: 'Your reading session has ended.',
        variant: 'default'
      });
      
      // Stop the timer
      setIsRunning(false);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/balance'] });
      
      // Call parent callback if provided
      if (onSessionEnd) {
        onSessionEnd();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to end session',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Timer effect
  useEffect(() => {
    let interval: number | null = null;
    
    if (isRunning) {
      interval = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);
  
  // Session update effect (heartbeat every 30 seconds)
  const updateSessionData = useCallback(() => {
    if (isRunning && elapsedSeconds > 0 && elapsedSeconds % 30 === 0) {
      console.log(`Sending session heartbeat at ${elapsedSeconds} seconds`);
      updateSession();
    }
    
    // Also check if we're approaching time limit
    if (remainingMinutes <= 1 && !needsExtension && !showExtendOptions) {
      setNeedsExtension(true);
      setShowExtendOptions(true);
      toast({
        title: 'Session time running low',
        description: 'Less than 1 minute remaining. Please extend your session.',
        variant: 'warning',
      });
    }
  }, [elapsedSeconds, isRunning, updateSession, remainingMinutes, needsExtension, showExtendOptions, toast]);
  
  useEffect(() => {
    updateSessionData();
  }, [elapsedSeconds, updateSessionData]);
  
  // Initial update on component mount
  useEffect(() => {
    // Update session after 3 seconds to establish connection
    const initialTimer = setTimeout(() => {
      updateSession();
    }, 3000);
    
    return () => clearTimeout(initialTimer);
  }, []);
  
  // Handle pause/resume
  const toggleRunning = () => {
    setIsRunning(prev => !prev);
  };
  
  // Handle end session
  const handleEndSession = () => {
    if (window.confirm('Are you sure you want to end this session?')) {
      endSession();
    }
  };
  
  // Handle extend session
  const handleExtendSession = (minutes: number) => {
    extendSession(minutes);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Session Timer
        </CardTitle>
        <CardDescription>
          Pay-per-minute reading session
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          {/* Timer Display */}
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">
              {formatDuration(elapsedSeconds)}
            </div>
            <div className="text-sm text-muted-foreground mb-3">
              {remainingMinutes <= 0 
                ? 'Session time expired' 
                : `${Math.floor(remainingMinutes)}m ${Math.round((remainingMinutes % 1) * 60)}s remaining`}
            </div>
            <Progress value={percentRemaining} className="h-2" />
          </div>
          
          {/* Cost Information */}
          <div className="bg-muted p-3 rounded-md">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Rate:</span>
              <span className="text-sm">
                {formatCurrency(minuteRate / 100)}/min
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm font-medium">Cost so far:</span>
              <span className="text-sm font-semibold text-primary">
                {formatCurrency(currentCost)}
              </span>
            </div>
          </div>
          
          {/* Extension Alert */}
          {needsExtension && (
            <Alert variant="warning" className="animate-pulse">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Time running out</AlertTitle>
              <AlertDescription>
                Please extend your session to continue the reading.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Extension Options */}
          {showExtendOptions && (
            <div className="grid gap-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <Plus className="h-4 w-4" /> Extend Session
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {EXTENSION_OPTIONS.map(minutes => (
                  <Button
                    key={minutes}
                    size="sm"
                    variant="outline"
                    disabled={isExtending}
                    onClick={() => handleExtendSession(minutes)}
                  >
                    {isExtending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <span>+{minutes}m</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Controls */}
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleRunning}
              disabled={isUpdating || isEnding}
            >
              {isRunning ? (
                <>
                  <PauseCircle className="h-4 w-4 mr-1" /> Pause
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-1" /> Resume
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExtendOptions(prev => !prev)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Time
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndSession}
              disabled={isEnding}
            >
              {isEnding ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4 mr-1" />
              )}
              End
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          Billed per minute based on active time
        </div>
      </CardFooter>
    </Card>
  );
};

export default SessionTimer;