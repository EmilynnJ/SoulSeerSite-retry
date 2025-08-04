import React from "react";
import { GIFTS } from "../config/gifts";
import toast from "react-hot-toast";

export default function GiftToolbar({ streamKey }: { streamKey: string }) {
  async function sendGift(giftId: string) {
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ streamKey, giftId }),
      });
      if (res.ok) {
        toast.success("Gift sent!");
      } else {
        const err = await res.json();
        toast.error(err?.message || "Gift failed");
      }
    } catch (err) {
      toast.error("Gift failed");
    }
  }

  return (
    <div className="flex gap-3 items-center justify-center my-2">
      {Object.values(GIFTS).map((gift) => (
        <button
          key={gift.id}
          className="flex flex-col items-center bg-gold px-3 py-2 rounded-lg shadow hover:bg-pink transition"
          onClick={() => sendGift(gift.id)}
        >
          <span className="text-2xl" aria-label={gift.label}>
            {gift.id === "heart" && "💖"}
            {gift.id === "star" && "⭐"}
            {gift.id === "gold" && "🌙"}
          </span>
          <span className="text-black font-bold text-xs">{gift.label}</span>
          <span className="text-pink font-bold text-xs">${(gift.priceCents / 100).toFixed(2)}</span>
        </button>
      ))}
    </div>
  );
}