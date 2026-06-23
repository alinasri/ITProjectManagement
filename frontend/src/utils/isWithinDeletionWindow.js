// Returns true if the record was created within the 10-minute deletion window.
// createdAt is the ISO datetime string stored by SQLite without a timezone suffix.
// 'Z' is appended so the browser parses it as UTC, matching the backend check.
export function isWithinDeletionWindow(createdAt) {
  return Date.now() - new Date(createdAt + 'Z').getTime() < 10 * 60 * 1000;
}
