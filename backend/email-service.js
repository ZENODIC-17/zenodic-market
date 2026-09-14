const axios = require("axios");

const enabled =
  String(process.env.EMAIL_NOTIFICATIONS_ENABLED || "").toLowerCase() === "true";

const apiKey = String(process.env.BREVO_API_KEY || "").trim();
const from = String(process.env.EMAIL_FROM || "").trim();
const fromName = String(process.env.EMAIL_FROM_NAME || "ZENODIC").trim();

async function sendNotificationEmail({
  to,
  subject,
  title,
  message,
}) {
  if (!enabled) {
    return {
      success: false,
      skipped: true,
      reason: "EMAIL_NOTIFICATIONS_ENABLED is not true",
    };
  }

  if (!apiKey) {
    throw new Error("BREVO_API_KEY haijawekwa.");
  }

  if (!from) {
    throw new Error("EMAIL_FROM haijawekwa.");
  }

  if (!to) {
    throw new Error("Recipient email haipo.");
  }

  const cleanTo = String(to).trim();

  const result = await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        name: fromName,
        email: from,
      },
      to: [
        {
          email: cleanTo,
        },
      ],
      subject: subject || title || "ZENODIC Notification",
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
          <h2 style="margin-bottom:8px">
            ${escapeHtml(title || "ZENODIC Notification")}
          </h2>

          <p style="font-size:15px;line-height:1.6;color:#475569">
            ${escapeHtml(message || "")}
          </p>

          <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">

          <p style="font-size:12px;color:#94a3b8">
            This is an automated notification from ZENODIC.
          </p>
        </div>
      `,
    },
    {
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      timeout: 15000,
    }
  );

  return {
    success: true,
    id: result?.data?.messageId || null,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  sendNotificationEmail,
};
