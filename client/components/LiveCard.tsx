import React from "react";

export default function LiveCard({
  stream,
  onClick,
}: {
  stream: any;
  onClick?: () => void;
}) {
  return (
    <div
      className="bg-black bg-opacity-80 rounded-xl shadow-lg p-4 flex flex-col items-center cursor-pointer hover:shadow-glow transition border-2 border-pink relative"
      onClick={onClick}
    >
      <img
        src={stream.reader.profileImage}
        className="w-20 h-20 object-cover rounded-full border-2 border-gold mb-3"
        alt={stream.reader.fullName}
      />
      <div className="font-heading text-xl text-pink mb-1">{stream.reader.fullName}</div>
      <div className="text-gold font-body text-sm mb-2">{(stream.reader.specialties || []).join(", ")}</div>
      <div className="flex items-center gap-2">
        <span className="bg-pink text-white text-xs rounded-full px-3 py-1 font-bold shadow">LIVE</span>
        <span className="bg-gold text-black text-xs rounded-full px-3 py-1 font-bold shadow">{stream.viewerCount} viewers</span>
      </div>
    </div>
  );
}