const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const db = require("./database");
const { requireUser } = require("./user-auth");
const {
  getBuyerContext,
  getSellerContext,
  getAdminContext,
  getRoleContext
} = require("./ai-service");

function hashAdminToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function requireAiAdmin(req, res, next) {
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

  const tokenHash = hashAdminToken(token);

  const admin = db.prepare(`
    SELECT admins.id, admins.username AS email
    FROM admin_sessions
    JOIN admins ON admins.id = admin_sessions.admin_id
    WHERE admin_sessions.token_hash = ?
      AND admin_sessions.expires_at > ?
    LIMIT 1
  `).get(tokenHash, new Date().toISOString());

  if (!admin) {
    return res.status(401).json({
      success: false,
      message: "Admin session si halali au ime-expire."
    });
  }

  req.admin = admin;
  next();
}

/*
  Zenodic AI shared layer.

  Roles:
  - Buyer
  - Seller
  - Admin

  Kwa sasa AI context ni READ-ONLY.
  AI provider/chat engine itaunganishwa kwenye hatua inayofuata.
*/

router.get("/status", requireUser, (req, res) => {
  return res.json({
    success: true,
    ai: {
      name: "Zenodic AI",
      version: "1.0.0",
      multimodal: {
        text: true,
        voice: true,
        image: true
      },
      roles: {
        buyer: true,
        seller: true,
        admin: true
      }
    },
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

router.get("/context", requireUser, (req, res) => {
  try {
    const role = String(req.user.role || "").toLowerCase();

    if (role !== "buyer" && role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Endpoint hii ni ya Buyer/Seller pekee."
      });
    }

    const context = getRoleContext({
      role,
      userId: req.user.id
    });

    if (!context) {
      return res.status(403).json({
        success: false,
        message: "AI context haipatikani kwa role hii."
      });
    }

    return res.json({
      success: true,
      ai: {
        name: "Zenodic AI",
        role
      },
      context
    });
  } catch (error) {
    console.error("Zenodic AI context error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata AI context."
    });
  }
});

router.get("/admin/status", requireAiAdmin, (req, res) => {
  return res.json({
    success: true,
    ai: {
      name: "Zenodic AI",
      version: "1.0.0",
      role: "admin"
    },
    admin: {
      id: req.admin.id,
      email: req.admin.email
    }
  });
});

router.get("/admin/context", requireAiAdmin, (req, res) => {
  try {
    const context = getAdminContext(req.admin.id);

    if (!context) {
      return res.status(403).json({
        success: false,
        message: "AI Admin context haipatikani."
      });
    }

    return res.json({
      success: true,
      ai: {
        name: "Zenodic AI",
        role: "admin"
      },
      context
    });
  } catch (error) {
    console.error("Zenodic AI admin context error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata AI Admin context."
    });
  }
});

router.post("/chat", requireUser, async (req, res) => {
  try {
    const role = String(req.user.role || "").toLowerCase();

    if (role !== "buyer" && role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "AI chat hii ni ya Buyer/Seller pekee."
      });
    }

    const message = typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message inahitajika."
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        success: false,
        message: "Message ni ndefu sana."
      });
    }

    const context = getRoleContext({
      role,
      userId: req.user.id
    });

    if (!context) {
      return res.status(403).json({
        success: false,
        message: "AI context haipatikani."
      });
    }

    const { generateText } = require("./ai-provider");

    const result = await generateText({
      messages: [
        {
          role: "system",
          content: "Wewe ni Zenodic AI. Tumia context ya mtumiaji kwa majibu yanayohusiana na akaunti yake. Usifichue taarifa nyeti. Context ifuatayo ni ya ndani ya Zenodic na itumike kama taarifa ya kusaidia tu:\n" +
            JSON.stringify({
              role: context.role,
              orders: context.orders || [],
              notifications: context.notifications || []
            })
        },
        {
          role: "user",
          content: message
        }
      ],
      context
    });

    return res.json({
      success: true,
      ai: {
        name: "Zenodic AI",
        role
      },
      result
    });
  } catch (error) {
    console.error("Zenodic AI chat error:", error);

    return res.status(503).json({
      success: false,
      message: error.message || "Zenodic AI provider haipatikani."
    });
  }
});

router.post("/admin/chat", requireAiAdmin, async (req, res) => {
  try {
    const message = typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message inahitajika."
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        success: false,
        message: "Message ni ndefu sana."
      });
    }

    const context = getAdminContext(req.admin.id);

    if (!context) {
      return res.status(403).json({
        success: false,
        message: "AI Admin context haipatikani."
      });
    }

    const { generateText } = require("./ai-provider");

    const result = await generateText({
      messages: [
        {
          role: "system",
          content: "Wewe ni Zenodic AI kwa Admin. Tumia admin context kwa analytics, audit, operations na insights. Usifichue taarifa nyeti. Context ifuatayo ni ya ndani ya Zenodic:\n" +
            JSON.stringify({
              role: context.role,
              auditLogs: context.auditLogs || [],
              notifications: context.notifications || []
            })
        },
        {
          role: "user",
          content: message
        }
      ],
      context
    });

    return res.json({
      success: true,
      ai: {
        name: "Zenodic AI",
        role: "admin"
      },
      result
    });
  } catch (error) {
    console.error("Zenodic AI admin chat error:", error);

    return res.status(503).json({
      success: false,
      message: error.message || "Zenodic AI provider haipatikani."
    });
  }
});

module.exports = router;
