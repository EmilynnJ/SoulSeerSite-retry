import React from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  reader: {
    id: number;
    fullName: string;
    specialties?: string[];
    profileImage?: string;
    rating?: number;
    pricingChat?: number;
    online?: boolean;
  };
  onClick?: () => void;
};

export default function ReaderCard({ reader, onClick }: Props) {
  const navigate = useNavigate();
  return (
    <div
      className={`relative bg-celestial border-2 rounded-lg p-4 w-56 flex flex-col items-center cursor-pointer hover:shadow-glow transition ${
        reader.online ? "border-pink" : "border-gray-600 opacity-80"
      }`}
      onClick={onClick || (() => navigate(`/readings/${reader.id}`))}
    >
      <img
        src={reader.profileImage || "https://i.postimg.cc/s2ds9RtC/FOUNDER.jpg"}
        alt={reader.fullName}
        className="w-24 h-24 rounded-full border-4 border-gold shadow-lg mb-2"
      />
      <div className="font-bold text-lg text-white">{reader.fullName}</div>
      <div className="text-gold font-body text-center mb-1">
        {reader.specialties?.join(", ") || "Psychic Readings"}
      </div>
      <div className="mt-1 text-white font-body text-sm">
        <span className="text-pink font-bold">
          ${((reader.pricingChat ?? 100) / 100).toFixed(2)}/min
        </span>{" "}
        Chat
      </div>
      <span
        className={`absolute top-2 right-3 w-3 h-3 rounded-full border-2 border-white ${
          reader.online ? "bg-green-400 animate-pulse" : "bg-gray-500"
        }`}
        title={reader.online ? "Online" : "Offline"}
      />
    </div>
  );
}