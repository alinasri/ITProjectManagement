// utils/serviceError.js — A custom Error subclass used by every service function.
//
// WHY a custom class instead of just returning { status, error }?
// Services throw errors; routes catch them. JavaScript's throw/catch mechanism works
// with any value, but using a real Error subclass gives you a stack trace for free,
// which makes debugging much easier. The `status` property carries the HTTP status code
// so the route handler knows which code to send without writing any domain logic itself.
//
// Usage in a service:
//   throw new ServiceError(404, 'Not found');
//
// Usage in a route (via the wrap() helper):
//   catch (err) { res.status(err.status || 500).json({ error: err.message }); }

class ServiceError extends Error {
  // super(message) calls the parent Error constructor, which sets this.message and
  // captures the stack trace. We then attach the HTTP status code as a plain property.
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = ServiceError;
