const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

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

// Serve React build in production
const publicDir = path.join(__dirname, '../public');
const fs = require('fs');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

module.exports = app;
