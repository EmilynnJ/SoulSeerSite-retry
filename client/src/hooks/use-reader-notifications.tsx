import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './use-websocket';
import { useAuth } from './use-auth';

export interface ReadingRequest {
  id: number;
  type: 'new_reading_request' | 'new_scheduled_reading';
  reading: {
    id: number;
    clientId: number;
    readerId: number;
    type: 'chat' | 'voice' | 'video';
    readingMode: 'on_demand' | 'scheduled';
    pricePerMinute: number;
    duration?: number;
    totalPrice?: number;
    scheduledFor?: string;
    notes?: string;
    status: string;
    paymentLinkUrl?: string;
    createdAt: string;
  };
  client: {
    id: number;
    fullName: string;
    username: string;
    profileImage?: string;
  };
  timestamp: number;
  read?: boolean;
}

export interface ReaderNotificationState {
  notifications: ReadingRequest[];
  unreadCount: number;
  isConnected: boolean;
  playNotificationSound: boolean;
}

export function useReaderNotifications() {
  const { user } = useAuth();
  const { status, sendMessage, lastMessage } = useWebSocket();
  const isConnected = status === 'open';
  
  const [state, setState] = useState<ReaderNotificationState>({
    notifications: [],
    unreadCount: 0,
    isConnected: false,
    playNotificationSound: true
  });

  // Audio notification
  const playNotificationAudio = useCallback(() => {
    if (!state.playNotificationSound) return;
    
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.type = 'sine';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, [state.playNotificationSound]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage || !user || user.role !== 'reader') return;

    const data = lastMessage;
    
    try {
      // Handle new reading requests
      if (data.type === 'new_reading_request' || data.type === 'new_scheduled_reading') {
        if (data.reading?.readerId === user.id) {
          const newNotification: ReadingRequest = {
            id: Date.now(), // Temporary ID for frontend
            type: data.type,
            reading: data.reading,
            client: data.client,
            timestamp: data.timestamp || Date.now()
          };

          setState(prev => ({
            ...prev,
            notifications: [newNotification, ...prev.notifications],
            unreadCount: prev.unreadCount + 1
          }));

          // Play notification sound
          playNotificationAudio();

          // Show browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification('New Reading Request', {
              body: `${data.client.fullName} requested a ${data.reading.type} reading`,
              icon: '/favicon.ico',
              badge: '/favicon.ico'
            });
          }
        }
      }

      // Handle call setup ready (after reader accepts)
      else if (data.type === 'CALL_SETUP_READY') {
        if (data.readerId === user.id) {
          setState(prev => ({
            ...prev,
            notifications: prev.notifications.filter(n => n.reading.id !== data.readingId)
          }));
        }
      }

      // Handle reading status updates
      else if (data.type === 'reading_started' || data.type === 'reading_completed') {
        setState(prev => ({
          ...prev,
          notifications: prev.notifications.filter(n => n.reading.id !== data.reading?.id)
        }));
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }, [lastMessage, user, playNotificationAudio]);

  // Request notification permission on component mount
  useEffect(() => {
    if (user?.role === 'reader' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  // Accept a reading request
  const acceptReading = useCallback(async (readingId: number) => {
    try {
      const response = await fetch(`/api/readings/${readingId}/accept`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to accept reading');
      }

      // Remove the notification from the list
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.reading.id !== readingId),
        unreadCount: Math.max(0, prev.unreadCount - 1)
      }));

      return true;
    } catch (error) {
      console.error('Error accepting reading:', error);
      return false;
    }
  }, []);

  // Decline a reading request
  const declineReading = useCallback(async (readingId: number) => {
    try {
      const response = await fetch(`/api/readings/${readingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'declined' })
      });

      if (!response.ok) {
        throw new Error('Failed to decline reading');
      }

      // Remove the notification from the list
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.reading.id !== readingId),
        unreadCount: Math.max(0, prev.unreadCount - 1)
      }));

      return true;
    } catch (error) {
      console.error('Error declining reading:', error);
      return false;
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: number) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1)
    }));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: [],
      unreadCount: 0
    }));
  }, []);

  // Toggle notification sound
  const toggleNotificationSound = useCallback(() => {
    setState(prev => ({
      ...prev,
      playNotificationSound: !prev.playNotificationSound
    }));
  }, []);

  // Update connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isConnected
    }));
  }, [isConnected]);

  return {
    ...state,
    acceptReading,
    declineReading,
    markAsRead,
    clearAllNotifications,
    toggleNotificationSound
  };
}