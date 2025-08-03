import React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import apiInstance from "../src/lib/api";

export default function ReaderProfile() {
  const { readerId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { search } = useLocation();

  const { data: reader, isLoading } = useQuery({
    queryKey: ["readerProfile", readerId],
    queryFn: async () => {
      const { data } = await apiInstance.get(`/api/readers/${readerId}`);
      return data;
    },
    enabled: !!readerId,
  });

  const startChatMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiInstance.post("/api/readings/on-demand", {
        readerId: readerId,
        type: "chat",
      });
      return data;
    },
    onSuccess: (data) => {
      if (data && data.paymentLink) {
        window.open(data.paymentLink, "_blank", "noopener noreferrer");
        navigate(`/dashboard/readings?pending=${data.reading?.id || ""}`);
      }
    },
  });

  // If coming from payment, show pending message
  const pending = new URLSearchParams(search).get("pending");

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-10 px-2">
      {isLoading ? (
        <div className="text-gold text-lg">Loading reader...</div>
      ) : !reader ? (
        <div className="text-gold text-lg">Reader not found.</div>
      ) : (
        <div className="bg-black bg-opacity-80 rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <div className="flex flex-col md:flex-row gap-8 items-center mb-6">
            <img
              src={reader.profileImage || "https://i.postimg.cc/s2ds9RtC/FOUNDER.jpg"}
              alt={reader.fullName}
              className="w-36 h-36 rounded-full border-4 border-gold shadow-lg"
            />
            <div>
              <h1 className="font-heading text-3xl text-pink mb-2">
                {reader.fullName}
              </h1>
              <div className="text-gold font-body mb-1">
                {reader.specialties?.join(", ") || "Psychic Readings"}
              </div>
              <div className="text-white font-body mb-2">
                <span className="font-bold">Rating:</span>{" "}
                {reader.rating ? `${reader.rating}/5` : "N/A"}
              </div>
              <div className="text-white font-body mb-2">
                <span className="font-bold">Bio:</span>{" "}
                {reader.bio || "No bio provided."}
              </div>
            </div>
          </div>
          <div className="mb-4">
            <h2 className="font-heading text-xl text-gold mb-2">
              Pricing (per minute)
            </h2>
            <table className="w-full text-white font-body mb-2">
              <tbody>
                <tr>
                  <td>Chat</td>
                  <td>
                    <span className="text-pink font-bold">
                      ${((reader.pricingChat ?? reader.pricing ?? 100) / 100).toFixed(2)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Voice</td>
                  <td>
                    <span className="text-pink font-bold">
                      ${((reader.pricingVoice ?? 200) / 100).toFixed(2)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Video</td>
                  <td>
                    <span className="text-pink font-bold">
                      ${((reader.pricingVideo ?? 300) / 100).toFixed(2)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <SignedIn>
            {reader.isOnline ? (
              <button
                className="bg-pink text-white px-8 py-3 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
                disabled={startChatMutation.isPending}
                onClick={() => startChatMutation.mutate()}
              >
                {startChatMutation.isPending ? "Starting..." : "Start Chat"}
              </button>
            ) : (
              <button
                className="bg-gray-400 text-white px-8 py-3 rounded-full font-bold cursor-not-allowed"
                disabled
              >
                Reader Offline
              </button>
            )}
          </SignedIn>
          <SignedOut>
            <button
              className="bg-pink text-white px-8 py-3 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
              onClick={() =>
                navigate(`/signin?redirect=/readings/${readerId}`)
              }
            >
              Sign In to Start Chat
            </button>
          </SignedOut>
          {pending && (
            <div className="mt-4 text-gold font-body">
              Waiting for reader to accept your request...
            </div>
          )}
        </div>
      )}
    </div>
  );
}