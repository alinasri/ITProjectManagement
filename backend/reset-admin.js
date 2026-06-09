// Usage: node reset-admin.js <new-password>
// Run this directly on the server when the super_admin password is forgotten.
// The admin will be forced to change the password on next login.

const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const password = process.argv[2];
if (!password || password.length < 6) {
  console.error('Usage: node reset-admin.js <new-password>   (minimum 6 characters)');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const db = new DatabaseSync(path.join(DATA_DIR, 'it_pm.db'));

const hash = bcrypt.hashSync(password, 10);
const result = db.prepare(
  `UPDATE users
   SET password_hash = ?, must_change_password = 1, is_active = 1, is_deleted = 0
   WHERE role = 'super_admin'`
).run(hash);

if (result.changes === 0) {
  console.error('No super_admin account found in the database.');
  process.exit(1);
}

console.log(`Done. ${result.changes} admin account(s) updated.`);
console.log('The admin will be prompted to change this password on next login.');
