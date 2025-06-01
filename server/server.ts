import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { runMigrations } from "./run-migrations.js";
import { config } from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables
config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup static file serving
const staticPaths = {
  uploads: path.join(process.cwd(), 'public', 'uploads'),
  images: path.join(process.cwd(), 'public', 'images'),
  assets: path.join(process.cwd(), 'public', 'assets')
};

// Ensure directories exist
Object.values(staticPaths).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static directories with caching
app.use('/uploads', express.static(staticPaths.uploads, {
  maxAge: '1d', // Cache for 1 day
}));
app.use('/images', express.static(staticPaths.images, {
  maxAge: '7d', // Cache for 7 days
}));
app.use('/assets', express.static(staticPaths.assets, {
  maxAge: '7d', // Cache for 7 days
}));

console.log(`Serving static files from: ${JSON.stringify(staticPaths, null, 2)}`);

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
  try {
    // Initialize database before registering routes
    await runMigrations();
    log('Database initialized successfully', 'database');
  } catch (error) {
    log(`Failed to initialize database: ${error}`, 'database');
    // Always fail on database initialization error
    log('Exiting due to database initialization failure', 'database');
    process.exit(1);
  }
  
  const server = await registerRoutes(app);

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
