import React from "react";
import { SignIn } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import Loading from "../components/Loading";

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) return <Loading />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-celestial">
      <div className="bg-black/80 rounded-xl shadow-xl p-8">
        <SignIn
          appearance={{
            elements: {
              formButtonPrimary: "bg-pink hover:bg-gold text-white font-bold",
            },
            variables: {
              colorPrimary: "#FF69B4",
            },
          }}
          path="/signin"
          routing="path"
          signUpUrl="/signup"
        />
      </div>
    </div>
  );
}