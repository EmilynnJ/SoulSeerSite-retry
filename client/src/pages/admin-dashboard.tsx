import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  UserPlus, 
  Eye, 
  DollarSign, 
  Activity,
  TrendingUp,
  Settings,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedTab, setSelectedTab] = useState('overview');
  const [createReaderOpen, setCreateReaderOpen] = useState(false);
  const [readerForm, setReaderForm] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    bio: '',
    specialties: '',
    pricingChat: 500,
    pricingVoice: 600,
    pricingVideo: 800
  });

  // Redirect if not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Admin privileges required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Create reader (placeholder - will be connected to API later)
  const createReader = async () => {
    try {
      const response = await fetch('/api/readers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/form-data' },
        body: new FormData(document.getElementById('reader-form') as HTMLFormElement)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Reader account created successfully"
        });
        setCreateReaderOpen(false);
        setReaderForm({
          username: '',
          email: '',
          password: '',
          fullName: '',
          bio: '',
          specialties: '',
          pricingChat: 500,
          pricingVoice: 600,
          pricingVideo: 800
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to create reader",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating reader:', error);
      toast({
        title: "Error",
        description: "Failed to create reader",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-alex text-pink-500 mb-2">Admin Dashboard</h1>
          <p className="font-playfair text-muted-foreground">Platform management and oversight</p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="readings">Readings</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  Analytics coming soon
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Readers</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  Analytics coming soon
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  Analytics coming soon
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
                <p className="text-xs text-muted-foreground">
                  Analytics coming soon
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Platform Analytics
              </CardTitle>
              <CardDescription>
                Advanced analytics and reporting will be available here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>Analytics dashboard coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-alex text-pink-500">User Management</h2>
            <Dialog open={createReaderOpen} onOpenChange={setCreateReaderOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Reader
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Reader Account</DialogTitle>
                  <DialogDescription>
                    Create a new reader account through the admin dashboard
                  </DialogDescription>
                </DialogHeader>
                <form id="reader-form" className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        name="username"
                        value={readerForm.username}
                        onChange={(e) => setReaderForm({...readerForm, username: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={readerForm.email}
                        onChange={(e) => setReaderForm({...readerForm, email: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        value={readerForm.fullName}
                        onChange={(e) => setReaderForm({...readerForm, fullName: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        value={readerForm.password}
                        onChange={(e) => setReaderForm({...readerForm, password: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={readerForm.bio}
                      onChange={(e) => setReaderForm({...readerForm, bio: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="specialties">Specialties (comma separated)</Label>
                    <Input
                      id="specialties"
                      name="specialties"
                      value={readerForm.specialties}
                      onChange={(e) => setReaderForm({...readerForm, specialties: e.target.value})}
                      placeholder="Tarot, Psychic, Love Readings"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="pricingChat">Chat Rate (cents/min)</Label>
                      <Input
                        id="pricingChat"
                        name="ratePerMinute"
                        type="number"
                        value={readerForm.pricingChat}
                        onChange={(e) => setReaderForm({...readerForm, pricingChat: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="pricingVoice">Voice Rate (cents/min)</Label>
                      <Input
                        id="pricingVoice"
                        type="number"
                        value={readerForm.pricingVoice}
                        onChange={(e) => setReaderForm({...readerForm, pricingVoice: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="pricingVideo">Video Rate (cents/min)</Label>
                      <Input
                        id="pricingVideo"
                        type="number"
                        value={readerForm.pricingVideo}
                        onChange={(e) => setReaderForm({...readerForm, pricingVideo: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                </form>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateReaderOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createReader}>Create Reader</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage platform users and reader accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>User management interface coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Readings Tab */}
        <TabsContent value="readings" className="space-y-6">
          <h2 className="text-2xl font-alex text-pink-500">Reading Management</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>All Readings</CardTitle>
              <CardDescription>Monitor and manage platform readings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>Reading management interface coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-alex text-pink-500">Product Management</h2>
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              Manage Products
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Stripe Product Integration</CardTitle>
              <CardDescription>Manage marketplace inventory and Stripe integration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>Product management interface coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
