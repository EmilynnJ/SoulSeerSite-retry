import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./src/lib/firebase";
import usePushRegistration from "./hooks/usePushRegistration";

function PushBootstrap() {
  usePushRegistration();
  return null;
}

if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {});
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PushBootstrap />
    <App />
  </React.StrictMode>
);