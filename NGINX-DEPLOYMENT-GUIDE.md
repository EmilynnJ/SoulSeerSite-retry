# SoulSeer Nginx Deployment Guide

This guide provides instructions for deploying the SoulSeer application with Nginx to ensure proper MIME type handling for PWA functionality.

## Prerequisites

- A server with Nginx installed
- Node.js (version 18 or higher)
- Your SoulSeer application code
- Domain name configured to point to your server IP
- SSL certificate (recommended for production)

## Deployment Steps

### 1. Build the Application

```bash
# Install dependencies
npm install

# Build the application
npm run build
```

### 2. Configure Nginx

Copy the provided `nginx.conf` configuration to your Nginx server. This configuration:

- Serves manifest.json with the correct application/json MIME type
- Serves serviceWorker.js with the correct application/javascript MIME type
- Configures proper caching for static assets
- Sets up fallback to index.html for client-side routing

```bash
# Copy the nginx.conf to the appropriate location
sudo cp nginx.conf /etc/nginx/sites-available/soulseer.app

# Create a symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/soulseer.app /etc/nginx/sites-enabled/

# Test the configuration
sudo nginx -t

# If the test passes, restart Nginx
sudo systemctl restart nginx
```

### 3. SSL Configuration (Recommended)

For production, secure your application with SSL:

```bash
# Install Certbot for Let's Encrypt certificates
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain an SSL certificate
sudo certbot --nginx -d soulseer.app

# Certbot will modify your Nginx configuration automatically
# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
```

## Nginx Configuration Details

The provided `nginx.conf` contains:

```nginx
server {
    listen 80;
    server_name soulseer.app;

    # Serve manifest.json with application/json header
    location /manifest.json {
        add_header Content-Type application/json;
        root /path/to/your/app/public;
    }

    # Serve serviceWorker.js with application/javascript header
    location /serviceWorker.js {
        add_header Content-Type application/javascript;
        root /path/to/your/app/public;
    }

    # Serve all other files
    location / {
        root /path/to/your/app/public;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Set long cache time for static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        root /path/to/your/app/public;
    }
}
```

## Important Notes

1. Update the `root` paths in the nginx configuration to match your actual deployment directory.
2. For production, always use HTTPS to enable all PWA features.
3. The service worker won't work properly in development mode in some browsers due to security restrictions.
4. Test your PWA configuration using Lighthouse in Chrome DevTools after deployment.

## Troubleshooting

### Service Worker Not Registering

- Ensure the `serviceWorker.js` file is being served with the correct MIME type.
- Check browser console for errors related to service worker registration.
- Confirm the service worker is served from the same origin as your application.

### Manifest Not Loading

- Ensure the `manifest.json` file is being served with the correct MIME type.
- Validate your manifest file using a PWA validator tool.

### Offline Mode Not Working

- Check if the service worker is properly caching the offline assets.
- Verify that the offline.html and offline-api.json files exist.
- Test offline functionality by disconnecting from the network.