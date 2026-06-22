// section-isolation.test.js — Verifies that section_head users are strictly confined
// to their own section's data and cannot read, edit, or delete another section's records.
//
// SETUP PATTERN: beforeAll creates TWO section_heads in TWO different sections,
// then creates one project and one task in each section via the API. Tests then
// cross-pollinate the tokens (head A tries to act on section B's data) to confirm
// the server returns 403 Forbidden.

const request = require('supertest');
const { setupTestApp, seedUser, makeToken } = require('./helpers');

let app, db, jwt, JWT_SECRET;

// Two section_heads in different sections, plus their sections' projects and tasks.
// IDs are captured at setup time so tests can reference specific records by ID.
let tokenA, tokenB;
let projectInA, projectInB;
let taskInA, taskInB;

// beforeAll is async here because we call the API to create projects and tasks.
// `await` pauses execution until each request finishes so the IDs are ready
// before any test runs.
beforeAll(async () => {
  ({ app, db, jwt, JWT_SECRET } = setupTestApp());

  // The schema seeds sections 1 and 2 on first run — we use those directly.
  const idA = seedUser(db, { username: 'head_a', role: 'section_head', section_id: 1 });
  const idB = seedUser(db, { username: 'head_b', role: 'section_head', section_id: 2 });

  tokenA = makeToken(jwt, JWT_SECRET, { id: idA, username: 'head_a', role: 'section_head', section_id: 1 });
  tokenB = makeToken(jwt, JWT_SECRET, { id: idB, username: 'head_b', role: 'section_head', section_id: 2 });

  // Create records via the API (not direct DB inserts) so section_id is enforced
  // by the route logic, matching the conditions tests will actually exercise.
  const pA = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ title: 'Project in Section A' });
  projectInA = pA.body.id;

  const pB = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ title: 'Project in Section B' });
  projectInB = pB.body.id;

  const tA = await request(app)
    .post('/api/ongoing-tasks')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ title: 'Task in Section A' });
  taskInA = tA.body.id;

  const tB = await request(app)
    .post('/api/ongoing-tasks')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ title: 'Task in Section B' });
  taskInB = tB.body.id;
});

// ─── Project visibility ────────────────────────────────────────────────────────
// A section_head's GET /api/projects response must only contain their own section's records.
// The route filters by req.user.section_id when the role is section_head.

describe('Projects – section_head visibility', () => {
  test('section_head A only sees projects from section 1', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // Extract just the IDs from the response array to check membership.
    const ids = res.body.map(p => p.id);
    expect(ids).toContain(projectInA);       // their own project must appear
    expect(ids).not.toContain(projectInB);   // the other section's project must NOT appear
  });

  test('section_head B only sees projects from section 2', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(p => p.id);
    expect(ids).toContain(projectInB);
    expect(ids).not.toContain(projectInA);
  });
});

// ─── Project edit ──────────────────────────────────────────────────────────────
// A section_head may update a project in their own section but must be rejected (403)
// when trying to update a project belonging to another section.
// The route checks: req.user.section_id !== project.section_id → 403.

describe('Projects – section_head edit', () => {
  test('section_head A can update their own project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectInA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated by A' });

    expect(res.status).toBe(200);
  });

  test('section_head A cannot update section B project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectInB}`)
      .set('Authorization', `Bearer ${tokenA}`)  // tokenA, but projectInB belongs to section 2
      .send({ title: 'Should be denied' });

    expect(res.status).toBe(403);
  });
});

// ─── Project delete ────────────────────────────────────────────────────────────
// Mirrors the edit tests but for the DELETE endpoint.

describe('Projects – section_head delete', () => {
  test('section_head A cannot delete section B project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectInB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
  });

  test('section_head A can delete their own project', async () => {
    // Create a fresh project just for this test — deleting projectInA would
    // break the visibility test above if tests ran in a different order.
    // Test isolation: each test that destroys data should create its own record.
    const created = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'To be deleted by A' });

    const res = await request(app)
      .delete(`/api/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
  });
});

// ─── Ongoing task archive ──────────────────────────────────────────────────────
// A section_head may archive tasks in their own section but not another section's.
// PATCH /:id/archive checks section ownership the same way PUT does.

describe('Ongoing tasks – section_head archive', () => {
  test('section_head A can archive their own task', async () => {
    const res = await request(app)
      .patch(`/api/ongoing-tasks/${taskInA}/archive`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ archive: true });

    expect(res.status).toBe(200);
  });

  test('section_head A cannot archive section B task', async () => {
    const res = await request(app)
      .patch(`/api/ongoing-tasks/${taskInB}/archive`)
      .set('Authorization', `Bearer ${tokenA}`)  // tokenA, but taskInB belongs to section 2
      .send({ archive: true });

    expect(res.status).toBe(403);
  });
});

// ─── Ongoing task edit ─────────────────────────────────────────────────────────

describe('Ongoing tasks – section_head edit', () => {
  test('section_head A can update their own task', async () => {
    const res = await request(app)
      .put(`/api/ongoing-tasks/${taskInA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated by A' });

    expect(res.status).toBe(200);
  });

  test('section_head A cannot update section B task', async () => {
    const res = await request(app)
      .put(`/api/ongoing-tasks/${taskInB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Should be denied' });

    expect(res.status).toBe(403);
  });
});
