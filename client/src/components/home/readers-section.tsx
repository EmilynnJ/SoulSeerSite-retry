import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { 
  MessageCircle, 
  Phone, 
  Video, 
  Star,
  Clock,
  Users,
  ArrowRight,
  Sparkles
} from "lucide-react";

interface Reader {
  id: number;
  username: string;
  fullName: string;
  profileImage?: string;
  bio: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  isOnline: boolean;
  pricingChat?: number;
  pricingVoice?: number;
  pricingVideo?: number;
}

export function ReadersSection() {
  const [onlineReaders, setOnlineReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOnlineReaders();
  }, []);

  const fetchOnlineReaders = async () => {
    try {
      const response = await fetch('/api/readers/online');
      if (response.ok) {
        const readers = await response.json();
        setOnlineReaders(readers.slice(0, 6)); // Show only first 6
      }
    } catch (error) {
      console.error('Failed to fetch online readers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents?: number) => {
    if (!cents) return 'N/A';
    return `$${(cents / 100).toFixed(2)}/min`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (loading) {
    return (
      <section className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-alex text-pink-500 mb-4">
            Featured Readers Online Now
          </h2>
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-gray-800/50 rounded-lg h-64"></div>
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
          <Sparkles className="text-pink-400 h-6 w-6 mr-2 animate-pulse" />
          <h2 className="text-4xl font-alex text-pink-500">
            Featured Readers Online Now
          </h2>
          <Sparkles className="text-pink-400 h-6 w-6 ml-2 animate-pulse" />
        </div>
        <p className="font-playfair text-gray-300 text-lg max-w-2xl mx-auto">
          Connect instantly with our verified psychic readers who are available right now
        </p>
      </div>

      {onlineReaders.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-playfair text-gray-300 mb-2">
            No readers online at the moment
          </h3>
          <p className="text-gray-400 mb-6">
            Check back soon or browse all our available readers
          </p>
          <Link href="/readers">
            <Button className="bg-pink-600 hover:bg-pink-700">
              Browse All Readers
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {onlineReaders.map((reader) => (
              <Card key={reader.id} className="bg-gray-900/80 border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 group">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Avatar className="h-16 w-16 border-2 border-pink-500/30">
                        <AvatarImage src={reader.profileImage} />
                        <AvatarFallback className="bg-pink-900/50 text-pink-200">
                          {getInitials(reader.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      {reader.isOnline && (
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 border-2 border-gray-900 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg font-playfair text-white group-hover:text-pink-400 transition-colors">
                        {reader.fullName}
                      </CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-300 ml-1">
                            {reader.rating || 5.0}
                          </span>
                        </div>
                        <span className="text-gray-500">•</span>
                        <span className="text-sm text-gray-400">
                          {reader.reviewCount || 0} reviews
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-gray-300 text-sm line-clamp-2 font-playfair">
                    {reader.bio || 'Experienced psychic reader ready to provide guidance.'}
                  </p>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-1">
                    {(reader.specialties || ['Psychic', 'Tarot']).slice(0, 3).map((specialty, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-pink-500/30 text-pink-200">
                        {specialty}
                      </Badge>
                    ))}
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="space-y-1">
                      <MessageCircle className="h-4 w-4 mx-auto text-blue-400" />
                      <div className="text-xs text-gray-400">Chat</div>
                      <div className="text-xs font-semibold text-white">
                        {formatPrice(reader.pricingChat)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Phone className="h-4 w-4 mx-auto text-green-400" />
                      <div className="text-xs text-gray-400">Voice</div>
                      <div className="text-xs font-semibold text-white">
                        {formatPrice(reader.pricingVoice)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Video className="h-4 w-4 mx-auto text-purple-400" />
                      <div className="text-xs text-gray-400">Video</div>
                      <div className="text-xs font-semibold text-white">
                        {formatPrice(reader.pricingVideo)}
                      </div>
                    </div>
                  </div>

                  <Link href={`/readers/${reader.id}`}>
                    <Button className="w-full bg-pink-600 hover:bg-pink-700 group-hover:shadow-lg transition-all">
                      Start Reading
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center">
            <Link href="/readers">
              <Button variant="outline" size="lg" className="border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white">
                <Users className="mr-2 h-5 w-5" />
                View All Readers
              </Button>
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
