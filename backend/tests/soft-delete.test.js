const request = require('supertest');
const { setupTestApp, seedUser, makeToken } = require('./helpers');

let app, db, jwt, JWT_SECRET;
let token;

beforeAll(() => {
  ({ app, db, jwt, JWT_SECRET } = setupTestApp());

  const id = seedUser(db, { username: 'test_super', role: 'super_admin' });
  token = makeToken(jwt, JWT_SECRET, { id, username: 'admin', role: 'super_admin' });
});

// Helper that sets a project's created_at to a given number of minutes ago.
// Used to simulate an "old" record without actually waiting 10 minutes in the test.
function ageProject(projectId, minutesAgo) {
  db.prepare(
    `UPDATE projects SET created_at = datetime('now', '-${minutesAgo} minutes') WHERE id = ?`
  ).run(projectId);
}

// Helper that creates a project via the API and returns its id.
async function createProject(title) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, section_id: 1 });
  return res.body.id;
}

// --- Within the window ---

// A project created moments ago should be deletable.
// The response is 200 and the record's is_deleted flag becomes 1 in the DB
// (it is not physically removed, so it can be recovered if needed).
test('fresh project can be deleted within the 10-minute window', async () => {
  const id = await createProject('Fresh Project');

  const res = await request(app)
    .delete(`/api/projects/${id}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);

  // Confirm the row still exists in the DB but is flagged as deleted.
  const row = db.prepare('SELECT is_deleted FROM projects WHERE id = ?').get(id);
  expect(row.is_deleted).toBe(1);
});

// --- Outside the window ---

// A project whose created_at is more than 10 minutes ago must be rejected.
// The server returns 409 with the error key 'older_than_10_min' so the
// frontend can show the right message without parsing a freeform string.
test('project older than 10 minutes cannot be deleted', async () => {
  const id = await createProject('Old Project');
  ageProject(id, 11);

  const res = await request(app)
    .delete(`/api/projects/${id}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe('older_than_10_min');

  // Confirm the row was NOT soft-deleted — it should still be visible.
  const row = db.prepare('SELECT is_deleted FROM projects WHERE id = ?').get(id);
  expect(row.is_deleted).toBe(0);
});

// --- Visibility after deletion ---

// Once soft-deleted, the project must not appear in the list endpoint.
// This verifies that GET /api/projects correctly filters out is_deleted = 1 records.
test('soft-deleted project does not appear in project list', async () => {
  const id = await createProject('Hidden After Delete');

  await request(app)
    .delete(`/api/projects/${id}`)
    .set('Authorization', `Bearer ${token}`);

  const res = await request(app)
    .get('/api/projects')
    .set('Authorization', `Bearer ${token}`);

  const ids = res.body.map(p => p.id);
  expect(ids).not.toContain(id);
});

// --- Boundary: just inside the window ---

// A project aged 9 minutes is still within the 10-minute window and must be deletable.
// We avoid testing exactly 10 minutes because SQLite datetime precision plus test
// execution time makes that boundary inherently flaky.
test('project aged 9 minutes can still be deleted', async () => {
  const id = await createProject('Boundary Project');
  ageProject(id, 9);

  const res = await request(app)
    .delete(`/api/projects/${id}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
});
