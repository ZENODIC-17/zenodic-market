const crypto = require("crypto");
const db = require("./database");

db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_user_sessions_token
  ON user_sessions(token_hash);

  CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
  ON user_sessions(expires_at);
`);

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createUserSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  db.prepare(`
    DELETE FROM user_sessions
    WHERE expires_at <= CURRENT_TIMESTAMP
  `).run();

  db.prepare(`
    INSERT INTO user_sessions
      (user_id, token_hash, expires_at)
    VALUES
      (?, ?, datetime('now', '+7 days'))
  `).run(userId, tokenHash);

  return token;
}

function getUserFromSession(req) {
  const token = req.cookies?.zenodic_session;

  if (!token) return null;

  const tokenHash = hashToken(token);

  const user = db.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.provider
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND datetime(s.expires_at) > datetime('now')
    LIMIT 1
  `).get(tokenHash);

  return user || null;
}

function requireUser(req, res, next) {
  const user = getUserFromSession(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Ingia kwanza."
    });
  }

  req.user = user;
  next();
}

function destroyUserSession(req) {
  const token = req.cookies?.zenodic_session;

  if (!token) return;

  db.prepare(`
    DELETE FROM user_sessions
    WHERE token_hash = ?
  `).run(hashToken(token));
}

module.exports = {
  createUserSession,
  getUserFromSession,
  requireUser,
  destroyUserSession
};
