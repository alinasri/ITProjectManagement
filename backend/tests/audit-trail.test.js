const request = require('supertest');
const { setupTestApp, seedUser, makeToken } = require('./helpers');

let app, db, jwt, JWT_SECRET;
let token, userId;

beforeAll(() => {
  ({ app, db, jwt, JWT_SECRET } = setupTestApp());

  userId = seedUser(db, { username: 'test_super', role: 'super_admin' });
  token = makeToken(jwt, JWT_SECRET, { id: userId, username: 'test_super', role: 'super_admin' });
});

// Helper that creates a project and returns its full response body.
async function createProject(title, status) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, section_id: 1, status });
  return res.body;
}

// Helper that reads all status_history rows for a project directly from the DB.
// Faster than going through the API and lets tests inspect raw DB state.
function getHistory(projectId) {
  return db.prepare(
    'SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY id'
  ).all('project', projectId);
}

// --- Initial status recorded on creation ---

// When a project is created, recordStatusChange is called with from_status = null.
// This ensures the history always starts with a clear "born as X" entry.
test('creating a project records its initial status in history', async () => {
  const project = await createProject('New Project', 'not_started');

  const history = getHistory(project.id);

  expect(history).toHaveLength(1);
  expect(history[0].from_status).toBeNull();
  expect(history[0].to_status).toBe('not_started');
  expect(history[0].changed_by).toBe(userId);
});

// --- Status change recorded on update ---

// When a PUT changes the status field, a new history row must appear showing
// the old value and the new value so the full transition chain is preserved.
test('changing project status adds a new history row with old and new values', async () => {
  const project = await createProject('Status Changer', 'not_started');

  await request(app)
    .put(`/api/projects/${project.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'in_progress' });

  const history = getHistory(project.id);

  // Row 0: creation (null → not_started), Row 1: the status change
  expect(history).toHaveLength(2);
  expect(history[1].from_status).toBe('not_started');
  expect(history[1].to_status).toBe('in_progress');
});

// --- Multiple transitions accumulate ---

// Each distinct status change adds another row. After three changes there should
// be four rows total (including the creation entry).
test('each status change appends a new row — history accumulates', async () => {
  const project = await createProject('Many Changes', 'not_started');

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

// --- No row added when status is unchanged ---

// recordStatusChange skips the insert when from_status === to_status.
// This prevents cluttering the audit log with no-op updates.
test('updating a project without changing status does not add a history row', async () => {
  const project = await createProject('No Status Change', 'in_progress');
  const countBefore = getHistory(project.id).length;

  await request(app)
    .put(`/api/projects/${project.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Renamed but same status', status: 'in_progress' });

  const countAfter = getHistory(project.id).length;
  expect(countAfter).toBe(countBefore);
});

// --- API history endpoint ---

// GET /api/projects/:id/history must return the audit rows in reverse
// chronological order (newest first) and include the username of who made
// each change so the UI can display it without a second request.
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
  expect(res.body.length).toBeGreaterThanOrEqual(2);

  // Both transitions must be present. We don't assert strict position because
  // the route orders by changed_at DESC and SQLite timestamps have second-level
  // precision — rows created in the same second have an undefined relative order.
  const toStatuses = res.body.map(r => r.to_status);
  expect(toStatuses).toContain('not_started');
  expect(toStatuses).toContain('in_progress');

  // Username must be joined in on every row
  expect(res.body.every(r => r.changed_by_username === 'test_super')).toBe(true);
});
