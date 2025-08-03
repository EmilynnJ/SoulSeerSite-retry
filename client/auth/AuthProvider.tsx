import React, { createContext, useContext } from "react";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import apiInstance from "../src/lib/api";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

type AuthRole = "client" | "reader" | "admin" | null;

interface AuthContextProps {
  isAuthenticated: boolean;
  user: any | null;
  role: AuthRole;
  loading: boolean;
}

const AuthContext = createContext<AuthContextProps>({
  isAuthenticated: false,
  user: null,
  role: null,
  loading: true,
});

export function useAuthContext() {
  return useContext(AuthContext);
}

// Fetch user role from backend
const fetchUserRole = async () => {
  const { data } = await apiInstance.get("/api/user");
  return data.role as AuthRole;
};

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      navigate={(to) => window.history.pushState({}, "", to)}
    >
      <AuthLoader>{children}</AuthLoader>
    </ClerkProvider>
  );
}

function AuthLoader({ children }: { children: React.ReactNode }) {
  const { isSignedIn, user, isLoaded } = useUser();
  const {
    data: role,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["userRole"],
    queryFn: fetchUserRole,
    enabled: !!isSignedIn,
    retry: false,
  });

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!isSignedIn,
        user: user || null,
        role: role || null,
        loading: !isLoaded || (isSignedIn && isLoading),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}