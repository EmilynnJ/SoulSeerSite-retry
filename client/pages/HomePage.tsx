import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import apiInstance from "../src/lib/api";

const HERO_IMG = "https://i.postimg.cc/tRLSgCPb/HERO-IMAGE-1.jpg";
const BG_IMG = "https://i.postimg.cc/sXdsKGTK/DALL-E-2025-06-06-14-36-29-A-vivid-ethereal-background-image-designed-for-a-psychic-reading-app.webp";

export default function HomePage() {
  // Fetch online readers
  const { data: readers, isLoading } = useQuery({
    queryKey: ["onlineReaders"],
    queryFn: async () => {
      const { data } = await apiInstance.get("/api/readers/online");
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-celestial flex flex-col">
      {/* Background Cosmic Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={BG_IMG}
          alt="Celestial Background"
          className="object-cover w-full h-full opacity-80"
          style={{ zIndex: -1, filter: "brightness(0.7)" }}
        />
      </div>
      {/* Header */}
      <header className="relative z-10 flex flex-col items-center pt-12 pb-8">
        <h1 className="font-heading text-5xl md:text-6xl text-pink drop-shadow-glow animate-fade-in">
          SoulSeer
        </h1>
        <img
          src={HERO_IMG}
          alt="Hero"
          className="rounded-lg shadow-lg mt-6 w-80 md:w-[450px] animate-fade-in"
          style={{ boxShadow: "0 0 40px #FF69B4" }}
        />
        <h2 className="font-body text-2xl md:text-3xl text-gold mt-6 animate-fade-in">
          A Community of Gifted Psychics
        </h2>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/readings">
            <button className="bg-pink text-white px-8 py-3 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition">
              Book a Reading
            </button>
          </Link>
          <Link to="/live">
            <button className="bg-gold text-black px-8 py-3 rounded-full font-bold shadow-glow hover:bg-pink hover:text-white transition">
              Watch Live Streams
            </button>
          </Link>
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10">
        {/* Online Readers Preview */}
        <section className="w-full max-w-5xl mt-8 p-6 bg-black bg-opacity-60 rounded-xl shadow-xl animate-fade-in">
          <h3 className="font-heading text-2xl text-pink mb-4">Currently Online Readers</h3>
          <div className="flex gap-6 flex-wrap justify-center">
            {isLoading ? (
              <div className="text-gold font-body text-lg">Loading readers...</div>
            ) : readers && readers.length > 0 ? (
              readers.map((reader: any) => (
                <Link
                  to={`/readings/${reader.id}`}
                  key={reader.id}
                  className="bg-celestial border-2 border-pink rounded-lg p-4 w-56 flex flex-col items-center hover:shadow-glow transition"
                >
                  <img
                    src={reader.profileImage || "https://i.postimg.cc/s2ds9RtC/FOUNDER.jpg"}
                    alt={reader.fullName}
                    className="w-24 h-24 rounded-full border-4 border-gold shadow-lg mb-2"
                  />
                  <div className="font-bold text-lg text-white">{reader.fullName}</div>
                  <div className="text-gold font-body">{reader.specialties?.join(", ") || "Psychic Readings"}</div>
                  <div className="mt-2 text-white font-body text-sm">
                    <span className="text-pink font-bold">${(reader.pricingChat ?? reader.pricing ?? 100) / 100}/min</span> Chat
                  </div>
                  <button className="mt-3 px-5 py-2 bg-pink text-white rounded-full font-bold hover:bg-gold hover:text-black transition">
                    View Profile
                  </button>
                </Link>
              ))
            ) : (
              <div className="text-gold font-body text-lg">No readers are online at the moment. Please check back soon!</div>
            )}
          </div>
        </section>
        {/* Announcements/Promos */}
        <section className="w-full max-w-5xl mt-8 p-6 bg-black bg-opacity-60 rounded-xl shadow-xl animate-fade-in">
          <h3 className="font-heading text-2xl text-pink mb-4">News & Offers</h3>
          <ul className="list-disc list-inside text-white font-body">
            <li>
              <span className="text-gold">✨ New:</span> Join <Link to="/community" className="underline text-pink">our vibrant forum</Link>!
            </li>
            <li>
              <span className="text-gold">🌙 Special:</span> Reader applications now open for September cohort!
            </li>
            <li>
              <span className="text-gold">🔮 Promo:</span> 20% bonus on first account funding this month!
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}