import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthContext } from "../auth/AuthProvider";
import Loading from "./Loading";

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "client" | "reader" | "admin";
}) {
  const { isAuthenticated, loading, role } = useAuthContext();

  if (loading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}