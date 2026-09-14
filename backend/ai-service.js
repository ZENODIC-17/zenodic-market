const db = require("./database");

/**
 * Zenodic AI shared service.
 *
 * Hii ndiyo layer moja ya AI inayotumiwa na:
 * - Buyer
 * - Seller
 * - Admin
 *
 * Kwa sasa context functions ni READ-ONLY.
 * Hakuna password, token, API key au secret inayorudishwa.
 */

function getBuyerContext(userId) {
  const user = db.prepare(`
    SELECT id, username, email, role
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!user) {
    return null;
  }

  const orders = db.prepare(`
    SELECT id, order_number, seller_id, status, payment_status,
           currency, total_amount, delivery_location,
           expected_delivery, created_at, updated_at
    FROM orders
    WHERE buyer_id = ?
    ORDER BY id DESC
    LIMIT 10
  `).all(userId);

  const notifications = db.prepare(`
    SELECT id, type, title, message, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 10
  `).all(userId);

  return {
    role: "buyer",
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    },
    orders,
    notifications
  };
}

function getSellerContext(userId) {
  const user = db.prepare(`
    SELECT id, username, email, role
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!user) {
    return null;
  }

  const settings = db.prepare(`
    SELECT id, user_id, store_name, phone, location,
           description, store_status, currency,
           minimum_order_quantity, delivery_information,
           notify_new_orders, notify_rfqs,
           notify_order_updates, notify_marketing,
           created_at, updated_at, payout_method,
           payout_schedule
    FROM seller_settings
    WHERE user_id = ?
    LIMIT 1
  `).get(userId);

  const ledger = db.prepare(`
    SELECT id, payment_id, order_id, entry_type,
           amount, currency, description, reference, created_at
    FROM seller_ledger
    WHERE seller_id = ?
    ORDER BY id DESC
    LIMIT 20
  `).all(userId);

  const payouts = db.prepare(`
    SELECT id, amount, currency, payout_method,
           status, payout_reference, provider_reference,
           processed_at, created_at, updated_at
    FROM seller_payouts
    WHERE seller_id = ?
    ORDER BY id DESC
    LIMIT 10
  `).all(userId);

  const inventory = db.prepare(`
    SELECT id, item_name, item_type, sku, quantity,
           reserved_quantity, reorder_level, unit,
           location, created_at, updated_at,
           image_url, description, price, approval_status
    FROM inventory
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 50
  `).all(userId);

  return {
    role: "seller",
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    },
    settings,
    ledger,
    payouts,
    inventory
  };
}

function getAdminContext(adminId) {
  const admin = db.prepare(`
    SELECT id, username, email
    FROM admins
    WHERE id = ?
  `).get(adminId);

  if (!admin) {
    return null;
  }

  const auditLogs = db.prepare(`
    SELECT id, action, target_type, target_id, description, created_at
    FROM admin_audit_logs
    ORDER BY id DESC
    LIMIT 50
  `).all();

  const notifications = db.prepare(`
    SELECT id, type, title, message, priority,
           entity_type, entity_id, is_read, created_at
    FROM admin_notifications
    ORDER BY id DESC
    LIMIT 20
  `).all();

  return {
    role: "admin",
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email
    },
    auditLogs,
    notifications
  };
}

function getRoleContext({ role, userId, adminId }) {
  if (role === "buyer") {
    return getBuyerContext(userId);
  }

  if (role === "seller") {
    return getSellerContext(userId);
  }

  if (role === "admin") {
    return getAdminContext(adminId);
  }

  return null;
}

module.exports = {
  getBuyerContext,
  getSellerContext,
  getAdminContext,
  getRoleContext
};
