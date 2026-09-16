const express = require("express");
const router = express.Router();
const db = require("./database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const productUploadDir = path.join(__dirname, "uploads", "products");
fs.mkdirSync(productUploadDir, { recursive: true });

const productVideoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safeName);
  }
});

const productVideoUpload = multer({
  storage: productVideoStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("File lazima iwe video."));
    }
    cb(null, true);
  }
});

// Seller product video upload
router.post("/video", (req, res) => {
  productVideoUpload.single("video")(req, res, (error) => {
    if (error) {
      console.error("PRODUCT VIDEO UPLOAD ERROR:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Imeshindikana kupakia video."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Chagua video ya bidhaa."
      });
    }

    const videoUrl = `/backend/uploads/products/${req.file.filename}`;

    return res.json({
      success: true,
      message: "Video imepakiwa.",
      video_url: videoUrl
    });
  });
});

// Public buyer market — only approved products from verified, active sellers/wholesalers
router.get("/market", (req, res) => {
  try {
    const products = db.prepare(`
      SELECT
        inventory.id,
        inventory.user_id,
        inventory.item_name,
        inventory.item_type,
        inventory.sku,
        inventory.quantity,
        inventory.reserved_quantity,
        inventory.unit,
        inventory.location,
        inventory.image_url,
                        inventory.video_url,
        inventory.description,
        inventory.price,
        inventory.phone,
        inventory.created_at,
        inventory.updated_at,
        users.name AS seller_name,
        users.email AS seller_email,
        users.role AS seller_role
      FROM inventory
      JOIN users
        ON users.id = inventory.user_id
      WHERE users.role IN ('seller', 'wholesale')
        AND users.verification_status = 'verified'
        AND users.account_status = 'active'
        AND inventory.approval_status = 'approved'
        AND inventory.price IS NOT NULL
        AND inventory.price > 0
        AND inventory.quantity > COALESCE(inventory.reserved_quantity, 0)
      ORDER BY inventory.id DESC
    `).all();

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error("PUBLIC MARKET ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Imeshindikana kupata bidhaa za Market.",
      debug: error.message
    });
  }
});

// Get seller's products
router.get("/seller/:sellerId", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID"
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
        message: "Seller not found"
      });
    }

    const products = db.prepare(`
      SELECT
        id,
        user_id,
        item_name,
        item_type,
        sku,
        quantity,
        reserved_quantity,
        reorder_level,
        unit,
        location,
        image_url,
                                  video_url,
        description,
        price,
        phone,
        created_at,
        updated_at
      FROM inventory
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(sellerId);

    res.json({
      success: true,
      seller,
      products
    });
  } catch (error) {
    console.error("SELLER PRODUCTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load seller products"
    });
  }
});

// Add seller product
router.post("/seller/:sellerId", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);

    const {
      item_name,
      item_type = "finished_product",
      sku = null,
      quantity = 0,
      reorder_level = 0,
      unit = "pcs",
      location = null,
      image_url = null,
                           video_url = null,
      description = null,
      price = null,
      phone = null
    } = req.body;

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID"
      });
    }

    if (!item_name || !String(item_name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (!image_url || !String(image_url).trim()) {
      return res.status(400).json({
        success: false,
        message: "Product image is required"
      });
    }

    const seller = db.prepare(`
      SELECT id
      FROM users
      WHERE id = ? AND role = 'seller'
    `).get(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found"
      });
    }

    const cleanPrice =
      price === null || price === "" ? null : Number(price);

    if (cleanPrice !== null && (!Number.isFinite(cleanPrice) || cleanPrice < 0)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product price"
      });
    }

    const result = db.prepare(`
      INSERT INTO inventory (
        user_id,
        item_name,
        item_type,
        sku,
        quantity,
        reorder_level,
        unit,
        location,
        image_url,
          video_url,
        description,
        price,
        phone
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sellerId,
      String(item_name).trim(),
      item_type,
      sku,
      Number(quantity) || 0,
      Number(reorder_level) || 0,
      unit,
      location,
      String(image_url).trim(),
        video_url ? String(video_url).trim() : null,
      description ? String(description).trim() : null,
      cleanPrice,
      phone ? String(phone).trim() : null
    );

    const product = db.prepare(`
      SELECT *
      FROM inventory
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    console.error("ADD SELLER PRODUCT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add product"
    });
  }
});;

// Update seller product
router.put("/seller/:sellerId/:productId", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);
    const productId = Number(req.params.productId);

    if (!Number.isInteger(sellerId) || sellerId <= 0 ||
        !Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller or product ID"
      });
    }

    const existing = db.prepare(`
      SELECT *
      FROM inventory
      WHERE id = ? AND user_id = ?
    `).get(productId, sellerId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const {
      item_name = existing.item_name,
      item_type = existing.item_type,
      sku = existing.sku,
      quantity = existing.quantity,
      reorder_level = existing.reorder_level,
      unit = existing.unit,
      location = existing.location,
      image_url = existing.image_url,
             video_url = existing.video_url,
      description = existing.description,
      price = existing.price,
      phone = existing.phone
    } = req.body;

    if (!item_name || !String(item_name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    const cleanPrice =
      price === null || price === "" ? null : Number(price);

    if (
      cleanPrice !== null &&
      (!Number.isFinite(cleanPrice) || cleanPrice < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product price"
      });
    }

    db.prepare(`
      UPDATE inventory
      SET
        item_name = ?,
        item_type = ?,
        sku = ?,
        quantity = ?,
        reorder_level = ?,
        unit = ?,
        location = ?,
        image_url = ?,
                              video_url = ?,
        description = ?,
        price = ?,
        phone = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      String(item_name).trim(),
      item_type,
      sku,
      Number(quantity) || 0,
      Number(reorder_level) || 0,
      unit,
      location,
      image_url ? String(image_url).trim() : null,
                                  video_url ? String(video_url).trim() : null,
      description ? String(description).trim() : null,
      cleanPrice,
      phone ? String(phone).trim() : null,
      productId,
      sellerId
    );

    const product = db.prepare(`
      SELECT *
      FROM inventory
      WHERE id = ? AND user_id = ?
    `).get(productId, sellerId);

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error("UPDATE SELLER PRODUCT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update product"
    });
  }
});

// Delete seller product
router.delete("/seller/:sellerId/:productId", (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);
    const productId = Number(req.params.productId);

    if (!Number.isInteger(sellerId) || sellerId <= 0 ||
        !Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller or product ID"
      });
    }

    const result = db.prepare(`
      DELETE FROM inventory
      WHERE id = ? AND user_id = ?
    `).run(productId, sellerId);

    if (!result.changes) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    console.error("DELETE SELLER PRODUCT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete product"
    });
  }
});

// Get wholesaler inventory
router.get("/wholesale/:wholesalerId", (req, res) => {
  try {
    const wholesalerId = Number(req.params.wholesalerId);

    if (!Number.isInteger(wholesalerId) || wholesalerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid wholesaler ID"
      });
    }

    const wholesaler = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ? AND role = 'wholesale'
    `).get(wholesalerId);

    if (!wholesaler) {
      return res.status(404).json({
        success: false,
        message: "Wholesaler not found"
      });
    }

    const products = db.prepare(`
      SELECT
        id,
        user_id,
        item_name,
        item_type,
        sku,
        quantity,
        reserved_quantity,
        reorder_level,
        unit,
        location,
        image_url,
        description,
        price,
        phone,
        approval_status,
        created_at,
        updated_at
      FROM inventory
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(wholesalerId);

    res.json({
      success: true,
      wholesaler,
      products
    });
  } catch (error) {
    console.error("WHOLESALER INVENTORY ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load wholesaler inventory"
    });
  }
});

// Add wholesaler product
router.post("/wholesale/:wholesalerId", (req, res) => {
  try {
    const wholesalerId = Number(req.params.wholesalerId);

    const {
      item_name,
      item_type = "finished_product",
      sku = null,
      quantity = 0,
      reorder_level = 0,
      unit = "pcs",
      location = null,
      image_url = null,
      description = null,
      price = null,
      phone = null
    } = req.body;

    if (!Number.isInteger(wholesalerId) || wholesalerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid wholesaler ID"
      });
    }

    if (!item_name || !String(item_name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (!image_url || !String(image_url).trim()) {
      return res.status(400).json({
        success: false,
        message: "Product image is required"
      });
    }

    const wholesaler = db.prepare(`
      SELECT id
      FROM users
      WHERE id = ? AND role = 'wholesale'
    `).get(wholesalerId);

    if (!wholesaler) {
      return res.status(404).json({
        success: false,
        message: "Wholesaler not found"
      });
    }

    const cleanPrice =
      price === null || price === "" ? null : Number(price);

    if (
      cleanPrice !== null &&
      (!Number.isFinite(cleanPrice) || cleanPrice < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product price"
      });
    }

    const result = db.prepare(`
      INSERT INTO inventory (
        user_id,
        item_name,
        item_type,
        sku,
        quantity,
        reorder_level,
        unit,
        location,
        image_url,
        description,
        price,
        phone
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      wholesalerId,
      String(item_name).trim(),
      item_type,
      sku,
      Number(quantity) || 0,
      Number(reorder_level) || 0,
      unit,
      location,
      String(image_url).trim(),
      description ? String(description).trim() : null,
      cleanPrice,
      phone ? String(phone).trim() : null
    );

    const product = db.prepare(`
      SELECT *
      FROM inventory
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    console.error("ADD WHOLESALER PRODUCT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add wholesaler product"
    });
  }
});

module.exports = router;
