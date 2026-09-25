const trackingModel = require('../models/trackingModel');

async function getLocations(req, res, next) {
  try {
    const locations = await trackingModel.listLocations({
      driverId: req.query.driverId,
      orderId: req.query.orderId,
    });
    res.json({ success: true, data: locations });
  } catch (error) {
    next(error);
  }
}

async function createLocation(req, res, next) {
  try {
    const location = await trackingModel.createLocation({
      driverId: req.user.id,
      orderId: req.body.orderId,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      heading: req.body.heading,
      speed: req.body.speed,
    });

    res.status(201).json({ success: true, data: location });
  } catch (error) {
    next(error);
  }
}

module.exports = { getLocations, createLocation };
