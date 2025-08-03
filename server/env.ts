/**
 * Centralized environment loader and validator for all critical secrets.
 * App will fail-fast (exit) if any required env variable is missing.
 */

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    // eslint-disable-next-line no-console
    console.error(`[ENV ERROR] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return val;
}

// Required for Clerk
export const CLERK_SECRET_KEY = requireEnv("CLERK_SECRET_KEY");
export const VITE_CLERK_PUBLISHABLE_KEY = requireEnv("VITE_CLERK_PUBLISHABLE_KEY");
export const VITE_CLERK_FRONTEND_API_URL = requireEnv("VITE_CLERK_FRONTEND_API_URL");

// Required for Stripe
export const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SIGNING_SECRET = requireEnv("STRIPE_WEBHOOK_SIGNING_SECRET");
export const VITE_STRIPE_PUBLIC_KEY = requireEnv("VITE_STRIPE_PUBLIC_KEY");

// WebRTC/Turn
export const TURN_SERVERS = requireEnv("TURN_SERVERS");
export const TURN_USERNAME = requireEnv("TURN_USERNAME");
export const TURN_CREDENTIAL = requireEnv("TURN_CREDENTIAL");
export const WEBRTC_ICE_SERVERS = requireEnv("WEBRTC_ICE_SERVERS");

// Admin
export const ADMIN_EMAIL = requireEnv("ADMIN_EMAIL");

// Add more required envs as needed for analytics, storage, etc.