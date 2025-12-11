const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// Create MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Make database available to Lambda functions
global.dbPool = pool;

// Serve static assets
app.use('/assets', express.static('/pokehabit-assets'));

// Import Lambda handlers
const pokemonCollection = require('/lambda/functions/pokemon-collection');
const eggManagement = require('/lambda/functions/egg-management');
const exerciseManagement = require('/lambda/functions/exercise-management');
const exerciseRewards = require('/lambda/functions/exercise-rewards');
const screenTimeManagement = require('/lambda/functions/screen-time-management');

const userManagement = require('/lambda/functions/user-management');
const pokemonManagement = require('/lambda/functions/pokemon-management');
const guestMode = require('/lambda/functions/guest-mode');

// Middleware to convert Express req/res to Lambda event/context
function lambdaAdapter(handler) {
    return async (req, res) => {
        const event = {
            httpMethod: req.method,
            path: req.path,
            queryStringParameters: req.query,
            headers: req.headers,
            body: req.body ? JSON.stringify(req.body) : null,
            pathParameters: req.params
        };

        const context = {
            functionName: 'local-dev',
            awsRequestId: `local-${Date.now()}`
        };

        try {
            const result = await handler.handler(event, context);
            const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
            res.status(result.statusCode || 200).json(body);
        } catch (error) {
            console.error('Lambda handler error:', error);
            res.status(500).json({ error: error.message });
        }
    };
}

// Config Route
app.get('/api/config', (req, res) => {
    res.json({
        firebase: {
            apiKey: process.env.VITE_FIREBASE_API_KEY,
            authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.VITE_FIREBASE_PROJECT_ID,
            appId: process.env.VITE_FIREBASE_APP_ID,
            messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        }
    });
});

// Pokemon Collection Routes
app.get('/api/collection', lambdaAdapter(pokemonCollection));
app.post('/api/collection/favorite', lambdaAdapter(pokemonCollection));
app.get('/api/collection/favorites', lambdaAdapter(pokemonCollection));
app.get('/api/collection/icons', lambdaAdapter(pokemonCollection));
app.get('/api/collection/all-pokemon', lambdaAdapter(pokemonCollection));
app.get('/api/collection/evolution/:baseImageName', lambdaAdapter(pokemonCollection));
app.get('/api/collection/pokemon/:stableId', lambdaAdapter(pokemonCollection));
app.post('/api/collection/reward', lambdaAdapter(pokemonCollection));

// Egg Management Routes
app.get('/api/eggs', lambdaAdapter(eggManagement));
app.get('/api/eggs/search', lambdaAdapter(eggManagement));
app.post('/api/eggs/acquire', lambdaAdapter(eggManagement));
app.post('/api/eggs/hatch', lambdaAdapter(eggManagement));


// Exercise Management Routes
// Exercise Management Routes
app.get('/api/exercises', lambdaAdapter(exerciseManagement));
app.post('/api/exercises', lambdaAdapter(exerciseManagement));
app.put('/api/exercises/:id', lambdaAdapter(exerciseManagement));
app.delete('/api/exercises/:id', lambdaAdapter(exerciseManagement));
app.get('/api/sessions', lambdaAdapter(exerciseManagement));
app.post('/api/sessions', lambdaAdapter(exerciseManagement));
app.get('/api/muscle-groups', lambdaAdapter(exerciseManagement));
app.get('/api/weekly-stats', lambdaAdapter(exerciseManagement));

// Exercise Rewards Routes
app.post('/api/exercise/rewards', lambdaAdapter(exerciseRewards));

// Screen Time Management Routes
app.post('/api/screen-time', lambdaAdapter(screenTimeManagement));
app.post('/api/screen-time/validate', lambdaAdapter(screenTimeManagement));



// User Management Routes
app.post('/api/auth/sync', lambdaAdapter(userManagement));
app.post('/api/user/terms-agreement', lambdaAdapter(userManagement));
app.get('/api/shop/items', lambdaAdapter(userManagement));
app.post('/api/user/exchange', lambdaAdapter(userManagement));

// Pokemon Management Routes
app.post('/api/pokemon/evolve', lambdaAdapter(pokemonManagement));
app.post('/api/pokemon/unlock-form', lambdaAdapter(pokemonManagement));
app.post('/api/pokemon/unlock-shiny', lambdaAdapter(pokemonManagement));
app.get('/api/user/items', lambdaAdapter(pokemonManagement));

// Guest Mode Routes (no auth required)
app.get('/api/guest/icons', lambdaAdapter(guestMode));
app.get('/api/guest/all-pokemon', lambdaAdapter(guestMode));
app.get('/api/guest/pokemon/:stableId', lambdaAdapter(guestMode));
app.get('/api/guest/evolution/:baseImageName', lambdaAdapter(guestMode));
app.get('/api/guest/exercises', lambdaAdapter(guestMode));
app.get('/api/guest/muscle-groups', lambdaAdapter(guestMode));
app.get('/api/guest/weekly-stats', lambdaAdapter(guestMode));
app.get('/api/guest/eggs', lambdaAdapter(guestMode));
app.get('/api/guest/sessions', lambdaAdapter(guestMode));
app.get('/api/guest/starter-pokemon', lambdaAdapter(guestMode));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', environment: 'local-dev' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Pokehabit API server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🗄️  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});
