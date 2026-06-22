const request = require('supertest');
const { setupTestApp, seedUser, makeToken } = require('./helpers');

let app, db, jwt, JWT_SECRET;

// One JWT token per role, keyed by role name. Built once in beforeAll and
// reused across all tests so we don't repeat setup inside each test.
const tokens = {};

beforeAll(() => {
  ({ app, db, jwt, JWT_SECRET } = setupTestApp());

  // The schema seeds sections 1–5 on first run, so section_id 1 is always valid.
  const users = [
    { username: 'u_super',    role: 'super_admin',    section_id: null },
    { username: 'u_ithead',   role: 'it_head',        section_id: null },
    { username: 'u_section',  role: 'section_head',   section_id: 1    },
    { username: 'u_purchase', role: 'purchase_admin', section_id: null },
    { username: 'u_tender',   role: 'tender_admin',   section_id: null },
    { username: 'u_contract', role: 'contract_admin', section_id: null },
  ];

  for (const u of users) {
    const id = seedUser(db, { username: u.username, role: u.role, section_id: u.section_id });
    tokens[u.role] = makeToken(jwt, JWT_SECRET, { id, username: u.username, role: u.role, section_id: u.section_id });
  }
});

// Convenience wrapper so tests don't repeat the Authorization header every time.
function authed(method, url, role) {
  return request(app)[method](url).set('Authorization', `Bearer ${tokens[role]}`);
}

// --- Projects ---
// Only super_admin and section_head may create projects.
// All other roles (including it_head) are blocked with 403.

describe('Projects – create', () => {
  test('super_admin can create a project', async () => {
    const res = await authed('post', '/api/projects', 'super_admin')
      .send({ title: 'Test Project', section_id: 1 });
    expect(res.status).toBe(201);
  });

  test('section_head can create a project in their own section', async () => {
    const res = await authed('post', '/api/projects', 'section_head')
      .send({ title: 'Section Project' }); // section_id comes from the token
    expect(res.status).toBe(201);
  });

  test('it_head cannot create a project', async () => {
    const res = await authed('post', '/api/projects', 'it_head')
      .send({ title: 'Denied', section_id: 1 });
    expect(res.status).toBe(403);
  });

  test('purchase_admin cannot create a project', async () => {
    const res = await authed('post', '/api/projects', 'purchase_admin')
      .send({ title: 'Denied', section_id: 1 });
    expect(res.status).toBe(403);
  });

  test('tender_admin cannot create a project', async () => {
    const res = await authed('post', '/api/projects', 'tender_admin')
      .send({ title: 'Denied', section_id: 1 });
    expect(res.status).toBe(403);
  });

  test('contract_admin cannot create a project', async () => {
    const res = await authed('post', '/api/projects', 'contract_admin')
      .send({ title: 'Denied', section_id: 1 });
    expect(res.status).toBe(403);
  });
});

// --- Purchases ---
// READ: super_admin, it_head, purchase_admin, section_head allowed. tender_admin and contract_admin are not.
// WRITE: super_admin and purchase_admin only.

describe('Purchases – read', () => {
  test('purchase_admin can list purchases', async () => {
    const res = await authed('get', '/api/purchases', 'purchase_admin');
    expect(res.status).toBe(200);
  });

  test('it_head can list purchases', async () => {
    const res = await authed('get', '/api/purchases', 'it_head');
    expect(res.status).toBe(200);
  });

  test('section_head can list purchases', async () => {
    const res = await authed('get', '/api/purchases', 'section_head');
    expect(res.status).toBe(200);
  });

  test('tender_admin cannot list purchases', async () => {
    const res = await authed('get', '/api/purchases', 'tender_admin');
    expect(res.status).toBe(403);
  });

  test('contract_admin cannot list purchases', async () => {
    const res = await authed('get', '/api/purchases', 'contract_admin');
    expect(res.status).toBe(403);
  });
});

describe('Purchases – create', () => {
  test('purchase_admin can create a purchase', async () => {
    const res = await authed('post', '/api/purchases', 'purchase_admin')
      .send({ title: 'Test Purchase' });
    expect(res.status).toBe(201);
  });

  test('it_head cannot create a purchase', async () => {
    const res = await authed('post', '/api/purchases', 'it_head')
      .send({ title: 'Denied' });
    expect(res.status).toBe(403);
  });

  test('section_head cannot create a purchase', async () => {
    const res = await authed('post', '/api/purchases', 'section_head')
      .send({ title: 'Denied' });
    expect(res.status).toBe(403);
  });

  test('tender_admin cannot create a purchase', async () => {
    const res = await authed('post', '/api/purchases', 'tender_admin')
      .send({ title: 'Denied' });
    expect(res.status).toBe(403);
  });
});

// --- Tenders ---
// READ: super_admin, it_head, tender_admin, section_head. purchase_admin and contract_admin are not.
// WRITE: super_admin and tender_admin only.

describe('Tenders – read', () => {
  test('tender_admin can list tenders', async () => {
    const res = await authed('get', '/api/tenders', 'tender_admin');
    expect(res.status).toBe(200);
  });

  test('purchase_admin cannot list tenders', async () => {
    const res = await authed('get', '/api/tenders', 'purchase_admin');
    expect(res.status).toBe(403);
  });

  test('contract_admin cannot list tenders', async () => {
    const res = await authed('get', '/api/tenders', 'contract_admin');
    expect(res.status).toBe(403);
  });
});

describe('Tenders – create', () => {
  test('tender_admin can create a tender', async () => {
    const res = await authed('post', '/api/tenders', 'tender_admin')
      .send({ title: 'Test Tender' });
    expect(res.status).toBe(201);
  });

  test('purchase_admin cannot create a tender', async () => {
    const res = await authed('post', '/api/tenders', 'purchase_admin')
      .send({ title: 'Denied' });
    expect(res.status).toBe(403);
  });

  test('it_head cannot create a tender', async () => {
    const res = await authed('post', '/api/tenders', 'it_head')
      .send({ title: 'Denied' });
    expect(res.status).toBe(403);
  });
});

// --- Contracts ---
// READ: super_admin, it_head, contract_admin, section_head. purchase_admin and tender_admin are not.
// WRITE: super_admin and contract_admin only.

describe('Contracts – read', () => {
  test('contract_admin can list contracts', async () => {
    const res = await authed('get', '/api/contracts', 'contract_admin');
    expect(res.status).toBe(200);
  });

  test('purchase_admin cannot list contracts', async () => {
    const res = await authed('get', '/api/contracts', 'purchase_admin');
    expect(res.status).toBe(403);
  });

  test('tender_admin cannot list contracts', async () => {
    const res = await authed('get', '/api/contracts', 'tender_admin');
    expect(res.status).toBe(403);
  });
});

describe('Contracts – create', () => {
  test('contract_admin can create a contract', async () => {
    const res = await authed('post', '/api/contracts', 'contract_admin')
      .send({ title: 'Test Contract' });
    expect(res.status).toBe(201);
  });

  test('tender_admin cannot create a contract', async () => {
    const res = await authed('post', '/api/contracts', 'tender_admin')
      .send({ title: 'Denied' });
    expect(res.status).toBe(403);
  });

  test('it_head cannot create a contract', async () => {
    const res = await authed('post', '/api/contracts', 'it_head')
      .send({ title: 'Denied' });
    expect(res.status).toBe(403);
  });
});

// --- Sections ---
// Only super_admin may create, update, or delete sections.

describe('Sections – manage', () => {
  test('super_admin can create a section', async () => {
    const res = await authed('post', '/api/sections', 'super_admin')
      .send({ name: 'New Section' });
    expect(res.status).toBe(201);
  });

  test('it_head cannot create a section', async () => {
    const res = await authed('post', '/api/sections', 'it_head')
      .send({ name: 'Denied' });
    expect(res.status).toBe(403);
  });

  test('section_head cannot create a section', async () => {
    const res = await authed('post', '/api/sections', 'section_head')
      .send({ name: 'Denied' });
    expect(res.status).toBe(403);
  });
});

// --- Users ---
// Only super_admin can list or create users. All other roles are blocked.

describe('Users – manage', () => {
  test('super_admin can list users', async () => {
    const res = await authed('get', '/api/users', 'super_admin');
    expect(res.status).toBe(200);
  });

  test('it_head cannot list users', async () => {
    const res = await authed('get', '/api/users', 'it_head');
    expect(res.status).toBe(403);
  });

  test('section_head cannot list users', async () => {
    const res = await authed('get', '/api/users', 'section_head');
    expect(res.status).toBe(403);
  });

  test('super_admin can create a user', async () => {
    const res = await authed('post', '/api/users', 'super_admin')
      .send({ username: 'newuser', password: 'pass123', role: 'it_head' });
    expect(res.status).toBe(201);
  });

  test('it_head cannot create a user', async () => {
    const res = await authed('post', '/api/users', 'it_head')
      .send({ username: 'sneaky', password: 'pass123', role: 'it_head' });
    expect(res.status).toBe(403);
  });
});
