import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { 
  Radio, 
  Eye, 
  Clock,
  ArrowRight,
  Calendar,
  Zap,
  Gift
} from "lucide-react";

interface Livestream {
  id: number;
  title: string;
  description: string;
  thumbnailUrl?: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduledFor?: Date;
  startedAt?: Date;
  viewerCount: number;
  category: string;
  userId: number;
  user?: {
    fullName: string;
    profileImage?: string;
  };
}

export function LiveSection() {
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLivestreams();
  }, []);

  const fetchLivestreams = async () => {
    try {
      const response = await fetch('/api/livestreams');
      if (response.ok) {
        const streams = await response.json();
        setLivestreams(streams.slice(0, 4)); // Show only first 4
      }
    } catch (error) {
      console.error('Failed to fetch livestreams:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
  };

  const formatViewerCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  if (loading) {
    return (
      <section className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-alex text-pink-500 mb-4">
            Live Spiritual Sessions
          </h2>
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-gray-800/50 rounded-lg h-48"></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <Radio className="text-red-500 h-6 w-6 mr-2 animate-pulse" />
          <h2 className="text-4xl font-alex text-pink-500">
            Live Spiritual Sessions
          </h2>
          <Radio className="text-red-500 h-6 w-6 ml-2 animate-pulse" />
        </div>
        <p className="font-playfair text-gray-300 text-lg max-w-2xl mx-auto">
          Join live group readings, Q&A sessions, and spiritual discussions with our gifted readers
        </p>
      </div>

      {livestreams.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-playfair text-gray-300 mb-2">
            No live sessions at the moment
          </h3>
          <p className="text-gray-400 mb-6">
            Check back soon for upcoming live spiritual sessions and group readings
          </p>
          <Link href="/live">
            <Button className="bg-pink-600 hover:bg-pink-700">
              View Schedule
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {livestreams.map((stream) => (
              <Card key={stream.id} className="bg-gray-900/80 border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 group overflow-hidden">
                <div className="relative">
                  {/* Thumbnail or placeholder */}
                  <div className="aspect-video bg-gradient-to-br from-pink-900/50 to-purple-900/50 relative">
                    {stream.thumbnailUrl ? (
                      <img 
                        src={stream.thumbnailUrl} 
                        alt={stream.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Zap className="h-12 w-12 text-pink-400 opacity-50" />
                      </div>
                    )}
                    
                    {/* Status overlay */}
                    <div className="absolute top-2 left-2">
                      {stream.status === 'live' ? (
                        <Badge className="bg-red-600 text-white animate-pulse">
                          <Radio className="h-3 w-3 mr-1" />
                          LIVE
                        </Badge>
                      ) : stream.status === 'scheduled' ? (
                        <Badge variant="outline" className="bg-black/50 border-yellow-500 text-yellow-400">
                          <Clock className="h-3 w-3 mr-1" />
                          SCHEDULED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-black/50 border-gray-500 text-gray-400">
                          ENDED
                        </Badge>
                      )}
                    </div>

                    {/* Viewer count */}
                    {stream.status === 'live' && (
                      <div className="absolute top-2 right-2 bg-black/70 rounded px-2 py-1 flex items-center">
                        <Eye className="h-3 w-3 text-white mr-1" />
                        <span className="text-white text-xs font-medium">
                          {formatViewerCount(stream.viewerCount)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={stream.user?.profileImage} />
                      <AvatarFallback className="bg-pink-900/50 text-pink-200 text-xs">
                        {getInitials(stream.user?.fullName || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {stream.user?.fullName || 'SoulSeer Reader'}
                      </p>
                      <p className="text-xs text-gray-400">{stream.category}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-playfair text-white font-medium line-clamp-2 group-hover:text-pink-400 transition-colors">
                      {stream.title}
                    </h3>
                    {stream.status === 'scheduled' && stream.scheduledFor && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(new Date(stream.scheduledFor))}
                      </p>
                    )}
                  </div>

                  <Link href={`/live/${stream.id}`}>
                    <Button 
                      size="sm" 
                      className={`w-full transition-all ${
                        stream.status === 'live' 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : stream.status === 'scheduled'
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }`}
                    >
                      {stream.status === 'live' ? (
                        <>
                          <Radio className="mr-2 h-4 w-4" />
                          Join Live
                        </>
                      ) : stream.status === 'scheduled' ? (
                        <>
                          <Clock className="mr-2 h-4 w-4" />
                          Set Reminder
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          Watch Replay
                        </>
                      )}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center">
            <Link href="/live">
              <Button variant="outline" size="lg" className="border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white">
                <Gift className="mr-2 h-5 w-5" />
                Explore All Live Sessions
              </Button>
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
