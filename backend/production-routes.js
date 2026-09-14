const express = require("express");
const router = express.Router();
const db = require("./database");
const { requireUser } = require("./user-auth");

router.get("/", requireUser, (req, res) => {
  try {
    const userId = Number(req.user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    const productionOrders = db.prepare(`
      SELECT
        production_orders.*,
        orders.order_number
      FROM production_orders
      LEFT JOIN orders
        ON orders.id = production_orders.order_id
      WHERE production_orders.user_id = ?
      ORDER BY production_orders.id DESC
    `).all(userId);

    res.json({
      success: true,
      productionOrders
    });
  } catch (error) {
    console.error("PRODUCTION LIST ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana kupata production orders."
    });
  }
});


router.post("/", requireUser, (req, res) => {
  try {
    const userId = Number(req.user.id);

    const {
      product_name,
      planned_quantity,
      unit = "pcs",
      order_id = null,
      start_date = null,
      expected_completion = null
    } = req.body;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    if (!product_name || typeof product_name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Product name inahitajika."
      });
    }

    const plannedQuantity = Number(planned_quantity);

    if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Planned quantity si sahihi."
      });
    }

    let orderId = null;

    if (order_id !== null && order_id !== "") {
      orderId = Number(order_id);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Order ID si sahihi."
        });
      }

      const order = db.prepare(`
        SELECT id
        FROM orders
        WHERE id = ?
          AND buyer_id = ?
      `).get(orderId, userId);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order haipatikani kwenye account yako."
        });
      }
    }

    const productionNumber =
      "PRD-" +
      Date.now() +
      "-" +
      Math.floor(Math.random() * 10000);

    const result = db.prepare(`
      INSERT INTO production_orders (
        user_id,
        order_id,
        production_number,
        product_name,
        planned_quantity,
        produced_quantity,
        unit,
        status,
        start_date,
        expected_completion
      )
      VALUES (?, ?, ?, ?, ?, 0, ?, 'planned', ?, ?)
    `).run(
      userId,
      orderId,
      productionNumber,
      product_name.trim(),
      plannedQuantity,
      String(unit || "pcs").trim(),
      start_date || null,
      expected_completion || null
    );

    const productionOrder = db.prepare(`
      SELECT *
      FROM production_orders
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: "Production order imeundwa.",
      productionOrder
    });
  } catch (error) {
    console.error("PRODUCTION CREATE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana kuunda production order."
    });
  }
});


router.patch("/:id/progress", requireUser, (req, res) => {
  try {
    const userId = Number(req.user.id);
    const productionId = Number(req.params.id);
    const producedQuantity = Number(req.body.produced_quantity);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    if (!Number.isInteger(productionId) || productionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Production ID si sahihi."
      });
    }

    if (!Number.isFinite(producedQuantity) || producedQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Produced quantity si sahihi."
      });
    }

    const production = db.prepare(`
      SELECT *
      FROM production_orders
      WHERE id = ?
        AND user_id = ?
    `).get(productionId, userId);

    if (!production) {
      return res.status(404).json({
        success: false,
        message: "Production order haipatikani."
      });
    }

    if (producedQuantity > Number(production.planned_quantity)) {
      return res.status(400).json({
        success: false,
        message: "Produced quantity haiwezi kuzidi planned quantity."
      });
    }

    const status =
      producedQuantity >= Number(production.planned_quantity)
        ? "completed"
        : producedQuantity > 0
          ? "in_progress"
          : "planned";

    db.prepare(`
      UPDATE production_orders
      SET
        produced_quantity = ?,
        status = ?,
        actual_completion = CASE
          WHEN ? = 'completed' THEN CURRENT_TIMESTAMP
          ELSE actual_completion
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
    `).run(
      producedQuantity,
      status,
      status,
      productionId,
      userId
    );

    const updatedProduction = db.prepare(`
      SELECT *
      FROM production_orders
      WHERE id = ?
        AND user_id = ?
    `).get(productionId, userId);

    res.json({
      success: true,
      message: "Production progress imeupdated.",
      productionOrder: updatedProduction
    });
  } catch (error) {
    console.error("PRODUCTION PROGRESS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana ku-update production progress."
    });
  }
});


router.patch("/:id/status", requireUser, (req, res) => {
  try {
    const userId = Number(req.user.id);
    const productionId = Number(req.params.id);
    const status = String(req.body.status || "").trim().toLowerCase();

    const allowedStatuses = [
      "planned",
      "in_progress",
      "completed",
      "cancelled"
    ];

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    if (!Number.isInteger(productionId) || productionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Production ID si sahihi."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Production status si sahihi."
      });
    }

    const production = db.prepare(`
      SELECT id
      FROM production_orders
      WHERE id = ?
        AND user_id = ?
    `).get(productionId, userId);

    if (!production) {
      return res.status(404).json({
        success: false,
        message: "Production order haipatikani."
      });
    }

    db.prepare(`
      UPDATE production_orders
      SET
        status = ?,
        actual_completion = CASE
          WHEN ? = 'completed' THEN CURRENT_TIMESTAMP
          WHEN ? != 'completed' THEN NULL
          ELSE actual_completion
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
    `).run(
      status,
      status,
      status,
      productionId,
      userId
    );

    const updatedProduction = db.prepare(`
      SELECT *
      FROM production_orders
      WHERE id = ?
        AND user_id = ?
    `).get(productionId, userId);

    res.json({
      success: true,
      message: "Production status imeupdated.",
      productionOrder: updatedProduction
    });
  } catch (error) {
    console.error("PRODUCTION STATUS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana ku-update production status."
    });
  }
});

module.exports = router;
