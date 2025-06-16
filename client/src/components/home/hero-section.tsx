import React from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Sparkles, Star, Moon } from "lucide-react";

export function HeroSection() {
  const { user } = useAuth();

  return (
    <section className="text-center py-16 space-y-8">
      {/* Main Header - As specified in build guide */}
      <div className="space-y-6">
        <h1 className="text-6xl md:text-8xl font-alex text-pink-500 mb-4 tracking-wide">
          SoulSeer
        </h1>
        
        {/* Hero Image - As specified in build guide */}
        <div className="mx-auto max-w-2xl mb-6">
          <img 
            src="https://i.postimg.cc/tRLSgCPb/HERO-IMAGE-1.jpg" 
            alt="SoulSeer - Mystical Reading Experience"
            className="w-full h-auto rounded-lg shadow-2xl border border-pink-500/20"
          />
        </div>
        
        {/* Tagline - As specified in build guide */}
        <h2 className="text-2xl md:text-4xl font-playfair text-white mb-8">
          A Community of Gifted Psychics
        </h2>
        
        <p className="text-lg md:text-xl font-playfair text-gray-200 max-w-3xl mx-auto leading-relaxed">
          Connect with verified psychic readers for authentic spiritual guidance. 
          Experience personalized readings through chat, voice, or video sessions.
        </p>
      </div>

      {/* Mystical decorative elements */}
      <div className="flex justify-center items-center space-x-8 my-8">
        <Sparkles className="text-pink-400 h-6 w-6 animate-pulse" />
        <Star className="text-yellow-400 h-8 w-8 animate-twinkle" />
        <Moon className="text-blue-300 h-6 w-6 animate-pulse" />
      </div>

      {/* Call to Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
        {!user ? (
          <>
            <Link href="/auth">
              <Button size="lg" className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white font-playfair">
                Get Your Reading
              </Button>
            </Link>
            <Link href="/readers">
              <Button variant="outline" size="lg" className="w-full sm:w-auto border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white font-playfair">
                Browse Readers
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/readers">
              <Button size="lg" className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white font-playfair">
                Find a Reader
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="w-full sm:w-auto border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white font-playfair">
                My Dashboard
              </Button>
            </Link>
          </>
        )}
      </div>

      {/* Trust indicators */}
      <div className="mt-12 pt-8 border-t border-pink-500/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-bold text-pink-500 mb-2">24/7</div>
            <div className="font-playfair text-gray-300">Available Anytime</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-pink-500 mb-2">100%</div>
            <div className="font-playfair text-gray-300">Verified Readers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-pink-500 mb-2">Private</div>
            <div className="font-playfair text-gray-300">Secure Sessions</div>
          </div>
        </div>
      </div>
    </section>
  );
}
