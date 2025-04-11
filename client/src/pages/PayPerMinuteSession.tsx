import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  UserSearch, 
  ArrowLeft, 
  Video, 
  PhoneCall, 
  MessageSquare,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { SessionControls } from '@/components/session/SessionControls';
import { SessionTimer } from '@/components/session/SessionTimer';
import { ClientBalance } from '@/components/session/ClientBalance';

export function PayPerMinuteSession() {
  const [_, params] = useParams();
  const readerId = params?.readerId;
  const [location, navigate] = useLocation();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('controls');
  const { toast } = useToast();

  // Fetch reader details
  const {
    data: reader,
    isLoading: isLoadingReader,
    error: readerError
  } = useQuery({
    queryKey: [`/api/readers/${readerId}`],
    enabled: !!readerId,
    refetchOnWindowFocus: false
  });

  // Check for active session
  const {
    data: activeSessionData,
    isLoading: isCheckingSession,
    error: sessionCheckError
  } = useQuery({
    queryKey: ['/api/sessions/active'],
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Effect to set active session if one exists
  useEffect(() => {
    if (activeSessionData?.session) {
      setActiveSession({
        session: activeSessionData.session,
        reading: activeSessionData.reading,
        otherUser: activeSessionData.otherUser
      });
      setActiveTab('session');
    }
  }, [activeSessionData]);

  // Start session after initialization
  const { mutate: startSession, isPending: isStartingSession } = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start session');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Session started',
        description: 'Your reading session has started.',
        variant: 'default'
      });
      
      // Update the session with latest data
      setActiveSession(prevSession => ({
        ...prevSession,
        session: data.session
      }));
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to start session',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Handle session initialization
  const handleSessionInitialized = (data: any) => {
    setActiveSession({
      session: data.session,
      reading: data.reading,
      ratePerMinute: data.ratePerMinute,
      initialDuration: data.initialDuration,
      roomId: data.roomId
    });
    
    setActiveTab('session');
    
    // Start the session
    startSession(data.session._id);
  };

  // Handle session end
  const handleSessionEnd = () => {
    // Navigate back to the reader profile
    setActiveSession(null);
    setActiveTab('controls');
    toast({
      title: 'Session ended',
      description: 'Your reading session has ended.',
      variant: 'default'
    });
  };

  if (isLoadingReader || isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium">Loading session data...</p>
      </div>
    );
  }

  if (readerError) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Unable to load reader information. Please try again.
          </AlertDescription>
        </Alert>
        
        <Button onClick={() => navigate('/readers')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Readers
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* Back button */}
      <Button 
        variant="ghost" 
        onClick={() => navigate(`/readers/${readerId}`)} 
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> 
        Back to Reader Profile
      </Button>
      
      {/* Reader info */}
      {reader && (
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="h-16 w-16">
            <AvatarImage src={reader.profileImage || undefined} alt={reader.fullName} />
            <AvatarFallback>{reader.fullName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{reader.fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-primary/10">
                {reader.isOnline ? 'Online' : 'Offline'}
              </Badge>
              <Badge variant="outline" className="bg-muted">
                @{reader.username}
              </Badge>
            </div>
          </div>
        </div>
      )}
      
      {/* Session tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="controls" disabled={!!activeSession}>
            <Clock className="h-4 w-4 mr-2" />
            Pay-Per-Minute Controls
          </TabsTrigger>
          <TabsTrigger value="session" disabled={!activeSession}>
            {activeSession?.session?.type === 'video' && <Video className="h-4 w-4 mr-2" />}
            {activeSession?.session?.type === 'audio' && <PhoneCall className="h-4 w-4 mr-2" />}
            {activeSession?.session?.type === 'chat' && <MessageSquare className="h-4 w-4 mr-2" />}
            Active Session
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="controls" className="mt-0">
          {reader && (
            <SessionControls 
              reader={reader} 
              onSessionStart={handleSessionInitialized} 
            />
          )}
        </TabsContent>
        
        <TabsContent value="session" className="mt-0">
          {activeSession ? (
            <div className="grid md:grid-cols-2 gap-6">
              <SessionTimer 
                sessionId={activeSession.session._id}
                initialSessionData={{
                  minuteRate: activeSession.session.minuteRate,
                  initialDuration: activeSession.session.initialDuration,
                  remainingMinutes: activeSession.session.remainingMinutes,
                  billedMinutes: activeSession.session.billedMinutes
                }}
                onSessionEnd={handleSessionEnd}
              />
              
              <ClientBalance />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[30vh]">
              <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No active session</p>
              <p className="text-muted-foreground mb-4">
                Start a session using the controls tab
              </p>
              <Button onClick={() => setActiveTab('controls')}>
                Go to Controls
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PayPerMinuteSession;