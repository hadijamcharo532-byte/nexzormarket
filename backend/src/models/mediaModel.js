const db = require('../config/database');

function normalizeMediaType(mimeType) {
  if (String(mimeType || '').startsWith('video/')) return 'video';
  return 'image';
}

async function createMediaRecord({
  ownerUserId,
  shopId,
  productId = null,
  mediaType,
  mimeType,
  fileName,
  filePath,
  fileUrl,
  fileSize,
  width = null,
  height = null,
  durationMs = null,
}) {
  const insert = await db.query(
    `INSERT INTO product_media
      (product_id, shop_id, owner_user_id, media_type, mime_type, file_name, file_path, file_url, file_size, width, height, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      shopId,
      ownerUserId,
      mediaType || normalizeMediaType(mimeType),
      mimeType,
      fileName,
      filePath,
      fileUrl,
      fileSize,
      width,
      height,
      durationMs,
    ]
  );

  const result = await db.query('SELECT * FROM product_media WHERE id = ?', [insert.insertId]);
  return result.rows[0] || null;
}

async function attachMediaToProduct({ mediaIds = [], productId, ownerUserId, shopId }) {
  if (!Array.isArray(mediaIds) || !mediaIds.length) return;

  const numericIds = mediaIds
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericIds.length) return;

  const placeholders = numericIds.map(() => '?').join(', ');

  await db.query(
    `UPDATE product_media
     SET product_id = ?, shop_id = ?, updated_at = NOW()
     WHERE id IN (${placeholders}) AND owner_user_id = ?`,
    [productId, shopId, ...numericIds, ownerUserId]
  );
}

async function listMediaByProductId(productId) {
  const result = await db.query(
    `SELECT id, product_id, shop_id, owner_user_id, media_type, mime_type, file_name, file_url, file_size, width, height, duration_ms, created_at
     FROM product_media
     WHERE product_id = ?
     ORDER BY created_at ASC`,
    [productId]
  );

  return result.rows;
}

module.exports = {
  createMediaRecord,
  attachMediaToProduct,
  listMediaByProductId,
};
