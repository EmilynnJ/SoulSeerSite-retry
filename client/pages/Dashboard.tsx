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

function ReaderDashboard() {
  return (
    <div className="min-h-screen p-8 bg-celestial text-white">
      <h1 className="font-heading text-3xl text-pink mb-8">Reader Dashboard</h1>
      {/* Status toggle, earnings, session history, analytics */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-black bg-opacity-70 rounded-xl p-6">
          <h2 className="font-heading text-xl text-gold mb-4">Earnings Tracker</h2>
          {/* TODO: Real earnings data */}
        </div>
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