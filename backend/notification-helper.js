const db = require("./database");
const { sendNotificationEmail } = require("./email-service");

function createNotification({
  userId,
  type = "system",
  title,
  message,
  orderId = null
}) {
  try {
    if (!userId || !title || !message) return;

    db.prepare(`
      INSERT INTO notifications
        (user_id, type, title, message, order_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      Number(userId),
      String(type),
      String(title),
      String(message),
      orderId ? Number(orderId) : null
    );

    try {
      const recipient = db.prepare(`
        SELECT email
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(Number(userId));

      if (recipient?.email) {
        Promise.resolve(
          sendNotificationEmail({
            to: recipient.email,
            subject: title,
            title,
            message
          })
        ).then((result) => {
          if (result?.success) {
            console.log(
              `📧 Notification email sent to ${recipient.email}`
            );
          } else if (result?.skipped) {
            console.log(
              `ℹ️ Notification email skipped: ${result.reason}`
            );
          }
        }).catch((error) => {
          console.error(
            "❌ Notification email failed:",
            error.response?.data || error.message
          );
        });
      }
    } catch (emailLookupError) {
      console.error(
        "Notification email lookup error:",
        emailLookupError
      );
    }
  } catch (error) {
    console.error("Create notification error:", error);
  }
}

module.exports = {
  createNotification
};
