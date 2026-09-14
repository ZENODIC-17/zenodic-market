const express = require("express");
const db = require("./database");
const { createNotification } = require("./notification-helper");
const { requireUser } = require("./user-auth");

const router = express.Router();

/* CREATE RFQ */
router.post("/", requireUser, (req, res) => {
  try {
    const {
      title,
      description,
      quantity,
      unit,
      target_price,
      currency = "TZS",
      delivery_location,
      required_date
    } = req.body;

    const userId = Number(req.user.id);

    if (!Number.isInteger(userId) || userId <= 0 || !title || !quantity || !unit) {
      return res.status(400).json({
        success: false,
        message: "Taarifa za RFQ si sahihi."
      });
    }

    const user = db.prepare(
      "SELECT id, role FROM users WHERE id = ?"
    ).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User hakupatikana."
      });
    }

    const result = db.prepare(`
      INSERT INTO rfqs (
        userId,
        title,
        description,
        quantity,
        unit,
        target_price,
        currency,
        delivery_location,
        required_date,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `).run(
      user_id,
      title,
      description || null,
      quantity,
      unit,
      target_price ?? null,
      currency,
      delivery_location || null,
      required_date || null
    );

    const rfq = db.prepare(
      "SELECT * FROM rfqs WHERE id = ?"
    ).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: "RFQ imeundwa vizuri.",
      rfq
    });

  } catch (error) {
    console.error("Create RFQ error:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana kuunda RFQ."
    });
  }
});


/* LIST USER RFQs */
router.get("/", requireUser, (req, res) => {
  try {
    const userId = Number(req.user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    const rfqs = db.prepare(`
      SELECT *
      FROM rfqs
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(userId);

    res.json({
      success: true,
      rfqs
    });

  } catch (error) {
    console.error("List RFQs error:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana kupata RFQs."
    });
  }
});


/* GET ONE RFQ */
router.get("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    const rfq = db.prepare(`
      SELECT *
      FROM rfqs
      WHERE id = ?
    `).get(id);

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ haijapatikana."
      });
    }

    res.json({
      success: true,
      rfq
    });

  } catch (error) {
    console.error("Get RFQ error:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana kupata RFQ."
    });
  }
});


/* UPDATE RFQ STATUS */
router.patch("/:id/status", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "open",
      "closed",
      "cancelled",
      "awarded"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status ya RFQ si halali."
      });
    }

    const result = db.prepare(`
      UPDATE rfqs
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);

    if (!result.changes) {
      return res.status(404).json({
        success: false,
        message: "RFQ haijapatikana."
      });
    }

    res.json({
      success: true,
      message: "RFQ status imebadilishwa."
    });

  } catch (error) {
    console.error("Update RFQ status error:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana kubadilisha RFQ."
    });
  }
});



/* =========================================================
   QUOTATION API
   ========================================================= */

/*
 * GET /api/rfqs/:id/quotations
 *
 * Buyer anaweza kuona quotations zote za RFQ yake.
 * Kwa sasa endpoint inahitaji user_id kama query parameter.
 */
router.get("/:id/quotations", (req, res) => {
  try {
    const rfqId = Number(req.params.id);
    const userId = Number(req.query.user_id);

    if (!Number.isInteger(rfqId) || rfqId <= 0) {
      return res.status(400).json({
        success: false,
        message: "RFQ ID si sahihi."
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    const rfq = db.prepare(`
      SELECT id, user_id, title, quantity, unit, status
      FROM rfqs
      WHERE id = ?
    `).get(rfqId);

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ haijapatikana."
      });
    }

    if (rfq.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Huna ruhusa kuona quotations za RFQ hii."
      });
    }

    const quotations = db.prepare(`
      SELECT
        q.id,
        q.rfq_id,
        q.supplier_id,
        u.name AS supplier_name,
        u.email AS supplier_email,
        q.unit_price,
        q.quantity,
        q.currency,
        q.delivery_days,
        q.notes,
        q.status,
        q.created_at,
        q.updated_at
      FROM rfq_quotations q
      LEFT JOIN users u ON u.id = q.supplier_id
      WHERE q.rfq_id = ?
      ORDER BY q.created_at DESC
    `).all(rfqId);

    return res.json({
      success: true,
      rfq,
      quotations
    });
  } catch (error) {
    console.error("Get quotations error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata quotations."
    });
  }
});


/*
 * POST /api/rfqs/:id/quotations
 *
 * Supplier anatuma quotation kwa RFQ.
 *
 * Body:
 * {
 *   supplier_id,
 *   unit_price,
 *   quantity,
 *   currency,
 *   delivery_days,
 *   notes
 * }
 */
router.post("/:id/quotations", (req, res) => {
  try {
    const rfqId = Number(req.params.id);
    const supplierId = Number(req.body.supplier_id);

    const unitPrice = Number(req.body.unit_price);
    const quantity = Number(req.body.quantity);
    const deliveryDays =
      req.body.delivery_days === undefined ||
      req.body.delivery_days === null ||
      req.body.delivery_days === ""
        ? null
        : Number(req.body.delivery_days);

    const currency =
      String(req.body.currency || "TZS").trim().toUpperCase();

    const notes =
      req.body.notes === undefined || req.body.notes === null
        ? null
        : String(req.body.notes).trim();

    if (!Number.isInteger(rfqId) || rfqId <= 0) {
      return res.status(400).json({
        success: false,
        message: "RFQ ID si sahihi."
      });
    }

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      return res.status(400).json({
        success: false,
        message: "supplier_id si sahihi."
      });
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Unit price lazima iwe zaidi ya sifuri."
      });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity lazima iwe zaidi ya sifuri."
      });
    }

    if (
      deliveryDays !== null &&
      (!Number.isInteger(deliveryDays) || deliveryDays < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Delivery days si sahihi."
      });
    }

    const supplier = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ?
    `).get(supplierId);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier hajapatikana."
      });
    }

    if (!["seller", "wholesale"].includes(supplier.role)) {
      return res.status(403).json({
        success: false,
        message: "Account hii haiwezi kutuma quotation."
      });
    }

    const rfq = db.prepare(`
      SELECT id, user_id, title, quantity, unit, status
      FROM rfqs
      WHERE id = ?
    `).get(rfqId);

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ haijapatikana."
      });
    }

    if (rfq.status !== "open") {
      return res.status(409).json({
        success: false,
        message: "RFQ hii haipokei quotations kwa sasa."
      });
    }

    if (rfq.user_id === supplierId) {
      return res.status(403).json({
        success: false,
        message: "Huwezi kutuma quotation kwenye RFQ yako mwenyewe."
      });
    }

    const existing = db.prepare(`
      SELECT id
      FROM rfq_quotations
      WHERE rfq_id = ? AND supplier_id = ? AND status = 'pending'
      LIMIT 1
    `).get(rfqId, supplierId);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Supplier huyu tayari ana quotation pending kwenye RFQ hii."
      });
    }

    const result = db.prepare(`
      INSERT INTO rfq_quotations (
        rfq_id,
        supplier_id,
        unit_price,
        quantity,
        currency,
        delivery_days,
        notes,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      rfqId,
      supplierId,
      unitPrice,
      quantity,
      currency,
      deliveryDays,
      notes
    );

    const quotation = db.prepare(`
      SELECT
        q.id,
        q.rfq_id,
        q.supplier_id,
        u.name AS supplier_name,
        u.email AS supplier_email,
        q.unit_price,
        q.quantity,
        q.currency,
        q.delivery_days,
        q.notes,
        q.status,
        q.created_at,
        q.updated_at
      FROM rfq_quotations q
      LEFT JOIN users u ON u.id = q.supplier_id
      WHERE q.id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: "Quotation imetumwa vizuri.",
      quotation
    });
  } catch (error) {
    console.error("Create quotation error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kutuma quotation."
    });
  }
});


/*
 * PATCH /api/quotations/:id
 *
 * Buyer wa RFQ ndiye anayeruhusiwa ku-accept/reject.
 *
 * Body:
 * {
 *   user_id,
 *   status: "accepted" | "rejected"
 * }
 */
router.patch("/quotations/:id", (req, res) => {
  try {
    const quotationId = Number(req.params.id);
    const userId = Number(req.body.user_id);
    const status = String(req.body.status || "").trim().toLowerCase();

    if (!Number.isInteger(quotationId) || quotationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quotation ID si sahihi."
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status lazima iwe accepted au rejected."
      });
    }

    const quotation = db.prepare(`
      SELECT
        q.id,
        q.rfq_id,
        q.supplier_id,
        q.status,
        r.user_id AS buyer_id,
        r.status AS rfq_status
      FROM rfq_quotations q
      JOIN rfqs r ON r.id = q.rfq_id
      WHERE q.id = ?
    `).get(quotationId);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation haijapatikana."
      });
    }

    if (quotation.buyer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Huna ruhusa kubadilisha quotation hii."
      });
    }

    if (quotation.rfq_status !== "open") {
      return res.status(409).json({
        success: false,
        message: "RFQ hii haiko open."
      });
    }

    if (quotation.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Quotation hii tayari imeshughulikiwa."
      });
    }

    db.prepare(`
      UPDATE rfq_quotations
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, quotationId);

    /*
     * Ikiwa buyer amekubali quotation,
     * quotations nyingine za RFQ hiyo zinakuwa rejected
     * na RFQ inakuwa awarded.
     */
    if (status === "accepted") {
      db.prepare(`
        UPDATE rfq_quotations
        SET status = 'rejected',
            updated_at = CURRENT_TIMESTAMP
        WHERE rfq_id = ?
          AND id <> ?
          AND status = 'pending'
      `).run(quotation.rfq_id, quotationId);

      db.prepare(`
        UPDATE rfqs
        SET status = 'awarded',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(quotation.rfq_id);
    }

    const updated = db.prepare(`
      SELECT
        q.id,
        q.rfq_id,
        q.supplier_id,
        q.unit_price,
        q.quantity,
        q.currency,
        q.delivery_days,
        q.notes,
        q.status,
        q.created_at,
        q.updated_at
      FROM rfq_quotations q
      WHERE q.id = ?
    `).get(quotationId);

    return res.json({
      success: true,
      message:
        status === "accepted"
          ? "Quotation imekubaliwa."
          : "Quotation imekataliwa.",
      quotation: updated
    });
  } catch (error) {
    console.error("Update quotation error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kusasisha quotation."
    });
  }
});

/*
 * POST /api/rfqs/quotations/:id/order
 *
 * Buyer anabadilisha quotation iliyokubaliwa kuwa order.
 * Body:
 * {
 *   user_id,
 *   delivery_location
 * }
 */
router.post("/quotations/:id/order", (req, res) => {
  try {
    const quotationId = Number(req.params.id);
    const userId = Number(req.body.user_id);
    const deliveryLocation =
      req.body.delivery_location === undefined ||
      req.body.delivery_location === null ||
      req.body.delivery_location === ""
        ? null
        : String(req.body.delivery_location).trim();

    if (!Number.isInteger(quotationId) || quotationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quotation ID si sahihi."
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    const quotation = db.prepare(`
      SELECT
        q.id,
        q.rfq_id,
        q.supplier_id,
        q.unit_price,
        q.quantity,
        q.currency,
        q.delivery_days,
        q.status,
        r.user_id AS buyer_id,
        r.title,
        r.unit,
        r.delivery_location AS rfq_delivery_location
      FROM rfq_quotations q
      JOIN rfqs r ON r.id = q.rfq_id
      WHERE q.id = ?
    `).get(quotationId);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation haijapatikana."
      });
    }

    if (quotation.buyer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Huna ruhusa kuunda order kutoka quotation hii."
      });
    }

    if (quotation.status !== "accepted") {
      return res.status(409).json({
        success: false,
        message: "Order inaweza kuundwa tu kutoka quotation iliyokubaliwa."
      });
    }

    const existingOrder = db.prepare(`
      SELECT id, order_number, status
      FROM orders
      WHERE rfq_id = ?
      LIMIT 1
    `).get(quotation.rfq_id);

    if (existingOrder) {
      return res.status(409).json({
        success: false,
        message: "Order tayari ipo kwa RFQ hii.",
        order: existingOrder
      });
    }

    const totalAmount =
      Number(quotation.unit_price) * Number(quotation.quantity);

    const orderNumber =
      "ZND-" +
      new Date().toISOString().replace(/\D/g, "").slice(0, 14) +
      "-" +
      quotation.rfq_id;

    const location =
      deliveryLocation || quotation.rfq_delivery_location || null;

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
      VALUES (?, ?, ?, ?, 'pending', 'unpaid', ?, ?, ?, ?)
    `);

    const createItem = db.prepare(`
      INSERT INTO order_items (
        order_id,
        product_name,
        quantity,
        unit,
        unit_price,
        total_price
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const orderResult = createOrder.run(
      quotation.buyer_id,
      quotation.supplier_id,
      quotation.rfq_id,
      orderNumber,
      quotation.currency,
      totalAmount,
      location,
      quotation.delivery_days === null
        ? null
        : String(quotation.delivery_days) + " days"
    );

    createItem.run(
      orderResult.lastInsertRowid,
      quotation.title,
      quotation.quantity,
      quotation.unit,
      quotation.unit_price,
      totalAmount
    );

    const order = db.prepare(`
      SELECT *
      FROM orders
      WHERE id = ?
    `).get(orderResult.lastInsertRowid);

    const items = db.prepare(`
      SELECT *
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `).all(order.id);

    /* Notify seller about the new order */
    if (order.seller_id) {
      createNotification({
        userId: order.seller_id,
        type: "new_order",
        title: "New order received",
        message: `You have received a new order #${order.id}.`,
        orderId: order.id
      });
    }

    return res.status(201).json({
      success: true,
      message: "Order imeundwa kutoka quotation iliyokubaliwa.",
      order,
      items
    });

  } catch (error) {
    console.error("Create order from quotation error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kuunda order kutoka quotation."
    });
  }
});

module.exports = router;
