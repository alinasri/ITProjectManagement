const request = require('supertest');
const { setupTestApp, seedUser, makeToken } = require('./helpers');

// Shared state set up once before all tests in this file run.
let app, db, jwt, JWT_SECRET;

beforeAll(() => {
  ({ app, db, jwt, JWT_SECRET } = setupTestApp());

  // Seed one active user and one disabled user for login tests.
  // The schema already seeds an 'admin' user, so we use distinct usernames.
  seedUser(db, { username: 'active_user', password: 'correct123', role: 'super_admin' });

  const disabledId = seedUser(db, { username: 'disabled_user', password: 'correct123', role: 'it_head' });
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(disabledId);
});

// --- POST /api/auth/login ---

// Verifies a valid username and password returns 200 with a token and user object.
test('login with correct credentials returns token and user', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'active_user', password: 'correct123' });

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('token');
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
test('login with unknown username returns 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'nobody', password: 'anything' });

  expect(res.status).toBe(401);
});

// Verifies that missing fields are rejected with 400.
test('login with missing password returns 400', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'active_user' });

  expect(res.status).toBe(400);
});

// Verifies that a disabled account cannot log in even with correct credentials.
test('login with disabled account returns 403', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'disabled_user', password: 'correct123' });

  expect(res.status).toBe(403);
});

// --- GET /api/auth/me ---

// Verifies that requests without a token are rejected with 401.
test('GET /me without token returns 401', async () => {
  const res = await request(app).get('/api/auth/me');

  expect(res.status).toBe(401);
});

// Verifies that a valid token returns the correct user profile.
test('GET /me with valid token returns user info', async () => {
  // First log in to get a real token.
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'active_user', password: 'correct123' });

  const token = loginRes.body.token;

  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ username: 'active_user', role: 'super_admin' });
});

// Verifies that a tampered or invalid token is rejected with 401.
test('GET /me with invalid token returns 401', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer this.is.fake');

  expect(res.status).toBe(401);
});
