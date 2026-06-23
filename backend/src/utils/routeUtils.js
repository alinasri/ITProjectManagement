// utils/routeUtils.js — Shared helpers for Express route handlers.

// wrap(statusCode, fn) — eliminates try/catch boilerplate from every route handler.
//
// HOW IT WORKS:
//   wrap() is a higher-order function: it takes a function and returns a new function.
//   The returned function is a standard Express middleware (req, res) => { ... }.
//   When Express calls that middleware, it runs fn(req) inside a try/catch.
//
// ON SUCCESS: calls res.status(statusCode).json(result)
// ON ServiceError (thrown by a service): uses err.status for the HTTP code
// ON unexpected error: falls back to 500 so the client always gets a response
//
// WHY this matters: without it, an unhandled exception inside a route handler leaves
// the HTTP connection open — the client waits forever for a response that never comes.
//
// Example usage in a route file:
//   router.get('/', requireAuth, wrap(200, req => myService.list(req.user, req.query)));
//   router.post('/', requireAuth, wrap(201, req => myService.create(req.user, req.body)));

function wrap(statusCode, fn) {
  return (req, res) => {
    try {
      res.status(statusCode).json(fn(req));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };
}

module.exports = { wrap };
