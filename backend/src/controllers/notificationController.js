const notificationModel = require('../models/notificationModel');

async function getNotifications(req, res, next) {
  try {
    const notifications = await notificationModel.listNotificationsForUser(req.user.id);
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotifications,
};
