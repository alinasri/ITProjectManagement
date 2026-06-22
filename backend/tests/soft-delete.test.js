// soft-delete.test.js — Verifies the soft-delete + 10-minute window behaviour for projects.
//
// "Soft delete" means the row is never physically removed from the database.
// Instead, is_deleted is set to 1. The GET endpoints filter it out (WHERE is_deleted = 0),
// making the record invisible to the UI while preserving it for audit purposes.
//
// The 10-minute window: only records created within the last 10 minutes can be deleted.
// This prevents accidental deletion of established records while still allowing
// immediate cleanup of just-created test entries.

const request = require('supertest');
const { setupTestApp, seedUser, makeToken } = require('./helpers');

let app, db, jwt, JWT_SECRET;
let token;

beforeAll(() => {
  ({ app, db, jwt, JWT_SECRET } = setupTestApp());

  const id = seedUser(db, { username: 'test_super', role: 'super_admin' });
  token = makeToken(jwt, JWT_SECRET, { id, username: 'admin', role: 'super_admin' });
});

// ageProject — directly sets a project's created_at timestamp to N minutes in the past.
// WHY: we can't actually wait 10 minutes in a test. Manipulating the database directly
// lets us simulate "this record has been around for 11 minutes" instantly.
// datetime('now', '-11 minutes') is SQLite syntax for: current time minus 11 minutes.
function ageProject(projectId, minutesAgo) {
  db.prepare(
    `UPDATE projects SET created_at = datetime('now', '-${minutesAgo} minutes') WHERE id = ?`
  ).run(projectId);
}

// createProject — helper that creates a project via the API and returns its ID.
// Avoids repeating the full POST setup in every test.
// `async` because we await the HTTP request.
async function createProject(title) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, section_id: 1 });
  return res.body.id;
}

// ─── Within the window ────────────────────────────────────────────────────────

// A project created moments ago should be deletable.
// After deletion: the response is 200, and the row still exists in the DB with is_deleted = 1.
test('fresh project can be deleted within the 10-minute window', async () => {
  const id = await createProject('Fresh Project');

  const res = await request(app)
    .delete(`/api/projects/${id}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);

  // Query the database directly to confirm the row is still there but flagged.
  // This is a WHITE-BOX test: we look inside the DB, not just at the API response.
  // It verifies the implementation (soft delete) not just the observable behaviour.
  const row = db.prepare('SELECT is_deleted FROM projects WHERE id = ?').get(id);
  expect(row.is_deleted).toBe(1);
});

// ─── Outside the window ───────────────────────────────────────────────────────

// A project whose created_at is more than 10 minutes ago must be rejected with 409.
// The error key 'older_than_10_min' is a machine-readable string the frontend can
// switch on to display the right message without parsing a freeform error string.
test('project older than 10 minutes cannot be deleted', async () => {
  const id = await createProject('Old Project');
  ageProject(id, 11); // simulate: this was created 11 minutes ago

  const res = await request(app)
    .delete(`/api/projects/${id}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe('older_than_10_min');

  // Confirm the row was NOT soft-deleted — it should still be is_deleted = 0.
  const row = db.prepare('SELECT is_deleted FROM projects WHERE id = ?').get(id);
  expect(row.is_deleted).toBe(0);
});

// ─── Visibility after deletion ────────────────────────────────────────────────

// Once soft-deleted, the project must not appear in the list endpoint.
// This verifies GET /api/projects correctly applies WHERE is_deleted = 0.
test('soft-deleted project does not appear in project list', async () => {
  const id = await createProject('Hidden After Delete');

  // Delete it (within the window — just created).
  await request(app)
    .delete(`/api/projects/${id}`)
    .set('Authorization', `Bearer ${token}`);

  // Now fetch the list and confirm the deleted project is absent.
  const res = await request(app)
    .get('/api/projects')
    .set('Authorization', `Bearer ${token}`);

  const ids = res.body.map(p => p.id);
  expect(ids).not.toContain(id);
});

// ─── Boundary: just inside the window ────────────────────────────────────────

// A project aged 9 minutes is still within the 10-minute window and must be deletable.
// We intentionally avoid testing exactly 10 minutes because SQLite datetime precision
// combined with test execution time makes that exact boundary inherently flaky.
// Testing at 9 minutes gives a comfortable margin without losing coverage.
test('project aged 9 minutes can still be deleted', async () => {
  const id = await createProject('Boundary Project');
  ageProject(id, 9);

  const res = await request(app)
    .delete(`/api/projects/${id}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
});
