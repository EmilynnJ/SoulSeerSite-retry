import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityManager } from "./availability-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  Users, 
  Calendar, 
  Clock, 
  Star, 
  TrendingUp, 
  Settings, 
  BarChart,
  MessageSquare,
  Video,
  Phone
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface Reading {
  id: number;
  clientId: number;
  readerId: number;
  type: string;
  status: string;
  duration: number;
  totalAmount: number;
  createdAt: string;
  completedAt: string;
  clientName?: string;
}

interface Session {
  id: number;
  clientId: number;
  readerId: number;
  type: string;
  status: string;
  duration: number;
  totalAmount: number;
  startedAt: string;
  endedAt: string;
  clientName?: string;
}

interface ReaderBalance {
  id: number;
  readerId: number;
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  lastPayout: string | null;
  nextScheduledPayout: string | null;
}

export function ReaderDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch reader's completed readings
  const { data: readings } = useQuery({
    queryKey: ['/api/readings/reader', user?.id],
    queryFn: () => apiRequest<Reading[]>(`/api/readings/reader/${user?.id}`),
    enabled: !!user && user.role === 'reader',
  });

  // Fetch reader's recent sessions
  const { data: sessions } = useQuery({
    queryKey: ['/api/sessions/reader', user?.id],
    queryFn: () => apiRequest<Session[]>(`/api/sessions/reader/${user?.id}`),
    enabled: !!user && user.role === 'reader',
  });

  // Fetch reader's balance
  const { data: balance } = useQuery({
    queryKey: ['/api/reader-balance', user?.id],
    queryFn: () => apiRequest<ReaderBalance>(`/api/reader-balance/${user?.id}`),
    enabled: !!user && user.role === 'reader',
  });

  // Calculate statistics
  const calculateStats = () => {
    if (!readings || !sessions || !balance) return {
      completedReadings: 0,
      totalClients: 0,
      totalMinutes: 0,
      averageRating: 0,
      totalEarnings: 0,
      pendingEarnings: 0,
      availableEarnings: 0
    };

    const uniqueClientIds = new Set([
      ...readings.map(r => r.clientId),
      ...sessions.map(s => s.clientId)
    ]);

    const totalMinutes = readings.reduce((sum, r) => sum + (r.duration || 0), 0) + 
                        sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      completedReadings: readings.filter(r => r.status === 'completed').length + 
                         sessions.filter(s => s.status === 'completed').length,
      totalClients: uniqueClientIds.size,
      totalMinutes,
      averageRating: 4.85, // Placeholder - would come from actual rating data
      totalEarnings: balance.lifetimeEarnings / 100,
      pendingEarnings: balance.pendingBalance / 100,
      availableEarnings: balance.availableBalance / 100
    };
  };

  const stats = calculateStats();

  // Recent activity for the dashboard
  const getRecentActivity = () => {
    if (!readings || !sessions) return [];
    
    const allActivity = [
      ...readings.map(reading => ({
        id: `reading-${reading.id}`,
        type: 'reading',
        date: new Date(reading.createdAt),
        data: reading
      })),
      ...sessions.map(session => ({
        id: `session-${session.id}`,
        type: 'session',
        date: new Date(session.startedAt || session.createdAt),
        data: session
      }))
    ];
    
    // Sort by date descending
    return allActivity
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5); // Get most recent 5
  };

  const recentActivity = getRecentActivity();

  if (!user || user.role !== 'reader') {
    return (
      <div className="p-4">
        <p>Reader dashboard is only available to users with reader privileges.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-alex">Reader Dashboard</h2>
          <p className="text-muted-foreground">Manage your readings and availability</p>
        </div>
        <Badge variant={user.isOnline ? "default" : "outline"}>
          {user.isOnline ? "Online" : "Offline"}
        </Badge>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Users className="h-4 w-4 mr-2 text-primary" />
                  Total Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalClients}</div>
                <p className="text-xs text-muted-foreground">Unique clients served</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  Reading Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMinutes} min</div>
                <p className="text-xs text-muted-foreground">Total minutes of readings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Star className="h-4 w-4 mr-2 text-primary" />
                  Average Rating
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.averageRating}</div>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-4 w-4 ${i < Math.floor(stats.averageRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-primary" />
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Lifetime earnings</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart className="h-5 w-5 mr-2" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your latest readings and sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => {
                      const data = activity.data;
                      const isReading = activity.type === 'reading';
                      const typeIcon = data.type === 'chat' ? (
                        <MessageSquare className="h-4 w-4" />
                      ) : data.type === 'video' ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <Phone className="h-4 w-4" />
                      );
                      
                      return (
                        <div key={activity.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`rounded-full p-2 mr-3 ${data.type === 'chat' ? 'bg-blue-100' : data.type === 'video' ? 'bg-purple-100' : 'bg-green-100'}`}>
                              {typeIcon}
                            </div>
                            <div>
                              <p className="font-medium">
                                {isReading ? 'Reading' : 'Session'} with {data.clientName || `Client #${data.clientId}`}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {data.type} • {data.duration || 0} min • ${((data.totalAmount || 0) / 100).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(activity.date, 'MMM d, h:mm a')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-6">No recent activity to display</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Earnings Status
                </CardTitle>
                <CardDescription>Your current balance and payouts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Available for Payout</span>
                      <span className="font-bold">${stats.availableEarnings.toFixed(2)}</span>
                    </div>
                    <Progress value={stats.availableEarnings > 0 ? 100 : 0} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Pending Earnings</span>
                      <span className="font-bold">${stats.pendingEarnings.toFixed(2)}</span>
                    </div>
                    <Progress value={75} className="h-2" />
                    <p className="text-xs text-muted-foreground">Funds will be available after sessions are reviewed</p>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-medium mb-2">Next Payout</h4>
                    <p className="text-sm">
                      {balance?.nextScheduledPayout ? 
                        format(new Date(balance.nextScheduledPayout), 'MMMM d, yyyy') : 
                        'Automatic when balance exceeds $15'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <AvailabilityManager readerId={user.id} />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Upcoming Scheduled Readings
              </CardTitle>
              <CardDescription>Manage your booked sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {readings && readings.filter(r => r.status === 'scheduled').length > 0 ? (
                <div className="space-y-4">
                  {readings
                    .filter(r => r.status === 'scheduled')
                    .map(reading => (
                      <div key={reading.id} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">Reading with {reading.clientName || `Client #${reading.clientId}`}</p>
                          <p className="text-sm text-muted-foreground">
                            {reading.type} • {reading.duration || 30} min
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{format(new Date(reading.scheduledAt || reading.createdAt), 'MMM d, yyyy')}</p>
                          <p className="text-sm text-muted-foreground">{format(new Date(reading.scheduledAt || reading.createdAt), 'h:mm a')}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-6">No upcoming scheduled readings</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Earnings Overview
              </CardTitle>
              <CardDescription>Your revenue and payout history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm font-medium mb-1">Available Balance</p>
                  <p className="text-2xl font-bold">${stats.availableEarnings.toFixed(2)}</p>
                </div>
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm font-medium mb-1">Pending Balance</p>
                  <p className="text-2xl font-bold">${stats.pendingEarnings.toFixed(2)}</p>
                </div>
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm font-medium mb-1">Lifetime Earnings</p>
                  <p className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</p>
                </div>
              </div>

              {/* Revenue breakdown by service type */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Revenue by Service</h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Chat Sessions</span>
                      <span>35%</span>
                    </div>
                    <Progress value={35} className="h-2" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Voice Sessions</span>
                      <span>25%</span>
                    </div>
                    <Progress value={25} className="h-2" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Video Sessions</span>
                      <span>40%</span>
                    </div>
                    <Progress value={40} className="h-2" />
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-medium mb-3">Recent Payouts</h3>
              {/* List of payouts would go here */}
              <p className="text-center text-muted-foreground py-4">No payouts to display yet</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Service Settings
              </CardTitle>
              <CardDescription>Configure your pricing and session options</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium mb-4">Pricing Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-md p-4">
                      <p className="font-medium flex items-center mb-2">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat Reading
                      </p>
                      <p className="text-2xl font-bold mb-1">${(user.pricingChat || 0) / 100}/min</p>
                      <Button variant="outline" size="sm" className="w-full">
                        Edit Price
                      </Button>
                    </div>
                    <div className="border rounded-md p-4">
                      <p className="font-medium flex items-center mb-2">
                        <Phone className="h-4 w-4 mr-2" />
                        Voice Reading
                      </p>
                      <p className="text-2xl font-bold mb-1">${(user.pricingVoice || 0) / 100}/min</p>
                      <Button variant="outline" size="sm" className="w-full">
                        Edit Price
                      </Button>
                    </div>
                    <div className="border rounded-md p-4">
                      <p className="font-medium flex items-center mb-2">
                        <Video className="h-4 w-4 mr-2" />
                        Video Reading
                      </p>
                      <p className="text-2xl font-bold mb-1">${(user.pricingVideo || 0) / 100}/min</p>
                      <Button variant="outline" size="sm" className="w-full">
                        Edit Price
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Session Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-md p-4">
                      <p className="font-medium mb-2">Minimum Session Length</p>
                      <p className="text-2xl font-bold mb-1">{user.minimumSessionLength || 15} minutes</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        The minimum duration for any reading session
                      </p>
                      <Button variant="outline" size="sm">
                        Edit Minimum
                      </Button>
                    </div>
                    <div className="border rounded-md p-4">
                      <p className="font-medium mb-2">Session Types</p>
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center">
                          <Checkbox id="chat" checked disabled />
                          <label htmlFor="chat" className="ml-2 text-sm">Chat Reading</label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="voice" checked disabled />
                          <label htmlFor="voice" className="ml-2 text-sm">Voice Reading</label>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="video" checked disabled />
                          <label htmlFor="video" className="ml-2 text-sm">Video Reading</label>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        All Types Enabled
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}