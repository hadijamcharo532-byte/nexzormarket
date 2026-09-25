const userModel = require('../models/userModel');

async function getUsers(req, res, next) {
  try {
    const users = await userModel.listUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (req.user.role !== 'admin' && req.user.id !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (req.user.role !== 'admin' && req.user.id !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const allowedFields = ['full_name', 'phone', 'avatar_url'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.full_name !== undefined) {
      updates.full_name = String(updates.full_name).trim();
      if (!updates.full_name) {
        return res.status(400).json({ success: false, error: 'Full name is required' });
      }
    }

    if (updates.phone !== undefined) {
      updates.phone = updates.phone ? String(updates.phone).trim() : null;
    }

    if (updates.avatar_url !== undefined) {
      updates.avatar_url = updates.avatar_url ? String(updates.avatar_url).trim() : null;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, error: 'No valid profile fields provided' });
    }

    const updatedUser = await userModel.updateUser(req.params.id, updates);
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const allowedStatuses = ['pending', 'approved', 'rejected', 'suspended'];
    const status = String(req.body.status || '').trim();
    const rejectionReason = req.body.rejection_reason ? String(req.body.rejection_reason).trim() : null;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required for rejected status' });
    }

    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updatedUser = await userModel.updateUserStatus(req.params.id, status, status === 'rejected' ? rejectionReason : null);
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
}

module.exports = { getUsers, getUser, updateUser, updateUserStatus };
