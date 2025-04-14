import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register the service worker for PWA support
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/serviceWorker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
};

// Register service worker for both production and development environments
// This ensures PWA functionality is testable in development
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
