import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { db, pool } from "./db";
import { config } from "dotenv";
import path from "path";
import sessionsRoutes from "./routes/sessions";
import payPerMinuteRoutes from "./routes/pay-per-minute";
import shopRoutes from "./routes/shop";
import readerBalancesRoutes from "./routes/reader-balances";
// import forumRoutes from "./routes/forum"; // Disabled - using PostgreSQL forum routes
import cors from "cors";
// MongoDB connection is no longer used - migrated to PostgreSQL

// Load environment variables
config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure CORS based on environment
const corsOptions = {
  // Using allowed origins with credentials support
  origin: (origin: string | undefined, callback: (err: Error | null, origin?: string | boolean) => void) => {
    // Allow localhost and the Replit environment
    const allowedOrigins = [
      'http://localhost:5000',
      'https://localhost:5000',
      'https://soulseer.app',
      undefined // Allow requests with no origin (like mobile apps or Postman)
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, origin);
    } else {
      // For development, allow any origin
      console.log(`CORS: Allowing origin ${origin}`);
      callback(null, origin);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'X-Session-ID']
};
app.use(cors(corsOptions));

// Log the CORS configuration
console.log("CORS configured for domains:", corsOptions.origin);

// Serve uploads directory directly in both development and production
const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
const imagesPath = path.join(process.cwd(), 'public', 'images');

// Serve uploads and images directories
app.use('/uploads', express.static(uploadsPath));
app.use('/images', express.static(imagesPath));

// Set correct MIME types for manifest.json and serviceWorker.js
const publicPath = path.join(process.cwd(), 'public');

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(publicPath, 'manifest.json'));
});

app.get('/serviceWorker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(publicPath, 'serviceWorker.js'));
});

console.log(`Serving uploads from: ${uploadsPath} with fallback to default images`);

// Add health check endpoint for Render
app.get('/api/health', (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VITE_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000; // 5 seconds
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Test PostgreSQL connection before registering routes
      const client = await pool.connect();
      
      // Run a simple query to verify connection
      const result = await client.query('SELECT version()');
      log(`PostgreSQL connection established successfully: ${result.rows[0].version}`, 'database');
      
      // Release the client back to the pool
      client.release();
      break;
    } catch (error) {
      log(`PostgreSQL connection attempt ${attempt} failed: ${error}`, 'database');
      
      if (attempt === MAX_RETRIES) {
        log('All PostgreSQL connection attempts failed. Exiting.', 'database');
        process.exit(1);
      }
      
      log(`Retrying in ${RETRY_DELAY/1000} seconds...`, 'database');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  // Register sessions routes
  app.use('/api/sessions', sessionsRoutes);
  
  // Register pay-per-minute routes
  app.use('/api/pay-per-minute', payPerMinuteRoutes);
  
  // Register shop routes
  app.use('/api/products', shopRoutes);
  
  // Register reader balances routes
  app.use('/api/reader-balances', readerBalancesRoutes);
  
  // Forum routes are registered in server/routes.ts now
  // app.use('/api/forum', forumRoutes);
  
  const server = await registerRoutes(app);
  
  // Initialize the WebRTC service with the HTTP server
  try {
    const { webRTCService } = await import('./services/webrtc-service');
    webRTCService.initialize(server);
    console.log('WebRTC service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize WebRTC service:', error);
  }
  
  // Initialize the Chat service with the HTTP server
  try {
    const { chatService } = await import('./services/chat-service-socketio');
    chatService.initialize(server);
    console.log('Chat service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Chat service:', error);
  }
  
  // Initialize the Livestream service with the HTTP server
  try {
    const { livestreamService } = await import('./services/livestream-service');
    livestreamService.initialize(server);
    console.log('Livestream service initialized successfully');
    
    // Initialize the Livestream Gifting service
    const { livestreamGiftingService } = await import('./services/livestream-gifting-service');
    livestreamGiftingService.initialize(server);
    console.log('Livestream Gifting service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Livestream services:', error);
  }

  // Initialize automatic Stripe product synchronization
  try {
    const { shopStripeService } = await import('./services/shop-stripe-service');
    
    // Initial product sync on startup
    console.log('[STRIPE SYNC] Starting initial product sync from Stripe');
    shopStripeService.importProductsFromStripe()
      .then(() => {
        console.log('[STRIPE SYNC] Initial product sync from Stripe completed successfully');
      })
      .catch((error) => {
        console.error('[STRIPE SYNC] Initial product sync failed:', error);
      });
    
    // Set up periodic sync (every 6 hours)
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        console.log('[STRIPE SYNC] Running scheduled product sync from Stripe');
        await shopStripeService.importProductsFromStripe();
        console.log('[STRIPE SYNC] Scheduled product sync completed successfully');
      } catch (error) {
        console.error('[STRIPE SYNC] Scheduled product sync failed:', error);
      }
    }, SIX_HOURS);
    
    console.log('[STRIPE SYNC] Product synchronization scheduler initialized');
  } catch (error) {
    console.error('[STRIPE SYNC] Failed to initialize product sync scheduler:', error);
  }

  // Initialize the daily reader payout scheduler
  try {
    const { readerBalanceService } = await import('./services/reader-balance-service');
    
    // Function to schedule payouts at midnight
    const scheduleDailyPayouts = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0); // Next midnight
      
      const timeUntilMidnight = midnight.getTime() - now.getTime();
      
      console.log(`[PAYOUT SCHEDULER] Next payout scheduled for ${midnight.toISOString()} (in ${Math.round(timeUntilMidnight / 60000)} minutes)`);
      
      // Schedule the payout
      setTimeout(async () => {
        try {
          console.log('[PAYOUT SCHEDULER] Running scheduled daily payouts');
          await readerBalanceService.scheduleDailyPayouts();
          
          // Schedule the next day's payout
          scheduleDailyPayouts();
        } catch (error) {
          console.error('[PAYOUT SCHEDULER] Error running scheduled payouts:', error);
          // Re-schedule even on error
          scheduleDailyPayouts();
        }
      }, timeUntilMidnight);
    };
    
    // Start the scheduler
    scheduleDailyPayouts();
    
    console.log('[PAYOUT SCHEDULER] Reader payout scheduler initialized');
  } catch (error) {
    console.error('[PAYOUT SCHEDULER] Failed to initialize payout scheduler:', error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
    // Don't rethrow the error, as it can crash the application
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  server.listen(Number(port), "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
