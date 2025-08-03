import React from "react";

export default function SessionWait() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-celestial">
      <div className="bg-black bg-opacity-80 rounded-xl shadow-xl p-8">
        <h1 className="font-heading text-3xl text-pink mb-4">Connecting...</h1>
        <div className="text-gold font-body text-lg">
          Please wait while we connect you to your psychic.
        </div>
      </div>
    </div>
  );
}