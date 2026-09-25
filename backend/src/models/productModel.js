const db = require('../config/database');
const mediaModel = require('./mediaModel');

let searchIndexesReady = false;

function normalizeLikeValue(value) {
  return `%${String(value || '').toLowerCase().trim()}%`;
}

function safeParseImages(images) {
  if (Array.isArray(images)) return images;
  if (!images) return [];

  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
}

function normalizeProduct(row, media = []) {
  if (!row) return null;

  const imageUrls = safeParseImages(row.images);
  const videoUrls = safeParseImages(row.videos);
  const mediaImages = media.filter((item) => item.media_type === 'image').map((item) => item.file_url);
  const mediaVideos = media.filter((item) => item.media_type === 'video').map((item) => item.file_url);

  return {
    ...row,
    images: mediaImages.length ? mediaImages : imageUrls,
    videos: mediaVideos.length ? mediaVideos : videoUrls,
    media,
  };
}

async function ensureSearchIndexes() {
  if (searchIndexesReady) return;

  const indexStatements = [
    'CREATE INDEX idx_products_active_price_created ON products (is_active, price, created_at)',
    'CREATE INDEX idx_products_rating_reviews ON products (rating, total_reviews)',
    'CREATE INDEX idx_products_stock_active ON products (stock_quantity, is_active)',
    'CREATE INDEX idx_products_shop_active ON products (shop_id, is_active)',
    'CREATE INDEX idx_shops_active_name_address ON shops (is_active, name, address)',
  ];

  for (const statement of indexStatements) {
    try {
      await db.query(statement);
    } catch (error) {
      if (error && (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_CANT_CREATE_TABLE')) {
        continue;
      }
    }
  }

  searchIndexesReady = true;
}

async function listProducts({ shopId, categoryId, activeOnly = true } = {}) {
  let query = 'SELECT * FROM products';
  const values = [];
  const conditions = [];

  if (shopId) {
    conditions.push('shop_id = ?');
    values.push(shopId);
  }

  if (categoryId) {
    conditions.push('category_id = ?');
    values.push(categoryId);
  }

  if (activeOnly) {
    conditions.push('is_active = true');
  }

  if (conditions.length) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC';
  const result = await db.query(query, values);
  const rows = result.rows;

  const withMedia = await Promise.all(
    rows.map(async (row) => {
      const media = await mediaModel.listMediaByProductId(row.id);
      return normalizeProduct(row, media);
    })
  );

  return withMedia;
}

async function findById(id) {
  const result = await db.query('SELECT * FROM products WHERE id = ?', [id]);
  const row = result.rows[0] || null;
  if (!row) return null;

  const media = await mediaModel.listMediaByProductId(row.id);
  return normalizeProduct(row, media);
}

async function createProduct(payload) {
  const insertResult = await db.query(
    `INSERT INTO products (
      shop_id, category_id, name, description, price, compare_price, stock_quantity,
      weight, dimensions, images, videos, is_active, verification_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.shopId,
      payload.categoryId || null,
      payload.name,
      payload.description || null,
      payload.price,
      payload.comparePrice || null,
      payload.stockQuantity || 0,
      payload.weight || null,
      payload.dimensions || null,
      payload.images || [],
      payload.videos || [],
      payload.isActive !== false,
      payload.verificationStatus || 'pending',
    ]
  );

  const result = await db.query('SELECT * FROM products WHERE id = ?', [insertResult.insertId]);
  const created = result.rows[0] || null;
  if (!created) return null;

  await mediaModel.attachMediaToProduct({
    mediaIds: payload.mediaIds,
    productId: created.id,
    ownerUserId: payload.ownerUserId,
    shopId: payload.shopId,
  });

  const media = await mediaModel.listMediaByProductId(created.id);
  return normalizeProduct(created, media);
}

async function updateProduct(id, updates) {
  const fields = Object.entries(updates)
    .filter(([key, value]) => key !== 'mediaIds' && key !== 'ownerUserId' && value !== undefined);

  if (fields.length) {
    const setClauses = fields.map(([key]) => `${key} = ?`).join(', ');
    const values = fields.map(([, value]) => value);
    await db.query(
      `UPDATE products SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );
  }

  if (!fields.length && !(updates.mediaIds && updates.ownerUserId)) {
    return null;
  }

  if (updates.mediaIds && updates.ownerUserId) {
    const current = await db.query('SELECT shop_id FROM products WHERE id = ?', [id]);
    const shopId = current.rows[0]?.shop_id;
    await mediaModel.attachMediaToProduct({
      mediaIds: updates.mediaIds,
      productId: id,
      ownerUserId: updates.ownerUserId,
      shopId,
    });
  }

  const result = await db.query('SELECT * FROM products WHERE id = ?', [id]);
  const updated = result.rows[0] || null;
  if (!updated) return null;

  const media = await mediaModel.listMediaByProductId(id);
  return normalizeProduct(updated, media);
}

async function searchMarketplace({
  query,
  category,
  shopName,
  location,
  priceMin,
  priceMax,
  ratingMin,
  availability,
  sortBy = 'relevance',
  newestOnly = false,
  popularOnly = false,
  nearMe = false,
  userLat,
  userLng,
  radiusKm = 10,
  limit = 30,
  offset = 0,
  occasion,
} = {}) {
  await ensureSearchIndexes();

  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 60);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const safeRadiusKm = Math.min(Math.max(Number(radiusKm) || 10, 1), 50);
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const normalizedShopName = String(shopName || '').trim().toLowerCase();
  const normalizedLocation = String(location || '').trim().toLowerCase();
  const normalizedOccasion = String(occasion || '').trim().toLowerCase();

  const queryTokens = normalizedQuery
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  const whereClauses = ['p.is_active = true', 's.is_active = true'];
  const whereValues = [];

  if (Number.isFinite(Number(priceMin))) {
    whereClauses.push('p.price >= ?');
    whereValues.push(Number(priceMin));
  }

  if (Number.isFinite(Number(priceMax))) {
    whereClauses.push('p.price <= ?');
    whereValues.push(Number(priceMax));
  }

  if (Number.isFinite(Number(ratingMin))) {
    whereClauses.push('p.rating >= ?');
    whereValues.push(Number(ratingMin));
  }

  if (availability === 'in_stock') {
    whereClauses.push('p.stock_quantity > 0');
  }

  if (availability === 'out_of_stock') {
    whereClauses.push('p.stock_quantity <= 0');
  }

  if (newestOnly) {
    whereClauses.push('p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
  }

  if (popularOnly) {
    whereClauses.push('p.total_reviews >= 10');
  }

  if (normalizedCategory) {
    whereClauses.push('(LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.description, "")) LIKE ?)');
    whereValues.push(normalizeLikeValue(normalizedCategory), normalizeLikeValue(normalizedCategory));
  }

  if (normalizedShopName) {
    whereClauses.push('LOWER(s.name) LIKE ?');
    whereValues.push(normalizeLikeValue(normalizedShopName));
  }

  if (normalizedLocation) {
    whereClauses.push('LOWER(s.address) LIKE ?');
    whereValues.push(normalizeLikeValue(normalizedLocation));
  }

  if (normalizedOccasion) {
    whereClauses.push('(LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.description, "")) LIKE ?)');
    whereValues.push(normalizeLikeValue(normalizedOccasion), normalizeLikeValue(normalizedOccasion));
  }

  for (const token of queryTokens) {
    whereClauses.push('(LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.description, "")) LIKE ? OR LOWER(s.name) LIKE ? OR LOWER(s.address) LIKE ?)');
    const likeToken = normalizeLikeValue(token);
    whereValues.push(likeToken, likeToken, likeToken, likeToken);
  }

  const hasGeoSearch = nearMe && Number.isFinite(Number(userLat)) && Number.isFinite(Number(userLng));
  const distanceSelect = hasGeoSearch
    ? ', (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(s.latitude)) * COS(RADIANS(s.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(s.latitude)))) AS distance_km'
    : ', NULL AS distance_km';
  const distanceValues = hasGeoSearch ? [Number(userLat), Number(userLng), Number(userLat)] : [];

  const scoreParts = ['0'];
  const scoreValues = [];

  if (normalizedQuery) {
    scoreParts.push('CASE WHEN LOWER(p.name) LIKE ? THEN 45 ELSE 0 END');
    scoreValues.push(normalizeLikeValue(normalizedQuery));
    scoreParts.push('CASE WHEN LOWER(COALESCE(p.description, "")) LIKE ? THEN 18 ELSE 0 END');
    scoreValues.push(normalizeLikeValue(normalizedQuery));
    scoreParts.push('CASE WHEN LOWER(s.name) LIKE ? THEN 22 ELSE 0 END');
    scoreValues.push(normalizeLikeValue(normalizedQuery));
    scoreParts.push('CASE WHEN LOWER(s.address) LIKE ? THEN 12 ELSE 0 END');
    scoreValues.push(normalizeLikeValue(normalizedQuery));
  }

  if (normalizedCategory) {
    scoreParts.push('CASE WHEN LOWER(p.name) LIKE ? THEN 14 ELSE 0 END');
    scoreValues.push(normalizeLikeValue(normalizedCategory));
  }

  if (normalizedLocation) {
    scoreParts.push('CASE WHEN LOWER(s.address) LIKE ? THEN 14 ELSE 0 END');
    scoreValues.push(normalizeLikeValue(normalizedLocation));
  }

  const orderByMap = {
    relevance: 'match_score DESC, p.rating DESC, p.total_reviews DESC, p.created_at DESC',
    newest: 'p.created_at DESC, p.rating DESC',
    price_asc: 'p.price ASC, p.rating DESC',
    price_desc: 'p.price DESC, p.rating DESC',
    rating: 'p.rating DESC, p.total_reviews DESC',
    popularity: 'p.total_reviews DESC, p.rating DESC, p.created_at DESC',
  };

  const safeSortBy = Object.prototype.hasOwnProperty.call(orderByMap, sortBy) ? sortBy : 'relevance';
  let orderBy = orderByMap[safeSortBy];
  if (hasGeoSearch) {
    orderBy = `distance_km ASC, ${orderBy}`;
  }

  const baseQuery = `
    SELECT
      p.id,
      p.shop_id,
      p.name,
      p.description,
      p.price,
      p.compare_price,
      p.stock_quantity,
      p.images,
      p.rating,
      p.total_reviews,
      p.is_active,
      p.created_at,
      s.name AS shop_name,
      s.address AS shop_location,
      s.rating AS shop_rating,
      s.total_reviews AS shop_total_reviews,
      (${scoreParts.join(' + ')}) AS match_score
      ${distanceSelect}
    FROM products p
    INNER JOIN shops s ON s.id = p.shop_id
    WHERE ${whereClauses.join(' AND ')}
    ${hasGeoSearch ? 'HAVING distance_km <= ?' : ''}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const queryValues = [
    ...scoreValues,
    ...distanceValues,
    ...whereValues,
    ...(hasGeoSearch ? [safeRadiusKm] : []),
    safeLimit,
    safeOffset,
  ];

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM products p
    INNER JOIN shops s ON s.id = p.shop_id
    WHERE ${whereClauses.join(' AND ')}
  `;

  const [result, countResult] = await Promise.all([
    db.query(baseQuery, queryValues),
    db.query(countQuery, whereValues),
  ]);

  return {
    rows: result.rows.map((row) => ({
      ...row,
      images: safeParseImages(row.images),
      availability: row.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
      popularity: row.total_reviews,
      match_score: Number(row.match_score || 0),
      distance_km: row.distance_km == null ? null : Number(row.distance_km),
    })),
    total: Number(countResult.rows[0]?.total || 0),
    limit: safeLimit,
    offset: safeOffset,
  };
}

async function getSearchSuggestions({ q, limit = 8 } = {}) {
  const normalized = String(q || '').trim().toLowerCase();
  if (!normalized) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const likeQuery = normalizeLikeValue(normalized);

  const result = await db.query(
    `
    SELECT suggestion, kind FROM (
      SELECT p.name AS suggestion, 'product' AS kind, p.total_reviews AS popularity
      FROM products p
      WHERE p.is_active = true AND LOWER(p.name) LIKE ?

      UNION ALL

      SELECT s.name AS suggestion, 'shop' AS kind, s.total_reviews AS popularity
      FROM shops s
      WHERE s.is_active = true AND LOWER(s.name) LIKE ?

      UNION ALL

      SELECT s.address AS suggestion, 'location' AS kind, s.total_reviews AS popularity
      FROM shops s
      WHERE s.is_active = true AND LOWER(s.address) LIKE ?
    ) t
    ORDER BY popularity DESC
    LIMIT ?
    `,
    [likeQuery, likeQuery, likeQuery, safeLimit * 2]
  );

  const unique = new Map();
  for (const row of result.rows) {
    const key = String(row.suggestion || '').trim().toLowerCase();
    if (!key || unique.has(key)) continue;
    unique.set(key, { text: row.suggestion, type: row.kind });
    if (unique.size >= safeLimit) break;
  }

  return Array.from(unique.values());
}

async function listSearchVocabulary(limit = 200) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 20), 500);
  const result = await db.query(
    `
    SELECT term FROM (
      SELECT p.name AS term, p.total_reviews AS popularity FROM products p WHERE p.is_active = true
      UNION ALL
      SELECT s.name AS term, s.total_reviews AS popularity FROM shops s WHERE s.is_active = true
      UNION ALL
      SELECT s.address AS term, s.total_reviews AS popularity FROM shops s WHERE s.is_active = true
    ) t
    ORDER BY popularity DESC
    LIMIT ?
    `,
    [safeLimit]
  );

  return result.rows.map((row) => String(row.term || '').trim()).filter(Boolean);
}

module.exports = {
  listProducts,
  findById,
  createProduct,
  updateProduct,
  searchMarketplace,
  getSearchSuggestions,
  listSearchVocabulary,
};
