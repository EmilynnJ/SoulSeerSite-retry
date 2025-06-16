import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Livestream } from "@shared/schema";
import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { GlowCard } from "@/components/ui/glow-card";
import {
  MonitorPlay,
  Users,
  Clock,
  Search,
  Star,
  Calendar,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function LivestreamPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  const { data: livestreams, isLoading, error, refetch, isRefetching } = useQuery<Livestream[]>({
    queryKey: ["/api/livestreams"],
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // 30 seconds for live updates
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Debounced search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Memoized filtering
  const filteredLivestreams = useMemo(() => {
    if (!livestreams) return [];

    return livestreams.filter(stream => {
      const matchesSearch = 
        debouncedSearchTerm === "" || 
        stream.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        stream.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
        
      const matchesCategory = 
        selectedCategory === "all" || 
        stream.category === selectedCategory;
        
      return matchesSearch && matchesCategory;
    });
  }, [livestreams, debouncedSearchTerm, selectedCategory]);

  // Categorized streams
  const categorizedStreams = useMemo(() => {
    const active = filteredLivestreams.filter((stream: Livestream) => stream.status === "live");
    const upcoming = filteredLivestreams.filter((stream: Livestream) => stream.status === "scheduled");
    const completed = filteredLivestreams.filter((stream: Livestream) => stream.status === "ended");

    return { active, upcoming, completed };
  }, [filteredLivestreams]);

  // Event handlers
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  // Utility functions
  const formatDuration = (duration?: number): string => {
    if (!duration) return "0:00";
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (date?: Date | string | null): string => {
    if (!date) return 'Date TBA';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  const capitalizeCategory = (category: string): string => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Categories
  const categories = [
    { value: "all", label: "All Categories" },
    { value: "tarot", label: "Tarot Readings" },
    { value: "astrology", label: "Astrology" },
    { value: "meditation", label: "Meditation" },
    { value: "spiritual", label: "Spiritual Guidance" },
    { value: "psychic", label: "Psychic Readings" },
  ];

  // Livestream Card Component
  const LivestreamCard = ({ livestream, variant }: { livestream: Livestream; variant: 'live' | 'upcoming' | 'completed' }) => {
    const getStatusBadge = () => {
      if (variant === 'live') {
        return (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center animate-pulse">
            <MonitorPlay className="mr-1 h-3 w-3" />
            <span>LIVE</span>
          </div>
        );
      }
      if (variant === 'upcoming') {
        return (
          <div className="absolute top-2 left-2 bg-accent/80 text-white text-xs px-2 py-1 rounded-full flex items-center">
            <Calendar className="mr-1 h-3 w-3" />
            <span>UPCOMING</span>
          </div>
        );
      }
      return null;
    };

    const getActionButton = () => {
      const buttonClass = "w-full transition-all duration-200";
      
      if (variant === 'live') {
        return (
          <CelestialButton
            variant="default"
            className={`${buttonClass} bg-accent/80 hover:bg-accent hover:scale-105`}
            size="sm"
          >
            Join Stream
          </CelestialButton>
        );
      }
      if (variant === 'upcoming') {
        return (
          <CelestialButton
            variant="secondary"
            className={buttonClass}
            size="sm"
          >
            Set Reminder
          </CelestialButton>
        );
      }
      if (variant === 'completed') {
        return (
          <CelestialButton
            variant="secondary"
            className={buttonClass}
            size="sm"
          >
            Watch Recording
          </CelestialButton>
        );
      }
      return null;
    };

    return (
      <GlowCard className="rounded-2xl overflow-hidden p-0 hover:scale-105 transition-all duration-300">
        <div className="relative">
          <img
            src={livestream.thumbnailUrl || "/images/livestream-placeholder.jpg"}
            alt={`${livestream.title} thumbnail`}
            className="w-full h-48 object-cover"
            loading="lazy"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
              const target = e.target as HTMLImageElement;
              target.src = "/images/livestream-placeholder.jpg";
            }}
          />
          
          {getStatusBadge()}
          
          {variant === 'live' && (
            <div className="absolute top-2 right-2 bg-dark/70 text-white text-xs px-2 py-1 rounded-full flex items-center">
              <Users className="mr-1 h-3 w-3" />
              <span>{livestream.viewerCount || 0} Viewers</span>
            </div>
          )}
          
          {variant === 'completed' && livestream.duration && (
            <div className="absolute bottom-2 right-2 bg-dark/70 text-white text-xs px-2 py-1 rounded-full">
              <span>{formatDuration(livestream.duration)}</span>
            </div>
          )}
        </div>
        
        <div className="p-4">
          <h3 className="text-lg font-cinzel text-secondary mb-1 line-clamp-1" title={livestream.title}>
            {livestream.title}
          </h3>
          
          <p className="text-accent text-sm mb-2 font-playfair">
            {capitalizeCategory(livestream.category)}
          </p>
          
          {(variant === 'upcoming' || variant === 'completed') && (
            <div className="flex items-center mb-3 text-light/70">
              <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="text-sm">
                {variant === 'upcoming' 
                  ? formatDate(livestream.scheduledFor)
                  : formatDate(livestream.endedAt)
                }
              </span>
            </div>
          )}
          
          <p className="text-light/70 text-sm mb-4 line-clamp-2" title={livestream.description}>
            {livestream.description}
          </p>
          
          <Link href={`${PATHS.LIVE}/${livestream.id}`} className="block">
            {getActionButton()}
          </Link>
        </div>
      </GlowCard>
    );
  };

  // Loading Skeleton Component
  const LoadingSkeleton = ({ count = 3 }: { count?: number }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(count)].map((_, index) => (
        <GlowCard key={index} className="overflow-hidden p-0">
          <Skeleton className="w-full h-48" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full rounded-full" />
          </div>
        </GlowCard>
      ))}
    </div>
  );

  // Empty State Component
  const EmptyState = ({ icon: Icon, message }: { icon: any; message: string }) => (
    <div className="text-center py-12 border border-accent/10 rounded-lg bg-primary-dark/20">
      <Icon className="h-12 w-12 mx-auto mb-3 text-accent/40" />
      <p className="text-light/70 font-playfair max-w-md mx-auto">
        {message}
      </p>
    </div>
  );

  // Section Component
  const LivestreamSection = ({ 
    title, 
    icon: Icon, 
    livestreams, 
    variant, 
    isLoading, 
    emptyMessage, 
    emptyIcon: EmptyIcon 
  }: {
    title: string;
    icon: any;
    livestreams: Livestream[];
    variant: 'live' | 'upcoming' | 'completed';
    isLoading: boolean;
    emptyMessage: string;
    emptyIcon: any;
  }) => (
    <section className="mb-16" aria-labelledby={`${variant}-section-title`}>
      <div className="flex justify-between items-center mb-6">
        <h2 
          id={`${variant}-section-title`}
          className="text-3xl font-alex-brush text-secondary flex items-center"
        >
          <Icon className="mr-2" aria-hidden="true" />
          {title}
        </h2>
        {!isLoading && livestreams.length > 0 && (
          <span className="text-sm text-accent/70 font-playfair" aria-live="polite">
            {livestreams.length} {livestreams.length === 1 ? 'stream' : 'streams'}
          </span>
        )}
      </div>
      
      {isLoading ? (
        <LoadingSkeleton />
      ) : livestreams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {livestreams.map((livestream) => (
            <LivestreamCard
              key={livestream.id}
              livestream={livestream}
              variant={variant}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={EmptyIcon} message={emptyMessage} />
      )}
    </section>
  );

  // Error state
  if (error && !isLoading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="text-center py-16 border border-red-500/20 rounded-lg bg-red-500/5">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-cinzel text-secondary mb-2">
            Failed to load livestreams
          </h2>
          <p className="text-light/70 font-playfair mb-6 max-w-md mx-auto">
            We couldn't fetch the latest livestream data. Please check your connection and try again.
          </p>
          <CelestialButton
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            {isRefetching ? 'Retrying...' : 'Try Again'}
          </CelestialButton>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      {/* Header */}
      <header className="text-center mb-12 cosmic-bg p-8 rounded-lg" role="banner">
        <h1 className="text-4xl md:text-5xl font-alex-brush text-accent mb-4">
          Live Streams
        </h1>
        <p className="text-light/80 font-playfair max-w-3xl mx-auto">
          Join our psychic readers for live spiritual sessions, readings, and community events.
        </p>
      </header>
      
      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="md:col-span-2">
          <div className="relative">
            <Search 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent/50" 
              aria-hidden="true"
            />
            <Input 
              placeholder="Search livestreams..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 bg-primary-dark/30 border-accent/20 focus:border-accent/40 transition-colors"
              aria-label="Search livestreams"
            />
          </div>
          {searchTerm && (
            <p className="text-xs text-accent/70 mt-1" aria-live="polite">
              {filteredLivestreams.length} result{filteredLivestreams.length !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
        
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full h-10 px-3 py-2 bg-primary-dark/30 border border-accent/20 text-light rounded-md focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
            aria-label="Filter by category"
          >
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Live Now Section */}
      <LivestreamSection
        title="Live Now"
        icon={MonitorPlay}
        livestreams={categorizedStreams.active}
        variant="live"
        isLoading={isLoading}
        emptyMessage="No live streams at the moment. Check back later or browse scheduled events."
        emptyIcon={MonitorPlay}
      />
      
      {/* Upcoming Scheduled Section */}
      <LivestreamSection
        title="Upcoming Scheduled"
        icon={Calendar}
        livestreams={categorizedStreams.upcoming}
        variant="upcoming"
        isLoading={isLoading}
        emptyMessage="No upcoming streams scheduled at the moment."
        emptyIcon={Calendar}
      />
      
      {/* Past Recordings Section */}
      <LivestreamSection
        title="Past Recordings"
        icon={Star}
        livestreams={categorizedStreams.completed}
        variant="completed"
        isLoading={isLoading}
        emptyMessage="No past recordings available at the moment."
        emptyIcon={Star}
      />
    </div>
  );
}
