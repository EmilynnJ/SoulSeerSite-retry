import React, { useState, useEffect, useRef } from 'react';
import { FiClock, FiAlertCircle } from 'react-icons/fi';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import apiRequest from '@/lib/apiRequest';

interface SessionTimerProps {
  sessionId: string;
  userId: string;
  isReader: boolean;
  onTimeEnd?: () => void;
  showNotifications?: boolean;
  className?: string;
  iconSize?: number;
}

export const SessionTimer: React.FC<SessionTimerProps> = ({
  sessionId,
  userId,
  isReader,
  onTimeEnd,
  showNotifications = false,
  className,
  iconSize = 16
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionActive, setSessionActive] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const warningShownRef = useRef<{
    threeMinutes: boolean;
    twoMinutes: boolean;
    oneMinute: boolean;
  }>({
    threeMinutes: false,
    twoMinutes: false,
    oneMinute: false
  });
  
  // Format seconds to mm:ss
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle session heartbeat and status checks
  useEffect(() => {
    // Function to send heartbeat to server
    const sendHeartbeat = async () => {
      try {
        const response = await apiRequest(`/api/sessions/billing`, {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            userId,
            isReader
          })
        });
        
        if (!response || response.error) {
          console.error('Session billing error:', response?.error || 'Unknown error');
          if (response?.status === 'ended') {
            stopSession();
          }
          return;
        }
        
        // Update session status
        if (response.status === 'active') {
          setSessionActive(true);
          
          // Set session start time if not already set
          if (!sessionStartTime && response.startTime) {
            setSessionStartTime(new Date(response.startTime));
          }
          
          // Update elapsed time from server if available
          if (response.elapsedSeconds !== undefined) {
            setElapsedSeconds(response.elapsedSeconds);
          }
          
          // Check for time warnings (only for client, not reader)
          if (!isReader && showNotifications && response.timeRemaining !== undefined) {
            checkTimeWarnings(response.timeRemaining);
          }
        } else if (response.status === 'ended') {
          stopSession();
        }
        
        setError(null);
      } catch (err) {
        console.error('Error sending session heartbeat:', err);
        setError('Connection error');
      }
    };
    
    // Check and show time warnings
    const checkTimeWarnings = (secondsRemaining: number) => {
      const minutesRemaining = Math.floor(secondsRemaining / 60);
      
      if (minutesRemaining <= 3 && !warningShownRef.current.threeMinutes) {
        warningShownRef.current.threeMinutes = true;
        if (showNotifications) {
          toast({
            title: 'Time Warning',
            description: 'You have about 3 minutes of session time remaining.',
            variant: 'warning'
          });
        }
      }
      
      if (minutesRemaining <= 2 && !warningShownRef.current.twoMinutes) {
        warningShownRef.current.twoMinutes = true;
        if (showNotifications) {
          toast({
            title: 'Time Warning',
            description: 'You have about 2 minutes of session time remaining.',
            variant: 'warning'
          });
        }
      }
      
      if (minutesRemaining <= 1 && !warningShownRef.current.oneMinute) {
        warningShownRef.current.oneMinute = true;
        if (showNotifications) {
          toast({
            title: 'Time Warning',
            description: 'You have about 1 minute of session time remaining.',
            variant: 'destructive'
          });
        }
      }
    };
    
    // Function to stop the session
    const stopSession = () => {
      setSessionActive(false);
      
      // Clear intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Notify parent component
      if (onTimeEnd) {
        onTimeEnd();
      }
    };
    
    // Initialize: send first heartbeat
    sendHeartbeat();
    
    // Set up heartbeat interval (every 30 seconds)
    heartbeatIntervalRef.current = window.setInterval(sendHeartbeat, 30000);
    
    // Set up timer interval (every second)
    timerIntervalRef.current = window.setInterval(() => {
      if (sessionActive) {
        setElapsedSeconds(prev => prev + 1);
      }
    }, 1000);
    
    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [sessionId, userId, isReader, sessionStartTime, onTimeEnd, showNotifications]);
  
  return (
    <div className={cn("flex items-center space-x-1.5", className)}>
      {error ? (
        <FiAlertCircle className="text-red-500" style={{ width: iconSize, height: iconSize }} />
      ) : (
        <FiClock style={{ width: iconSize, height: iconSize }} />
      )}
      <Badge 
        variant="outline" 
        className={cn(
          "font-mono",
          error ? "bg-red-500/10 text-red-500" : "bg-primary/10"
        )}
      >
        {error ? 'Error' : formatTime(elapsedSeconds)}
      </Badge>
    </div>
  );
};