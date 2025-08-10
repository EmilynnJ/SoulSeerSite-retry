import React from "react";
import { Navigate } from "react-router-dom";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useAuthContext } from "../auth/AuthProvider";
import Loading from "./Loading";

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "client" | "reader" | "admin";
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { loading, role } = useAuthContext();

  if (loading || !isLoaded) return <Loading />;
  return (
    <>
      <SignedIn>
        {requiredRole && role !== requiredRole ? (
          <Navigate to="/dashboard" replace />
        ) : (
          <>{children}</>
        )}
      </SignedIn>
      <SignedOut>
        <Navigate to="/signin" replace />
      </SignedOut>
    </>
  );
}