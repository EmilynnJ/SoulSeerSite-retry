import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-celestial flex flex-col justify-center items-center">
      <h1 className="font-heading text-6xl text-pink mb-4">404</h1>
      <p className="font-body text-xl text-white mb-6">The page you seek is lost in the stars.</p>
      <Link
        to="/"
        className="bg-pink text-white px-8 py-3 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
      >
        Return Home
      </Link>
    </div>
  );
}