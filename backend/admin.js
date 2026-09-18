const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("./database");

function createAdmin(username, password) {
  const existing = db
    .prepare("SELECT id FROM admins WHERE username = ?")
    .get(email, email);

  if (existing) {
    throw new Error("Admin username tayari ipo.");
  }

  const passwordHash = bcrypt.hashSync(password, 12);

  const result = db
    .prepare(
      "INSERT INTO admins (username, password_hash) VALUES (?, ?)"
    )
    .run(username, passwordHash);

  return result.lastInsertRowid;
}

function loginAdmin(email, password) {
  const admin = db
    .prepare(
      "SELECT id, username, email, password_hash FROM admins WHERE LOWER(username) = ? OR LOWER(email) = ?"
    )
    .get(email, email);

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return null;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
     VALUES (?, ?, ?)`
  ).run(admin.id, tokenHash, expiresAt);

  return {
    token,
    admin: {
      id: admin.id,
      username: admin.username
    }
  };
}

function verifyAdminToken(token) {
  if (!token) return null;

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  return db
    .prepare(`
      SELECT admins.id, admins.username
      FROM admin_sessions
      JOIN admins
        ON admins.id = admin_sessions.admin_id
      WHERE admin_sessions.token_hash = ?
        AND admin_sessions.expires_at > ?
    `)
    .get(tokenHash, new Date().toISOString());
}

module.exports = {
  createAdmin,
  loginAdmin,
  verifyAdminToken
};
