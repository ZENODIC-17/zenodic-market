const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");
fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });

const db = new DatabaseSync(
  path.join(__dirname, "data", "zenodic.db")
);

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
/* ============================================================
   ZENODIC ADMIN WEBAUTHN CREDENTIALS
   ============================================================ */
db.exec(`
CREATE TABLE IF NOT EXISTS admin_webauthn_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_webauthn_admin
ON admin_webauthn_credentials(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_webauthn_credential
ON admin_webauthn_credentials(credential_id);
`);
db.exec(`
CREATE TABLE IF NOT EXISTS admin_webauthn_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  challenge TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_webauthn_challenge
ON admin_webauthn_challenges(challenge);
`);




db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'wholesale')),
    provider TEXT NOT NULL DEFAULT 'local',
    provider_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

  CREATE INDEX IF NOT EXISTS idx_users_provider
    ON users(provider, provider_id);
`);


/* ============================================================
   SELLER SETTINGS
   ============================================================ */

db.exec(`
  CREATE TABLE IF NOT EXISTS seller_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,

    store_name TEXT,
    phone TEXT,
    location TEXT,
    description TEXT,

    store_status TEXT NOT NULL DEFAULT 'open'
      CHECK (store_status IN ('open', 'paused')),

    currency TEXT NOT NULL DEFAULT 'TZS',
    minimum_order_quantity REAL DEFAULT 1,
    delivery_information TEXT,

    notify_new_orders INTEGER NOT NULL DEFAULT 1,
    notify_rfqs INTEGER NOT NULL DEFAULT 1,
    notify_order_updates INTEGER NOT NULL DEFAULT 1,
    notify_marketing INTEGER NOT NULL DEFAULT 0,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_seller_settings_user
    ON seller_settings(user_id);
`);


/* ---------- LOGIN ACTIVITY MIGRATION ---------- */
/* ---------- SELLER LOGIN ACTIVITY TABLE ---------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS seller_login_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    login_at TEXT DEFAULT CURRENT_TIMESTAMP,
    login_status TEXT DEFAULT 'success',
    device_info TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);


const loginActivityColumns = [
  ["last_login_at", "TEXT"]
];

for (const [column, definition] of loginActivityColumns) {
  const exists = db
    .prepare("PRAGMA table_info(users)")
    .all()
    .some(row => row.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
  }
}

/* ---------- SELLER PAYMENT & PAYOUT MIGRATION ---------- */
const sellerPaymentColumns = [
  ["payout_method", "TEXT DEFAULT 'mobile_money'"],
  ["payout_account_name", "TEXT"],
  ["payout_account_number", "TEXT"],
  ["payout_schedule", "TEXT DEFAULT 'monthly'"],
  ["tax_vat_number", "TEXT"]
];

for (const [column, definition] of sellerPaymentColumns) {
  const exists = db
    .prepare("PRAGMA table_info(seller_settings)")
    .all()
    .some(row => row.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE seller_settings ADD COLUMN ${column} ${definition}`);
  }
}


/* ============================================================
   ZENODIC ADMIN SETTINGS
   ============================================================ */

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO admin_settings
    (setting_key, setting_value)
  VALUES
    ('commission_rate', '5');
`);

/* ============================================================
   ZENODIC PAYMENTS / COMMISSIONS / SELLER LEDGER / PAYOUTS
   ============================================================ */

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER,
    payment_reference TEXT NOT NULL UNIQUE,
    payment_method TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TZS',
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
    provider_reference TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_payments_order
    ON payments(order_id);

  CREATE INDEX IF NOT EXISTS idx_payments_buyer
    ON payments(buyer_id);

  CREATE INDEX IF NOT EXISTS idx_payments_seller
    ON payments(seller_id);

  CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(status);

  CREATE TABLE IF NOT EXISTS admin_commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL UNIQUE,
    order_id INTEGER NOT NULL,
    commission_rate REAL NOT NULL,
    gross_amount REAL NOT NULL,
    commission_amount REAL NOT NULL,
    seller_net_amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TZS',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE INDEX IF NOT EXISTS idx_commissions_order
    ON admin_commissions(order_id);

  CREATE TABLE IF NOT EXISTS seller_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    payment_id INTEGER,
    order_id INTEGER,
    entry_type TEXT NOT NULL
      CHECK (entry_type IN ('credit', 'debit')),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TZS',
    description TEXT,
    reference TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (payment_id) REFERENCES payments(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE INDEX IF NOT EXISTS idx_seller_ledger_seller
    ON seller_ledger(seller_id);

  CREATE INDEX IF NOT EXISTS idx_seller_ledger_payment
    ON seller_ledger(payment_id);

  CREATE TABLE IF NOT EXISTS seller_payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TZS',
    payout_method TEXT NOT NULL,
    payout_account_name TEXT,
    payout_account_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
    payout_reference TEXT NOT NULL UNIQUE,
    provider_reference TEXT,
    processed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller
    ON seller_payouts(seller_id);

  CREATE INDEX IF NOT EXISTS idx_seller_payouts_status
    ON seller_payouts(status);
`);

module.exports = db;

/* =========================================================
   ZENODIC B2B / WHOLESALE / FACTORY
   ========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS rfqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    target_price REAL,
    currency TEXT DEFAULT 'TZS',
    delivery_location TEXT,
    required_date TEXT,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rfq_quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rfq_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    quantity REAL NOT NULL,
    currency TEXT DEFAULT 'TZS',
    delivery_days INTEGER,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfqs(id),
    FOREIGN KEY (supplier_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER,
    rfq_id INTEGER,
    order_number TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    currency TEXT DEFAULT 'TZS',
    total_amount REAL DEFAULT 0,
    delivery_location TEXT,
    expected_delivery TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (rfq_id) REFERENCES rfqs(id)
  );

  CREATE TABLE IF NOT EXISTS market_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TZS',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_products_active
ON market_products(active);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    item_type TEXT DEFAULT 'finished_product',
    sku TEXT,
    quantity REAL DEFAULT 0,
    reserved_quantity REAL DEFAULT 0,
    reorder_level REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    location TEXT,
    image_url TEXT,
    description TEXT,
    price REAL,
    phone TEXT,
    approval_status TEXT DEFAULT 'pending',
    video_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
  );

  CREATE TABLE IF NOT EXISTS production_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_id INTEGER,
    production_number TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    planned_quantity REAL NOT NULL,
    produced_quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    status TEXT DEFAULT 'planned',
    start_date TEXT,
    expected_completion TEXT,
    actual_completion TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE INDEX IF NOT EXISTS idx_rfqs_user
    ON rfqs(user_id);

  CREATE INDEX IF NOT EXISTS idx_rfqs_status
    ON rfqs(status);

  CREATE INDEX IF NOT EXISTS idx_orders_buyer
    ON orders(buyer_id);

  CREATE INDEX IF NOT EXISTS idx_orders_seller
    ON orders(seller_id);

  CREATE INDEX IF NOT EXISTS idx_inventory_user
    ON inventory(user_id);

  CREATE INDEX IF NOT EXISTS idx_inventory_sku
    ON inventory(sku);

  CREATE INDEX IF NOT EXISTS idx_production_user
    ON production_orders(user_id);

  CREATE INDEX IF NOT EXISTS idx_production_status
    ON production_orders(status);
`);


/* ============================================================
   ZENODIC NOTIFICATIONS
   ============================================================ */

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    order_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id);

  CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(user_id, is_read);

  CREATE INDEX IF NOT EXISTS idx_notifications_created
    ON notifications(created_at);
`);

/* ============================================================
   ZENODIC INVENTORY SCHEMA MIGRATION
   ============================================================ */
const inventoryColumns = db
  .prepare("PRAGMA table_info(inventory)")
  .all()
  .map((column) => column.name);

const inventoryMigrations = {
  image_url: "ALTER TABLE inventory ADD COLUMN image_url TEXT",
  description: "ALTER TABLE inventory ADD COLUMN description TEXT",
  price: "ALTER TABLE inventory ADD COLUMN price REAL",
  phone: "ALTER TABLE inventory ADD COLUMN phone TEXT",
  approval_status:
    "ALTER TABLE inventory ADD COLUMN approval_status TEXT DEFAULT 'pending'",
  video_url: "ALTER TABLE inventory ADD COLUMN video_url TEXT"
};

for (const [column, sql] of Object.entries(inventoryMigrations)) {
  if (!inventoryColumns.includes(column)) {
    db.exec(sql);
  }
}

/* ============================================================
   ZENODIC USERS SCHEMA MIGRATION
   ============================================================ */
const userColumns = db
  .prepare("PRAGMA table_info(users)")
  .all()
  .map((column) => column.name);

const userMigrations = {
  verification_status:
    "ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending'",
  account_status:
    "ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'"
};

for (const [column, sql] of Object.entries(userMigrations)) {
  if (!userColumns.includes(column)) {
    db.exec(sql);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const auditColumns = db
  .prepare("PRAGMA table_info(admin_audit_logs)")
  .all()
  .map((column) => column.name);

const auditMigrations = {
  target_type: "ALTER TABLE admin_audit_logs ADD COLUMN target_type TEXT",
  target_id: "ALTER TABLE admin_audit_logs ADD COLUMN target_id TEXT",
  description: "ALTER TABLE admin_audit_logs ADD COLUMN description TEXT",
  metadata: "ALTER TABLE admin_audit_logs ADD COLUMN metadata TEXT",
  ip_address: "ALTER TABLE admin_audit_logs ADD COLUMN ip_address TEXT",
  user_agent: "ALTER TABLE admin_audit_logs ADD COLUMN user_agent TEXT"
};

for (const [column, sql] of Object.entries(auditMigrations)) {
  if (!auditColumns.includes(column)) {
    db.exec(sql);
  }
}

const adminColumns = db
  .prepare("PRAGMA table_info(admins)")
  .all()
  .map((column) => column.name);

if (!adminColumns.includes("email")) {
  db.exec("ALTER TABLE admins ADD COLUMN email TEXT");
}

db.prepare(
  "UPDATE admins SET email = username WHERE email IS NULL AND username = ?"
).run("admin@zenodic.com");
