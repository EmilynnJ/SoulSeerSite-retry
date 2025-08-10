import React, { useEffect, useState } from "react";
import confetti from "canvas-confetti";

const ANIMATION_MAP: Record<string, string> = {
  heart_pop: "💖",
  star_shoot: "⭐",
  moon_spin: "🌙",
};

export default function GiftOverlay({ events }: { events: any[] }) {
  const [active, setActive] = useState<{ icon: string; key: number } | null>(null);

  useEffect(() => {
    if (events.length === 0) return;
    const last = events[events.length - 1];
    if (!last) return;
    const icon = ANIMATION_MAP[last.animation] || "🎁";
    setActive({ icon, key: Date.now() });
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    const t = setTimeout(() => setActive(null), 2000);
    return () => clearTimeout(t);
  }, [events]);

  return active ? (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="text-7xl animate-pulse drop-shadow-lg">{active.icon}</div>
    </div>
  ) : null;
}