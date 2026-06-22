// server.js — Entry point. Node starts executing here.
// Kept separate from app.js so tests can import the configured app without binding a real port.

const app = require('./app');

// process.env.PORT lets the deployment environment (e.g. a cloud host) assign the port.
// The || fallback means: use 3000 locally if no PORT variable is set.
const PORT = process.env.PORT || 3000;

// app.listen() binds to the TCP port and starts accepting HTTP connections.
// The callback fires once — after the server is fully ready.
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
