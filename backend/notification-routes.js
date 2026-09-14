const express = require("express");
const router = express.Router();
const db = require("./database");
const { requireUser } = require("./user-auth");

/*
  GET /api/notifications/:userId
  Returns latest notifications for a user.
*/
router.get("/:userId", requireUser, (req, res) => {
  try {
    const userId = Number(req.user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const notifications = db.prepare(`
      SELECT
        id,
        user_id,
        type,
        title,
        message,
        order_id,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 100
    `).all(userId);

    const unread = db.prepare(`
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = ?
        AND is_read = 0
    `).get(userId);

    return res.json({
      success: true,
      unread: Number(unread?.count || 0),
      notifications
    });
  } catch (error) {
    console.error("Notifications GET error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kupata notifications."
    });
  }
});


/*
  PATCH /api/notifications/:id/read
*/
router.patch("/:id/read", requireUser, (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.user.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Notification ID si sahihi."
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    const result = db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ?
        AND user_id = ?
    `).run(id, userId);

    return res.json({
      success: true,
      updated: Number(result?.changes || 0)
    });
  } catch (error) {
    console.error("Notification read error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kusoma notification."
    });
  }
});


/*
  PATCH /api/notifications/read-all
*/
router.patch("/read-all", requireUser, (req, res) => {
  try {
    const userId = Number(req.body?.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    const result = db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ?
        AND is_read = 0
    `).run(userId);

    return res.json({
      success: true,
      updated: Number(result?.changes || 0)
    });
  } catch (error) {
    console.error("Notification read-all error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kusoma notifications zote."
    });
  }
});


/*
  DELETE /api/notifications/:id
*/
router.delete("/:id", requireUser, (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.body?.user_id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Notification ID si sahihi."
      });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "user_id inahitajika."
      });
    }

    db.prepare(`
      DELETE FROM notifications
      WHERE id = ?
        AND user_id = ?
    `).run(id, userId);

    return res.json({
      success: true
    });
  } catch (error) {
    console.error("Notification delete error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kufuta notification."
    });
  }
});


module.exports = router;
