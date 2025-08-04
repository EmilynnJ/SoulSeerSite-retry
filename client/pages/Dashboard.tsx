import React from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuthContext } from "../auth/AuthProvider";

function ClientDashboard() {
  return (
    <div className="min-h-screen p-8 bg-celestial text-white">
      <h1 className="font-heading text-3xl text-pink mb-8">Client Dashboard</h1>
      {/* Booking history, balance, favorites, etc. */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-black bg-opacity-70 rounded-xl p-6">
          <h2 className="font-heading text-xl text-gold mb-4">Booking History</h2>
          {/* TODO: Booking history table */}
        </div>
        <div className="bg-black bg-opacity-70 rounded-xl p-6">
          <h2 className="font-heading text-xl text-gold mb-4">Account Balance</h2>
          {/* TODO: Show/add funds */}
        </div>
      </div>
    </div>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthContext } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import apiInstance from "../src/lib/api";
import EarningsChart from "./ReaderDashboard/EarningsChart";

function ReaderDashboard() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  // Fetch incoming reading requests
  const { data: readings, isLoading } = useQuery({
    queryKey: ["incomingReadings"],
    queryFn: async () => {
      const { data } = await apiInstance.get("/api/readings/reader");
      return data;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (reading: any) => apiInstance.post(`/api/readings/${reading.id}/accept`),
    onSuccess: (_data, reading) => {
      if (reading.type === "chat") {
        navigate(`/readings/session/${reading.id}/chat`);
      } else {
        navigate(`/readings/session/${reading.id}/video`);
      }
    },
  });

  const incoming =
    readings?.filter(
      (r: any) =>
        r.status === "waiting_payment" ||
        r.status === "payment_completed"
    ) || [];

  return (
    <div className="min-h-screen p-8 bg-celestial text-white">
      <h1 className="font-heading text-3xl text-pink mb-8">Reader Dashboard</h1>
      {/* Incoming Requests */}
      <div className="bg-black bg-opacity-70 rounded-xl p-6 mb-8">
        <h2 className="font-heading text-xl text-gold mb-4">Incoming Requests</h2>
        {isLoading ? (
          <div className="text-gold">Loading...</div>
        ) : incoming.length === 0 ? (
          <div className="text-gold">No incoming requests right now.</div>
        ) : (
          <table className="w-full text-white font-body">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Status</th>
                <th>Accept</th>
              </tr>
            </thead>
            <tbody>
              {incoming.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.clientId}</td>
                  <td>{r.type}</td>
                  <td>{r.status}</td>
                  <td>
                    <button
                      className="bg-pink text-white px-4 py-1 rounded-full font-bold shadow-glow hover:bg-gold hover:text-black transition"
                      disabled={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate(r)}
                    >
                      Accept
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Earnings chart */}
      <EarningsChart />
      {/* Status toggle, session history, analytics */}
      <div className="grid md:grid-cols-2 gap-8 mt-8">
        <div className="bg-black bg-opacity-70 rounded-xl p-6">
          <h2 className="font-heading text-xl text-gold mb-4">Session History</h2>
          {/* TODO: Session history table */}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="min-h-screen p-8 bg-celestial text-white">
      <h1 className="font-heading text-3xl text-pink mb-8">Admin Dashboard</h1>
      {/* Reader creation, user mgmt, analytics, Stripe, etc. */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-black bg-opacity-70 rounded-xl p-6">
          <h2 className="font-heading text-xl text-gold mb-4">Manage Readers</h2>
          {/* TODO: Create/Edit reader profiles */}
        </div>
        <div className="bg-black bg-opacity-70 rounded-xl p-6">
          <h2 className="font-heading text-xl text-gold mb-4">Platform Analytics</h2>
          {/* TODO: Analytics & Stripe */}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { role } = useAuthContext();

  return (
    <ProtectedRoute>
      {role === "client" && <ClientDashboard />}
      {role === "reader" && <ReaderDashboard />}
      {role === "admin" && <AdminDashboard />}
    </ProtectedRoute>
  );
}