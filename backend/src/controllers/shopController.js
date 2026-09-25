const shopModel = require('../models/shopModel');

async function getShops(req, res, next) {
  try {
    const shops = await shopModel.listShops({ ownerId: req.query.ownerId, activeOnly: req.query.activeOnly !== 'false' });
    res.json({ success: true, data: shops });
  } catch (error) {
    next(error);
  }
}

async function getShop(req, res, next) {
  try {
    const shop = await shopModel.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    res.json({ success: true, data: shop });
  } catch (error) {
    next(error);
  }
}

async function createShop(req, res, next) {
  try {
    const shop = await shopModel.createShop({
      ownerId: req.user.id,
      name: req.body.name,
      description: req.body.description,
      address: req.body.address,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      licenseNumber: req.body.licenseNumber,
      tinNumber: req.body.tinNumber,
    });

    res.status(201).json({ success: true, data: shop });
  } catch (error) {
    next(error);
  }
}

async function updateShop(req, res, next) {
  try {
    const shop = await shopModel.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    if (req.user.role !== 'admin' && req.user.id !== shop.owner_id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updatedShop = await shopModel.updateShop(req.params.id, req.body);
    res.json({ success: true, data: updatedShop });
  } catch (error) {
    next(error);
  }
}

module.exports = { getShops, getShop, createShop, updateShop };
