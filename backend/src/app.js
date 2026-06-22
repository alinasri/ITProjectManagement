// app.js — Creates and configures the Express application object.
// Registers global middleware (runs on EVERY request) and mounts route groups.
// Does NOT start the server — that is server.js's job.

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

// express() returns the main app object. All middleware and routes attach to this.
const app = express();

// CORS middleware: adds HTTP headers so browsers allow requests from a different origin.
// The React frontend (e.g. port 5173) and this API (port 3000) are different origins.
// Without CORS, the browser's built-in security policy blocks all cross-origin requests.
// credentials: true is required so the browser includes cookies in cross-origin requests.
app.use(cors({ origin: true, credentials: true }));

// Reads the raw request body and parses it as JSON, populating req.body.
// Without this, req.body is undefined in all POST/PUT route handlers.
app.use(express.json());

// Parses the Cookie header and populates req.cookies.
// Required so requireAuth (middleware/auth.js) can read the JWT from req.cookies.token.
app.use(cookieParser());

// Route mounting: app.use(prefix, router) delegates any request whose URL starts with
// the prefix to the matching router file. Each file owns one domain of the API.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sections', require('./routes/sections'));
app.use('/api/users', require('./routes/users'));
app.use('/api/personnel', require('./routes/personnel'));
app.use('/api/ongoing-tasks', require('./routes/ongoingTasks'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/custom-columns', require('./routes/customColumns'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/tenders', require('./routes/tenders'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/report',   require('./routes/report'));

// Production static file serving: when the React app is compiled, its files land in
// backend/public/. express.static() serves those files directly (JS, CSS, images).
// The wildcard GET * catch-all returns index.html for any URL not matched by an API
// route above, so React's client-side router can handle page refreshes (e.g. /projects/5).
const publicDir = path.join(__dirname, '../public');
const fs = require('fs');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

module.exports = app;
