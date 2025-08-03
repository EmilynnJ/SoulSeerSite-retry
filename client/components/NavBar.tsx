import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/readings", label: "Readings" },
  { to: "/live", label: "Live" },
  { to: "/shop", label: "Shop" },
  { to: "/community", label: "Community" },
  { to: "/messages", label: "Messages" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/help", label: "Help" },
];

export default function NavBar() {
  const navigate = useNavigate();
  const { user } = useUser();

  return (
    <nav className="bg-black bg-opacity-80 shadow-lg py-3 px-7 flex items-center justify-between z-50 relative">
      <div className="flex items-center gap-3">
        <Link to="/" className="font-heading text-3xl text-pink tracking-wide">
          SoulSeer
        </Link>
        <span className="hidden md:inline-block h-8 border-l-2 border-pink mx-3" />
        <div className="flex gap-3">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="font-body text-lg text-white hover:text-pink transition"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <SignedIn>
          <div className="flex items-center gap-3">
            <span className="text-white font-body text-base hidden md:inline">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
        <SignedOut>
          <button
            className="bg-pink text-white px-5 py-2 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
            onClick={() => navigate("/signin")}
          >
            Sign In
          </button>
        </SignedOut>
      </div>
    </nav>
  );
}