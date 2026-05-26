// const path = require('path');
// // Only load dotenv if .env file exists (local development)
// try {
//     require('dotenv').config({ path: path.resolve(__dirname, '.env') });
// } catch (e) {
//     console.log('No .env file found, using environment variables');
// }

// const express = require('express');
// const cors = require('cors');
// const mysql = require('mysql2/promise');

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Request logging middleware with memory monitoring
// app.use((req, res, next) => {
//     const timestamp = new Date().toISOString();
//     console.log(`${timestamp} [${req.method}] ${req.url}`);
    
//     // Memory monitoring for debugging (production should be more efficient)
//     if (process.env.NODE_ENV === 'development') {
//         const memUsage = process.memoryUsage();
//         console.log(`Memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
//     }
    
//     next();
// });

// // Create MySQL connection pool (optimized for low memory)
// const pool = mysql.createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     charset: 'utf8mb4',
//     waitForConnections: true,
//     connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 3, // Reduced for t3.micro
//     queueLimit: 5, // Limit queue to prevent memory buildup
//     acquireTimeout: 60000,
//     timeout: 60000,
//     idleTimeout: 300000, // 5 minutes
//     enableKeepAlive: true,
//     keepAliveInitialDelay: 0
// });

// // Check database connection on startup
// pool.getConnection()
//     .then(connection => {
//         console.log('✅ Successfully connected to database');
//         connection.release();
//     })
//     .catch(err => {
//         console.error('❌ Failed to connect to database:', err);
//     });

// // Make database available to Lambda functions (global scope as expected by current implementation)
// global.dbPool = pool;

// // Serve static assets if configured (usually served by CDN in production, but good fallback)
// if (process.env.SERVE_STATIC_ASSETS === 'true') {
//     app.use('/assets', express.static(path.join(__dirname, 'poff-assets')));
// }

// // Import Lambda handlers with lazy loading for memory optimization
// const LAMBDA_PATH = process.env.LAMBDA_PATH || './lambda/functions';

// // Lazy load handlers to reduce initial memory footprint
// const handlers = {};
// function getLambdaHandler(name) {
//     if (!handlers[name]) {
//         console.log(`Loading handler: ${name}`);
//         handlers[name] = require(path.join(LAMBDA_PATH, name));
//     }
//     return handlers[name];
// }

// // Middleware to convert Express req/res to Lambda event/context
// function lambdaAdapter(handlerFactory) {
//     return async (req, res) => {
//         const handler = typeof handlerFactory === 'function' ? handlerFactory() : handlerFactory;
        
//         const event = {
//             httpMethod: req.method,
//             path: req.path,
//             queryStringParameters: req.query,
//             headers: req.headers,
//             body: req.body ? JSON.stringify(req.body) : null,
//             pathParameters: req.params,
//             requestContext: {
//                 identity: {
//                     sourceIp: req.ip,
//                     userAgent: req.get('User-Agent')
//                 }
//             }
//         };

//         const context = {
//             functionName: 'ecs-server',
//             awsRequestId: `ecs-${Date.now()}-${Math.random().toString(36).substring(7)}`,
//             callbackWaitsForEmptyEventLoop: false
//         };

//         try {
//             const result = await handler.handler(event, context);

//             // Handle different body types
//             let body = result.body;
//             if (typeof body === 'string') {
//                 try {
//                     body = JSON.parse(body);
//                 } catch (e) {
//                     // keep as string if not JSON
//                 }
//             }

//             // Set headers
//             if (result.headers) {
//                 Object.keys(result.headers).forEach(key => {
//                     res.setHeader(key, result.headers[key]);
//                 });
//             }

//             res.status(result.statusCode || 200).json(body);
//         } catch (error) {
//             console.error('❌ Lambda handler error:', error);
//             res.status(500).json({
//                 success: false,
//                 error: 'Internal Server Error',
//                 message: process.env.NODE_ENV === 'development' ? error.message : undefined
//             });
//         }
//     };
// }

// // Config Route
// app.get('/api/config', (req, res) => {
//     res.json({
//         success: true,
//         data: {
//             firebase: {
//                 apiKey: process.env.VITE_FIREBASE_API_KEY,
//                 authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
//                 projectId: process.env.VITE_FIREBASE_PROJECT_ID,
//                 appId: process.env.VITE_FIREBASE_APP_ID,
//                 messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//             }
//         }
//     });
// });

// // Pokemon Collection Routes
// app.get('/api/collection', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));
// app.post('/api/collection/favorite', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));
// app.get('/api/collection/favorites', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));
// app.get('/api/collection/icons', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));
// app.get('/api/collection/all-pokemon', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));
// app.get('/api/collection/today', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));
// app.get('/api/collection/evolution/:baseImageName', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));
// app.get('/api/collection/pokemon/:stableId', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));
// app.post('/api/collection/reward', lambdaAdapter(() => getLambdaHandler('pokemon-collection')));

// // Egg Management Routes
// app.get('/api/eggs', lambdaAdapter(() => getLambdaHandler('egg-management')));
// app.get('/api/eggs/search', lambdaAdapter(() => getLambdaHandler('egg-management')));
// app.post('/api/eggs/acquire', lambdaAdapter(() => getLambdaHandler('egg-management')));
// app.post('/api/eggs/hatch', lambdaAdapter(() => getLambdaHandler('egg-management')));

// // Screen Time Management Routes
// app.get('/api/screen-time', lambdaAdapter(() => getLambdaHandler('screen-time-management')));
// app.post('/api/screen-time', lambdaAdapter(() => getLambdaHandler('screen-time-management')));
// app.delete('/api/screen-time/:date', lambdaAdapter(() => getLambdaHandler('screen-time-management')));
// app.get('/api/screen-time/weekly-stats', lambdaAdapter(() => getLambdaHandler('screen-time-management')));
// app.get('/api/screen-time/status', lambdaAdapter(() => getLambdaHandler('screen-time-management')));
// app.post('/api/screen-time/verify', lambdaAdapter(() => getLambdaHandler('screen-time-management')));

// // User Management Routes
// app.post('/api/auth/sync', lambdaAdapter(() => getLambdaHandler('user-management')));
// app.post('/api/user/terms-agreement', lambdaAdapter(() => getLambdaHandler('user-management')));
// app.get('/api/shop/items', lambdaAdapter(() => getLambdaHandler('user-management')));
// app.post('/api/user/exchange', lambdaAdapter(() => getLambdaHandler('user-management')));
// app.get('/api/user/habitat', lambdaAdapter(() => getLambdaHandler('user-management')));
// app.post('/api/user/habitat', lambdaAdapter(() => getLambdaHandler('user-management')));
// app.get('/api/habitats', lambdaAdapter(() => getLambdaHandler('user-management')));

// // Pokemon Management Routes
// app.post('/api/pokemon/evolve', lambdaAdapter(() => getLambdaHandler('pokemon-management')));
// app.post('/api/pokemon/unlock-form', lambdaAdapter(() => getLambdaHandler('pokemon-management')));
// app.post('/api/pokemon/unlock-shiny', lambdaAdapter(() => getLambdaHandler('pokemon-management')));
// app.get('/api/user/items', lambdaAdapter(() => getLambdaHandler('pokemon-management')));

// // Guest Mode Routes (no auth required)
// app.get('/api/guest/icons', lambdaAdapter(() => getLambdaHandler('guest-mode')));
// app.get('/api/guest/all-pokemon', lambdaAdapter(() => getLambdaHandler('guest-mode')));
// app.get('/api/guest/pokemon/:stableId', lambdaAdapter(() => getLambdaHandler('guest-mode')));
// app.get('/api/guest/evolution/:baseImageName', lambdaAdapter(() => getLambdaHandler('guest-mode')));
// app.get('/api/guest/today', lambdaAdapter(() => getLambdaHandler('guest-mode')));
// app.get('/api/guest/eggs', lambdaAdapter(() => getLambdaHandler('guest-mode')));
// app.get('/api/guest/starter-pokemon', lambdaAdapter(() => getLambdaHandler('guest-mode')));
// app.get('/api/guest/sleep-status', lambdaAdapter(() => getLambdaHandler('guest-mode')));

// // Sleep Management Routes
// app.post('/api/sleep', lambdaAdapter(() => getLambdaHandler('sleep-management')));
// app.get('/api/sleep/status', lambdaAdapter(() => getLambdaHandler('sleep-management')));
// app.post('/api/sleep/reward', lambdaAdapter(() => getLambdaHandler('sleep-management')));

// // Health check
// app.get('/health', async (req, res) => {
//     try {
//         await pool.query('SELECT 1');
//         res.json({
//             status: 'healthy',
//             environment: process.env.NODE_ENV,
//             timestamp: new Date().toISOString(),
//             uptime: process.uptime()
//         });
//     } catch (e) {
//         res.status(503).json({
//             status: 'unhealthy',
//             error: e.message
//         });
//     }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, '0.0.0.0', () => {
//     console.log(`🚀 Poff ECS Server running on port ${PORT}`);
//     console.log(`📊 Environment: ${process.env.NODE_ENV}`);
// });

// // Graceful shutdown
// process.on('SIGTERM', () => {
//     console.log('SIGTERM signal received: closing HTTP server');
//     pool.end();
//     process.exit(0);
// });
