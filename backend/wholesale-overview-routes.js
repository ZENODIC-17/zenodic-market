const express = require("express");
const db = require("./database");
const { requireUser } = require("./user-auth");

const router = express.Router();

router.get("/", requireUser, (req, res) => {
  try {
    const userId = Number(req.user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "User ID si sahihi."
      });
    }

    const activeOrders = db.prepare(`
      SELECT COUNT(*) AS count
      FROM orders
      WHERE buyer_id = ?
        AND status NOT IN ('delivered', 'cancelled')
    `).get(userId).count;

    const openRfqs = db.prepare(`
      SELECT COUNT(*) AS count
      FROM rfqs
      WHERE user_id = ?
        AND status = 'open'
    `).get(userId).count;

    const productionInProgress = db.prepare(`
      SELECT COUNT(*) AS count
      FROM production_orders
      WHERE user_id = ?
        AND status IN ('planned', 'in_progress')
    `).get(userId).count;

    const stockAlerts = db.prepare(`
      SELECT COUNT(*) AS count
      FROM inventory
      WHERE user_id = ?
        AND quantity <= reorder_level
    `).get(userId).count;

    res.json({
      success: true,
      data: {
        active_orders: Number(activeOrders || 0),
        open_rfqs: Number(openRfqs || 0),
        production_in_progress: Number(productionInProgress || 0),
        stock_alerts: Number(stockAlerts || 0)
      }
    });
  } catch (error) {
    console.error("Wholesale overview error:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana kupakia Wholesale Overview."
    });
  }
});

module.exports = router;
