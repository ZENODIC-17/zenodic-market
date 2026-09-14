const express = require("express");
const axios = require("axios");
const db = require("./database");

const router = express.Router();
const { requireUser } = require("./user-auth");

async function getClickPesaToken() {
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

  return response.data?.token || response.data?.accessToken;
}

function getAuthHeader(token) {
  return token.startsWith("Bearer ")
    ? token
    : `Bearer ${token}`;
}

/*
 * POST /api/payments/preview
 *
 * Validates the buyer phone number, amount and available
 * ClickPesa payment channels before sending USSD-PUSH.
 */
router.post("/preview", requireUser, async (req, res) => {
  try {
    const { order_id, phone_number } = req.body;
    const buyer_id = req.user.id;

    if (!order_id || !phone_number) {
      return res.status(400).json({
        error: "order_id and phone_number are required"
      });
    }

    const order = db.prepare(`
      SELECT
        id,
        buyer_id,
        seller_id,
        order_number,
        payment_status,
        currency,
        total_amount
      FROM orders
      WHERE id = ?
    `).get(order_id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    if (Number(order.buyer_id) !== Number(req.user.id)) {
      return res.status(403).json({
        error: "You are not allowed to pay for this order"
      });
    }

    if (!order.seller_id) {
      return res.status(400).json({
        error: "Order has no seller"
      });
    }

    if (order.payment_status === "paid") {
      return res.status(409).json({
        error: "Order is already paid"
      });
    }

    const amount = Number(order.total_amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: "Invalid order amount"
      });
    }

    const currency = String(order.currency || "TZS").toUpperCase();

    if (currency !== "TZS") {
      return res.status(400).json({
        error: "USSD-PUSH currently supports TZS only"
      });
    }

    const phoneNumber = String(phone_number)
      .replace(/\s+/g, "")
      .replace(/^\+/, "");

    if (!/^255\d{9}$/.test(phoneNumber)) {
      return res.status(400).json({
        error: "Phone number must use Tanzania format, e.g. 255712345678"
      });
    }

    const paymentReference = `ZP${order.id}${Date.now().toString().slice(-10)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    const token = await getClickPesaToken();

    if (!token) {
      return res.status(502).json({
        error: "ClickPesa authentication failed"
      });
    }

    const response = await axios.post(
      `${process.env.CLICKPESA_API_URL}/third-parties/payments/preview-ussd-push-request`,
      {
        amount: amount.toFixed(2),
        currency: "TZS",
        orderReference: paymentReference,
        phoneNumber,
        fetchSenderDetails: false
      },
      {
        headers: {
          Authorization: getAuthHeader(token),
          "Content-Type": "application/json"
        }
      }
    );

    return res.json({
      success: true,
      payment: {
        payment_reference: paymentReference,
        order_id: order.id,
        amount,
        currency: "TZS",
        phone_number: phoneNumber
      },
      clickpesa: response.data
    });
  } catch (error) {
    console.error(
      "ClickPesa preview error:",
      error.response?.data || error.message
    );

    return res.status(error.response ? 502 : 500).json({
      error: "Unable to preview ClickPesa payment",
      details:
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data ||
        null
    });
  }
});


/*
 * POST /api/payments/ussd-push
 *
 * Initiates the actual USSD-PUSH after preview validation.
 */
router.post("/ussd-push", requireUser, async (req, res) => {
  try {
    const {
      order_id,
      phone_number,
      payment_reference
    } = req.body;

    const buyer_id = req.user.id;

    if (!order_id || !phone_number) {
      return res.status(400).json({
        error: "order_id and phone_number are required"
      });
    }

    const order = db.prepare(`
      SELECT
        id,
        buyer_id,
        seller_id,
        order_number,
        payment_status,
        currency,
        total_amount
      FROM orders
      WHERE id = ?
    `).get(order_id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    if (Number(order.buyer_id) !== Number(req.user.id)) {
      return res.status(403).json({
        error: "You are not allowed to pay for this order"
      });
    }

    if (!order.seller_id) {
      return res.status(400).json({
        error: "Order has no seller"
      });
    }

    if (order.payment_status === "paid") {
      return res.status(409).json({
        error: "Order is already paid"
      });
    }

    const amount = Number(order.total_amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: "Invalid order amount"
      });
    }

    const currency = String(order.currency || "TZS").toUpperCase();

    if (currency !== "TZS") {
      return res.status(400).json({
        error: "USSD-PUSH currently supports TZS only"
      });
    }

    const phoneNumber = String(phone_number)
      .replace(/\s+/g, "")
      .replace(/^\+/, "");

    if (!/^255\d{9}$/.test(phoneNumber)) {
      return res.status(400).json({
        error: "Phone number must use Tanzania format, e.g. 255712345678"
      });
    }

    const paymentReference =
      payment_reference ||
      `ZNDPAY${order.id}${Date.now()}${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

    const token = await getClickPesaToken();

    if (!token) {
      return res.status(502).json({
        error: "ClickPesa authentication failed"
      });
    }

    const response = await axios.post(
      `${process.env.CLICKPESA_API_URL}/third-parties/payments/initiate-ussd-push-request`,
      {
        amount: amount.toFixed(2),
        currency: "TZS",
        orderReference: paymentReference,
        phoneNumber
      },
      {
        headers: {
          Authorization: getAuthHeader(token),
          "Content-Type": "application/json"
        }
      }
    );

    const result = response.data || {};

    const providerStatus = String(result.status || "PROCESSING").toUpperCase();

    const localStatus =
      providerStatus === "FAILED"
        ? "failed"
        : "pending";

    const existingPayment = db.prepare(`
      SELECT id
      FROM payments
      WHERE payment_reference = ?
      LIMIT 1
    `).get(paymentReference);

    if (existingPayment) {
      db.prepare(`
        UPDATE payments
        SET
          provider_reference = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        result.id || null,
        localStatus,
        existingPayment.id
      );
    } else {
      db.prepare(`
        INSERT INTO payments (
          order_id,
          buyer_id,
          seller_id,
          payment_reference,
          payment_method,
          currency,
          amount,
          status,
          provider_reference
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id,
        order.buyer_id,
        order.seller_id,
        paymentReference,
        "clickpesa_ussd_push",
        "TZS",
        amount,
        localStatus,
        result.id || null
      );
    }

    return res.json({
      success: true,
      payment: {
        payment_reference: paymentReference,
        order_id: order.id,
        amount,
        currency: "TZS",
        status: String(result.status || "PROCESSING").toUpperCase(),
        provider_reference: result.id || null,
        channel: result.channel || null
      },
      clickpesa: result
    });
  } catch (error) {
    console.error(
      "ClickPesa USSD-PUSH error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      error: "Unable to initiate ClickPesa USSD-PUSH",
      details:
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data ||
        null
    });
  }
});


/*
 * GET /api/payments/status/:payment_reference
 *
 * Queries ClickPesa using the orderReference/payment reference.
 * A successful status is verified before marking the order paid
 * and creating the commission + seller ledger entries.
 */
router.get("/status/:payment_reference", requireUser, async (req, res) => {
  try {
    const paymentReference = String(
      req.params.payment_reference || ""
    ).trim();

    if (!paymentReference) {
      return res.status(400).json({
        error: "payment_reference is required"
      });
    }

    const payment = db.prepare(`
      SELECT p.*
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE p.payment_reference = ?
        AND o.buyer_id = ?
      ORDER BY p.id DESC
      LIMIT 1
    `).get(paymentReference, req.user.id);

    if (!payment) {
      return res.status(404).json({
        error: "Payment not found"
      });
    }

    const token = await getClickPesaToken();

    if (!token) {
      return res.status(502).json({
        error: "ClickPesa authentication failed"
      });
    }

    const response = await axios.get(
      `${process.env.CLICKPESA_API_URL}/third-parties/payments/${encodeURIComponent(paymentReference)}`,
      {
        headers: {
          Authorization: getAuthHeader(token)
        }
      }
    );

    const records = Array.isArray(response.data)
      ? response.data
      : [response.data];

    const providerPayment =
      records.find((item) =>
        ["SUCCESS", "SETTLED", "PROCESSING", "PENDING", "FAILED"]
          .includes(String(item?.status || "").toUpperCase())
      ) || records[0];

    if (!providerPayment) {
      return res.status(502).json({
        error: "ClickPesa returned no payment status"
      });
    }

    const providerStatus = String(
      providerPayment.status || "PENDING"
    ).toUpperCase();

    db.prepare(`
      UPDATE payments
      SET
        status = ?,
        provider_reference = COALESCE(?, provider_reference),
        paid_at = CASE
          WHEN ? IN ('SUCCESS', 'SETTLED') THEN CURRENT_TIMESTAMP
          ELSE paid_at
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      providerStatus.toLowerCase(),
      providerPayment.id || null,
      providerStatus,
      payment.id
    );

    /*
     * Only SUCCESS or SETTLED can create the financial ledger.
     * PROCESSING/PENDING/FAILED never credit the seller.
     */
    if (providerStatus === "SUCCESS" || providerStatus === "SETTLED") {
      const transaction = db.transaction(() => {
        const currentPayment = db.prepare(`
          SELECT *
          FROM payments
          WHERE id = ?
        `).get(payment.id);

        const order = db.prepare(`
          SELECT *
          FROM orders
          WHERE id = ?
        `).get(currentPayment.order_id);

        if (!order) {
          throw new Error("Order not found for payment");
        }

        const commissionSetting = db.prepare(`
          SELECT setting_value
          FROM admin_settings
          WHERE setting_key = 'commission_rate'
          LIMIT 1
        `).get();

        const commissionRate = Number(
          commissionSetting?.setting_value ?? 5
        );

        if (
          !Number.isFinite(commissionRate) ||
          commissionRate < 0 ||
          commissionRate > 100
        ) {
          throw new Error("Invalid admin commission rate");
        }

        const alreadyCommissioned = db.prepare(`
          SELECT id
          FROM admin_commissions
          WHERE payment_id = ?
          LIMIT 1
        `).get(currentPayment.id);

        if (!alreadyCommissioned) {
          const grossAmount = Number(currentPayment.amount);
          const commissionAmount =
            Math.round(grossAmount * commissionRate) / 100;
          const sellerNetAmount =
            Math.round((grossAmount - commissionAmount) * 100) / 100;

          db.prepare(`
            INSERT INTO admin_commissions (
              payment_id,
              order_id,
              commission_rate,
              gross_amount,
              commission_amount,
              seller_net_amount,
              currency
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            currentPayment.id,
            order.id,
            commissionRate,
            grossAmount,
            commissionAmount,
            sellerNetAmount,
            currentPayment.currency
          );

          db.prepare(`
            INSERT INTO seller_ledger (
              seller_id,
              payment_id,
              order_id,
              entry_type,
              amount,
              currency,
              description,
              reference
            )
            VALUES (?, ?, ?, 'credit', ?, ?, ?, ?)
          `).run(
            currentPayment.seller_id,
            currentPayment.id,
            order.id,
            sellerNetAmount,
            currentPayment.currency,
            `Seller net earnings for ${order.order_number}`,
            currentPayment.payment_reference
          );
        }

        db.prepare(`
          UPDATE payments
          SET status = 'paid',
              paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(currentPayment.id);

        db.prepare(`
          UPDATE orders
          SET
            payment_status = 'paid',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(order.id);
      });

      transaction();
    }

    const updatedPayment = db.prepare(`
      SELECT *
      FROM payments
      WHERE id = ?
    `).get(payment.id);

    const commission = db.prepare(`
      SELECT
        commission_rate,
        gross_amount,
        commission_amount,
        seller_net_amount,
        currency
      FROM admin_commissions
      WHERE payment_id = ?
      LIMIT 1
    `).get(payment.id);

    return res.json({
      success: true,
      payment: updatedPayment,
      clickpesa: providerPayment,
      commission: commission || null
    });
  } catch (error) {
    console.error(
      "ClickPesa payment status error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      error: "Unable to query ClickPesa payment status",
      details:
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data ||
        null
    });
  }
});


/*
 * POST /api/payments/clickpesa/webhook
 * Local webhook receiver for ClickPesa payment events.
 *
 * IMPORTANT:
 * This endpoint only marks a payment as paid after matching
 * an existing Zenodic payment record. It does not trust the
 * browser/client to declare a payment successful.
 */
router.post("/clickpesa/webhook", async (req, res) => {
  try {
    const event = req.body || {};

    console.log(
      "ClickPesa webhook received:",
      JSON.stringify(event)
    );

    const providerPayment =
      event.payment ||
      event.data ||
      event;

    const orderReference =
      providerPayment.orderReference ||
      providerPayment.order_reference ||
      event.orderReference ||
      event.order_reference ||
      null;

    const providerStatus = String(
      providerPayment.status ||
      event.status ||
      ""
    ).toUpperCase();

    const providerReference =
      providerPayment.paymentReference ||
      providerPayment.payment_reference ||
      providerPayment.id ||
      event.paymentReference ||
      event.payment_reference ||
      null;

    if (!orderReference) {
      return res.status(400).json({
        error: "Missing ClickPesa order reference"
      });
    }

    const payment = db.prepare(`
      SELECT *
      FROM payments
      WHERE payment_reference = ?
      LIMIT 1
    `).get(orderReference);

    if (!payment) {
      console.warn(
        "ClickPesa webhook: payment not found:",
        orderReference
      );

      /*
       * Return 200 so ClickPesa does not repeatedly retry an event
       * that belongs to an unknown/local test transaction.
       */
      return res.json({
        success: true,
        processed: false,
        message: "Payment reference not found"
      });
    }

    /*
     * Only successful provider states can settle a payment.
     */
    if (!["SUCCESS", "SETTLED"].includes(providerStatus)) {
      return res.json({
        success: true,
        processed: false,
        payment_reference: payment.payment_reference,
        provider_status: providerStatus
      });
    }

    const alreadySettled = payment.status === "paid";

    if (alreadySettled) {
      return res.json({
        success: true,
        processed: false,
        duplicate: true,
        payment_reference: payment.payment_reference
      });
    }

    let settlePayment;

    try {
      db.exec("BEGIN");

      const currentPayment = db.prepare(`
        SELECT *
        FROM payments
        WHERE id = ?
        LIMIT 1
      `).get(payment.id);

      if (!currentPayment) {
        throw new Error("Payment disappeared during settlement");
      }

      if (currentPayment.status === "paid") {
        db.exec("COMMIT");

        settlePayment = {
          duplicate: true,
          payment: currentPayment
        };
      } else {
        const order = db.prepare(`
          SELECT *
          FROM orders
          WHERE id = ?
          LIMIT 1
        `).get(currentPayment.order_id);

        if (!order) {
          throw new Error("Order not found for payment");
        }

        const commissionSetting = db.prepare(`
          SELECT setting_value
          FROM admin_settings
          WHERE setting_key = 'commission_rate'
          LIMIT 1
        `).get();

        let commissionRate = Number(
          commissionSetting?.setting_value ?? 5
        );

        if (!Number.isFinite(commissionRate) || commissionRate < 0) {
          commissionRate = 5;
        }

        if (commissionRate > 100) {
          commissionRate = 100;
        }

        const grossAmount = Number(currentPayment.amount);

        if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
          throw new Error("Invalid payment amount");
        }

        const commissionAmount =
          Math.round(
            grossAmount * (commissionRate / 100) * 100
          ) / 100;

        const sellerNetAmount =
          Math.round(
            (grossAmount - commissionAmount) * 100
          ) / 100;

        const existingCommission = db.prepare(`
          SELECT id
          FROM admin_commissions
          WHERE payment_id = ?
          LIMIT 1
        `).get(currentPayment.id);

        if (!existingCommission) {
          db.prepare(`
            INSERT INTO admin_commissions (
              payment_id,
              order_id,
              commission_rate,
              gross_amount,
              commission_amount,
              seller_net_amount,
              currency
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            currentPayment.id,
            currentPayment.order_id,
            commissionRate,
            grossAmount,
            commissionAmount,
            sellerNetAmount,
            currentPayment.currency
          );
        }

        const existingLedger = db.prepare(`
          SELECT id
          FROM seller_ledger
          WHERE payment_id = ?
            AND entry_type = 'credit'
          LIMIT 1
        `).get(currentPayment.id);

        if (!existingLedger) {
          db.prepare(`
            INSERT INTO seller_ledger (
              seller_id,
              payment_id,
              order_id,
              entry_type,
              amount,
              currency,
              description,
              reference
            )
            VALUES (?, ?, ?, 'credit', ?, ?, ?, ?)
          `).run(
            currentPayment.seller_id,
            currentPayment.id,
            currentPayment.order_id,
            sellerNetAmount,
            currentPayment.currency,
            "Seller earnings from completed buyer payment",
            currentPayment.payment_reference
          );
        }

        db.prepare(`
          UPDATE payments
          SET
            status = 'paid',
            provider_reference = COALESCE(?, provider_reference),
            paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          providerReference,
          currentPayment.id
        );

        db.prepare(`
          UPDATE orders
          SET
            payment_status = 'paid',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(currentPayment.order_id);

        db.exec("COMMIT");

        settlePayment = {
          duplicate: false,
          commissionRate,
          grossAmount,
          commissionAmount,
          sellerNetAmount
        };
      }
    } catch (settlementError) {
      try {
        db.exec("ROLLBACK");
      } catch (_) {}

      throw settlementError;
    }

    return res.json({
      success: true,
      processed: !settlePayment.duplicate,
      duplicate: settlePayment.duplicate,
      payment_reference: payment.payment_reference,
      commission: settlePayment.commissionRate
        ? {
            rate: settlePayment.commissionRate,
            gross_amount: settlePayment.grossAmount,
            commission_amount: settlePayment.commissionAmount,
            seller_net_amount: settlePayment.sellerNetAmount
          }
        : null
    });
  } catch (error) {
    console.error(
      "ClickPesa webhook processing error:",
      error
    );

    return res.status(500).json({
      error: "Webhook processing failed"
    });
  }
});

/**
 * GET /api/payments/wholesale
 * Returns payment dashboard data for an authenticated wholesale seller.
 */
router.get("/wholesale", requireUser, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const user = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = "wholesale"
    `).get(userId);

    if (!user) {
      return res.status(403).json({
        success: false,
        error: "Wholesale access required"
      });
    }

    const transactions = db.prepare(`
      SELECT
        o.id AS order_id,
        o.order_number,
        o.buyer_id,
        buyer.name AS buyer_name,
        p.id AS payment_id,
        p.payment_reference,
        p.payment_method,
        p.currency,
        p.amount,
        p.status,
        p.provider_reference,
        p.paid_at,
        p.created_at,
        p.updated_at
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      LEFT JOIN users buyer ON buyer.id = o.buyer_id
      WHERE o.seller_id = ?
      ORDER BY p.id DESC
      LIMIT 100
    `).all(userId);

    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN p.status = "paid" THEN p.amount ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN p.status = "pending" THEN p.amount ELSE 0 END), 0) AS total_pending,
        COALESCE(SUM(CASE WHEN p.status IN ("failed", "cancelled") THEN p.amount ELSE 0 END), 0) AS total_failed,
        COALESCE(SUM(CASE WHEN p.status = "refunded" THEN p.amount ELSE 0 END), 0) AS total_refunded,
        COUNT(*) AS transaction_count
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.seller_id = ?
    `).get(userId);

    return res.json({
      success: true,
      currency: transactions[0]?.currency || "TZS",
      summary,
      transactions
    });
  } catch (error) {
    console.error("Wholesale payment dashboard error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load wholesale payments"
    });
  }
});

/**
 * GET /api/payments/history
 * Returns payment history for the authenticated user.
 */
router.get("/history", requireUser, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const transactions = db.prepare(`
      SELECT
        o.id AS order_id,
        o.order_number,
        o.currency AS order_currency,
        o.total_amount AS order_amount,
        o.payment_status AS order_payment_status,
        o.created_at AS order_created_at,
        p.id AS payment_id,
        p.payment_reference,
        p.payment_method,
        p.currency AS payment_currency,
        p.amount AS payment_amount,
        p.status AS payment_status,
        p.provider_reference,
        p.paid_at,
        p.created_at AS payment_created_at
      FROM orders o
      LEFT JOIN payments p
        ON p.order_id = o.id
        AND p.buyer_id = o.buyer_id
      WHERE o.buyer_id = ?
      ORDER BY o.id DESC
      LIMIT 50
    `).all(userId);

    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN o.payment_status = 'paid' OR p.status = 'paid'
            THEN COALESCE(p.amount, o.total_amount)
            ELSE 0
          END
        ), 0) AS total_paid,

        COALESCE(SUM(
          CASE
            WHEN o.payment_status = 'pending' OR p.status = 'pending'
            THEN COALESCE(p.amount, o.total_amount)
            ELSE 0
          END
        ), 0) AS total_pending,

        COALESCE(SUM(
          CASE
            WHEN o.payment_status IN ('failed', 'cancelled')
              OR p.status IN ('failed', 'cancelled')
            THEN COALESCE(p.amount, o.total_amount)
            ELSE 0
          END
        ), 0) AS total_failed,

        COUNT(*) AS transaction_count
      FROM orders o
      LEFT JOIN payments p
        ON p.order_id = o.id
        AND p.buyer_id = o.buyer_id
      WHERE o.buyer_id = ?
    `).get(userId);

    return res.json({
      success: true,
      currency: transactions[0]?.payment_currency ||
        transactions[0]?.order_currency ||
        "TZS",
      summary,
      transactions
    });
  } catch (error) {
    console.error("Payment history error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load payment history"
    });
  }
});

module.exports = router;
