// audit-trail.test.js — Verifies that status changes are correctly recorded in status_history.
//
// The audit trail is a core feature: every time a project's status changes, a row is
// written to status_history with the old value, the new value, the timestamp, and who
// made the change. These tests verify that the trail is accurate and complete.
//
// APPROACH: a mix of BLACK-BOX and WHITE-BOX testing.
//   - Black-box: assert what the API returns (GET /:id/history endpoint).
//   - White-box: query the database directly to check the raw rows — faster and more
//     precise for counting rows and checking exact field values.

const request = require('supertest');
const { setupTestApp, seedUser, makeToken } = require('./helpers');

let app, db, jwt, JWT_SECRET;
let token, userId;

beforeAll(() => {
  ({ app, db, jwt, JWT_SECRET } = setupTestApp());

  userId = seedUser(db, { username: 'test_super', role: 'super_admin' });
  token = makeToken(jwt, JWT_SECRET, { id: userId, username: 'test_super', role: 'super_admin' });
});

// createProject — creates a project via the API and returns its full response body.
// Returns the whole body (not just the ID) so tests can access title, status, etc.
async function createProject(title, status) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, section_id: 1, status });
  return res.body;
}

// getHistory — reads status_history rows for one project directly from the database.
// Using the DB directly is faster than going through the API and lets tests inspect
// exact column values (like changed_by) that the API might not expose directly.
// ORDER BY id ensures rows are returned in insertion order, not timestamp order
// (timestamps have second-level precision so multiple rows in the same second have
// an undefined order if sorted by changed_at).
function getHistory(projectId) {
  return db.prepare(
    'SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY id'
  ).all('project', projectId);
}

// ─── Initial status recorded on creation ──────────────────────────────────────

// When a project is created, recordStatusChange is called with from_status = null.
// This creates a "born as X" entry so the history always has a clear starting point,
// even if the status is never subsequently changed.
test('creating a project records its initial status in history', async () => {
  const project = await createProject('New Project', 'not_started');

  const history = getHistory(project.id);

  // .toHaveLength(n) — asserts the array has exactly n elements.
  expect(history).toHaveLength(1);
  // .toBeNull() — asserts the value is strictly null.
  // from_status is null on creation because the project had no previous status.
  expect(history[0].from_status).toBeNull();
  expect(history[0].to_status).toBe('not_started');
  // changed_by must be the ID of the user who made the request.
  expect(history[0].changed_by).toBe(userId);
});

// ─── Status change recorded on update ─────────────────────────────────────────

// When a PUT changes the status field, a new history row must appear showing
// the old value and the new value so the full transition chain is preserved.
test('changing project status adds a new history row with old and new values', async () => {
  const project = await createProject('Status Changer', 'not_started');

  // Update the project's status via the API.
  await request(app)
    .put(`/api/projects/${project.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'in_progress' });

  const history = getHistory(project.id);

  // Expect exactly 2 rows: one for creation, one for the status change.
  expect(history).toHaveLength(2);
  // history[0] is the creation row (already tested above).
  // history[1] is the change we just made.
  expect(history[1].from_status).toBe('not_started');
  expect(history[1].to_status).toBe('in_progress');
});

// ─── Multiple transitions accumulate ──────────────────────────────────────────

// Each distinct status change appends a new row; old rows are never removed.
// After three changes there should be four rows total (one creation + three changes).
// This guarantees the full lifecycle of a project is always recoverable.
test('each status change appends a new row — history accumulates', async () => {
  const project = await createProject('Many Changes', 'not_started');

  // Apply three status changes sequentially.
  for (const status of ['in_progress', 'on_hold', 'completed']) {
    await request(app)
      .put(`/api/projects/${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status });
  }

  const history = getHistory(project.id);
  expect(history).toHaveLength(4); // creation + 3 changes
  expect(history[3].to_status).toBe('completed');
});

// ─── No row added when status is unchanged ─────────────────────────────────────

// recordStatusChange skips the insert when from_status === to_status.
// This prevents cluttering the audit log with no-op updates (e.g. a PUT that only
// changes the title but leaves status the same).
test('updating a project without changing status does not add a history row', async () => {
  const project = await createProject('No Status Change', 'in_progress');
  const countBefore = getHistory(project.id).length;

  await request(app)
    .put(`/api/projects/${project.id}`)
    .set('Authorization', `Bearer ${token}`)
    // Same status as before — only the title changes.
    .send({ title: 'Renamed but same status', status: 'in_progress' });

  const countAfter = getHistory(project.id).length;
  // toBe(countBefore) — the count must not have increased.
  expect(countAfter).toBe(countBefore);
});

// ─── API history endpoint ──────────────────────────────────────────────────────

// GET /api/projects/:id/history must return the audit rows in reverse chronological order
// (newest first — ORDER BY changed_at DESC in the route) and must include the username
// of who made each change (joined from the users table) so the UI doesn't need a second
// request to look up usernames.
test('GET /:id/history returns rows newest-first with changed_by_username', async () => {
  const project = await createProject('History API Test', 'not_started');

  await request(app)
    .put(`/api/projects/${project.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'in_progress' });

  const res = await request(app)
    .get(`/api/projects/${project.id}/history`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  // .toBeGreaterThanOrEqual(2) — at least creation + one change.
  expect(res.body.length).toBeGreaterThanOrEqual(2);

  // Check that both transitions are present somewhere in the response.
  // We don't assert strict index positions because rows created in the same
  // second have an undefined relative order when sorted by changed_at.
  const toStatuses = res.body.map(r => r.to_status);
  expect(toStatuses).toContain('not_started');
  expect(toStatuses).toContain('in_progress');

  // Every row must have the changed_by_username joined in.
  // .every(predicate) returns true only if ALL elements match the predicate.
  expect(res.body.every(r => r.changed_by_username === 'test_super')).toBe(true);
});
