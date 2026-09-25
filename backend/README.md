# CargoSwift Backend

A modular Node.js + Express REST API for the existing CargoSwift marketplace schema.

## Structure
- src/app.js - Express app setup and route registration
- src/config - environment and database configuration
- src/controllers - request handlers
- src/models - database access layer
- src/routes - REST endpoints
- src/middleware - auth and error handling

## Run locally
1. Copy .env.example to .env and configure DATABASE_URL and JWT_SECRET.
2. Install dependencies with npm install.
3. Start the API with npm run dev.

## Available endpoints
- /api/auth/register
- /api/auth/login
- /api/auth/me
- /api/users
- /api/shops
- /api/products
- /api/orders
- /api/payments
- /api/tracking
