const paymentModel = require('../models/paymentModel');

async function getPayments(req, res, next) {
  try {
    const payments = await paymentModel.listPayments({
      orderId: req.query.orderId,
      customerId: req.query.customerId,
      sellerId: req.query.sellerId,
    });
    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
}

async function createPayment(req, res, next) {
  try {
    const payment = await paymentModel.createPayment({
      orderId: req.body.orderId,
      customerId: req.user.id,
      sellerId: req.body.sellerId,
      amount: req.body.amount,
      status: req.body.status,
      paymentMethod: req.body.paymentMethod,
      transactionRef: req.body.transactionRef,
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
}

async function updatePayment(req, res, next) {
  try {
    const updatedPayment = await paymentModel.updatePayment(req.params.id, req.body);
    res.json({ success: true, data: updatedPayment });
  } catch (error) {
    next(error);
  }
}

module.exports = { getPayments, createPayment, updatePayment };
