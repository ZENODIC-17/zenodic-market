const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const db = require("./database");
const adminRoutes = require("./admin-routes");
const { verifyAdminToken } = require("./admin");
const rfqRoutes = require("./rfq-routes");
const ordersRoutes = require("./orders-routes");
const paymentsRoutes = require("./payments-routes");
const sellerPaymentsRoutes = require("./seller-payments-routes");
const notificationRoutes = require("./notification-routes");
const aiRoutes = require("./ai-routes");
const inventoryRoutes = require("./inventory-routes");
const productionRoutes = require("./production-routes");
const wholesaleOverviewRoutes = require("./wholesale-overview-routes");
const { sendNotificationEmail } = require("./email-service");
const {
  createUserSession,
  destroyUserSession,
  requireUser
} = require("./user-auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(helmet());
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.get("/admin", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(__dirname, "..", "admin-login.html"));
});
app.use(express.static(path.join(__dirname, "..")));
app.use("/backend/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/admin", adminRoutes);
app.use("/api/rfqs", rfqRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/seller/payments", sellerPaymentsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/wholesale/overview", wholesaleOverviewRoutes);
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Zenodic backend iko hewani."
  });
});




/* ---------- CURRENT USER SESSION ---------- */

app.get("/api/auth/me", requireUser, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

app.post("/api/auth/logout", (req, res) => {
  try {
    destroyUserSession(req);

    res.clearCookie("zenodic_session", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });

    return res.json({
      success: true,
      message: "Umetoka kwenye akaunti."
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kufanya logout."
    });
  }
});

/* ---------- USER LOGIN ---------- */

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Weka email na password."
      });
    }

    const user = db
      .prepare(`
        SELECT id, name, email, password_hash, role, provider
        FROM users
        WHERE email = ?
        LIMIT 1
      `)
      .get(cleanEmail);

    if (!user || !user.password_hash) {
      return res.status(401).json({
        success: false,
        message: "Email au password si sahihi."
      });
    }

    const passwordValid = await bcrypt.compare(
      String(password),
      user.password_hash
    );

    if (!passwordValid) {
      if (user.role === "seller") {
        db.prepare(`
          INSERT INTO seller_login_activity (
            user_id,
            login_at,
            login_status,
            device_info,
            ip_address
          )
          VALUES (?, CURRENT_TIMESTAMP, 'failed', ?, ?)
        `).run(
          user.id,
          req.get("user-agent") || "Unknown device",
          req.ip || req.socket?.remoteAddress || null
        );
      }

      return res.status(401).json({
        success: false,
        message: "Email au password si sahihi."
      });
    }

    db.prepare(`
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    db.prepare(`
      INSERT INTO seller_login_activity (
        user_id,
        login_at,
        login_status,
        device_info,
        ip_address
      )
      VALUES (?, CURRENT_TIMESTAMP, 'success', ?, ?)
    `).run(
      user.id,
      req.get("user-agent") || "Unknown device",
      req.ip || req.socket?.remoteAddress || null
    );

    const sessionToken = createUserSession(user.id);

    res.cookie("zenodic_session", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/"
    });

    return res.json({
      success: true,
      message: "Login imefanikiwa.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        provider: user.provider
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login imeshindikana. Jaribu tena."
    });
  }
});

/* ---------- USER REGISTRATION ---------- */

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanRole = String(role || "").trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !cleanRole) {
      return res.status(400).json({
        success: false,
        message: "Jaza taarifa zote."
      });
    }

    const allowedRoles = ["buyer", "seller", "wholesale"];

    if (!allowedRoles.includes(cleanRole)) {
      return res.status(400).json({
        success: false,
        message: "Aina ya akaunti si sahihi."
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password iwe na angalau herufi 8."
      });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
      .get(cleanEmail);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email hii tayari imesajiliwa."
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);

    const result = db.prepare(`
      INSERT INTO users
        (name, email, password_hash, role, provider)
      VALUES
        (?, ?, ?, ?, 'local')
    `).run(
      cleanName,
      cleanEmail,
      passwordHash,
      cleanRole
    );

    /* ---------- WELCOME EMAIL ---------- */
    try {
      await sendNotificationEmail({
        to: cleanEmail,
        subject: "Karibu ZENODIC — Akaunti yako imetengenezwa",
        title: `Karibu ZENODIC, ${cleanName}!`,
        message:
          "Akaunti yako ya ZENODIC imetengenezwa kwa mafanikio. " +
          "Sasa unaweza kuingia kwenye akaunti yako na kuanza kutumia huduma za ZENODIC."
      });

      console.log(`✅ Welcome email imetumwa kwa ${cleanEmail}`);
    } catch (emailError) {
      console.error(
        `⚠️ Welcome email imeshindikana kwa ${cleanEmail}:`,
        emailError.response?.data || emailError.message
      );
    }

    return res.status(201).json({
      success: true,
      message: "Akaunti imetengenezwa vizuri.",
      user: {
        id: Number(result.lastInsertRowid),
        name: cleanName,
        email: cleanEmail,
        role: cleanRole,
        provider: "local"
      }
    });

  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Usajili umeshindikana. Jaribu tena."
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend iko sawa."
  });
});

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Admin token haipo."
    });
  }

  const token = auth.slice(7);
  const admin = verifyAdminToken(token);

  if (!admin) {
    return res.status(401).json({
      success: false,
      message: "Admin session si halali au ime-expire."
    });
  }

  req.admin = admin;
  next();
}


app.put("/api/seller/change-password", async (req, res) => {
  try {
    const userId = Number(req.body?.user_id);
    const currentPassword = String(req.body?.current_password || "");
    const newPassword = String(req.body?.new_password || "");

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "User ID, current password na new password vinahitajika."
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password mpya lazima iwe na angalau characters 8."
      });
    }

    const user = db.prepare(`
      SELECT id, role, password_hash
      FROM users
      WHERE id = ?
      LIMIT 1
    `).get(userId);

    if (!user || user.role !== "seller" || !user.password_hash) {
      return res.status(403).json({
        success: false,
        message: "Seller account haijapatikana."
      });
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password si sahihi."
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    db.prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `).run(newPasswordHash, userId);

    return res.json({
      success: true,
      message: "Password imebadilishwa vizuri."
    });
  } catch (error) {
    console.error("Seller change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha password."
    });
  }
});

app.put("/api/seller/settings", (req, res) => {
  try {
    const userId = Number(req.body?.user_id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    const user = db
      .prepare("SELECT id, role FROM users WHERE id = ? LIMIT 1")
      .get(userId);

    if (!user || user.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Seller account haijapatikana."
      });
    }

    const existing = db
      .prepare("SELECT * FROM seller_settings WHERE user_id = ? LIMIT 1")
      .get(userId);

    const body = req.body || {};

    const value = (key, fallback) =>
      Object.prototype.hasOwnProperty.call(body, key)
        ? body[key]
        : fallback;

    const storeStatus = value(
      "store_status",
      existing?.store_status || "open"
    ) === "paused" ? "paused" : "open";

    const currency = String(
      value("currency", existing?.currency || "TZS") || "TZS"
    ).trim() || "TZS";

    const minimumOrderQuantity = Math.max(
      1,
      Number(value(
        "minimum_order_quantity",
        existing?.minimum_order_quantity ?? 1
      )) || 1
    );

    const payoutMethod = ["mobile_money", "bank"].includes(
      String(value("payout_method", existing?.payout_method || "mobile_money"))
    )
      ? String(value("payout_method", existing?.payout_method || "mobile_money"))
      : "mobile_money";

    const payoutSchedule = ["weekly", "biweekly", "monthly"].includes(
      String(value("payout_schedule", existing?.payout_schedule || "monthly"))
    )
      ? String(value("payout_schedule", existing?.payout_schedule || "monthly"))
      : "monthly";

    const notify = (key, fallback) =>
      value(key, existing?.[key] ?? fallback) ? 1 : 0;

    if (existing) {
      db.prepare(`
        UPDATE seller_settings
        SET
          store_name = ?,
          phone = ?,
          location = ?,
          description = ?,
          store_status = ?,
          currency = ?,
          minimum_order_quantity = ?,
          delivery_information = ?,
          notify_new_orders = ?,
          notify_rfqs = ?,
          notify_order_updates = ?,
          notify_marketing = ?,
          payout_method = ?,
          payout_account_name = ?,
          payout_account_number = ?,
          payout_schedule = ?,
          tax_vat_number = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        value("store_name", existing.store_name),
        value("phone", existing.phone),
        value("location", existing.location),
        value("description", existing.description),
        storeStatus,
        currency,
        minimumOrderQuantity,
        value("delivery_information", existing.delivery_information),
        notify("notify_new_orders", 1),
        notify("notify_rfqs", 1),
        notify("notify_order_updates", 1),
        notify("notify_marketing", 0),
        payoutMethod,
        value("payout_account_name", existing.payout_account_name),
        value("payout_account_number", existing.payout_account_number),
        payoutSchedule,
        value("tax_vat_number", existing.tax_vat_number),
        userId
      );
    } else {
      db.prepare(`
        INSERT INTO seller_settings (
          user_id,
          store_name,
          phone,
          location,
          description,
          store_status,
          currency,
          minimum_order_quantity,
          delivery_information,
          notify_new_orders,
          notify_rfqs,
          notify_order_updates,
          notify_marketing,
          payout_method,
          payout_account_name,
          payout_account_number,
          payout_schedule,
          tax_vat_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        value("store_name", null),
        value("phone", null),
        value("location", null),
        value("description", null),
        storeStatus,
        currency,
        minimumOrderQuantity,
        value("delivery_information", null),
        notify("notify_new_orders", 1),
        notify("notify_rfqs", 1),
        notify("notify_order_updates", 1),
        notify("notify_marketing", 0),
        payoutMethod,
        value("payout_account_name", null),
        value("payout_account_number", null),
        payoutSchedule,
        value("tax_vat_number", null)
      );
    }

    const settings = db
      .prepare("SELECT * FROM seller_settings WHERE user_id = ?")
      .get(userId);

    return res.json({
      success: true,
      message: "Seller settings zimehifadhiwa.",
      settings
    });
  } catch (error) {
    console.error("Seller settings PUT error:", error);

    return res.status(500).json({
      success: false,
      message: "Kuhifadhi seller settings kumeshindikana."
    });
  }
});

app.get("/api/clickpesa/token-test", requireAdmin, async (req, res) => {
  try {
    const response = await axios.post(
      `${process.env.CLICKPESA_API_URL}/third-parties/generate-token`,
      null,
      {
        headers: {
          "client-id": process.env.CLICKPESA_CLIENT_ID,
          "api-key": process.env.CLICKPESA_API_KEY
        }
      }
    );

    res.json({
      success: true,
      message: "ClickPesa authentication imefanikiwa."
    });
  } catch (error) {
    console.error(
      "ClickPesa authentication failed:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      message: "ClickPesa authentication imeshindikana."
    });
  }
});


/* ---------- SELLER LOGIN ACTIVITY ---------- */

app.delete("/api/seller/login-activity", (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    const seller = db.prepare(`
      SELECT id, role
      FROM users
      WHERE id = ?
      LIMIT 1
    `).get(userId);

    if (!seller || seller.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Akaunti hii si seller account."
      });
    }

    db.prepare(`
      DELETE FROM seller_login_activity
      WHERE user_id = ?
    `).run(userId);

    return res.json({
      success: true,
      message: "Login history imefutwa."
    });
  } catch (error) {
    console.error("Seller login activity DELETE error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kufuta login history."
    });
  }
});

app.get("/api/seller/login-activity", (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    const seller = db.prepare(`
      SELECT id, role
      FROM users
      WHERE id = ?
      LIMIT 1
    `).get(userId);

    if (!seller || seller.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Akaunti hii si seller account."
      });
    }

    const activities = db.prepare(`
      SELECT
        id,
        login_at,
        login_status,
        device_info,
        ip_address
      FROM seller_login_activity
      WHERE user_id = ?
      ORDER BY datetime(login_at) DESC
      LIMIT 5
    `).all(userId);

    return res.json({
      success: true,
      activities
    });

  } catch (error) {
    console.error("Seller login activity GET error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kusoma login activity."
    });
  }
});

/* ---------- SELLER SETTINGS ---------- */
app.get("/api/seller/settings", (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    const seller = db.prepare(`
      SELECT id, name, email, role, last_login_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `).get(userId);

    if (!seller || seller.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Akaunti hii si seller account."
      });
    }

    const settings = db.prepare(`
      SELECT *
      FROM seller_settings
      WHERE user_id = ?
      LIMIT 1
    `).get(userId);

    return res.json({
      success: true,
      user: seller,
      settings: settings || null
    });
  } catch (error) {
    console.error("Seller settings GET error:", error);
    return res.status(500).json({
      success: false,
      message: "Imeshindikana kusoma seller settings."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Zenodic backend running on port ${PORT}`);
});
