const rateLimit = require("express-rate-limit");
const express = require("express");
const crypto = require("crypto");
const { loginAdmin } = require("./admin");
const db = require("./database");
const bcrypt = require("bcryptjs");
const { Resend } = require("resend");
const { sendNotificationEmail } = require("./email-service");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require("@simplewebauthn/server");


const router = express.Router();

function writeAdminAuditLog(req, {
  adminId = null,
  action,
  targetType = null,
  targetId = null,
  description = null,
  metadata = null
}) {
  try {
    const safeMetadata =
      metadata && typeof metadata === "object"
        ? JSON.stringify(metadata)
        : null;

    db.prepare(`
      INSERT INTO admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        description,
        metadata,
        ip_address,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      String(action || "unknown").slice(0, 120),
      targetType ? String(targetType).slice(0, 80) : null,
      targetId !== null && targetId !== undefined
        ? String(targetId).slice(0, 120)
        : null,
      description ? String(description).slice(0, 500) : null,
      safeMetadata ? safeMetadata.slice(0, 5000) : null,
      req.ip ? String(req.ip).slice(0, 100) : null,
      req.get("user-agent")
        ? String(req.get("user-agent")).slice(0, 500)
        : null
    );
  } catch (error) {
    console.error("Admin audit log error:", error);
  }
}

function getWebAuthnConfig() {
  const rpName = process.env.WEBAUTHN_RP_NAME;
  const rpID = process.env.WEBAUTHN_RP_ID;
  const origin = process.env.WEBAUTHN_ORIGIN;

  if (!rpName || !rpID || !origin) {
    throw new Error("WebAuthn configuration haijakamilika.");
  }

  return { rpName, rpID, origin };
}

function ensureAdminGateway() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_gateway (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const existing = db.prepare("SELECT id FROM admin_gateway WHERE id = 1").get();
  if (!existing) {
    const admin = db.prepare("SELECT username, password_hash FROM admins WHERE username = ?").get("admin@zenodic.com");
    if (admin) {
      db.prepare("INSERT INTO admin_gateway (id, email, password_hash) VALUES (1, ?, ?)").run(admin.username, admin.password_hash);
    }
  }
}

ensureAdminGateway();

const GATEWAY_COOKIE = "zenodic_admin_gateway";
const GATEWAY_TTL_MS = 10 * 60 * 1000;

function createGatewayToken() {
  return crypto.randomBytes(32).toString("hex");
}

function saveGatewaySession(token) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + GATEWAY_TTL_MS).toISOString();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_gateway_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    INSERT INTO admin_gateway_sessions (token_hash, expires_at)
    VALUES (?, ?)
  `).run(tokenHash, expiresAt);
}

function gatewayIsValid(req) {
  const token = req.cookies?.[GATEWAY_COOKIE];
  if (!token) return false;

  const tokenHash = hashToken(token);

  const session = db.prepare(`
    SELECT id
    FROM admin_gateway_sessions
    WHERE token_hash = ?
      AND expires_at > ?
  `).get(tokenHash, new Date().toISOString());

  return !!session;
}

function requireGateway(req, res, next) {
  if (!gatewayIsValid(req)) {
    return res.status(403).json({
      success: false,
      message: "Admin gateway verification inahitajika."
    });
  }

  next();
}


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Majaribio mengi ya login. Jaribu tena baada ya dakika 15."
  }
});
function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}


router.get("/management/passkeys", requireAdminSession, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        id,
        credential_id,
        transports,
        created_at,
        last_used_at
      FROM admin_webauthn_credentials
      WHERE admin_id = ?
      ORDER BY id DESC
    `).all(req.admin.id);

    const passkeys = rows.map((row) => ({
      id: row.id,
      credential_id: row.credential_id,
      transports: row.transports
        ? JSON.parse(row.transports)
        : [],
      created_at: row.created_at,
      last_used_at: row.last_used_at
    }));

    return res.json({
      success: true,
      passkeys
    });
  } catch (error) {
    console.error("Admin passkeys list error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupakia passkeys."
    });
  }
});


router.delete("/management/passkeys/:id", requireAdminSession, (req, res) => {
  try {
    const passkeyId = Number(req.params.id);

    if (!Number.isInteger(passkeyId) || passkeyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Passkey ID si sahihi."
      });
    }

    const result = db.prepare(`
      DELETE FROM admin_webauthn_credentials
      WHERE id = ? AND admin_id = ?
    `).run(passkeyId, req.admin.id);

    if (!result.changes) {
      return res.status(404).json({
        success: false,
        message: "Passkey haikupatikana."
      });
    }

    writeAdminAuditLog(req, {
      adminId: req.admin.id,
      action: "passkey.revoked",
      targetType: "admin_passkey",
      targetId: passkeyId,
      description: "Admin passkey imeondolewa."
    });

    return res.json({
      success: true,
      message: "Passkey imeondolewa."
    });
  } catch (error) {
    console.error("Admin passkey delete error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuondoa passkey."
    });
  }
});

router.post("/webauthn/register/options", requireAdminSession, async (req, res) => {
  try {
    const { rpName, rpID } = getWebAuthnConfig();

    const admin = db.prepare(
      "SELECT id, username FROM admins WHERE id = ?"
    ).get(req.admin.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin wa kwanza hakupatikana."
      });
    }

    const existingCredentials = db.prepare(
      `SELECT credential_id, transports
       FROM admin_webauthn_credentials
       WHERE admin_id = ?`
    ).all(admin.id);

    const excludeCredentials = existingCredentials.map((credential) => ({
      id: credential.credential_id,
      transports: credential.transports
        ? JSON.parse(credential.transports)
        : undefined
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: admin.username,
      userID: Buffer.from(String(admin.id), "utf8"),
      userDisplayName: admin.username,
      timeout: 60000,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred"
      }
    });

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    db.prepare(
      `DELETE FROM admin_webauthn_challenges
       WHERE admin_id = ? AND purpose = ?`
    ).run(admin.id, "registration");

    db.prepare(
      `INSERT INTO admin_webauthn_challenges
       (admin_id, challenge, purpose, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(
      admin.id,
      options.challenge,
      "registration",
      expiresAt
    );

    return res.json({
      success: true,
      options
    });
  } catch (error) {
    console.error("WEBAUTHN REGISTER OPTIONS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuandaa WebAuthn registration."
    });
  }
});

router.post("/webauthn/register/verify", requireAdminSession, async (req, res) => {
  try {
    const { origin, rpID } = getWebAuthnConfig();
    const credential = req.body;

    if (!credential || !credential.id || !credential.response) {
      return res.status(400).json({
        success: false,
        message: "WebAuthn credential haijakamilika."
      });
    }

    const admin = db.prepare(
      "SELECT id, username FROM admins WHERE id = ?"
    ).get(req.admin.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin wa kwanza hakupatikana."
      });
    }

    const challengeRow = db.prepare(
      `SELECT id, challenge, expires_at
       FROM admin_webauthn_challenges
       WHERE admin_id = ? AND purpose = ?
       ORDER BY id DESC
       LIMIT 1`
    ).get(admin.id, "registration");

    if (!challengeRow) {
      return res.status(400).json({
        success: false,
        message: "WebAuthn registration challenge haipo."
      });
    }

    if (new Date(challengeRow.expires_at).getTime() < Date.now()) {
      db.prepare(
        "DELETE FROM admin_webauthn_challenges WHERE id = ?"
      ).run(challengeRow.id);

      return res.status(400).json({
        success: false,
        message: "WebAuthn registration challenge ime-expire."
      });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        success: false,
        message: "WebAuthn credential haijathibitishwa."
      });
    }

    const registrationInfo = verification.registrationInfo;
    const storedCredential = registrationInfo.credential;

    const alreadyExists = db.prepare(
      "SELECT id FROM admin_webauthn_credentials WHERE credential_id = ?"
    ).get(storedCredential.id);

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "Passkey hii tayari imesajiliwa."
      });
    }

    db.prepare(
      `INSERT INTO admin_webauthn_credentials
       (admin_id, credential_id, public_key, counter, transports)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      admin.id,
      storedCredential.id,
      Buffer.from(storedCredential.publicKey),
      storedCredential.counter,
      storedCredential.transports
        ? JSON.stringify(storedCredential.transports)
        : null
    );

    db.prepare(
      "DELETE FROM admin_webauthn_challenges WHERE id = ?"
    ).run(challengeRow.id);

    return res.json({
      success: true,
      message: "Passkey imesajiliwa kwa mafanikio."
    });
  } catch (error) {
    console.error("WEBAUTHN REGISTER VERIFY ERROR:", error);
    return res.status(400).json({
      success: false,
      message: "WebAuthn registration verification imeshindikana."
    });
  }
});

router.post("/webauthn/auth/options", requireGateway, async (req, res) => {
  try {
    const { rpID } = getWebAuthnConfig();

    const admin = db.prepare(
      "SELECT id FROM admins WHERE id = ?"
    ).get(1);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin wa kwanza hakupatikana."
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      timeout: 60000,
      userVerification: "required"
    });

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    db.prepare(
      `DELETE FROM admin_webauthn_challenges
       WHERE admin_id = ? AND purpose = ?`
    ).run(admin.id, "authentication");

    db.prepare(
      `INSERT INTO admin_webauthn_challenges
       (admin_id, challenge, purpose, expires_at)
       VALUES (?, ?, ?, ?)`
    ).run(
      admin.id,
      options.challenge,
      "authentication",
      expiresAt
    );

    return res.json({
      success: true,
      options
    });
  } catch (error) {
    console.error("WEBAUTHN AUTH OPTIONS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuandaa WebAuthn authentication."
    });
  }
});


router.post("/webauthn/auth/verify", requireGateway, async (req, res) => {
  try {
    const { origin, rpID } = getWebAuthnConfig();
    const credential = req.body;

    if (!credential || !credential.id || !credential.response) {
      return res.status(400).json({
        success: false,
        message: "Passkey credential haijakamilika."
      });
    }

    const admin = db.prepare(
      "SELECT id, username FROM admins WHERE id = ?"
    ).get(1);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin wa kwanza hakupatikana."
      });
    }

    const credentialRow = db.prepare(`
      SELECT id, credential_id, public_key, counter, transports
      FROM admin_webauthn_credentials
      WHERE credential_id = ? AND admin_id = ?
    `).get(credential.id, admin.id);

    if (!credentialRow) {
      return res.status(401).json({
        success: false,
        message: "Passkey hii haijasajiliwa kwa admin huyu."
      });
    }

    const challengeRow = db.prepare(`
      SELECT id, challenge, expires_at
      FROM admin_webauthn_challenges
      WHERE admin_id = ? AND purpose = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(admin.id, "authentication");

    if (!challengeRow) {
      return res.status(400).json({
        success: false,
        message: "WebAuthn authentication challenge haipo."
      });
    }

    if (new Date(challengeRow.expires_at).getTime() < Date.now()) {
      db.prepare(
        "DELETE FROM admin_webauthn_challenges WHERE id = ?"
      ).run(challengeRow.id);

      return res.status(400).json({
        success: false,
        message: "Passkey challenge ime-expire. Jaribu tena."
      });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialRow.credential_id,
        publicKey: Buffer.from(credentialRow.public_key),
        counter: credentialRow.counter,
        transports: credentialRow.transports
          ? JSON.parse(credentialRow.transports)
          : undefined
      },
      requireUserVerification: true
    });

    if (!verification.verified) {
      return res.status(401).json({
        success: false,
        message: "Passkey haijathibitishwa."
      });
    }

    db.prepare(`
      UPDATE admin_webauthn_credentials
      SET counter = ?
      WHERE id = ?
    `).run(
      verification.authenticationInfo.newCounter,
      credentialRow.id
    );

    db.prepare(
      "DELETE FROM admin_webauthn_challenges WHERE id = ?"
    ).run(challengeRow.id);

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    db.prepare(`
      INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `).run(admin.id, tokenHash, expiresAt);

    return res.json({
      success: true,
      message: "Passkey login imefanikiwa.",
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });

  } catch (error) {
    console.error("WEBAUTHN AUTH VERIFY ERROR:", error);

    return res.status(400).json({
      success: false,
      message: "Passkey authentication imeshindikana."
    });
  }
});

router.post("/gateway-login", loginLimiter, (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email na password vinahitajika."
      });
    }

    const gateway = db
      .prepare(`
        SELECT id, email, password_hash
        FROM admin_gateway
        WHERE id = 1
      `)
      .get();

    if (!gateway) {
      return res.status(500).json({
        success: false,
        message: "Admin gateway haijawekwa."
      });
    }

    const validEmail =
      email.trim().toLowerCase() ===
      gateway.email.toLowerCase();

    const validPassword =
      bcrypt.compareSync(password, gateway.password_hash);

    console.log(
      "ADMIN GATEWAY CHECK:",
      {
        validEmail,
        validPassword,
        emailReceived: !!email,
        passwordReceived: !!password
      }
    );

    if (!validEmail || !validPassword) {
      return res.status(401).json({
        success: false,
        message: "Gateway email au password si sahihi."
      });
    }

    const gatewayToken = createGatewayToken();
    saveGatewaySession(gatewayToken);

    res.cookie(GATEWAY_COOKIE, gatewayToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: GATEWAY_TTL_MS,
      path: "/api/admin"
    });

    console.log("ADMIN LOGIN SUCCESS - SENDING RESPONSE");

    res.json({
      success: true,
      message: "Gateway authentication imefanikiwa."
    });

  } catch (error) {
    console.error("Admin gateway error:", error);

    res.status(500).json({
      success: false,
      message: "Kuna tatizo kwenye admin gateway."
    });
  }
});


function requireAdminSession(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : req.cookies?.zenodicAdminToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Admin session inahitajika."
    });
  }

  const tokenHash = hashToken(token);

  const session = db.prepare(`
    SELECT admins.id, admins.username AS email
    FROM admin_sessions
    JOIN admins ON admins.id = admin_sessions.admin_id
    WHERE admin_sessions.token_hash = ?
      AND admin_sessions.expires_at > ?
  `).get(tokenHash, new Date().toISOString());

  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Admin session si halali au ime-expire."
    });
  }

  req.admin = session;
  next();
}

router.post("/login", loginLimiter, requireGateway, (req, res) => { console.log("ADMIN LOGIN REQUEST:", req.body?.email);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email na password vinahitajika."
      });
    }

    console.log("BEFORE LOGINADMIN");
    const result = loginAdmin(
      email.trim().toLowerCase(),
      password
    );
    console.log("AFTER LOGINADMIN:", !!result);

    if (!result) {
      writeAdminAuditLog(req, {
        action: "admin.login.failed",
        targetType: "admin_session",
        description: "Admin login imekataa kwa credentials zisizo sahihi."
      });

      return res.status(401).json({
        success: false,
        message: "Email au password si sahihi."
      });
    }

    writeAdminAuditLog(req, {
      adminId: result.admin?.id || null,
      action: "admin.login.success",
      targetType: "admin_session",
      targetId: result.admin?.id || null,
      description: "Admin login imefanikiwa."
    });

    res.cookie("zenodicAdminToken", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      path: "/"
    });

    res.json({
      success: true,
      message: "Admin login imefanikiwa.",
      token: result.token,
      admin: result.admin
    });

  } catch (error) {
    console.error("Admin login error:", error);

    res.status(500).json({
      success: false,
      message: "Kuna tatizo kwenye admin login."
    });
  }
});

router.get("/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token =
    auth.startsWith("Bearer ")
      ? auth.slice(7)
      : req.cookies?.zenodicAdminToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Admin token haipo."
    });
  }
  const tokenHash = hashToken(token);

  console.log("ADMIN /ME CHECK:", {
    hasBearer: true,
    tokenLength: token.length,
    tokenHashPrefix: tokenHash.slice(0, 12)
  });

  const db = require("./database");

  const session = db
    .prepare(`
      SELECT admins.id, admins.username AS email
      FROM admin_sessions
      JOIN admins
        ON admins.id = admin_sessions.admin_id
      WHERE admin_sessions.token_hash = ?
      AND admin_sessions.expires_at > ?
    `)
    .get(
      tokenHash,
      new Date().toISOString()
    );

  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Admin session si halali au ime-expire."
    });
  }

  res.json({
    success: true,
    admin: session
  });
});


// ============================================================
// ADMIN MANAGEMENT API
// ============================================================

router.get("/management/stats", requireAdminSession, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(role = 'buyer') AS buyers,
        SUM(role = 'seller') AS sellers,
        SUM(role = 'wholesale') AS wholesalers,
        SUM(role IN ('seller','wholesale') AND verification_status = 'pending') AS pending_verification,
        SUM(account_status = 'suspended') AS suspended
      FROM users
    `).get();

    const products = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(approval_status = 'pending') AS pending,
        SUM(approval_status = 'approved') AS approved,
        SUM(approval_status = 'rejected') AS rejected
      FROM inventory
    `).get();

    const orders = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(payment_status = 'paid') AS paid,
        COALESCE(
          SUM(
            CASE
              WHEN payment_status = 'paid' THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS revenue
      FROM orders
    `).get();

    const payouts = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('completed', 'paid', 'processed') THEN amount ELSE 0 END), 0) AS paid_out,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_payout
      FROM seller_payouts
    `).get();

    const commissions = db.prepare(`
      SELECT
        COALESCE(SUM(commission_amount), 0) AS commission
      FROM admin_commissions
    `).get();

    res.json({
      success: true,
      stats: { users, products, orders, payouts, commissions }
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Imeshindikana kupata admin statistics."
    });
  }
});

router.get("/management/audit-logs", requireAdminSession, (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim().slice(0, 100);
    const action = String(req.query.action || "").trim().slice(0, 120);
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));

    const where = [
      "a.created_at >= datetime('now', ?)"
    ];
    const params = [`-${days} days`];

    if (search) {
      where.push(`
        (
          a.action LIKE ?
          OR a.description LIKE ?
          OR a.target_type LIKE ?
          OR a.target_id LIKE ?
          OR COALESCE(ad.username, '') LIKE ?
          OR COALESCE(ad.username, '') LIKE ?
        )
      `);

      const pattern = `%${search}%`;
      params.push(
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern
      );
    }

    if (action) {
      where.push("a.action = ?");
      params.push(action);
    }

    const whereSql = where.join(" AND ");

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS total
      FROM admin_audit_logs a
      LEFT JOIN admins ad ON ad.id = a.admin_id
      WHERE ${whereSql}
    `).get(...params);

    const logs = db.prepare(`
      SELECT
        a.id,
        a.admin_id,
        a.action,
        a.target_type,
        a.target_id,
        a.description,
        a.metadata,
        a.ip_address,
        a.user_agent,
        a.created_at,
        ad.username AS admin_name,
        ad.username AS admin_email
      FROM admin_audit_logs a
      LEFT JOIN admins ad ON ad.id = a.admin_id
      WHERE ${whereSql}
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total: Number(totalRow?.total || 0),
        total_pages: Math.ceil(
          Number(totalRow?.total || 0) / limit
        )
      },
      filters: {
        search,
        action,
        days
      }
    });
  } catch (error) {
    console.error("Admin audit logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata audit logs."
    });
  }
});


router.delete("/management/audit-logs/:id", requireAdminSession, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Audit ID si sahihi."
      });
    }

    const existing = db.prepare(
      "SELECT id, action, target_type, target_id FROM admin_audit_logs WHERE id = ?"
    ).get(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Audit activity haijapatikana."
      });
    }

    db.prepare("DELETE FROM admin_audit_logs WHERE id = ?").run(id);

    return res.json({
      success: true,
      message: "Audit activity imefutwa."
    });
  } catch (error) {
    console.error("Delete admin audit log error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kufuta audit activity."
    });
  }
});

router.get("/management/users", requireAdminSession, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        id,
        name,
        email,
        role,
        verification_status,
        account_status,
        created_at,
        last_login_at
      FROM users
      ORDER BY id DESC
    `).all();

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({
      success: false,
      message: "Imeshindikana kupata users."
    });
  }
});

router.get("/management/users/:id", requireAdminSession, (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    const user = db.prepare(`
      SELECT
        id,
        name,
        email,
        role,
        provider,
        provider_id,
        verification_status,
        account_status,
        created_at,
        updated_at,
        last_login_at
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User hakupatikana."
      });
    }

    const productCount = db.prepare(`
      SELECT COUNT(*) AS total
      FROM inventory
      WHERE user_id = ?
    `).get(userId);

    const sellerSettings = db.prepare(`
      SELECT *
      FROM seller_settings
      WHERE user_id = ?
    `).get(userId);

    res.json({
      success: true,
      user,
      productCount: productCount.total,
      sellerSettings: sellerSettings || null
    });
  } catch (error) {
    console.error("Admin user details error:", error);
    res.status(500).json({
      success: false,
      message: "Imeshindikana kupata taarifa za user."
    });
  }
});

router.patch("/management/users/:id/verification", requireAdminSession, (req, res) => {
  try {
    const userId = Number(req.params.id);
    const status = String(req.body?.status || "").trim().toLowerCase();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    if (!["verified", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Verification status si sahihi."
      });
    }

    const user = db.prepare(`
      SELECT id, role
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User hakupatikana."
      });
    }

    if (!["seller", "wholesale"].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: "Verification inaruhusiwa kwa Seller na Wholesaler tu."
      });
    }

    db.prepare(`
      UPDATE users
      SET verification_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, userId);

    res.json({
      success: true,
      message: `User verification imewekwa kuwa ${status}.`
    });
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha verification."
    });
  }
});

router.patch("/management/users/:id/suspension", requireAdminSession, (req, res) => {
  try {
    const userId = Number(req.params.id);
    const suspended = Boolean(req.body?.suspended);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    const user = db.prepare(`
      SELECT id, role, account_status
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User hakupatikana."
      });
    }

    const newStatus = suspended ? "suspended" : "active";

    db.prepare(`
      UPDATE users
      SET account_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, userId);

    res.json({
      success: true,
      message: suspended ? "User amesuspendiwa." : "User amerudishwa active.",
      account_status: newStatus
    });
  } catch (error) {
    console.error("Admin suspension error:", error);
    res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha suspension."
    });
  }
});

router.delete("/management/users/:id", requireAdminSession, (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    const user = db.prepare(`
      SELECT id, role
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User hakupatikana."
      });
    }

    const hasAdmin = db.prepare(`
      SELECT id
      FROM admins
      WHERE id = ?
    `).get(userId);

    if (hasAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin account haiwezi kufutwa hapa."
      });
    }

    db.prepare(`
      UPDATE users
      SET account_status = 'deleted',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId);

    res.json({
      success: true,
      message: "User amewekwa deleted."
    });
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Imeshindikana kufuta user."
    });
  }
});


router.get("/management/orders", requireAdminSession, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.payment_status,
        o.currency,
        o.total_amount,
        o.delivery_location,
        o.expected_delivery,
        o.created_at,
        o.updated_at,
        buyer.id AS buyer_id,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        seller.id AS seller_id,
        seller.name AS seller_name,
        seller.email AS seller_email
      FROM orders o
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
      LEFT JOIN users seller ON seller.id = o.seller_id
      ORDER BY o.id DESC
    `).all();

    return res.json({ success: true, orders });
  } catch (error) {
    console.error("Admin orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata orders."
    });
  }
});

router.get("/management/orders/:id", requireAdminSession, (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Order ID si sahihi."
      });
    }

    const order = db.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.payment_status,
        o.currency,
        o.total_amount,
        o.delivery_location,
        o.expected_delivery,
        o.created_at,
        o.updated_at,
        buyer.id AS buyer_id,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        seller.id AS seller_id,
        seller.name AS seller_name,
        seller.email AS seller_email
      FROM orders o
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
      LEFT JOIN users seller ON seller.id = o.seller_id
      WHERE o.id = ?
    `).get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order haipatikani."
      });
    }

    const items = db.prepare(`
      SELECT
        id,
        order_id,
        product_name,
        quantity,
        unit,
        unit_price,
        total_price,
        created_at
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `).all(orderId);

    return res.json({
      success: true,
      order: {
        ...order,
        items
      }
    });
  } catch (error) {
    console.error("Admin order details error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata details za order."
    });
  }
});


router.patch("/management/orders/:id/status", requireAdminSession, (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const status = String(req.body.status || "").trim().toLowerCase();

    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
    ];

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Order ID si sahihi."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status ya order si halali."
      });
    }

    const order = db.prepare(`
      SELECT
        id,
        buyer_id,
        seller_id,
        order_number,
        status AS old_status
      FROM orders
      WHERE id = ?
    `).get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order haijapatikana."
      });
    }

    db.prepare(`
      UPDATE orders
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, orderId);

    if (order.old_status !== status) {
      const statusLabels = {
        pending: "Pending",
        confirmed: "Confirmed",
        processing: "Processing",
        shipped: "Shipped",
        delivered: "Delivered"
      };

      const oldStatusLabel =
        statusLabels[order.old_status] || order.old_status || "Unknown";

      const newStatusLabel =
        statusLabels[status] || status;

      const notificationTitle = "Order status updated";
      const notificationMessage =
        `Order ${order.order_number} imebadilika kutoka ${oldStatusLabel} kwenda ${newStatusLabel}.`;

      try {
        const { createNotification } = require("./notification-helper");

        if (order.buyer_id) {
          createNotification({
            userId: order.buyer_id,
            type: "order_status_updated",
            title: notificationTitle,
            message: notificationMessage,
            orderId
          });
        }

        if (order.seller_id) {
          createNotification({
            userId: order.seller_id,
            type: "order_status_updated",
            title: notificationTitle,
            message: notificationMessage,
            orderId
          });
        }
      } catch (notificationError) {
        console.error(
          "Admin order status user notification error:",
          notificationError?.message || notificationError
        );
      }

      try {
        db.prepare(`
          INSERT INTO admin_notifications (
            type,
            title,
            message,
            priority,
            entity_type,
            entity_id,
            is_read
          )
          VALUES (?, ?, ?, ?, ?, ?, 0)
        `).run(
          "order",
          notificationTitle,
          notificationMessage,
          "normal",
          "order",
          orderId
        );
      } catch (notificationError) {
        console.error(
          "Admin order status notification error:",
          notificationError?.message || notificationError
        );
      }
    }

    const updated = db.prepare(`
      SELECT *
      FROM orders
      WHERE id = ?
    `).get(orderId);

    return res.json({
      success: true,
      message: "Order status imebadilishwa.",
      order: updated
    });
  } catch (error) {
    console.error("Admin update order status error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha order status."
    });
  }
});

// Admin cancellation: only pending + unpaid orders can be cancelled safely.
router.post("/management/orders/:id/cancel", requireAdminSession, (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Order ID si sahihi."
      });
    }

    const order = db.prepare(`
      SELECT
        id,
        buyer_id,
        seller_id,
        order_number,
        status,
        payment_status
      FROM orders
      WHERE id = ?
      LIMIT 1
    `).get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order haijapatikana."
      });
    }

    if (order.status !== "pending" || order.payment_status !== "unpaid") {
      return res.status(409).json({
        success: false,
        message: "Admin cancellation inaruhusiwa kwa order ya pending na unpaid tu."
      });
    }

    const items = db.prepare(`
      SELECT
        product_id,
        quantity,
        product_name
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `).all(orderId);

    if (!items.length) {
      return res.status(409).json({
        success: false,
        message: "Order haina items za kurejeshea reserved stock."
      });
    }

    const invalidItem = items.find(item => {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);
      return (
        !Number.isInteger(productId) ||
        productId <= 0 ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      );
    });

    if (invalidItem) {
      return res.status(409).json({
        success: false,
        message: "Order hii haina product_id/quantity salama ya kurejeshea stock."
      });
    }

    db.exec("BEGIN");

    try {
      const currentOrder = db.prepare(`
        SELECT status, payment_status
        FROM orders
        WHERE id = ?
        LIMIT 1
      `).get(orderId);

      if (
        !currentOrder ||
        currentOrder.status !== "pending" ||
        currentOrder.payment_status !== "unpaid"
      ) {
        throw new Error("ORDER_STATE_CHANGED");
      }

      const releaseStock = db.prepare(`
        UPDATE inventory
        SET reserved_quantity =
          COALESCE(reserved_quantity, 0) - ?
        WHERE id = ?
          AND COALESCE(reserved_quantity, 0) >= ?
      `);

      for (const item of items) {
        const released = releaseStock.run(
          Number(item.quantity),
          Number(item.product_id),
          Number(item.quantity)
        );

        if (released.changes !== 1) {
          throw new Error("STOCK_RELEASE_FAILED");
        }
      }

      const updatedOrder = db.prepare(`
        UPDATE orders
        SET status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'pending'
          AND payment_status = 'unpaid'
      `).run(orderId);

      if (updatedOrder.changes !== 1) {
        throw new Error("ORDER_UPDATE_FAILED");
      }

      db.exec("COMMIT");
    } catch (transactionError) {
      try { db.exec("ROLLBACK"); } catch (_) {}

      if (transactionError?.message === "ORDER_STATE_CHANGED") {
        return res.status(409).json({
          success: false,
          message: "Order tayari imebadilishwa na haiwezi ku-cancel."
        });
      }

      if (transactionError?.message === "STOCK_RELEASE_FAILED") {
        return res.status(409).json({
          success: false,
          message: "Reserved stock haikuweza kurejeshwa salama, hivyo order haijacancel."
        });
      }

      if (transactionError?.message === "ORDER_UPDATE_FAILED") {
        return res.status(409).json({
          success: false,
          message: "Order haikuweza kubadilishwa kuwa cancelled."
        });
      }

      throw transactionError;
    }

    try {
      if (order.buyer_id) {
        const { createNotification } = require("./notification-helper");
        createNotification({
          userId: order.buyer_id,
          type: "order_cancelled",
          title: "Order cancelled",
          message: `Order ${order.order_number} imecancelwa na admin.`,
          orderId
        });
      }

      if (order.seller_id) {
        const { createNotification } = require("./notification-helper");
        createNotification({
          userId: order.seller_id,
          type: "order_cancelled",
          title: "Order cancelled",
          message: `Order ${order.order_number} imecancelwa na admin.`,
          orderId
        });
      }
    } catch (notificationError) {
      console.error(
        "Admin cancellation user notification error:",
        notificationError?.message || notificationError
      );
    }

    try {
      db.prepare(`
        INSERT INTO admin_notifications (
          type,
          title,
          message,
          priority,
          entity_type,
          entity_id,
          is_read
        )
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(
        "order",
        "Order cancelled by admin",
        `Order ${order.order_number} imecancelwa na admin.`,
        "important",
        "order",
        orderId
      );
    } catch (notificationError) {
      console.error(
        "Admin cancellation notification error:",
        notificationError?.message || notificationError
      );
    }

    const updated = db.prepare(`
      SELECT
        id,
        buyer_id,
        seller_id,
        order_number,
        status,
        payment_status,
        currency,
        total_amount,
        delivery_location,
        expected_delivery,
        created_at,
        updated_at
      FROM orders
      WHERE id = ?
      LIMIT 1
    `).get(orderId);

    return res.json({
      success: true,
      message: "Order imecancelwa na reserved stock imerejeshwa.",
      order: updated
    });
  } catch (error) {
    console.error("Admin order cancellation error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana ku-cancel order."
    });
  }
});

router.get("/management/products", requireAdminSession, (req, res) => {
  try {
    const products = db.prepare(`
      SELECT
        inventory.id,
        inventory.user_id,
        inventory.item_name,
        inventory.item_type,
        inventory.sku,
        inventory.quantity,
        inventory.unit,
        inventory.location,
        inventory.image_url,
        inventory.description,
        inventory.price,
        inventory.phone,
        inventory.approval_status,
        inventory.created_at,
        users.name AS user_name,
        users.email AS user_email,
        users.role AS user_role,
        users.verification_status AS user_verification_status
      FROM inventory
      JOIN users ON users.id = inventory.user_id
      WHERE users.role IN ('seller', 'wholesale')
      ORDER BY inventory.id DESC
    `).all();

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error("Admin products error:", error);
    res.status(500).json({
      success: false,
      message: "Imeshindikana kupata products."
    });
  }
});

router.patch("/management/products/:id/approval", requireAdminSession, (req, res) => {
  try {
    const productId = Number(req.params.id);
    const status = String(req.body?.status || "").trim().toLowerCase();

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product ID si sahihi."
      });
    }

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Approval status si sahihi."
      });
    }

    const product = db.prepare(`
      SELECT inventory.id, users.role
      FROM inventory
      JOIN users ON users.id = inventory.user_id
      WHERE inventory.id = ?
    `).get(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product haikupatikana."
      });
    }

    if (!["seller", "wholesale"].includes(product.role)) {
      return res.status(400).json({
        success: false,
        message: "Product hii si ya Seller au Wholesaler."
      });
    }

    db.prepare(`
      UPDATE inventory
      SET approval_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, productId);

    res.json({
      success: true,
      message: `Product approval imewekwa kuwa ${status}.`
    });
  } catch (error) {
    console.error("Admin product approval error:", error);
    res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha product approval."
    });
  }
});

// Admin payment monitoring


router.get("/management/commission-payouts", requireAdminSession, (req, res) => {
  try {
    const payouts = db.prepare(`
      SELECT
        p.id,
        p.payout_reference,
        p.account_id,
        p.currency,
        p.amount,
        p.status,
        p.provider_reference,
        p.notes,
        p.paid_at,
        p.created_at,
        p.updated_at,
        a.account_type,
        a.provider,
        a.account_name,
        a.account_number,
        a.currency AS account_currency,
        a.is_active AS account_is_active
      FROM admin_commission_payouts p
      LEFT JOIN admin_payout_accounts a
        ON a.id = p.account_id
      ORDER BY p.id DESC
    `).all();

    return res.json({
      success: true,
      payouts
    });
  } catch (error) {
    console.error("Admin commission payouts list error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata commission payouts."
    });
  }
});

router.post("/management/commission-payouts", requireAdminSession, (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const currency = String(req.body?.currency || "TZS").trim().toUpperCase();
    const notes = String(req.body?.notes || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount lazima iwe zaidi ya 0."
      });
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({
        success: false,
        message: "Currency si sahihi."
      });
    }

    if (notes.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Notes ni ndefu sana."
      });
    }

    let transactionStarted = false;
    let result;

    try {
      db.exec("BEGIN IMMEDIATE");
      transactionStarted = true;

      const account = db.prepare(`
        SELECT
          id,
          account_type,
          provider,
          account_name,
          account_number,
          currency,
          is_active
        FROM admin_payout_accounts
        WHERE is_active = 1
        ORDER BY id DESC
        LIMIT 1
      `).get();

      if (!account) {
        const error = new Error("Hakuna Admin Payment Account iliyo active.");
        error.statusCode = 400;
        throw error;
      }

      if (account.currency !== currency) {
        const error = new Error(
          "Currency ya payout lazima ilingane na Admin Payment Account."
        );
        error.statusCode = 400;
        throw error;
      }

      const commissionRow = db.prepare(`
        SELECT COALESCE(SUM(commission_amount), 0) AS total_commission
        FROM admin_commissions
        WHERE currency = ?
      `).get(currency);

      const reservedRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS reserved_payout
        FROM admin_commission_payouts
        WHERE currency = ?
          AND status IN ('pending', 'processing', 'paid')
      `).get(currency);

      const totalCommission = Number(commissionRow?.total_commission || 0);
      const reservedPayout = Number(reservedRow?.reserved_payout || 0);
      const availableCommission = Math.max(
        0,
        Math.round((totalCommission - reservedPayout) * 100) / 100
      );

      if (amount > availableCommission) {
        const error = new Error(
          "Commission inayopatikana haitoshi kwa payout hii."
        );
        error.statusCode = 400;
        throw error;
      }

      const payoutReference =
        "ZND-COMMISSION-PAYOUT-" +
        Date.now() +
        "-" +
        crypto.randomBytes(3).toString("hex").toUpperCase();

      const insert = db.prepare(`
        INSERT INTO admin_commission_payouts (
          payout_reference,
          account_id,
          currency,
          amount,
          status,
          notes
        )
        VALUES (?, ?, ?, ?, 'pending', ?)
      `).run(
        payoutReference,
        account.id,
        currency,
        Math.round(amount * 100) / 100,
        notes || null
      );

      result = db.prepare(`
        SELECT
          p.*,
          a.account_type,
          a.provider,
          a.account_name,
          a.account_number
        FROM admin_commission_payouts p
        LEFT JOIN admin_payout_accounts a ON a.id = p.account_id
        WHERE p.id = ?
      `).get(insert.lastInsertRowid);

      db.exec("COMMIT");
      transactionStarted = false;
    } catch (transactionError) {
      if (transactionStarted) {
        try { db.exec("ROLLBACK"); } catch (_) {}
      }
      throw transactionError;
    }

    return res.status(201).json({
      success: true,
      message: "Commission payout request imeundwa.",
      payout: result
    });
  } catch (error) {
    console.error("Admin commission payout creation error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Imeshindikana kuunda commission payout."
    });
  }
});


router.patch("/management/commission-payouts/:id", requireAdminSession, (req, res) => {
  try {
    const payoutId = Number(req.params.id);
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const providerReference = String(req.body?.provider_reference || "").trim();

    if (!Number.isInteger(payoutId) || payoutId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payout ID si sahihi."
      });
    }

    const allowedStatuses = new Set([
      "processing",
      "paid",
      "failed",
      "cancelled"
    ]);

    if (!allowedStatuses.has(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status ya payout si sahihi."
      });
    }

    if (nextStatus === "paid" && !providerReference) {
      return res.status(400).json({
        success: false,
        message: "Provider reference inahitajika kabla ya payout kuwa paid."
      });
    }

    let transactionStarted = false;
    let updatedPayout;

    try {
      db.exec("BEGIN IMMEDIATE");
      transactionStarted = true;

      const payout = db.prepare(`
        SELECT
          id,
          payout_reference,
          currency,
          amount,
          status,
          provider_reference,
          notes
        FROM admin_commission_payouts
        WHERE id = ?
      `).get(payoutId);

      if (!payout) {
        const error = new Error("Commission payout haikupatikana.");
        error.statusCode = 404;
        throw error;
      }

      const currentStatus = String(payout.status || "").toLowerCase();

      if (["paid", "failed", "cancelled"].includes(currentStatus)) {
        const error = new Error(
          "Payout iliyofika terminal status haiwezi kubadilishwa."
        );
        error.statusCode = 400;
        throw error;
      }

      const validTransition =
        (currentStatus === "pending" && nextStatus === "processing") ||
        (currentStatus === "processing" &&
          ["paid", "failed", "cancelled"].includes(nextStatus));

      if (!validTransition) {
        const error = new Error(
          `Transition kutoka ${currentStatus} kwenda ${nextStatus} hairuhusiwi.`
        );
        error.statusCode = 400;
        throw error;
      }

      const paidAt = nextStatus === "paid"
        ? new Date().toISOString()
        : null;

      db.prepare(`
        UPDATE admin_commission_payouts
        SET
          status = ?,
          provider_reference = CASE
            WHEN ? <> '' THEN ?
            ELSE provider_reference
          END,
          paid_at = CASE
            WHEN ? = 'paid' THEN ?
            ELSE paid_at
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        nextStatus,
        providerReference,
        providerReference,
        nextStatus,
        paidAt,
        payoutId
      );

      updatedPayout = db.prepare(`
        SELECT
          p.*,
          a.account_type,
          a.provider,
          a.account_name,
          a.account_number,
          a.currency AS account_currency
        FROM admin_commission_payouts p
        LEFT JOIN admin_payout_accounts a
          ON a.id = p.account_id
        WHERE p.id = ?
      `).get(payoutId);

      db.exec("COMMIT");
      transactionStarted = false;
    } catch (transactionError) {
      if (transactionStarted) {
        try { db.exec("ROLLBACK"); } catch (_) {}
      }
      throw transactionError;
    }

    return res.json({
      success: true,
      message: "Commission payout status imebadilishwa.",
      payout: updatedPayout
    });
  } catch (error) {
    console.error("Admin commission payout status update error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message ||
        "Imeshindikana kubadilisha commission payout."
    });
  }
});

router.get("/management/commission-payout-summary", requireAdminSession, (req, res) => {
  try {
    const currency = String(req.query.currency || "TZS").trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({
        success: false,
        message: "Currency si sahihi."
      });
    }

    const commissionRow = db.prepare(`
      SELECT
        COALESCE(SUM(commission_amount), 0) AS total_commission
      FROM admin_commissions
      WHERE currency = ?
    `).get(currency);

    const payoutRow = db.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) AS reserved_payout
      FROM admin_commission_payouts
      WHERE currency = ?
        AND status IN ('pending', 'processing', 'paid')
    `).get(currency);

    const account = db.prepare(`
      SELECT
        id,
        account_type,
        provider,
        account_name,
        account_number,
        currency,
        is_active,
        created_at,
        updated_at
      FROM admin_payout_accounts
      WHERE is_active = 1
      ORDER BY id DESC
      LIMIT 1
    `).get();

    const totalCommission = Number(commissionRow?.total_commission || 0);
    const reservedPayout = Number(payoutRow?.reserved_payout || 0);
    const availableCommission = Math.max(
      0,
      Math.round((totalCommission - reservedPayout) * 100) / 100
    );

    return res.json({
      success: true,
      currency,
      total_commission: totalCommission,
      reserved_payout: reservedPayout,
      available_commission: availableCommission,
      payout_account: account || null
    });
  } catch (error) {
    console.error("Admin commission payout summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata commission payout summary."
    });
  }
});

router.get("/management/payments", requireAdminSession, (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT
        p.id,
        p.order_id,
        p.buyer_id,
        p.seller_id,
        p.payment_reference,
        p.payment_method,
        p.currency,
        p.amount,
        p.status,
        p.provider_reference,
        p.paid_at,
        p.created_at,
        p.updated_at,
        o.order_number,
        o.status AS order_status,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        seller.name AS seller_name,
        seller.email AS seller_email,
        ac.commission_rate,
        ac.commission_amount,
        ac.seller_net_amount
      FROM payments p
      LEFT JOIN orders o ON o.id = p.order_id
      LEFT JOIN users buyer ON buyer.id = p.buyer_id
      LEFT JOIN users seller ON seller.id = p.seller_id
      LEFT JOIN admin_commissions ac ON ac.payment_id = p.id
      ORDER BY p.id DESC
    `).all();

    return res.json({
      success: true,
      payments
    });
  } catch (error) {
    console.error("Admin payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata payments."
    });
  }
});


/* Admin payout monitoring */
router.get("/management/payouts", requireAdminSession, (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total_payouts,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_amount,
        COALESCE(SUM(CASE WHEN status = 'processing' THEN amount ELSE 0 END), 0) AS processing_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0) AS failed_amount,
        COALESCE(SUM(CASE WHEN status = 'cancelled' THEN amount ELSE 0 END), 0) AS cancelled_amount
      FROM seller_payouts
    `).get();

    const payouts = db.prepare(`
      SELECT
        sp.id,
        sp.seller_id,
        sp.amount,
        sp.currency,
        sp.payout_method,
        sp.status,
        sp.payout_reference,
        sp.provider_reference,
        sp.processed_at,
        sp.created_at,
        sp.updated_at,
        u.name AS seller_name,
        u.email AS seller_email
      FROM seller_payouts sp
      LEFT JOIN users u ON u.id = sp.seller_id
      ORDER BY sp.id DESC
    `).all();

    return res.json({
      success: true,
      summary: {
        total_payouts: Number(summary.total_payouts || 0),
        total_amount: Number(summary.total_amount || 0),
        pending_amount: Number(summary.pending_amount || 0),
        processing_amount: Number(summary.processing_amount || 0),
        paid_amount: Number(summary.paid_amount || 0),
        failed_amount: Number(summary.failed_amount || 0),
        cancelled_amount: Number(summary.cancelled_amount || 0)
      },
      payouts
    });
  } catch (error) {
    console.error("Admin payouts error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata payouts."
    });
  }
});



/* Admin ClickPesa payout initiation */
router.post("/management/payouts/:id/clickpesa-initiate", requireAdminSession, async (req, res) => {
  try {
    const payoutId = Number(req.params.id);

    if (!Number.isInteger(payoutId) || payoutId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payout ID si sahihi."
      });
    }

    const enabled =
      String(process.env.CLICKPESA_PAYOUT_ENABLED || "false").toLowerCase() === "true";

    if (!enabled) {
      return res.status(409).json({
        success: false,
        message: "ClickPesa payouts bado zimezimwa.",
        code: "CLICKPESA_PAYOUT_DISABLED"
      });
    }

    const payout = db.prepare(`
      SELECT
        id,
        seller_id,
        amount,
        currency,
        payout_method,
        payout_account_number,
        status,
        payout_reference,
        provider_reference
      FROM seller_payouts
      WHERE id = ?
    `).get(payoutId);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout haijapatikana."
      });
    }

    if (payout.status !== "processing") {
      return res.status(400).json({
        success: false,
        message: "Payout lazima iwe processing kabla ya kuanzishwa ClickPesa."
      });
    }

    if (payout.payout_method !== "mobile_money") {
      return res.status(400).json({
        success: false,
        message: "ClickPesa integration kwa sasa inatumia mobile money tu."
      });
    }

    if (!payout.payout_account_number) {
      return res.status(400).json({
        success: false,
        message: "Payout account number haipo."
      });
    }

    const {
      previewMobileMoneyPayout,
      createMobileMoneyPayout
    } = require("./clickpesa-payout-client");

    const preview = await previewMobileMoneyPayout({
      amount: payout.amount,
      phoneNumber: payout.payout_account_number,
      currency: payout.currency || "TZS",
      orderReference: payout.payout_reference
    });

    return res.status(200).json({
      success: true,
      message: "ClickPesa payout preview imefanikiwa. Create payout bado haijawezeshwa.",
      payout,
      provider_preview: preview
    });
  } catch (error) {
    console.error(
      "Admin ClickPesa payout initiation error:",
      error?.response?.data || error?.message
    );

    return res.status(502).json({
      success: false,
      message: "ClickPesa payout preview imeshindikana."
    });
  }
});

/* Admin ClickPesa payout creation */
router.post("/management/payouts/:id/clickpesa-create", requireAdminSession, async (req, res) => {
  try {
    const payoutId = Number(req.params.id);

    if (!Number.isInteger(payoutId) || payoutId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payout ID si sahihi."
      });
    }

    const enabled =
      String(process.env.CLICKPESA_PAYOUT_ENABLED || "false").toLowerCase() === "true";

    if (!enabled) {
      return res.status(409).json({
        success: false,
        message: "ClickPesa payouts bado zimezimwa.",
        code: "CLICKPESA_PAYOUT_DISABLED"
      });
    }

    const payout = db.prepare(`
      SELECT
        id,
        seller_id,
        amount,
        currency,
        payout_method,
        payout_account_number,
        status,
        payout_reference,
        provider_reference
      FROM seller_payouts
      WHERE id = ?
    `).get(payoutId);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout haijapatikana."
      });
    }

    if (payout.status !== "processing") {
      return res.status(400).json({
        success: false,
        message: "Payout lazima iwe processing kabla ya kuanzishwa ClickPesa."
      });
    }

    if (payout.provider_reference) {
      return res.status(409).json({
        success: false,
        message: "Payout hii tayari ina provider reference."
      });
    }

    if (payout.payout_method !== "mobile_money") {
      return res.status(400).json({
        success: false,
        message: "ClickPesa integration kwa sasa inatumia mobile money tu."
      });
    }

    if (!payout.payout_account_number) {
      return res.status(400).json({
        success: false,
        message: "Payout account number haipo."
      });
    }

    const { createMobileMoneyPayout } = require("./clickpesa-payout-client");

    const providerResponse = await createMobileMoneyPayout({
      amount: payout.amount,
      phoneNumber: payout.payout_account_number,
      currency: payout.currency || "TZS",
      orderReference: payout.payout_reference
    });

    const providerStatus = String(
      providerResponse?.status || ""
    ).trim().toUpperCase();

    const providerReference =
      providerResponse?.providerReference ||
      providerResponse?.transactionReference ||
      providerResponse?.reference ||
      null;

    if (!providerReference) {
      return res.status(502).json({
        success: false,
        message: "ClickPesa haikurudisha provider reference. Payout haijawekwa paid."
      });
    }

    const updated = db.prepare(`
      UPDATE seller_payouts
      SET
        provider_reference = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'processing'
        AND provider_reference IS NULL
    `).run(providerReference, payoutId);

    if (!updated.changes) {
      return res.status(409).json({
        success: false,
        message: "Payout imebadilishwa na request nyingine au provider reference tayari ipo."
      });
    }

    return res.json({
      success: true,
      message:
        providerStatus === "SUCCESS"
          ? "ClickPesa payout imepokelewa na provider. Confirmation ya mwisho bado inahitajika."
          : "ClickPesa payout imeanzishwa. Confirmation ya provider bado inahitajika.",
      payout: {
        id: payout.id,
        status: payout.status,
        payout_reference: payout.payout_reference,
        provider_reference: providerReference
      },
      provider_status: providerStatus || null
    });
  } catch (error) {
    console.error(
      "Admin ClickPesa payout creation error:",
      error?.response?.status || error?.message
    );

    return res.status(502).json({
      success: false,
      message: "ClickPesa payout creation imeshindikana."
    });
  }
});

/* Admin ClickPesa payout status confirmation + final settlement */
router.post("/management/payouts/:id/clickpesa-status", requireAdminSession, async (req, res) => {
  try {
    const payoutId = Number(req.params.id);

    if (!Number.isInteger(payoutId) || payoutId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payout ID si sahihi."
      });
    }

    const enabled =
      String(process.env.CLICKPESA_PAYOUT_ENABLED || "false").toLowerCase() === "true";

    if (!enabled) {
      return res.status(409).json({
        success: false,
        message: "ClickPesa payouts bado zimezimwa.",
        code: "CLICKPESA_PAYOUT_DISABLED"
      });
    }

    const payout = db.prepare(`
      SELECT
        id,
        seller_id,
        amount,
        currency,
        status,
        payout_reference,
        provider_reference
      FROM seller_payouts
      WHERE id = ?
    `).get(payoutId);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout haijapatikana."
      });
    }

    if (payout.status !== "processing") {
      return res.status(400).json({
        success: false,
        message: "Payout lazima iwe processing kabla ya ku-check ClickPesa."
      });
    }

    if (!payout.provider_reference) {
      return res.status(400).json({
        success: false,
        message: "Payout bado haina provider reference."
      });
    }

    const { getMobileMoneyPayoutStatus } = require("./clickpesa-payout-client");

    const providerResponse = await getMobileMoneyPayoutStatus(
      payout.payout_reference
    );

    const providerStatus = String(
      providerResponse?.status || ""
    ).trim().toUpperCase();

    if (!providerStatus) {
      return res.status(502).json({
        success: false,
        message: "ClickPesa haikurudisha payout status."
      });
    }

    if (providerStatus !== "SUCCESS") {
      return res.json({
        success: true,
        message: `ClickPesa payout status ni ${providerStatus}. Payout bado haijawekwa paid.`,
        payout: {
          id: payout.id,
          status: payout.status,
          payout_reference: payout.payout_reference,
          provider_reference: payout.provider_reference
        },
        provider_status: providerStatus,
        confirmed: false
      });
    }

    const existingDebit = db.prepare(`
      SELECT
        id,
        amount,
        currency
      FROM seller_ledger
      WHERE entry_type = 'debit'
        AND reference = ?
      LIMIT 1
    `).get(payout.payout_reference);

    if (existingDebit) {
      return res.status(409).json({
        success: false,
        message: "Payout hii tayari ina ledger debit.",
        code: "PAYOUT_ALREADY_SETTLED"
      });
    }

    const insertLedgerDebit = db.prepare(`
      INSERT INTO seller_ledger (
        seller_id,
        payment_id,
        order_id,
        entry_type,
        amount,
        currency,
        description,
        reference
      )
      VALUES (
        ?,
        NULL,
        NULL,
        'debit',
        ?,
        ?,
        ?,
        ?
      )
    `);

    const updatePayout = db.prepare(`
      UPDATE seller_payouts
      SET
        status = 'paid',
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'processing'
        AND provider_reference = ?
    `);

    try {
      db.exec("BEGIN");

      const balance = db.prepare(`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN entry_type = 'credit' THEN amount
              WHEN entry_type = 'debit' THEN -amount
              ELSE 0
            END
          ), 0) AS balance
        FROM seller_ledger
        WHERE seller_id = ?
      `).get(payout.seller_id);

      const sellerBalance = Number(balance?.balance || 0);
      const payoutAmount = Number(payout.amount || 0);

      if (payoutAmount <= 0) {
        throw new Error("Payout amount si sahihi.");
      }

      if (payoutAmount > sellerBalance) {
        const error = new Error(
          "Seller hana balance ya kutosha kulipia payout hii."
        );
        error.code = "INSUFFICIENT_SELLER_BALANCE";
        throw error;
      }

      insertLedgerDebit.run(
        payout.seller_id,
        payoutAmount,
        payout.currency || "TZS",
        `Seller payout ${payout.payout_reference}`,
        payout.payout_reference
      );

      const updated = updatePayout.run(
        payoutId,
        payout.provider_reference
      );

      if (!updated.changes) {
        throw new Error(
          "Payout imebadilishwa na request nyingine au provider reference haifanani."
        );
      }

      db.exec("COMMIT");
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {}

      if (error?.code === "INSUFFICIENT_SELLER_BALANCE") {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      throw error;
    }

    const settledPayout = db.prepare(`
      SELECT
        id,
        seller_id,
        amount,
        currency,
        payout_method,
        status,
        payout_reference,
        provider_reference,
        processed_at,
        created_at,
        updated_at
      FROM seller_payouts
      WHERE id = ?
    `).get(payoutId);

    return res.json({
      success: true,
      message: "ClickPesa imethibitisha SUCCESS. Payout imelipwa na seller ledger imewekewa debit.",
      payout: settledPayout,
      provider_status: providerStatus,
      confirmed: true,
      settled: true
    });
  } catch (error) {
    console.error(
      "Admin ClickPesa payout status/settlement error:",
      error?.response?.status || error?.message
    );

    return res.status(502).json({
      success: false,
      message: "ClickPesa payout status au final settlement imeshindikana."
    });
  }
});


/* Admin notifications */

router.get("/management/notifications", requireAdminSession, (req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 30, 1),
      100
    );

    const filter = String(req.query.filter || "all")
      .trim()
      .toLowerCase();

    const allowedFilters = ["all", "unread", "important"];

    if (!allowedFilters.includes(filter)) {
      return res.status(400).json({
        success: false,
        message: "Notification filter si sahihi."
      });
    }

    let where = "";
    const params = [];

    if (filter === "unread") {
      where = "WHERE is_read = 0";
    } else if (filter === "important") {
      where = "WHERE priority IN ('important', 'critical')";
    }

    const notifications = db.prepare(`
      SELECT
        id,
        type,
        title,
        message,
        priority,
        entity_type,
        entity_id,
        is_read,
        created_at
      FROM admin_notifications
      ${where}
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'important' THEN 2
          ELSE 3
        END,
        id DESC
      LIMIT ?
    `).all(...params, limit);

    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END), 0) AS unread,
        COALESCE(SUM(CASE WHEN priority IN ('important', 'critical') THEN 1 ELSE 0 END), 0) AS important,
        COALESCE(SUM(CASE WHEN priority = 'critical' AND is_read = 0 THEN 1 ELSE 0 END), 0) AS critical_unread
      FROM admin_notifications
    `).get();

    return res.json({
      success: true,
      summary: {
        total: Number(summary.total || 0),
        unread: Number(summary.unread || 0),
        important: Number(summary.important || 0),
        critical_unread: Number(summary.critical_unread || 0)
      },
      notifications
    });
  } catch (error) {
    console.error("Admin notifications list error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata admin notifications."
    });
  }
});

router.post("/management/notifications", requireAdminSession, (req, res) => {
  try {
    const type = String(req.body?.type || "system")
      .trim()
      .toLowerCase();

    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();

    const priority = String(req.body?.priority || "normal")
      .trim()
      .toLowerCase();

    const entityType = req.body?.entity_type
      ? String(req.body.entity_type).trim()
      : null;

    const entityId =
      req.body?.entity_id === null ||
      req.body?.entity_id === undefined ||
      req.body?.entity_id === ""
        ? null
        : Number(req.body.entity_id);

    const allowedTypes = [
      "system",
      "order",
      "payment",
      "payout",
      "user",
      "security"
    ];

    const allowedPriorities = [
      "normal",
      "important",
      "critical"
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Notification type si sahihi."
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Notification title na message vinahitajika."
      });
    }

    if (title.length > 180 || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Notification title au message ni ndefu sana."
      });
    }

    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Notification priority si sahihi."
      });
    }

    if (
      entityId !== null &&
      (!Number.isInteger(entityId) || entityId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Entity ID si sahihi."
      });
    }

    const result = db.prepare(`
      INSERT INTO admin_notifications (
        type,
        title,
        message,
        priority,
        entity_type,
        entity_id,
        is_read
      )
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(
      type,
      title,
      message,
      priority,
      entityType,
      entityId
    );

    const notification = db.prepare(`
      SELECT
        id,
        type,
        title,
        message,
        priority,
        entity_type,
        entity_id,
        is_read,
        created_at
      FROM admin_notifications
      WHERE id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: "Admin notification imeundwa.",
      notification
    });
  } catch (error) {
    console.error("Admin notification create error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuunda admin notification."
    });
  }
});

router.patch("/management/notifications/:id/read", requireAdminSession, (req, res) => {
  try {
    const notificationId = Number(req.params.id);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Notification ID si sahihi."
      });
    }

    const result = db.prepare(`
      UPDATE admin_notifications
      SET is_read = 1
      WHERE id = ?
    `).run(notificationId);

    if (!result.changes) {
      return res.status(404).json({
        success: false,
        message: "Notification haijapatikana."
      });
    }

    return res.json({
      success: true,
      message: "Notification imewekwa kama read."
    });
  } catch (error) {
    console.error("Admin notification read error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kusoma notification."
    });
  }
});

router.post("/management/notifications/read-all", requireAdminSession, (req, res) => {
  try {
    const result = db.prepare(`
      UPDATE admin_notifications
      SET is_read = 1
      WHERE is_read = 0
    `).run();

    return res.json({
      success: true,
      message: "Admin notifications zote zimewekwa kama read.",
      updated: Number(result.changes || 0)
    });
  } catch (error) {
    console.error("Admin notifications read-all error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kusoma notifications zote."
    });
  }
});

/* Admin payout status workflow */
router.patch("/management/payouts/:id/status", requireAdminSession, (req, res) => {
  try {
    const payoutId = Number(req.params.id);
    const status = String(req.body?.status || "").trim().toLowerCase();
    const providerReference = String(
      req.body?.provider_reference || ""
    ).trim();

    const allowedStatuses = [
      "pending",
      "processing",
      "paid",
      "failed",
    ];

    if (!Number.isInteger(payoutId) || payoutId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payout ID si sahihi."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status ya payout si halali."
      });
    }

    const payout = db.prepare(`
      SELECT
        id,
        seller_id,
        amount,
        currency,
        status,
        payout_reference,
        provider_reference
      FROM seller_payouts
      WHERE id = ?
    `).get(payoutId);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout haijapatikana."
      });
    }

    if (status === "paid" && !providerReference && !payout.provider_reference) {
      return res.status(400).json({
        success: false,
        message: "Paid payout lazima iwe na provider reference."
      });
    }

    const clickPesaEnabled =
      String(process.env.CLICKPESA_PAYOUT_ENABLED || "false").toLowerCase() === "true";

    if (
      status === "paid" &&
      clickPesaEnabled &&
      payout.payout_method === "mobile_money"
    ) {
      return res.status(400).json({
        success: false,
        message: "ClickPesa mobile-money payout lazima ithibitishwe na provider kabla ya kuwa paid.",
        code: "CLICKPESA_PROVIDER_CONFIRMATION_REQUIRED"
      });
    }

    if (
      status === "paid" &&
      !["processing", "paid"].includes(payout.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payout lazima iwe processing kabla ya kuwa paid."
      });
    }

    if (
      status === "processing" &&
      payout.status !== "pending" &&
      payout.status !== "processing"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payout hii haiwezi kuanza processing kutoka status yake ya sasa."
      });
    }

    if (
      status === "pending" &&
      payout.status !== "pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payout haiwezi kurudishwa pending kutoka status yake ya sasa."
      });
    }

    if (
      ["failed", "cancelled"].includes(status) &&
      !["processing", "failed", "cancelled"].includes(payout.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payout lazima iwe processing kabla ya kuwa failed au cancelled."
      });
    }

    if (
      ["paid", "failed", "cancelled"].includes(payout.status) &&
      status !== payout.status
    ) {
      return res.status(400).json({
        success: false,
        message: "Payout hii tayari iko kwenye terminal status na haiwezi kubadilishwa."
      });
    }

    if (
      ["failed", "cancelled"].includes(status) &&
      ["failed", "cancelled"].includes(payout.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payout hii tayari iko kwenye terminal status."
      });
    }

    const nextProviderReference =
      providerReference || payout.provider_reference || null;

    const updatePayout = db.prepare(`
      UPDATE seller_payouts
      SET
        status = ?,
        provider_reference = ?,
        processed_at = CASE
          WHEN ? IN ('paid', 'failed', 'cancelled')
            THEN CURRENT_TIMESTAMP
          ELSE NULL
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertLedgerDebit = db.prepare(`
      INSERT INTO seller_ledger (
        seller_id,
        payment_id,
        order_id,
        entry_type,
        amount,
        currency,
        description,
        reference
      )
      VALUES (
        ?,
        NULL,
        NULL,
        'debit',
        ?,
        ?,
        ?,
        ?
      )
    `);

    if (status === "paid" && payout.status !== "paid") {
      const existingDebit = db.prepare(`
        SELECT
          id,
          amount,
          currency
        FROM seller_ledger
        WHERE entry_type = 'debit'
          AND reference = ?
        LIMIT 1
      `).get(payout.payout_reference);

      if (existingDebit) {
        return res.status(409).json({
          success: false,
          message: "Payout hii tayari ina ledger debit."
        });
      }

      db.exec("BEGIN");

      try {
        const balance = db.prepare(`
          SELECT
            COALESCE(SUM(
              CASE
                WHEN entry_type = 'credit' THEN amount
                WHEN entry_type = 'debit' THEN -amount
                ELSE 0
              END
            ), 0) AS balance
          FROM seller_ledger
          WHERE seller_id = ?
        `).get(payout.seller_id);

        const sellerBalance = Number(balance?.balance || 0);
        const payoutAmount = Number(payout.amount || 0);

        if (payoutAmount <= 0) {
          throw new Error("Payout amount si sahihi.");
        }

        if (payoutAmount > sellerBalance) {
          const error = new Error(
            "Seller hana balance ya kutosha kulipia payout hii."
          );
          error.code = "INSUFFICIENT_SELLER_BALANCE";
          throw error;
        }

        insertLedgerDebit.run(
          payout.seller_id,
          payoutAmount,
          payout.currency || "TZS",
          `Seller payout ${payout.payout_reference}`,
          payout.payout_reference
        );

        updatePayout.run(
          status,
          nextProviderReference,
          status,
          payoutId
        );

        db.exec("COMMIT");
      } catch (error) {
        try {
          db.exec("ROLLBACK");
        } catch {}
        if (error?.code === "INSUFFICIENT_SELLER_BALANCE") {
          return res.status(400).json({
            success: false,
            message: error.message
          });
        }

        throw error;
      }
    } else {
      updatePayout.run(
        status,
        nextProviderReference,
        status,
        payoutId
      );
    }

    const updated = db.prepare(`
      SELECT
        id,
        seller_id,
        amount,
        currency,
        payout_method,
        status,
        payout_reference,
        provider_reference,
        processed_at,
        created_at,
        updated_at
      FROM seller_payouts
      WHERE id = ?
    `).get(payoutId);

    return res.json({
      success: true,
      message:
        status === "paid"
          ? "Payout imelipwa na seller ledger imewekewa debit."
          : "Payout status imebadilishwa.",
      payout: updated
    });
  } catch (error) {
    console.error("Admin payout status error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha payout status."
    });
  }
});


// Admin General Settings
router.get("/management/settings", requireAdminSession, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT setting_key, setting_value, updated_at
      FROM admin_settings
      ORDER BY setting_key ASC
    `).all();

    const settings = {};
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }


    return res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error("Admin settings load error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupakia admin settings."
    });
  }
});

router.patch("/management/settings", requireAdminSession, (req, res) => {
  try {
    const allowedKeys = [
      "site_name",
      "site_description",
      "support_email",
      "default_currency",
      "maintenance_mode",
      "commission_rate"
    ];

    const input = req.body && typeof req.body === "object"
      ? req.body
      : {};

    const changedKeys = Object.keys(input).filter((key) =>
      [
        "site_name",
        "site_description",
        "support_email",
        "default_currency",
        "maintenance_mode",
        "commission_rate"
      ].includes(key)
    );

    const upsert = db.prepare(`
      INSERT INTO admin_settings (
        setting_key,
        setting_value,
        updated_at
      )
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key)
      DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `);

    db.exec("BEGIN");

    try {
      for (const key of allowedKeys) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) {
          continue;
        }

        let value = input[key];

        if (typeof value === "boolean") {
          value = value ? "true" : "false";
        } else if (typeof value !== "string") {
          value = String(value ?? "");
        }

        value = value.trim();

        if (key === "commission_rate") {
          const commissionRate = Number(value);

          if (
            !Number.isFinite(commissionRate) ||
            commissionRate < 0 ||
            commissionRate > 100
          ) {
            throw new Error("INVALID_COMMISSION_RATE");
          }

          value = String(commissionRate);
        }

        if (value.length > 500) {
          throw new Error(`SETTING_TOO_LONG:${key}`);
        }

        upsert.run(key, value);
      }

      db.exec("COMMIT");

      if (changedKeys.length) {
        const generalChangedKeys = changedKeys.filter(
          (key) => key !== "commission_rate"
        );

        if (generalChangedKeys.length) {
          writeAdminAuditLog(req, {
            adminId: req.admin?.id || null,
            action: "settings.updated",
            targetType: "admin_settings",
            description: "Admin general settings zimesasishwa.",
            metadata: {
              keys: generalChangedKeys
            }
          });
        }

        if (changedKeys.includes("commission_rate")) {
          writeAdminAuditLog(req, {
            adminId: req.admin?.id || null,
            action: "commission.rate.updated",
            targetType: "commission_settings",
            description: "Admin commission rate imebadilishwa.",
            metadata: {
              commission_rate: Number(input.commission_rate)
            }
          });
        }
      }
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch (_) {}

      if (error?.message?.startsWith("SETTING_TOO_LONG:")) {
        return res.status(400).json({
          success: false,
          message: "Setting moja imezidi urefu unaoruhusiwa."
        });
      }

      throw error;
    }

    const rows = db.prepare(`
      SELECT setting_key, setting_value, updated_at
      FROM admin_settings
      ORDER BY setting_key ASC
    `).all();

    const settings = {};
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }

    return res.json({
      success: true,
      message: "General settings zimehifadhiwa.",
      settings
    });
  } catch (error) {
    console.error("Admin settings save error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuhifadhi admin settings."
    });
  }
});


// Admin Commission Payout Account
router.get("/management/payout-account", requireAdminSession, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT
        id,
        account_type,
        provider,
        account_name,
        account_number,
        currency,
        is_active,
        created_at,
        updated_at
      FROM admin_payout_accounts
      WHERE is_active = 1
      ORDER BY id DESC
      LIMIT 1
    `).get();

    return res.json({
      success: true,
      account: account || null
    });
  } catch (error) {
    console.error("Admin payout account load error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupakia payout account."
    });
  }
});

router.put("/management/payout-account", requireAdminSession, (req, res) => {
  try {
    const body = req.body && typeof req.body === "object"
      ? req.body
      : {};

    const accountType = String(body.account_type || "").trim();
    const provider = String(body.provider || "").trim();
    const accountName = String(body.account_name || "").trim();
    const accountNumber = String(body.account_number || "").trim();
    const currency = String(body.currency || "TZS").trim().toUpperCase();

    if (!["mobile_money", "bank"].includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: "Account type si sahihi."
      });
    }

    if (!provider || provider.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Provider si sahihi."
      });
    }

    if (!accountName || accountName.length > 160) {
      return res.status(400).json({
        success: false,
        message: "Account name si sahihi."
      });
    }

    if (!accountNumber || accountNumber.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Account number si sahihi."
      });
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({
        success: false,
        message: "Currency lazima iwe ISO 3-letter code."
      });
    }

    db.exec("BEGIN");

    try {
      db.prepare(`
        UPDATE admin_payout_accounts
        SET is_active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE is_active = 1
      `).run();

      db.prepare(`
        INSERT INTO admin_payout_accounts (
          account_type,
          provider,
          account_name,
          account_number,
          currency,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run(
        accountType,
        provider,
        accountName,
        accountNumber,
        currency
      );

      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch (_) {}
      throw error;
    }

    const account = db.prepare(`
      SELECT
        id,
        account_type,
        provider,
        account_name,
        account_number,
        currency,
        is_active,
        created_at,
        updated_at
      FROM admin_payout_accounts
      WHERE is_active = 1
      ORDER BY id DESC
      LIMIT 1
    `).get();

    return res.json({
      success: true,
      message: "Commission payout account imehifadhiwa.",
      account
    });
  } catch (error) {
    console.error("Admin payout account save error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuhifadhi payout account."
    });
  }
});



router.patch("/management/security/password", requireAdminSession, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password na new password zinahitajika."
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password mpya iwe na angalau characters 8."
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password mpya ni ndefu sana."
      });
    }

    const admin = db.prepare(
      "SELECT id, username, password_hash FROM admins WHERE id = ?"
    ).get(req.admin.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin hakupatikana."
      });
    }

    const currentPasswordValid = await bcrypt.compare(
      currentPassword,
      admin.password_hash
    );

    if (!currentPasswordValid) {
      writeAdminAuditLog(req, {
        adminId: admin.id,
        action: "admin.password.change_failed",
        targetType: "admin",
        targetId: admin.id,
        description: "Admin password change imekataa kwa current password isiyo sahihi."
      });

      return res.status(401).json({
        success: false,
        message: "Current password si sahihi."
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    db.prepare(
      "UPDATE admins SET password_hash = ? WHERE id = ?"
    ).run(newPasswordHash, admin.id);

    writeAdminAuditLog(req, {
      adminId: admin.id,
      action: "admin.password.changed",
      targetType: "admin",
      targetId: admin.id,
      description: "Admin password imebadilishwa."
    });

    return res.json({
      success: true,
      message: "Admin password imebadilishwa."
    });
  } catch (error) {
    console.error("Admin security password change error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha admin password."
    });
  }
});

router.get("/management/security/email", requireAdminSession, (req, res) => {
  try {
    const admin = db.prepare(
      "SELECT id, username, email FROM admins WHERE id = ?"
    ).get(req.admin.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin hakupatikana."
      });
    }

    return res.json({
      success: true,
      email: admin.email || "",
      username: admin.username
    });
  } catch (error) {
    console.error("Admin security email get error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupakia admin email."
    });
  }
});

router.patch("/management/security/email", requireAdminSession, (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Admin email inahitajika."
      });
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Admin email si sahihi."
      });
    }

    const result = db.prepare(
      "UPDATE admins SET email = ? WHERE id = ?"
    ).run(email, req.admin.id);

    if (!result.changes) {
      return res.status(404).json({
        success: false,
        message: "Admin hakupatikana."
      });
    }

    writeAdminAuditLog(req, {
      adminId: req.admin.id,
      action: "admin.email.updated",
      targetType: "admin",
      targetId: req.admin.id,
      description: "Admin email imebadilishwa."
    });

    return res.json({
      success: true,
      message: "Admin email imehifadhiwa.",
      email
    });
  } catch (error) {
    console.error("Admin security email save error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuhifadhi admin email."
    });
  }
});


router.post("/password-reset/request", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    const genericResponse = {
      success: true,
      message: "Ikiwa email hiyo ni ya admin, reset link imetumwa."
    };

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json(genericResponse);
    }

    const admin = db.prepare(`
      SELECT id, username, email
      FROM admins
      WHERE lower(email) = ?
      LIMIT 1
    `).get(email);

    if (!admin || !admin.email) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare(`
      DELETE FROM admin_password_reset_tokens
      WHERE admin_id = ? AND used_at IS NULL
    `).run(admin.id);

    db.prepare(`
      INSERT INTO admin_password_reset_tokens (
        admin_id,
        token_hash,
        expires_at
      )
      VALUES (?, ?, ?)
    `).run(admin.id, tokenHash, expiresAt);

    const resetBaseUrl = String(
      process.env.ADMIN_PASSWORD_RESET_URL ||
      "http://localhost:3000/admin-reset-password.html"
    ).trim();

    const separator = resetBaseUrl.includes("?") ? "&" : "?";
    const resetUrl = `${resetBaseUrl}${separator}token=${encodeURIComponent(rawToken)}`;

    await sendNotificationEmail({
      to: admin.email,
      subject: "ZENODIC Admin Password Reset",
      title: "Admin Password Reset",
      message:
        `Umeomba kubadilisha password ya ZENODIC Admin. ` +
        `Tumia link hii ndani ya dakika 30: ${resetUrl}`
    });

    writeAdminAuditLog(req, {
      adminId: admin.id,
      action: "admin.password.reset_requested",
      targetType: "admin",
      targetId: admin.id,
      description: "Admin password reset link imeombwa."
    });

    return res.json(genericResponse);
  } catch (error) {
    console.error("Admin password reset request error:", error);

    return res.json({
      success: true,
      message: "Ikiwa email hiyo ni ya admin, reset link imetumwa."
    });
  }
});


router.post("/password-reset/confirm", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (!token || token.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Reset token si sahihi."
      });
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password mpya lazima iwe kati ya characters 8 na 128."
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const resetRecord = db.prepare(`
      SELECT
        admin_password_reset_tokens.id,
        admin_password_reset_tokens.admin_id,
        admins.username,
        admins.email
      FROM admin_password_reset_tokens
      JOIN admins
        ON admins.id = admin_password_reset_tokens.admin_id
      WHERE admin_password_reset_tokens.token_hash = ?
        AND admin_password_reset_tokens.used_at IS NULL
        AND admin_password_reset_tokens.expires_at > ?
      LIMIT 1
    `).get(tokenHash, new Date().toISOString());

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "Reset link si halali au ime-expire."
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    db.prepare(`
      UPDATE admins
      SET password_hash = ?
      WHERE id = ?
    `).run(newPasswordHash, resetRecord.admin_id);

    db.prepare(`
      UPDATE admin_password_reset_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(resetRecord.id);

    db.prepare(`
      DELETE FROM admin_sessions
      WHERE admin_id = ?
    `).run(resetRecord.admin_id);

    writeAdminAuditLog(req, {
      adminId: resetRecord.admin_id,
      action: "admin.password.reset_completed",
      targetType: "admin",
      targetId: resetRecord.admin_id,
      description: "Admin password reset imekamilika."
    });

    return res.json({
      success: true,
      message: "Admin password imebadilishwa."
    });
  } catch (error) {
    console.error("Admin password reset confirm error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha admin password."
    });
  }
});

module.exports = router;
