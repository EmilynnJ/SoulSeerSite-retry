import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import StarRating from "../components/StarRating";
import apiInstance from "../src/lib/api";
import { useAuthContext } from "../auth/AuthProvider";
import toast from "react-hot-toast";

export default function ReadingSummary() {
  const { readingId } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuthContext();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: reading, isLoading } = useQuery({
    queryKey: ["reading", readingId],
    queryFn: async () => {
      const res = await fetch(`/api/readings/${readingId}`);
      if (!res.ok) throw new Error("Could not fetch reading");
      return res.json();
    },
    enabled: !!readingId,
  });

  const rateMutation = useMutation({
    mutationFn: async () =>
      apiInstance.post(`/api/readings/${readingId}/rate`, {
        rating,
        review,
      }),
    onSuccess: () => {
      toast.success("Thank you for your feedback!");
      setSubmitted(true);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to submit rating"
      );
    },
  });

  if (isLoading || !reading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-celestial">
        <div className="text-gold text-lg">Loading...</div>
      </div>
    );

  const isClient = role === "client" && user?.id === reading.clientId;
  const canRate =
    isClient && reading.status === "completed" && !reading.rating && !submitted;

  return (
    <div className="min-h-screen bg-celestial flex flex-col items-center pt-10 px-2">
      <div className="bg-black bg-opacity-90 rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        <h1 className="font-heading text-2xl text-pink mb-4">Session Summary</h1>
        <div className="mb-2">
          <span className="font-bold text-gold">Reader: </span>
          {reading.readerName || reading.readerId}
        </div>
        <div className="mb-2">
          <span className="font-bold text-gold">Duration: </span>
          {reading.duration} min
        </div>
        <div className="mb-2">
          <span className="font-bold text-gold">Total: </span>
          <span className="text-pink font-bold">${((reading.totalPrice ?? 0) / 100).toFixed(2)}</span>
        </div>
        <div className="mb-2">
          <span className="font-bold text-gold">Completed: </span>
          {reading.completedAt
            ? new Date(reading.completedAt).toLocaleString()
            : "N/A"}
        </div>
        {reading.notes && (
          <div className="mb-2">
            <a
              href="#"
              className="text-pink underline"
              onClick={() => alert("Chat transcript: " + reading.notes)}
            >
              View Chat Transcript
            </a>
          </div>
        )}
        <hr className="my-5 border-gold" />
        {canRate ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              rateMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="font-bold text-white block mb-2">
                Your Rating:
              </label>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div>
              <label className="font-bold text-white block mb-2">
                Your Review:
              </label>
              <textarea
                className="w-full p-3 rounded-lg bg-gray-900 border border-gold text-white font-body"
                rows={3}
                value={review}
                onChange={e => setReview(e.target.value)}
                placeholder="Share your experience..."
              />
            </div>
            <button
              type="submit"
              className="bg-pink text-white px-8 py-2 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
              disabled={rateMutation.isPending}
            >
              {rateMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        ) : (
          <div className="mt-4">
            <div className="mb-2">
              <span className="font-bold text-gold">Rating: </span>
              <StarRating value={reading.rating || rating} readOnly />
            </div>
            <div>
              <span className="font-bold text-gold">Review: </span>
              <span className="text-white">{reading.review || "No review submitted."}</span>
            </div>
          </div>
        )}
        <div className="mt-6 flex justify-end">
          <Link
            to="/dashboard"
            className="bg-gold text-black px-6 py-2 rounded-full font-bold shadow-glow hover:bg-pink hover:text-white transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}