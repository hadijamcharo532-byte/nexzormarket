const fs = require('fs');
const path = require('path');
const shopModel = require('../models/shopModel');
const mediaModel = require('../models/mediaModel');

function buildPublicFileUrl(req, fileName) {
  const host = req.get('host');
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}/uploads/product-media/${fileName}`;
}

async function findOwnerShopId(userId) {
  const shops = await shopModel.listShops({ ownerId: userId, activeOnly: false });
  return shops[0]?.id || null;
}

async function uploadProductMedia(req, res, next) {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    let shopId = req.body.shopId ? Number(req.body.shopId) : null;

    if (req.user.role === 'shop_owner') {
      const ownerShopId = await findOwnerShopId(req.user.id);
      if (!ownerShopId) {
        return res.status(400).json({ success: false, error: 'No shop found for this owner account' });
      }

      if (shopId && String(shopId) !== String(ownerShopId)) {
        return res.status(403).json({ success: false, error: 'You can only upload media for your own shop' });
      }

      shopId = ownerShopId;
    }

    if (!shopId) {
      return res.status(400).json({ success: false, error: 'shopId is required' });
    }

    const shop = await shopModel.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    if (req.user.role !== 'admin' && String(shop.owner_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const createdRecords = [];

    for (const file of files) {
      const mediaType = String(file.mimetype || '').startsWith('video/') ? 'video' : 'image';
      const record = await mediaModel.createMediaRecord({
        ownerUserId: req.user.id,
        shopId,
        mediaType,
        mimeType: file.mimetype,
        fileName: file.filename,
        filePath: file.path,
        fileUrl: buildPublicFileUrl(req, file.filename),
        fileSize: file.size,
      });

      createdRecords.push(record);
    }

    res.status(201).json({ success: true, data: createdRecords });
  } catch (error) {
    if (Array.isArray(req.files)) {
      for (const file of req.files) {
        if (file?.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    next(error);
  }
}

module.exports = {
  uploadProductMedia,
};
