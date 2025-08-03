import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Clerk API (browser, real)
import { ClerkProvider, useUser, useAuth } from "@clerk/clerk-react";

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

const fetchRoleFromBackend = async (userId: string | undefined | null): Promise<AuthRole> => {
  if (!userId) return null;
  // Call backend /api/user or similar to get user record (with role)
  const res = await fetch("/api/user", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.role as AuthRole;
};

// This provider wraps the entire app (in client/App.tsx)
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
  const [role, setRole] = useState<AuthRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Fetch role from backend
      fetchRoleFromBackend(user?.id).then((r) => {
        setRole(r);
        setLoading(false);
      });
    } else if (isLoaded) {
      setRole(null);
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!isSignedIn,
        user: user || null,
        role,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}