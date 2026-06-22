// auth.test.js — Tests for POST /login, POST /logout, GET /me, POST /change-password.
//
// TOOL: Supertest — makes real HTTP requests against the Express app IN MEMORY.
// No network port is opened; request(app) connects directly to the Express instance.
// This means tests run fast and don't need a running server.
//
// TOOL: Jest — the test runner. It finds files named *.test.js, runs them, and
// reports which tests passed or failed.

const request = require('supertest');
const { setupTestApp, seedUser, makeToken } = require('./helpers');

// Variables declared here (outside beforeAll) are accessible in all tests below.
// `let` (not `const`) because they are assigned inside beforeAll, not at declaration time.
let app, db, jwt, JWT_SECRET;

// beforeAll(fn) — Jest hook. Runs the function ONCE before any test in this file starts.
// Used for setup that is expensive or only needs to happen once (opening a DB, seeding data).
// Compare with beforeEach() which runs before EVERY individual test.
beforeAll(() => {
  ({ app, db, jwt, JWT_SECRET } = setupTestApp());

  // Seed one active user and one disabled user for login tests.
  // The schema already seeds an 'admin' user, so we use distinct usernames.
  seedUser(db, { username: 'active_user', password: 'correct123', role: 'super_admin' });

  const disabledId = seedUser(db, { username: 'disabled_user', password: 'correct123', role: 'it_head' });
  // Directly update the DB to disable this user (simulates an admin deactivating them).
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(disabledId);
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
//
// test(name, fn) — defines one test case. Jest runs fn and the test passes if
// no expect() assertion throws. `async` + `await` is used because HTTP requests
// are asynchronous — we must wait for the response before asserting on it.

// Verifies a valid username and password returns 200 with a token and user object.
test('login with correct credentials returns token and user', async () => {
  // request(app).post(url) — Supertest creates an HTTP POST request to the Express app.
  // .send(body) — sets the JSON request body (like req.body in the route handler).
  // await — waits for the response before the next line runs.
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'active_user', password: 'correct123' });

  // expect(value).toBe(expected) — strict equality check (===).
  expect(res.status).toBe(200);
  // .toHaveProperty(key) — asserts the object has a property with that key.
  expect(res.body).toHaveProperty('token');
  // .toMatchObject(subset) — asserts the object contains at least these key-value pairs.
  // Extra properties (like 'id') are ignored — only the listed ones must match.
  expect(res.body.user).toMatchObject({ username: 'active_user', role: 'super_admin' });
});

// Verifies a wrong password is rejected with 401.
test('login with wrong password returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'active_user', password: 'wrongpassword' });

  expect(res.status).toBe(401);
});

// Verifies an unknown username is rejected with 401.
// (Same status as wrong password — the API deliberately gives no hint about which was wrong.)
test('login with unknown username returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'nobody', password: 'anything' });

  expect(res.status).toBe(401);
});

// Verifies that missing fields are rejected with 400 (Bad Request).
test('login with missing password returns 400', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'active_user' }); // password is missing

  expect(res.status).toBe(400);
});

// Verifies that a disabled account cannot log in even with correct credentials.
// The login route checks is_active === 0 after validating the password.
test('login with disabled account returns 403', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'disabled_user', password: 'correct123' });

  expect(res.status).toBe(403);
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

// Verifies that requests without a token are rejected with 401.
// requireAuth middleware checks for a token first; if missing, it responds 401
// before the route handler ever runs.
test('GET /me without token returns 401', async () => {
  const res = await request(app).get('/api/auth/me');
  // No .set('Authorization', ...) — the request has no token at all.
  expect(res.status).toBe(401);
});

// Verifies that a valid token returns the correct user profile.
// This test uses the actual login endpoint to get a real token — useful here because
// we ARE testing the login-then-me flow, not just the /me endpoint in isolation.
test('GET /me with valid token returns user info', async () => {
  // Step 1: log in to receive a token.
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'active_user', password: 'correct123' });

  const token = loginRes.body.token;

  // Step 2: use that token in the Authorization header.
  // .set(header, value) — sets an HTTP request header.
  // The 'Bearer ' prefix is the standard format for JWT tokens in the Authorization header.
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ username: 'active_user', role: 'super_admin' });
});

// Verifies that a tampered or completely fake token is rejected with 401.
// jwt.verify() in requireAuth throws when the token's signature is invalid.
test('GET /me with invalid token returns 401', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer this.is.fake');

  expect(res.status).toBe(401);
});
