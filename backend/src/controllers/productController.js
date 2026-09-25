const productModel = require('../models/productModel');
const shopModel = require('../models/shopModel');

const CATEGORY_KEYWORDS = {
  dresses: ['dress', 'dresses', 'gauni', 'nguo', 'fashion', 'mavazi'],
  shoes: ['shoe', 'shoes', 'viatu', 'sneaker', 'heels'],
  handbags: ['handbag', 'mkoba', 'bag', 'purse'],
  cosmetics: ['cosmetic', 'makeup', 'urembo', 'lipstick', 'skincare', 'perfume'],
  electronics: ['electronics', 'electronic', 'simu', 'tv', 'laptop', 'phone', 'fridge', 'microwave'],
};

const OCCASION_KEYWORDS = ['sendoff', 'wedding', 'harusi', 'office', 'casual', 'party'];
const POPULARITY_KEYWORDS = ['popular', 'trending', 'zinazopendwa', 'top'];
const NEWEST_KEYWORDS = ['new', 'newest', 'latest', 'mpya'];
const CHEAP_KEYWORDS = ['cheap', 'bei rahisi', 'nafuu', 'budget'];
const NEAR_ME_KEYWORDS = ['near me', 'karibu na mimi', 'nearby'];

function toNumberOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : undefined;
}

function containsKeyword(query, keywords) {
  return keywords.some((keyword) => query.includes(keyword));
}

function detectCategory(query) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (containsKeyword(query, keywords)) {
      return category;
    }
  }
  return undefined;
}

function detectOccasion(query) {
  const match = OCCASION_KEYWORDS.find((occasion) => query.includes(occasion));
  return match || undefined;
}

function detectLocation(query) {
  const locationPatterns = [
    /(?:katika|kwenye|near|karibu na|from)\s+([a-zA-Z\s]+)/i,
    /(mwananyamala|kinondoni|kariakoo|mwenge|upanga|mikocheni|masaki|manzese|ilala|temeke|kariakoo\s+market)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return String(match[1]).trim();
    }
  }

  return undefined;
}

function extractPriceBounds(query) {
  const normalized = query.replace(/,/g, '');

  const lessThan = normalized.match(/(?:chini\s+ya|under|less\s+than)\s*(\d+)/i);
  if (lessThan) {
    return { priceMax: Number(lessThan[1]) };
  }

  const between = normalized.match(/(\d+)\s*(?:-|to|hadi)\s*(\d+)/i);
  if (between) {
    return { priceMin: Number(between[1]), priceMax: Number(between[2]) };
  }

  if (containsKeyword(normalized, CHEAP_KEYWORDS)) {
    return { priceMax: 50000 };
  }

  return {};
}

function parseNaturalLanguageQuery(rawQuery = '') {
  const query = String(rawQuery || '').trim().toLowerCase();
  const hasQuery = query.length > 0;

  if (!hasQuery) {
    return {
      intent: 'browse',
      filters: {},
      extracted: {
        category: undefined,
        location: undefined,
        occasion: undefined,
        budget: undefined,
        nearMe: false,
      },
    };
  }

  const category = detectCategory(query);
  const location = detectLocation(query);
  const occasion = detectOccasion(query);
  const budget = extractPriceBounds(query);
  const nearMe = containsKeyword(query, NEAR_ME_KEYWORDS);
  const popularOnly = containsKeyword(query, POPULARITY_KEYWORDS);
  const newestOnly = containsKeyword(query, NEWEST_KEYWORDS);

  return {
    intent: nearMe ? 'nearby_search' : category ? 'category_search' : 'general_search',
    filters: {
      category,
      location,
      occasion,
      priceMin: budget.priceMin,
      priceMax: budget.priceMax,
      popularOnly,
      newestOnly,
      nearMe,
    },
    extracted: {
      category,
      location,
      occasion,
      budget: budget.priceMin || budget.priceMax ? budget : undefined,
      nearMe,
    },
  };
}

function levenshteinDistance(a = '', b = '') {
  const source = String(a);
  const target = String(b);
  const matrix = Array.from({ length: source.length + 1 }, () => []);

  for (let i = 0; i <= source.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= target.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= source.length; i += 1) {
    for (let j = 1; j <= target.length; j += 1) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[source.length][target.length];
}

function didYouMean(query, vocabulary) {
  const source = String(query || '').trim();
  if (!source) return null;

  const candidates = vocabulary.filter((item) => item && item.length >= 3).slice(0, 150);
  let best = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const score = levenshteinDistance(source.toLowerCase(), candidate.toLowerCase());
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best) return null;
  const threshold = Math.max(2, Math.floor(source.length * 0.35));
  return bestScore <= threshold ? best : null;
}

async function getProducts(req, res, next) {
  try {
    const products = await productModel.listProducts({
      shopId: req.query.shopId,
      categoryId: req.query.categoryId,
      activeOnly: req.query.activeOnly !== 'false',
    });
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
}

async function searchProducts(req, res, next) {
  try {
    const rawQuery = String(req.query.q || '').trim();
    const parsed = parseNaturalLanguageQuery(rawQuery);

    const effectiveFilters = {
      query: rawQuery,
      category: req.query.category || parsed.filters.category,
      shopName: req.query.shopName,
      location: req.query.location || parsed.filters.location,
      priceMin: toNumberOrUndefined(req.query.priceMin) ?? parsed.filters.priceMin,
      priceMax: toNumberOrUndefined(req.query.priceMax) ?? parsed.filters.priceMax,
      ratingMin: toNumberOrUndefined(req.query.ratingMin),
      availability: req.query.availability,
      sortBy: req.query.sortBy || 'relevance',
      newestOnly: req.query.newest === 'true' || parsed.filters.newestOnly,
      popularOnly: req.query.popular === 'true' || parsed.filters.popularOnly,
      nearMe: req.query.nearMe === 'true' || parsed.filters.nearMe,
      userLat: toNumberOrUndefined(req.query.lat),
      userLng: toNumberOrUndefined(req.query.lng),
      radiusKm: toNumberOrUndefined(req.query.radiusKm) || 10,
      limit: toNumberOrUndefined(req.query.limit) || 30,
      offset: toNumberOrUndefined(req.query.offset) || 0,
      occasion: req.query.occasion || parsed.filters.occasion,
    };

    const result = await productModel.searchMarketplace(effectiveFilters);
    const suggestions = rawQuery
      ? await productModel.getSearchSuggestions({ q: rawQuery, limit: 6 })
      : [];

    let spellSuggestion = null;
    if (rawQuery && result.rows.length === 0) {
      const vocabulary = await productModel.listSearchVocabulary(200);
      spellSuggestion = didYouMean(rawQuery, vocabulary);
    }

    res.json({
      success: true,
      data: {
        results: result.rows,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.limit < result.total,
        },
        intent: parsed.intent,
        extracted: parsed.extracted,
        appliedFilters: effectiveFilters,
        suggestions,
        didYouMean: spellSuggestion,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function searchSuggestions(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const suggestions = await productModel.getSearchSuggestions({ q, limit: toNumberOrUndefined(req.query.limit) || 8 });
    res.json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const shop = await shopModel.findById(req.body.shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    if (req.user.role !== 'admin' && req.user.id !== shop.owner_id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const product = await productModel.createProduct({
      shopId: req.body.shopId,
      categoryId: req.body.categoryId,
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      comparePrice: req.body.comparePrice,
      stockQuantity: req.body.stockQuantity,
      weight: req.body.weight,
      dimensions: req.body.dimensions,
      images: req.body.images,
      videos: req.body.videos,
      mediaIds: req.body.mediaIds,
      ownerUserId: req.user.id,
      isActive: req.body.isActive,
      verificationStatus: req.body.verificationStatus,
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const shop = await shopModel.findById(product.shop_id);
    if (req.user.role !== 'admin' && req.user.id !== shop.owner_id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updatedProduct = await productModel.updateProduct(req.params.id, {
      ...req.body,
      mediaIds: req.body.mediaIds,
      ownerUserId: req.user.id,
    });
    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  searchProducts,
  searchSuggestions,
};
