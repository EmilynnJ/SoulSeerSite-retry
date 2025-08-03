import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-black bg-opacity-70 text-white font-body py-8 text-center">
      <div className="flex flex-wrap justify-center gap-6 mb-2">
        <Link to="/about" className="hover:text-pink transition">About</Link>
        <Link to="/policies" className="hover:text-pink transition">Policies</Link>
        <Link to="/help" className="hover:text-pink transition">Help Center</Link>
        <Link to="/community" className="hover:text-pink transition">Community</Link>
      </div>
      <div>
        &copy; {new Date().getFullYear()} SoulSeer. All rights reserved.
      </div>
    </footer>
  );
}