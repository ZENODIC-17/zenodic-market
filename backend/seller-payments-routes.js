const express = require("express");
const { requireUser } = require("./user-auth");
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const {
  previewMobileMoneyPayout,
  createMobileMoneyPayout,
  getMobileMoneyPayoutStatus
} = require("./clickpesa-payout-client");

const router = express.Router();

const db = new DatabaseSync(
  path.join(__dirname, "data", "zenodic.db")
);

const CLICKPESA_PAYOUT_ENABLED =
  String(process.env.CLICKPESA_PAYOUT_ENABLED || "false").toLowerCase() === "true";

async function previewSellerClickPesaPayout({
  amount,
  phoneNumber,
  currency,
  orderReference
}) {
  if (!CLICKPESA_PAYOUT_ENABLED) {
    return {
      enabled: false,
      status: "DISABLED",
      message: "ClickPesa payouts bado zimezimwa."
    };
  }

  return previewMobileMoneyPayout({
    amount,
    phoneNumber,
    currency,
    orderReference
  });
}


/*
 * GET /api/seller/payments/summary?seller_id=2
 *
 * Seller payment summary based on the seller ledger.
 */
router.get("/summary", requireUser, (req, res) => {
  try {
    const sellerId = Number(req.user.id);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(401).json({
        error: "Invalid authenticated seller"
      });
    }

    if (req.user.role !== "seller") {
      return res.status(403).json({
        error: "Seller access required"
      });
    }

    const settings = db.prepare(`
      SELECT
        payout_method,
        payout_account_name,
        payout_account_number,
        payout_schedule,
        currency
      FROM seller_settings
      WHERE user_id = ?
      LIMIT 1
    `).get(sellerId);

    const currency = settings?.currency || "TZS";

    const balance = db.prepare(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN entry_type = 'credit' THEN amount
            WHEN entry_type = 'debit' THEN -amount
            ELSE 0
          END
        ), 0) AS balance
      FROM seller_ledger
      WHERE seller_id = ?
    `).get(sellerId);

    const totalEarned = db.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) AS total
      FROM seller_ledger
      WHERE seller_id = ?
        AND entry_type = 'credit'
    `).get(sellerId);

    const totalPaidOut = db.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) AS total
      FROM seller_payouts
      WHERE seller_id = ?
        AND status IN ('paid', 'completed')
    `).get(sellerId);

    const pendingPayouts = db.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) AS total
      FROM seller_payouts
      WHERE seller_id = ?
        AND status IN ('pending', 'processing')
    `).get(sellerId);

    const ledgerBalance = Number(balance?.balance || 0);
    const reservedPayouts = Number(pendingPayouts?.total || 0);
    const availableBalance = Math.max(0, ledgerBalance - reservedPayouts);

    return res.json({
      success: true,
      seller_id: sellerId,
      currency,
      summary: {
        available_balance: availableBalance,
        total_earned: Number(totalEarned?.total || 0),
        total_paid_out: Number(totalPaidOut?.total || 0),
        pending_payouts: reservedPayouts
      },
      payout_settings: settings
        ? {
            method: settings.payout_method,
            account_name: settings.payout_account_name,
            account_number: settings.payout_account_number,
            schedule: settings.payout_schedule
          }
        : null
    });
  } catch (error) {
    console.error("Seller payment summary error:", error);
    return res.status(500).json({
      error: "Unable to load seller payment summary"
    });
  }
});


/*
 * GET /api/seller/payments/transactions?seller_id=2
 *
 * Returns buyer payment transactions and the seller's net earnings.
 */
router.get("/transactions", requireUser, (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({
        error: "Seller access required"
      });
    }
    const sellerId = Number(req.user.id);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        error: "Valid seller_id is required"
      });
    }

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 50, 1),
      100
    );

    const rows = db.prepare(`
      SELECT
        p.id,
        p.order_id,
        o.order_number,
        p.payment_reference,
        p.payment_method,
        p.amount AS gross_amount,
        p.currency,
        p.status,
        p.provider_reference,
        p.paid_at,
        p.created_at,

        ac.commission_rate,
        ac.commission_amount,
        ac.seller_net_amount

      FROM payments p

      LEFT JOIN orders o
        ON o.id = p.order_id

      LEFT JOIN admin_commissions ac
        ON ac.payment_id = p.id

      WHERE p.seller_id = ?

      ORDER BY p.created_at DESC, p.id DESC

      LIMIT ?
    `).all(sellerId, limit);

    const transactions = rows.map(row => ({
      id: row.id,
      order_id: row.order_id,
      order_number: row.order_number,
      payment_reference: row.payment_reference,
      payment_method: row.payment_method,
      gross_amount: Number(row.gross_amount || 0),
      commission_rate: Number(row.commission_rate || 0),
      commission_amount: Number(row.commission_amount || 0),
      seller_net_amount:
        row.seller_net_amount !== null
          ? Number(row.seller_net_amount)
          : null,
      currency: row.currency,
      status: row.status,
      provider_reference: row.provider_reference,
      paid_at: row.paid_at,
      created_at: row.created_at
    }));

    return res.json({
      success: true,
      seller_id: sellerId,
      transactions
    });
  } catch (error) {
    console.error("Seller payment transactions error:", error);
    return res.status(500).json({
      error: "Unable to load seller payment transactions"
    });
  }
});


/*
 * GET /api/seller/payments/payout-settings?seller_id=2
 */
router.get("/payout-settings", requireUser, (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({
        error: "Seller access required"
      });
    }
    const sellerId = Number(req.user.id);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        error: "Valid seller_id is required"
      });
    }

    const settings = db.prepare(`
      SELECT
        payout_method,
        payout_account_name,
        payout_account_number,
        payout_schedule,
        tax_vat_number,
        currency
      FROM seller_settings
      WHERE user_id = ?
      LIMIT 1
    `).get(sellerId);

    if (!settings) {
      return res.status(404).json({
        error: "Seller payout settings not found"
      });
    }

    return res.json({
      success: true,
      seller_id: sellerId,
      payout_settings: settings
    });
  } catch (error) {
    console.error("Seller payout settings error:", error);
    return res.status(500).json({
      error: "Unable to load payout settings"
    });
  }
});



/*
 * POST /api/seller/payments/payout-request
 *
 * Creates a seller payout request.
 * The request starts as "pending" and does not call a payment provider.
 */
router.post("/payout-request", requireUser, async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Seller access required"
      });
    }

    const sellerId = Number(req.user.id);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated seller"
      });
    }

    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payout amount lazima iwe zaidi ya sifuri."
      });
    }

    const settings = db.prepare(`
      SELECT
        payout_method,
        payout_account_name,
        payout_account_number,
        currency
      FROM seller_settings
      WHERE user_id = ?
      LIMIT 1
    `).get(sellerId);

    if (!settings) {
      return res.status(400).json({
        success: false,
        message: "Weka payout settings kwanza."
      });
    }

    if (
      !settings.payout_method ||
      !settings.payout_account_name ||
      !settings.payout_account_number
    ) {
      return res.status(400).json({
        success: false,
        message: "Payout account details hazijakamilika."
      });
    }

    const currency = settings.currency || "TZS";
    const payoutReference =
      "ZND-PAYOUT-" +
      Date.now() +
      "-" +
      Math.floor(1000 + Math.random() * 9000);

    let providerPreview = null;

    if (CLICKPESA_PAYOUT_ENABLED) {
      if (settings.payout_method !== "mobile_money") {
        return res.status(400).json({
          success: false,
          message: "ClickPesa payout integration kwa sasa inatumia mobile money tu."
        });
      }

      try {
        providerPreview = await previewSellerClickPesaPayout({
          amount,
          phoneNumber: settings.payout_account_number,
          currency,
          orderReference: payoutReference
        });
      } catch (error) {
        console.error(
          "ClickPesa payout preview error:",
          error?.response?.data || error?.message
        );

        return res.status(502).json({
          success: false,
          message: "ClickPesa payout preview imeshindikana."
        });
      }
    }

    let payout;

    try {
      db.exec("BEGIN IMMEDIATE");

      const balance = db.prepare(`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN entry_type = 'credit' THEN amount
              WHEN entry_type = 'debit' THEN -amount
              ELSE 0
            END
          ), 0) AS balance
        FROM seller_ledger
        WHERE seller_id = ?
      `).get(sellerId);

      const pending = db.prepare(`
        SELECT
          COALESCE(SUM(amount), 0) AS total
        FROM seller_payouts
        WHERE seller_id = ?
          AND status IN ('pending', 'processing')
      `).get(sellerId);

      const ledgerBalance = Number(balance?.balance || 0);
      const reserved = Number(pending?.total || 0);
      const availableBalance = Math.max(0, ledgerBalance - reserved);

      if (amount > availableBalance) {
        const error = new Error(
          "Payout amount inazidi available balance."
        );
        error.code = "INSUFFICIENT_AVAILABLE_BALANCE";
        error.availableBalance = availableBalance;
        throw error;
      }

      const insert = db.prepare(`
        INSERT INTO seller_payouts (
          seller_id,
          amount,
          currency,
          payout_method,
          payout_account_name,
          payout_account_number,
          status,
          payout_reference,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const result = insert.run(
        sellerId,
        amount,
        currency,
        settings.payout_method,
        settings.payout_account_name,
        settings.payout_account_number,
        payoutReference
      );

      payout = db.prepare(`
        SELECT
          id,
          seller_id,
          amount,
          currency,
          payout_method,
          status,
          payout_reference,
          provider_reference,
          processed_at,
          created_at,
          updated_at
        FROM seller_payouts
        WHERE id = ?
      `).get(result.lastInsertRowid);

      db.exec("COMMIT");
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {}

      if (error?.code === "INSUFFICIENT_AVAILABLE_BALANCE") {
        return res.status(400).json({
          success: false,
          message: error.message,
          available_balance: error.availableBalance
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Payout request imepokelewa na iko pending.",
      payout,
      provider_preview: providerPreview
    });
  } catch (error) {
    console.error("Seller payout request error:", error);

    return res.status(500).json({
      success: false,
      message: "Imeshindikana kutengeneza payout request."
    });
  }
});

module.exports = router;
