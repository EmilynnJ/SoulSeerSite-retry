import React from "react";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-celestial">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-pink border-solid"></div>
    </div>
  );
}