import React from 'react';
import { Bell, Check, X, Phone, Video, MessageCircle, Clock, DollarSign, Volume2, VolumeX } from 'lucide-react';
import { useReaderNotifications, ReadingRequest } from '@/hooks/use-reader-notifications';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function ReaderNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    notifications,
    unreadCount,
    isConnected,
    playNotificationSound,
    acceptReading,
    declineReading,
    markAsRead,
    clearAllNotifications,
    toggleNotificationSound
  } = useReaderNotifications();

  // Don't show for non-readers
  if (!user || user.role !== 'reader') {
    return null;
  }

  const handleAcceptReading = async (readingId: number) => {
    const success = await acceptReading(readingId);
    if (success) {
      toast({
        title: "Reading Accepted",
        description: "You've accepted the reading request. The client will be notified.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to accept the reading. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeclineReading = async (readingId: number) => {
    const success = await declineReading(readingId);
    if (success) {
      toast({
        title: "Reading Declined",
        description: "You've declined the reading request.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to decline the reading. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getReadingTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'voice':
        return <Phone className="h-4 w-4" />;
      case 'chat':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getReadingTypeColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'voice':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'chat':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const formatPrice = (pricePerMinute: number) => {
    return `$${(pricePerMinute / 100).toFixed(2)}/min`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          title="Reading Notifications"
        >
          <Bell className={`h-5 w-5 ${!isConnected ? 'text-gray-400' : ''}`} />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs bg-red-500 hover:bg-red-500"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-alex">
                Reading Requests
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="notification-sound" className="sr-only">
                    Sound notifications
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleNotificationSound}
                    title={playNotificationSound ? "Disable sound" : "Enable sound"}
                  >
                    {playNotificationSound ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllNotifications}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>
            {!isConnected && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-md">
                ⚠️ Connection lost. Reconnecting...
              </div>
            )}
          </CardHeader>
          
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-playfair">No new reading requests</p>
                <p className="text-sm mt-1">
                  You'll be notified when clients request readings
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-0">
                  {notifications.map((notification, index) => (
                    <div key={notification.id}>
                      <NotificationItem
                        notification={notification}
                        onAccept={handleAcceptReading}
                        onDecline={handleDeclineReading}
                        onMarkAsRead={markAsRead}
                        getReadingTypeIcon={getReadingTypeIcon}
                        getReadingTypeColor={getReadingTypeColor}
                        formatPrice={formatPrice}
                      />
                      {index < notifications.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  notification: ReadingRequest;
  onAccept: (readingId: number) => void;
  onDecline: (readingId: number) => void;
  onMarkAsRead: (notificationId: number) => void;
  getReadingTypeIcon: (type: string) => React.ReactNode;
  getReadingTypeColor: (type: string) => string;
  formatPrice: (pricePerMinute: number) => string;
}

function NotificationItem({
  notification,
  onAccept,
  onDecline,
  onMarkAsRead,
  getReadingTypeIcon,
  getReadingTypeColor,
  formatPrice
}: NotificationItemProps) {
  const { reading, client } = notification;
  
  return (
    <div className="p-4 hover:bg-muted/50 transition-colors">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
              {client.fullName?.charAt(0) || client.username.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-sm">{client.fullName}</p>
              <p className="text-xs text-muted-foreground">@{client.username}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
          </div>
        </div>

        {/* Reading Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className={getReadingTypeColor(reading.type)} variant="outline">
              {getReadingTypeIcon(reading.type)}
              <span className="ml-1 capitalize">{reading.type}</span>
            </Badge>
            <Badge variant="outline" className="text-xs">
              <DollarSign className="h-3 w-3 mr-1" />
              {formatPrice(reading.pricePerMinute)}
            </Badge>
            {reading.readingMode === 'scheduled' && reading.scheduledFor && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Scheduled
              </Badge>
            )}
          </div>

          {reading.notes && (
            <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              "{reading.notes}"
            </p>
          )}

          {reading.readingMode === 'scheduled' && reading.scheduledFor && (
            <p className="text-sm">
              <span className="font-medium">Scheduled for:</span>{' '}
              {new Date(reading.scheduledFor).toLocaleDateString()} at{' '}
              {new Date(reading.scheduledFor).toLocaleTimeString()}
            </p>
          )}

          {reading.duration && (
            <p className="text-sm">
              <span className="font-medium">Duration:</span> {reading.duration} minutes
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => onAccept(reading.id)}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDecline(reading.id)}
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <X className="h-4 w-4 mr-1" />
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}