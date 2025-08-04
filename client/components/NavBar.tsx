import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import AddFundsModal from "./AddFundsModal";
import { useCart } from "../cart/CartContext";
import CartDrawer from "./CartDrawer";
import { ShoppingCart } from "lucide-react";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { items } = useCart();

  // Fetch balance
  const { data: balanceData } = useQuery({
    queryKey: ["balance"],
    queryFn: async () => {
      const res = await fetch("/api/user/balance", { credentials: "include" });
      if (!res.ok) return { balance: 0 };
      return res.json();
    },
    staleTime: 10000,
  });

  return (
    <nav className="bg-black bg-opacity-80 shadow-lg py-3 px-7 flex items-center justify-between z-50 relative">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
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
          <button
            className="relative ml-2"
            aria-label="Open cart"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="text-pink" />
            {items.length > 0 && (
              <span className="absolute -top-2 -right-1 bg-gold text-xs text-black rounded-full px-2 font-bold">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </div>
      <div>
        <SignedIn>
          <div className="flex items-center gap-4">
            <span className="text-white font-body text-base hidden md:inline">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
            <button
              className="relative px-4 py-2 bg-gold text-black rounded-full font-bold shadow-glow hover:bg-pink hover:text-white transition focus:outline-none"
              onClick={() => setModalOpen(true)}
              title="Account Balance"
            >
              ${((balanceData?.balance ?? 0) / 100).toFixed(2)}
              <span className="absolute top-0 -right-2 bg-pink text-white rounded-full px-2 py-0.5 text-xs font-bold shadow">
                + Add
              </span>
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
          <AddFundsModal open={modalOpen} onClose={() => setModalOpen(false)} />
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