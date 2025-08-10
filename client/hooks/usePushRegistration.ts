import { useEffect } from "react";
import { messaging } from "../src/lib/firebase";
import { useUser } from "@clerk/clerk-react";
import { getToken } from "firebase/messaging";
import toast from "react-hot-toast";

export default function usePushRegistration() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isSignedIn || !messaging || typeof window === "undefined") return;
    if (!("Notification" in window) || Notification.permission === "denied") return;

    async function register() {
      try {
        if (Notification.permission !== "granted") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) return;
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
        if (token) {
          await fetch("/api/push/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token, platform: "web" }),
          });
        }
      } catch (err: any) {
        toast.error("Push registration failed: " + (err?.message || "unknown"));
      }
    }
    register();
  }, [isSignedIn, user]);
}