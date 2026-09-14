const ExcelJS = require("exceljs");
const express = require("express");
const db = require("./database");

const { createNotification } = require("./notification-helper");
const { requireUser } = require("./user-auth");

const router = express.Router();

/* =========================================================
   GET /api/orders?buyer_id=1
   Buyer anaona orders zake
   ========================================================= */
router.get("/", requireUser, (req, res) => {
  try {
    const buyerId = req.user.id;

    const orders = db.prepare(`
      SELECT
        o.id,
        o.buyer_id,
        o.seller_id,
        o.rfq_id,
        o.order_number,
        o.status,
        o.payment_status,
        o.currency,
        o.total_amount,
        o.delivery_location,
        o.expected_delivery,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE o.buyer_id = ?
      ORDER BY o.id DESC
    `).all(buyerId);

    return res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error("List buyer orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata orders."
    });
  }
});


/* =========================================================
   GET /api/orders/:id?user_id=1
   Buyer au seller anaona order moja
   ========================================================= */
router.get("/:id", requireUser, (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const userId = req.user.id;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Order ID si sahihi."
      });
    }

    const order = db.prepare(`
      SELECT
        o.id,
        o.buyer_id,
        o.seller_id,
        o.rfq_id,
        o.order_number,
        o.status,
        o.payment_status,
        o.currency,
        o.total_amount,
        o.delivery_location,
        o.expected_delivery,
        o.created_at,
        o.updated_at,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
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
        message: "Order haijapatikana."
      });
    }

    if (order.buyer_id !== userId && order.seller_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Huna ruhusa kuona order hii."
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
      order,
      items
    });
  } catch (error) {
    console.error("Get order error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata order."
    });
  }
});


/* =========================================================
   GET /api/orders/seller/:seller_id
   Seller anaona orders alizopokea
   ========================================================= */

/* =========================================================
   GET /api/orders/seller/:seller_id/overview
   Seller Sales Overview + Earnings
   ========================================================= */
router.get("/seller/:seller_id/overview", (req, res) => {
  try {
    const sellerId = Number(req.params.seller_id);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "seller_id si sahihi."
      });
    }

    const seller = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = 'seller'
    `).get(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller hakupatikana."
      });
    }

    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_sales,

        COALESCE(SUM(
          CASE WHEN payment_status = 'paid'
          THEN total_amount ELSE 0 END
        ), 0) AS paid_earnings,

        COALESCE(SUM(
          CASE WHEN payment_status != 'paid'
            OR payment_status IS NULL
          THEN total_amount ELSE 0 END
        ), 0) AS unpaid_amount,

        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)
          AS pending_orders,

        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0)
          AS confirmed_orders,

        COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0)
          AS processing_orders,

        COALESCE(SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END), 0)
          AS shipped_orders,

        COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0)
          AS delivered_orders,

        COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0)
          AS cancelled_orders

      FROM orders
      WHERE seller_id = ?
    `).get(sellerId);

    const recentOrders = db.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.buyer_id,
        u.name AS buyer_name,
        o.status,
        o.payment_status,
        o.currency,
        o.total_amount,
        o.delivery_location,
        o.expected_delivery,
        o.created_at,
        o.updated_at
      FROM orders o
      LEFT JOIN users u ON u.id = o.buyer_id
      WHERE o.seller_id = ?
      ORDER BY o.id DESC
      LIMIT 10
    `).all(sellerId);

    const salesLast7Days = db.prepare(`
      SELECT
        substr(created_at, 1, 10) AS date,
        COUNT(*) AS orders,
        COALESCE(SUM(total_amount), 0) AS sales,
        COALESCE(SUM(
          CASE WHEN payment_status = 'paid'
          THEN total_amount ELSE 0 END
        ), 0) AS paid_sales
      FROM orders
      WHERE seller_id = ?
        AND datetime(created_at) >= datetime('now', '-6 days')
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `).all(sellerId);

    return res.json({
      success: true,
      seller,
      summary,
      recentOrders,
      salesLast7Days
    });

  } catch (error) {
    console.error("Seller sales overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata seller sales overview."
    });
  }
});

router.get("/seller/:seller_id", (req, res) => {
  try {
    const sellerId = Number(req.params.seller_id);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "seller_id si sahihi."
      });
    }

    const orders = db.prepare(`
      SELECT
        o.id,
        o.buyer_id,
        o.seller_id,
        o.rfq_id,
        o.order_number,
        o.status,
        o.payment_status,
        o.currency,
        o.total_amount,
        o.delivery_location,
        o.expected_delivery,
        o.created_at,
        o.updated_at,
        u.name AS buyer_name,
        u.email AS buyer_email
      FROM orders o
      LEFT JOIN users u ON u.id = o.buyer_id
      WHERE o.seller_id = ?
      ORDER BY o.id DESC
    `).all(sellerId);

    return res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error("List seller orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata seller orders."
    });
  }
});


/* =========================================================
   PATCH /api/orders/:id/status

   Body:
   {
     "user_id": 1,
     "status": "confirmed"
   }

   Allowed:
   pending
   confirmed
   processing
   shipped
   delivered
   cancelled
   ========================================================= */
router.patch("/:id/status", (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const userId = Number(req.body.user_id);
    const status = String(req.body.status || "").trim().toLowerCase();

    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled"
    ];

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Order ID si sahihi."
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status ya order si halali."
      });
    }

    const order = db.prepare(`
      SELECT id, buyer_id, seller_id, status
      FROM orders
      WHERE id = ?
    `).get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order haijapatikana."
      });
    }

    if (order.buyer_id !== userId && order.seller_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Huna ruhusa kubadilisha order hii."
      });
    }

    db.prepare(`
      UPDATE orders
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, orderId);

    /* Notify the other party about order status change */
    const statusRecipient =
      order.buyer_id === userId
        ? order.seller_id
        : order.buyer_id;

    if (statusRecipient) {
      createNotification({
        userId: statusRecipient,
        type: "order_status",
        title: "Order status updated",
        message: `Order #${orderId} is now ${status}.`,
        orderId
      });
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
    console.error("Update order status error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha order status."
    });
  }
});


/* =========================================================
   PATCH /api/orders/:id/payment

   Body:
   {
     "user_id": 1,
     "payment_status": "paid"
   }

   Allowed:
   unpaid
   pending
   paid
   failed
   refunded
   ========================================================= */
router.patch("/:id/payment", (req, res) => {
  return res.status(403).json({
    success: false,
    message:
      "Payment status haiwezi kubadilishwa manually. Subiri uthibitisho wa payment gateway."
  });
});

router.get("/seller/:sellerId/earnings", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);

    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID."
      });
    }

    const seller = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = 'seller'
    `).get(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found."
      });
    }

    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total_orders,

        COALESCE(SUM(total_amount), 0) AS total_sales,

        COALESCE(SUM(
          CASE
            WHEN payment_status = 'paid'
            THEN total_amount
            ELSE 0
          END
        ), 0) AS paid_earnings,

        COALESCE(SUM(
          CASE
            WHEN payment_status != 'paid'
            THEN total_amount
            ELSE 0
          END
        ), 0) AS pending_earnings

      FROM orders
      WHERE seller_id = ?
    `).get(sellerId);

    const transactions = db.prepare(`
      SELECT
        id,
        order_number,
        buyer_id,
        status,
        payment_status,
        currency,
        total_amount,
        delivery_location,
        created_at,
        updated_at
      FROM orders
      WHERE seller_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 100
    `).all(sellerId);

    const monthly = db.prepare(`
      SELECT
        substr(created_at, 1, 7) AS month,
        COUNT(*) AS orders,
        COALESCE(SUM(total_amount), 0) AS sales,
        COALESCE(SUM(
          CASE
            WHEN payment_status = 'paid'
            THEN total_amount
            ELSE 0
          END
        ), 0) AS paid_sales
      FROM orders
      WHERE seller_id = ?
      GROUP BY substr(created_at, 1, 7)
      ORDER BY month DESC
      LIMIT 12
    `).all(sellerId);

    return res.json({
      success: true,

      seller,

      summary: {
        total_orders: Number(summary.total_orders || 0),
        total_sales: Number(summary.total_sales || 0),
        paid_earnings: Number(summary.paid_earnings || 0),
        pending_earnings: Number(summary.pending_earnings || 0)
      },

      transactions,

      monthly
    });

  } catch (error) {
    console.error("Seller earnings error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata earnings."
    });
  }
});



/* ============================================================
   SELLER SPEED SHEET
   Quick operational snapshot for seller dashboard
   ============================================================ */
router.get("/seller/:sellerId/speed-sheet", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID."
      });
    }

    const seller = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = 'seller'
    `).get(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found."
      });
    }

    const today = db.prepare(`
      SELECT
        COUNT(*) AS orders,
        COALESCE(SUM(total_amount), 0) AS sales,
        COALESCE(SUM(
          CASE WHEN payment_status = 'paid'
          THEN total_amount ELSE 0 END
        ), 0) AS paid_sales,
        COALESCE(SUM(
          CASE WHEN payment_status != 'paid'
          THEN total_amount ELSE 0 END
        ), 0) AS unpaid_sales
      FROM orders
      WHERE seller_id = ?
        AND date(created_at) = date('now')
    `).get(sellerId);

    const orderStatus = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed,
        COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) AS processing,
        COALESCE(SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END), 0) AS shipped,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered,
        COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
      FROM orders
      WHERE seller_id = ?
    `).get(sellerId);

    const payment = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_orders,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' THEN 1 ELSE 0 END), 0) AS unpaid_orders,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' THEN total_amount ELSE 0 END), 0) AS unpaid_amount
      FROM orders
      WHERE seller_id = ?
    `).get(sellerId);

    const inventory = db.prepare(`
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(quantity), 0) AS total_quantity,
        COALESCE(SUM(reserved_quantity), 0) AS reserved_quantity,
        COALESCE(SUM(
          CASE
            WHEN quantity <= reorder_level THEN 1
            ELSE 0
          END
        ), 0) AS low_stock_products,
        COALESCE(SUM(
          CASE
            WHEN quantity <= 0 THEN 1
            ELSE 0
          END
        ), 0) AS out_of_stock_products
      FROM inventory
      WHERE user_id = ?
    `).get(sellerId);

    const recentOrders = db.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.payment_status,
        o.currency,
        o.total_amount,
        o.expected_delivery,
        o.created_at,
        u.name AS buyer_name
      FROM orders o
      LEFT JOIN users u ON u.id = o.buyer_id
      WHERE o.seller_id = ?
      ORDER BY datetime(o.created_at) DESC
      LIMIT 8
    `).all(sellerId);

    const lowStock = db.prepare(`
      SELECT
        id,
        item_name,
        sku,
        quantity,
        reserved_quantity,
        reorder_level,
        unit,
        location
      FROM inventory
      WHERE user_id = ?
        AND quantity <= reorder_level
      ORDER BY quantity ASC, item_name ASC
      LIMIT 10
    `).all(sellerId);

    const todaySales = Number(today.sales || 0);
    const paidSales = Number(today.paid_sales || 0);

    return res.json({
      success: true,
      seller,

      today: {
        orders: Number(today.orders || 0),
        sales: todaySales,
        paid_sales: paidSales,
        unpaid_sales: Number(today.unpaid_sales || 0)
      },

      orders: {
        pending: Number(orderStatus.pending || 0),
        confirmed: Number(orderStatus.confirmed || 0),
        processing: Number(orderStatus.processing || 0),
        shipped: Number(orderStatus.shipped || 0),
        delivered: Number(orderStatus.delivered || 0),
        cancelled: Number(orderStatus.cancelled || 0)
      },

      payments: {
        paid_orders: Number(payment.paid_orders || 0),
        unpaid_orders: Number(payment.unpaid_orders || 0),
        paid_amount: Number(payment.paid_amount || 0),
        unpaid_amount: Number(payment.unpaid_amount || 0)
      },

      inventory: {
        total_products: Number(inventory.total_products || 0),
        total_quantity: Number(inventory.total_quantity || 0),
        reserved_quantity: Number(inventory.reserved_quantity || 0),
        low_stock_products: Number(inventory.low_stock_products || 0),
        out_of_stock_products: Number(inventory.out_of_stock_products || 0)
      },

      recentOrders,
      lowStock
    });

  } catch (error) {
    console.error("Seller Speed Sheet error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata Speed Sheet."
    });
  }
});




/* ============================================================
   SELLER REPORTS
   Detailed order report data for seller dashboard / Excel
   ============================================================ */
router.get("/seller/:sellerId/reports", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID."
      });
    }

    const seller = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = 'seller'
    `).get(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found."
      });
    }

    const requestedPeriod = String(
      req.query.period || "30d"
    ).toLowerCase();

    const periodConfig = {
      "7d": 6,
      "30d": 29,
      "90d": 89,
      "1y": 364,
      "all": null
    };

    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(
      String(req.query.from || "")
    );

    const validTo = /^\d{4}-\d{2}-\d{2}$/.test(
      String(req.query.to || "")
    );

    let period = Object.prototype.hasOwnProperty.call(
      periodConfig,
      requestedPeriod
    )
      ? requestedPeriod
      : "30d";

    let dateCondition = "";
    let params = [sellerId];

    if (validFrom && validTo) {
      const from = String(req.query.from);
      const to = String(req.query.to);

      if (from > to) {
        return res.status(400).json({
          success: false,
          message: "From date haiwezi kuwa baada ya To date."
        });
      }

      period = "custom";

      dateCondition = `
        AND date(o.created_at) >= date(?)
        AND date(o.created_at) <= date(?)
      `;

      params.push(from, to);
    } else {
      const daysBack = periodConfig[period];

      dateCondition =
        daysBack === null
          ? ""
          : `AND datetime(o.created_at) >= datetime('now', '-${daysBack} days')`;
    }

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
        o.buyer_id,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        oi.id AS item_id,
        oi.product_name,
        oi.quantity,
        oi.unit,
        oi.unit_price,
        oi.total_price
      FROM orders o
      LEFT JOIN users buyer
        ON buyer.id = o.buyer_id
      LEFT JOIN order_items oi
        ON oi.order_id = o.id
      WHERE o.seller_id = ?
        ${dateCondition}
      ORDER BY datetime(o.created_at) DESC, o.id DESC, oi.id ASC
    `).all(...params);

    const summary = db.prepare(`
      SELECT
        COUNT(DISTINCT o.id) AS total_orders,
        COALESCE(SUM(DISTINCT o.total_amount), 0) AS total_sales,
        COALESCE(SUM(
          CASE
            WHEN LOWER(COALESCE(o.payment_status, '')) = 'paid'
            THEN o.total_amount
            ELSE 0
          END
        ), 0) AS paid_sales
      FROM orders o
      WHERE o.seller_id = ?
        ${dateCondition}
    `).get(...params);

    const totalSales = Number(summary.total_sales || 0);
    const paidSales = Number(summary.paid_sales || 0);

    return res.json({
      success: true,
      period,
      filters: {
        from: validFrom && validTo
          ? String(req.query.from)
          : null,
        to: validFrom && validTo
          ? String(req.query.to)
          : null
      },
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        role: seller.role
      },
      summary: {
        total_orders: Number(summary.total_orders || 0),
        total_sales: totalSales,
        paid_sales: paidSales,
        unpaid_sales: Math.max(0, totalSales - paidSales),
        average_order_value:
          Number(summary.total_orders || 0) > 0
            ? totalSales / Number(summary.total_orders)
            : 0
      },
      orders: orders.map(row => ({
        id: Number(row.id),
        order_number: row.order_number,
        status: row.status,
        payment_status: row.payment_status,
        currency: row.currency || "TZS",
        total_amount: Number(row.total_amount || 0),
        delivery_location: row.delivery_location || "",
        expected_delivery: row.expected_delivery || "",
        created_at: row.created_at,
        updated_at: row.updated_at,
        buyer_id: row.buyer_id,
        buyer_name: row.buyer_name || "",
        buyer_email: row.buyer_email || "",
        item_id: row.item_id ? Number(row.item_id) : null,
        product_name: row.product_name || "",
        quantity: Number(row.quantity || 0),
        unit: row.unit || "",
        unit_price: Number(row.unit_price || 0),
        total_price: Number(row.total_price || 0)
      }))
    });

  } catch (error) {
    console.error("Seller reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata Seller Report."
    });
  }
});


/* ============================================================
   SELLER REPORT — EXCEL EXPORT
   Generates a real .xlsx workbook from seller report data
   ============================================================ */
router.get("/seller/:sellerId/reports/excel", async (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID."
      });
    }

    const seller = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = 'seller'
    `).get(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found."
      });
    }

    const requestedPeriod = String(
      req.query.period || "30d"
    ).toLowerCase();

    const periodConfig = {
      "7d": 6,
      "30d": 29,
      "90d": 89,
      "1y": 364,
      "all": null
    };

    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(
      String(req.query.from || "")
    );

    const validTo = /^\d{4}-\d{2}-\d{2}$/.test(
      String(req.query.to || "")
    );

    let period = Object.prototype.hasOwnProperty.call(
      periodConfig,
      requestedPeriod
    )
      ? requestedPeriod
      : "30d";

    let dateCondition = "";
    let params = [sellerId];

    if (validFrom && validTo) {
      const from = String(req.query.from);
      const to = String(req.query.to);

      if (from > to) {
        return res.status(400).json({
          success: false,
          message: "From date haiwezi kuwa baada ya To date."
        });
      }

      period = "custom";

      dateCondition = `
        AND date(o.created_at) >= date(?)
        AND date(o.created_at) <= date(?)
      `;

      params.push(from, to);
    } else {
      const daysBack = periodConfig[period];

      dateCondition =
        daysBack === null
          ? ""
          : `AND datetime(o.created_at) >= datetime('now', '-${daysBack} days')`;
    }

    const rows = db.prepare(`
      SELECT
        o.order_number,
        o.created_at,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        o.status,
        o.payment_status,
        o.currency,
        o.total_amount,
        o.delivery_location,
        o.expected_delivery,
        oi.product_name,
        oi.quantity,
        oi.unit,
        oi.unit_price,
        oi.total_price
      FROM orders o
      LEFT JOIN users buyer
        ON buyer.id = o.buyer_id
      LEFT JOIN order_items oi
        ON oi.order_id = o.id
      WHERE o.seller_id = ?
        ${dateCondition}
      ORDER BY datetime(o.created_at) DESC, o.id DESC, oi.id ASC
    `).all(...params);

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "ZENODIC";
    workbook.lastModifiedBy = "ZENODIC";
    workbook.created = new Date();
    workbook.modified = new Date();

    const summarySheet = workbook.addWorksheet("Summary");
    const ordersSheet = workbook.addWorksheet("Orders");

    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 28 },
      { header: "Value", key: "value", width: 28 }
    ];

    const totalSales = rows.reduce(
      (sum, row) => sum + Number(row.total_amount || 0),
      0
    );

    const paidSales = rows.reduce(
      (sum, row) =>
        String(row.payment_status || "").toLowerCase() === "paid"
          ? sum + Number(row.total_amount || 0)
          : sum,
      0
    );

    const uniqueOrders = new Set(
      rows.map(row => row.order_number).filter(Boolean)
    ).size;

    summarySheet.addRows([
      ["Seller", seller.name],
      ["Email", seller.email],
      ["Report Period", period],
      ["Generated At", new Date()],
      [],
      ["Total Orders", uniqueOrders],
      ["Total Sales", totalSales],
      ["Paid Sales", paidSales],
      ["Unpaid Sales", Math.max(0, totalSales - paidSales)],
      [
        "Average Order Value",
        uniqueOrders > 0 ? totalSales / uniqueOrders : 0
      ]
    ]);

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).alignment = {
      vertical: "middle"
    };

    summarySheet.getColumn(2).numFmt =
      'TZS #,##0';

    ordersSheet.columns = [
      { header: "Order Number", key: "order_number", width: 24 },
      { header: "Date", key: "created_at", width: 22 },
      { header: "Buyer", key: "buyer_name", width: 24 },
      { header: "Buyer Email", key: "buyer_email", width: 30 },
      { header: "Product", key: "product_name", width: 30 },
      { header: "Quantity", key: "quantity", width: 14 },
      { header: "Unit", key: "unit", width: 14 },
      { header: "Unit Price", key: "unit_price", width: 18 },
      { header: "Item Total", key: "total_price", width: 18 },
      { header: "Order Total", key: "total_amount", width: 20 },
      { header: "Order Status", key: "status", width: 18 },
      { header: "Payment Status", key: "payment_status", width: 18 },
      { header: "Delivery Location", key: "delivery_location", width: 26 },
      { header: "Expected Delivery", key: "expected_delivery", width: 20 }
    ];

    for (const row of rows) {
      ordersSheet.addRow({
        order_number: row.order_number || "",
        created_at: row.created_at || "",
        buyer_name: row.buyer_name || "",
        buyer_email: row.buyer_email || "",
        product_name: row.product_name || "",
        quantity: Number(row.quantity || 0),
        unit: row.unit || "",
        unit_price: Number(row.unit_price || 0),
        total_price: Number(row.total_price || 0),
        total_amount: Number(row.total_amount || 0),
        status: row.status || "",
        payment_status: row.payment_status || "",
        delivery_location: row.delivery_location || "",
        expected_delivery: row.expected_delivery || ""
      });
    }

    ordersSheet.getRow(1).font = {
      bold: true
    };

    ordersSheet.views = [
      {
        state: "frozen",
        ySplit: 1
      }
    ];

    ordersSheet.autoFilter = {
      from: "A1",
      to: "N1"
    };

    for (const column of ["H", "I", "J"]) {
      ordersSheet.getColumn(column).numFmt =
        'TZS #,##0';
    }

    const safeSellerName = String(seller.name || "seller")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "seller";

    const filename =
      `zenodic-${safeSellerName}-report-${period}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch (error) {
    console.error("Seller Excel report error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Imeshindikana kutengeneza Excel Report."
      });
    }

    res.end();
  }
});

/* ============================================================
   SELLER ANALYTICS — TOP PRODUCTS
   Uses order_items.product_name because this schema
   does not have a products table/product_id.
   ============================================================ */

router.get("/seller/:sellerId/analytics/top-products", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID."
      });
    }

    const seller = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = 'seller'
    `).get(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found."
      });
    }

    const requestedPeriod = String(
      req.query.period || "30d"
    ).toLowerCase();

    const periodConfig = {
      "7d": 6,
      "30d": 29,
      "90d": 89,
      "1y": 364,
      "all": null
    };

    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(
      String(req.query.from || "")
    );

    const validTo = /^\d{4}-\d{2}-\d{2}$/.test(
      String(req.query.to || "")
    );

    let dateCondition = "";
    let params = [sellerId];

    if (validFrom && validTo) {
      const from = String(req.query.from);
      const to = String(req.query.to);

      if (from > to) {
        return res.status(400).json({
          success: false,
          message: "From date haiwezi kuwa baada ya To date."
        });
      }

      dateCondition = `
        AND date(o.created_at) >= date(?)
        AND date(o.created_at) <= date(?)
      `;

      params = [sellerId, from, to];
    } else {
      const period = Object.prototype.hasOwnProperty.call(
        periodConfig,
        requestedPeriod
      )
        ? requestedPeriod
        : "30d";

      const daysBack = periodConfig[period];

      dateCondition =
        daysBack === null
          ? ""
          : `AND datetime(o.created_at) >= datetime('now', '-${daysBack} days')`;
    }

    const products = db.prepare(`
      SELECT
        oi.product_name,
        COALESCE(SUM(oi.quantity), 0) AS quantity,
        COALESCE(SUM(oi.total_price), 0) AS sales,
        COUNT(DISTINCT o.id) AS orders
      FROM orders o
      INNER JOIN order_items oi
        ON oi.order_id = o.id
      WHERE o.seller_id = ?
        ${dateCondition}
        AND COALESCE(o.status, '') != 'cancelled'
      GROUP BY oi.product_name
      ORDER BY sales DESC, quantity DESC, oi.product_name ASC
      LIMIT 5
    `).all(...params);

    return res.json({
      success: true,
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        role: seller.role
      },
      products: products.map(row => ({
        product_name: row.product_name,
        quantity: Number(row.quantity || 0),
        sales: Number(row.sales || 0),
        orders: Number(row.orders || 0)
      }))
    });

  } catch (error) {
    console.error("Seller top products error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata Top Products."
    });
  }
});

/* ============================================================
   SELLER ANALYTICS
   Business performance data for seller dashboard
   ============================================================ */
router.get("/seller/:sellerId/analytics", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID."
      });
    }

    const seller = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = 'seller'
    `).get(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found."
      });
    }

    /*
      Analytics filters:
      - period=7d
      - period=30d
      - period=90d
      - period=1y
      - period=all
      - from=YYYY-MM-DD&to=YYYY-MM-DD
    */

    const requestedPeriod = String(
      req.query.period || "30d"
    ).toLowerCase();

    const periodConfig = {
      "7d": 6,
      "30d": 29,
      "90d": 89,
      "1y": 364,
      "all": null
    };

    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(
      String(req.query.from || "")
    );

    const validTo = /^\d{4}-\d{2}-\d{2}$/.test(
      String(req.query.to || "")
    );

    let period = Object.prototype.hasOwnProperty.call(
      periodConfig,
      requestedPeriod
    )
      ? requestedPeriod
      : "30d";

    let dateCondition = "";
    let dateParams = [sellerId];

    /*
      Custom date range has priority when both dates exist.
    */
    if (validFrom && validTo) {
      const from = String(req.query.from);
      const to = String(req.query.to);

      if (from > to) {
        return res.status(400).json({
          success: false,
          message: "From date haiwezi kuwa baada ya To date."
        });
      }

      period = "custom";

      dateCondition = `
        AND date(created_at) >= date(?)
        AND date(created_at) <= date(?)
      `;

      dateParams = [sellerId, from, to];
    } else {
      const daysBack = periodConfig[period];

      dateCondition =
        daysBack === null
          ? ""
          : `AND datetime(created_at) >= datetime('now', '-${daysBack} days')`;
    }

    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total_orders,

        COALESCE(
          SUM(total_amount),
          0
        ) AS total_sales,

        COALESCE(
          SUM(
            CASE
              WHEN payment_status = 'paid'
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS paid_sales,

        COALESCE(
          SUM(
            CASE
              WHEN payment_status != 'paid'
                OR payment_status IS NULL
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS unpaid_sales,

        COALESCE(
          AVG(total_amount),
          0
        ) AS average_order_value

      FROM orders
      WHERE seller_id = ?
      ${dateCondition}
    `).get(...dateParams);

    const status = db.prepare(`
      SELECT
        status,
        COUNT(*) AS count,
        COALESCE(SUM(total_amount), 0) AS sales
      FROM orders
      WHERE seller_id = ?
      ${dateCondition}
      GROUP BY status
      ORDER BY count DESC
    `).all(...dateParams);

    const daily = db.prepare(`
      SELECT
        substr(created_at, 1, 10) AS date,
        COUNT(*) AS orders,
        COALESCE(SUM(total_amount), 0) AS sales,

        COALESCE(
          SUM(
            CASE
              WHEN payment_status = 'paid'
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS paid_sales

      FROM orders
      WHERE seller_id = ?
      ${dateCondition}

      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `).all(...dateParams);

    const monthly = db.prepare(`
      SELECT
        substr(created_at, 1, 7) AS month,
        COUNT(*) AS orders,
        COALESCE(SUM(total_amount), 0) AS sales,

        COALESCE(
          SUM(
            CASE
              WHEN payment_status = 'paid'
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS paid_sales

      FROM orders
      WHERE seller_id = ?
      ${dateCondition}

      GROUP BY substr(created_at, 1, 7)
      ORDER BY month ASC
    `).all(...dateParams);

    /*
      Inventory is NOT date-filtered.
      It represents the seller's current inventory health.
    */
    const inventory = db.prepare(`
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(quantity), 0) AS total_quantity,
        COALESCE(SUM(reserved_quantity), 0) AS reserved_quantity,

        COALESCE(
          SUM(
            CASE
              WHEN quantity <= 0 THEN 1
              WHEN quantity <= reorder_level THEN 1
              ELSE 0
            END
          ),
          0
        ) AS attention_products

      FROM inventory
      WHERE user_id = ?
    `).get(sellerId);

    return res.json({
      success: true,

      period,

      filters: {
        from: validFrom ? String(req.query.from) : null,
        to: validTo ? String(req.query.to) : null
      },

      seller,

      summary: {
        total_orders: Number(summary.total_orders || 0),
        total_sales: Number(summary.total_sales || 0),
        paid_sales: Number(summary.paid_sales || 0),
        unpaid_sales: Number(summary.unpaid_sales || 0),
        average_order_value: Number(
          summary.average_order_value || 0
        )
      },

      status: status.map(row => ({
        status: row.status,
        count: Number(row.count || 0),
        sales: Number(row.sales || 0)
      })),

      daily: daily.map(row => ({
        date: row.date,
        orders: Number(row.orders || 0),
        sales: Number(row.sales || 0),
        paid_sales: Number(row.paid_sales || 0)
      })),

      monthly: monthly.map(row => ({
        month: row.month,
        orders: Number(row.orders || 0),
        sales: Number(row.sales || 0),
        paid_sales: Number(row.paid_sales || 0)
      })),

      inventory: {
        total_products: Number(
          inventory.total_products || 0
        ),
        total_quantity: Number(
          inventory.total_quantity || 0
        ),
        reserved_quantity: Number(
          inventory.reserved_quantity || 0
        ),
        attention_products: Number(
          inventory.attention_products || 0
        )
      }
    });

  } catch (error) {
    console.error(
      "Seller analytics error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata seller analytics."
    });
  }
});

 
router.post("/", requireUser, (req, res) => {
  try {
    const { items, delivery_location, expected_delivery } = req.body;
    const buyerId = req.user.id;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart haina bidhaa."
      });
    }

    if (items.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Bidhaa nyingi sana kwenye order."
      });
    }

    const getProduct = db.prepare(`
      SELECT
        inventory.id,
        inventory.item_name AS product_name,
        inventory.item_type AS category,
        inventory.unit,
        inventory.price AS unit_price,
        'TZS' AS currency,
        inventory.user_id AS seller_id,
        inventory.quantity,
        inventory.reserved_quantity
      FROM inventory
      JOIN users
        ON users.id = inventory.user_id
      WHERE inventory.id = ?
        AND users.role IN ('seller', 'wholesale')
        AND users.verification_status = 'verified'
        AND users.account_status = 'active'
        AND inventory.approval_status = 'approved'
        AND inventory.price IS NOT NULL
        AND inventory.price > 0
        AND inventory.quantity > COALESCE(inventory.reserved_quantity, 0)
      LIMIT 1
    `);

    const validatedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const productId = Number(item?.product_id);
      const quantity = Number(item?.quantity);

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Product ID si sahihi."
        });
      }

      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
        return res.status(400).json({
          success: false,
          message: "Quantity si sahihi."
        });
      }

      const product = getProduct.get(productId);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Bidhaa yenye ID ${productId} haipatikani.`
        });
      }

      const lineTotal =
        Math.round(Number(product.unit_price) * quantity * 100) / 100;

      totalAmount =
        Math.round((totalAmount + lineTotal) * 100) / 100;

      if (!Number.isInteger(Number(product.seller_id)) || Number(product.seller_id) <= 0) {
        return res.status(400).json({
          success: false,
          message: `Bidhaa ${product.product_name} haina seller.`
        });
      }

      validatedItems.push({
        product,
        quantity,
        lineTotal
      });
    }

    const orderNumber =
      "ZND-" +
      Date.now() +
      "-" +
      Math.floor(Math.random() * 10000);

    const createOrder = db.prepare(`
      INSERT INTO orders (
        buyer_id,
        seller_id,
        rfq_id,
        order_number,
        status,
        payment_status,
        currency,
        total_amount,
        delivery_location,
        expected_delivery
      )
      VALUES (?, ?, NULL, ?, 'pending', 'unpaid', 'TZS', ?, ?, ?)
    `);

    const createItem = db.prepare(`
      INSERT INTO order_items (
        order_id,
        product_id,
        product_name,
        quantity,
        unit,
        unit_price,
        total_price
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN");

    let orderId;

    try {
      const sellerIds = [
        ...new Set(
          validatedItems.map(item => Number(item.product.seller_id))
        )
      ];

      if (sellerIds.length !== 1) {
        throw new Error("Direct market order inahitaji bidhaa za seller mmoja kwa sasa.");
      }

      const sellerId = sellerIds[0];

      const orderResult = createOrder.run(
        buyerId,
        sellerId,
        orderNumber,
        totalAmount,
        delivery_location || null,
        expected_delivery || null
      );

      orderId = Number(orderResult.lastInsertRowid);

      const reserveStock = db.prepare(`
        UPDATE inventory
        SET reserved_quantity =
          COALESCE(reserved_quantity, 0) + ?
        WHERE id = ?
          AND approval_status = 'approved'
          AND quantity - COALESCE(reserved_quantity, 0) >= ?
      `);

      for (const item of validatedItems) {
        const reserved = reserveStock.run(
          item.quantity,
          item.product.id,
          item.quantity
        );

        if (reserved.changes !== 1) {
          throw new Error(
            `Stock haitoshi kwa bidhaa: ${item.product.product_name}`
          );
        }

        createItem.run(
          orderId,
          item.product.id,
          item.product.product_name,
          item.quantity,
          item.product.unit,
          item.product.unit_price,
          item.lineTotal
        );
      }

      db.exec("COMMIT");
    
    
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
        "New order created",
        `Order ${orderNumber} imeundwa na buyer. Total: TZS ${Number(totalAmount).toLocaleString()}.`,
        "important",
        "order",
        orderId
      );
    } catch (notificationError) {
      console.error(
        "Admin order notification error:",
        notificationError?.message || notificationError
      );
    }
} catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch (_) {}

      throw error;
    }

    const order = db.prepare(`
      SELECT
        id,
        buyer_id,
        order_number,
        status,
        payment_status,
        currency,
        total_amount,
        delivery_location,
        expected_delivery,
        created_at
      FROM orders
      WHERE id = ?
        AND buyer_id = ?
      LIMIT 1
    `).get(orderId, buyerId);

    return res.status(201).json({
      success: true,
      message: "Order imeundwa.",
      order
    });
  } catch (error) {
    console.error("Direct market order creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuunda order."
    });
  }
});

 
// Buyer cancellation: only pending + unpaid orders can be cancelled.
router.post("/:id/cancel", requireUser, (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const buyerId = Number(req.user?.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Order ID si sahihi."
      });
    }

    if (!Number.isInteger(buyerId) || buyerId <= 0) {
      return res.status(401).json({
        success: false,
        message: "User session si sahihi."
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

    if (Number(order.buyer_id) !== buyerId) {
      return res.status(403).json({
        success: false,
        message: "Huna ruhusa ya ku-cancel order hii."
      });
    }

    if (order.status !== "pending" || order.payment_status !== "unpaid") {
      return res.status(409).json({
        success: false,
        message: "Order hii haiwezi ku-cancel. Cancellation inaruhusiwa kwa order ya pending na unpaid tu."
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

    const missingProductId = items.find(
      item => !Number.isInteger(Number(item.product_id)) || Number(item.product_id) <= 0
    );

    if (missingProductId) {
      return res.status(409).json({
        success: false,
        message: "Order hii ni ya zamani na haina product_id salama ya kurejeshea stock. Tafadhali tumia admin handling."
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
        const quantity = Number(item.quantity);
        const productId = Number(item.product_id);

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("INVALID_ORDER_QUANTITY");
        }

        const released = releaseStock.run(
          quantity,
          productId,
          quantity
        );

        if (released.changes !== 1) {
          throw new Error(`STOCK_RELEASE_FAILED:${productId}`);
        }
      }

      db.prepare(`
        UPDATE orders
        SET status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND buyer_id = ?
          AND status = 'pending'
          AND payment_status = 'unpaid'
      `).run(orderId, buyerId);

      db.exec("COMMIT");
    } catch (transactionError) {
      try {
        db.exec("ROLLBACK");
      } catch (_) {}

      if (transactionError?.message === "ORDER_STATE_CHANGED") {
        return res.status(409).json({
          success: false,
          message: "Order hii tayari imebadilishwa na haiwezi ku-cancel."
        });
      }

      if (transactionError?.message === "INVALID_ORDER_QUANTITY") {
        return res.status(409).json({
          success: false,
          message: "Order ina quantity isiyo sahihi."
        });
      }

      if (transactionError?.message?.startsWith("STOCK_RELEASE_FAILED:")) {
        return res.status(409).json({
          success: false,
          message: "Reserved stock haikuweza kurejeshwa salama, hivyo order haijacancel."
        });
      }

      throw transactionError;
    }

    try {
      if (order.seller_id) {
        createNotification({
          userId: order.seller_id,
          type: "order_cancelled",
          title: "Order cancelled",
          message: `Buyer amecancel order ${order.order_number}.`,
          orderId
        });
      }

      createNotification({
        userId: buyerId,
        type: "order_cancelled",
        title: "Order cancelled",
        message: `Order ${order.order_number} imecancelwa.`,
        orderId
      });
    } catch (notificationError) {
      console.error(
        "Buyer order cancellation notification error:",
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
        "Order cancelled",
        `Order ${order.order_number} imecancelwa na buyer.`,
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
    console.error("Buyer order cancellation error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana ku-cancel order."
    });
  }
});

module.exports = router;
