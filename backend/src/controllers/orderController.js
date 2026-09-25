const orderModel = require('../models/orderModel');

async function getOrders(req, res, next) {
  try {
    const orders = await orderModel.listOrders({
      customerId: req.query.customerId,
      shopId: req.query.shopId,
      driverId: req.query.driverId,
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

async function createOrder(req, res, next) {
  try {
    const order = await orderModel.createOrder({
      customerId: req.user.id,
      shopId: req.body.shopId,
      driverId: req.body.driverId,
      status: req.body.status,
      items: req.body.items,
      subtotal: req.body.subtotal,
      deliveryFee: req.body.deliveryFee,
      totalAmount: req.body.totalAmount,
      deliveryAddress: req.body.deliveryAddress,
      deliveryLatitude: req.body.deliveryLatitude,
      deliveryLongitude: req.body.deliveryLongitude,
      pickupAddress: req.body.pickupAddress,
      pickupLatitude: req.body.pickupLatitude,
      pickupLongitude: req.body.pickupLongitude,
      paymentStatus: req.body.paymentStatus,
      deliveryNotes: req.body.deliveryNotes,
      estimatedDelivery: req.body.estimatedDelivery,
      vehicleType: req.body.vehicleType,
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

async function updateOrder(req, res, next) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const isOwner = req.user.id === order.customer_id;
    const isShopOwner = req.user.role === 'shop_owner';
    const isDriver = req.user.id === order.driver_id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isShopOwner && !isDriver && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updatedOrder = await orderModel.updateOrder(req.params.id, req.body);
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
}

module.exports = { getOrders, getOrder, createOrder, updateOrder };
