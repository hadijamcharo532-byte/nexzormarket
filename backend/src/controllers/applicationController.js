const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const applicationModel = require('../models/applicationModel');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const parsed = String(value).trim();
  return parsed || null;
}

function normalizeProductCategories(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function createBaseUser({ email, password, fullName, phone, role }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password || !fullName) {
    throw new Error('Email, password and full name are required');
  }

  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) {
    throw new Error('User already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return userModel.createUser({
    email: normalizedEmail,
    passwordHash,
    fullName: String(fullName).trim(),
    phone: normalizeOptionalText(phone),
    role,
  });
}

async function registerCustomer(req, res, next) {
  try {
    const user = await createBaseUser({
      email: req.body.email,
      password: req.body.password,
      fullName: req.body.fullName,
      phone: req.body.phone,
      role: 'customer',
    });

    res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    const code = error.message === 'User already exists' ? 409 : 400;
    res.status(code).json({ success: false, error: error.message });
  }
}

async function submitShopOwnerApplication(req, res, next) {
  try {
    const {
      personalInfo,
      shopInfo,
      documents,
      agreement,
    } = req.body || {};

    if (!personalInfo || !shopInfo) {
      return res.status(400).json({ success: false, error: 'Personal and shop information are required' });
    }

    if (!shopInfo.shopName || !shopInfo.shopCategory || !shopInfo.address) {
      return res.status(400).json({ success: false, error: 'Shop name, category and address are required' });
    }

    const user = await createBaseUser({
      email: personalInfo.email,
      password: personalInfo.password,
      fullName: personalInfo.fullName,
      phone: personalInfo.phone,
      role: 'shop_owner',
    });

    const application = await applicationModel.submitApplication({
      userId: user.id,
      type: 'shop_owner',
      personalInfo: {
        full_name: String(personalInfo.fullName).trim(),
        phone: normalizeOptionalText(personalInfo.phone),
        profile_photo_url: normalizeOptionalText(personalInfo.profilePhotoUrl),
      },
      applicationData: {
        shop_name: String(shopInfo.shopName).trim(),
        shop_category: String(shopInfo.shopCategory).trim(),
        shop_description: normalizeOptionalText(shopInfo.shopDescription),
        shop_logo_url: normalizeOptionalText(shopInfo.shopLogoUrl),
        product_categories: normalizeProductCategories(shopInfo.productCategories),
        shop_location: normalizeOptionalText(shopInfo.shopLocation),
        region: normalizeOptionalText(shopInfo.region),
        district: normalizeOptionalText(shopInfo.district),
        address: String(shopInfo.address).trim(),
        business_phone: normalizeOptionalText(shopInfo.businessPhoneNumber),
        national_id: normalizeOptionalText(shopInfo.nationalId),
        business_registration: normalizeOptionalText(shopInfo.businessRegistrationDetails),
      },
      documents,
      agreement: {
        type: 'shop_owner_agreement',
        version: normalizeOptionalText(agreement?.version) || 'v1',
        accepted: Boolean(agreement?.accepted),
        accepted_terms: Boolean(agreement?.acceptedTerms),
        accepted_agreement: Boolean(agreement?.acceptedAgreement),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Your application is under review.',
      data: {
        user,
        application,
      },
    });
  } catch (error) {
    const code = error.message === 'User already exists' ? 409 : 400;
    res.status(code).json({ success: false, error: error.message });
  }
}

async function submitDriverApplication(req, res, next) {
  try {
    const {
      personalInfo,
      driverInfo,
      documents,
      agreement,
    } = req.body || {};

    if (!personalInfo || !driverInfo) {
      return res.status(400).json({ success: false, error: 'Personal and driver information are required' });
    }

    if (!driverInfo.vehicleType || !driverInfo.vehicleRegistrationNumber || !driverInfo.drivingLicenseNumber || !driverInfo.operatingArea) {
      return res.status(400).json({ success: false, error: 'Vehicle and license details are required' });
    }

    const user = await createBaseUser({
      email: personalInfo.email,
      password: personalInfo.password,
      fullName: personalInfo.fullName,
      phone: personalInfo.phone,
      role: 'driver',
    });

    const application = await applicationModel.submitApplication({
      userId: user.id,
      type: 'driver',
      personalInfo: {
        full_name: String(personalInfo.fullName).trim(),
        phone: normalizeOptionalText(personalInfo.phone),
        profile_photo_url: normalizeOptionalText(personalInfo.profilePhotoUrl),
      },
      applicationData: {
        vehicle_type: String(driverInfo.vehicleType).trim(),
        vehicle_registration_number: String(driverInfo.vehicleRegistrationNumber).trim(),
        driving_license_number: String(driverInfo.drivingLicenseNumber).trim(),
        operating_area: String(driverInfo.operatingArea).trim(),
        availability_status: normalizeOptionalText(driverInfo.availabilityStatus) || 'full_time',
      },
      documents,
      agreement: {
        type: 'driver_agreement',
        version: normalizeOptionalText(agreement?.version) || 'v1',
        accepted: Boolean(agreement?.accepted),
        accepted_terms: Boolean(agreement?.acceptedTerms),
        accepted_agreement: Boolean(agreement?.acceptedAgreement),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Your application is under review.',
      data: {
        user,
        application,
      },
    });
  } catch (error) {
    const code = error.message === 'User already exists' ? 409 : 400;
    res.status(code).json({ success: false, error: error.message });
  }
}

async function getPendingApplications(req, res, next) {
  try {
    const applications = await applicationModel.listPendingApplications();
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
}

async function getPendingShopOwnerRequests(req, res, next) {
  try {
    const requests = await applicationModel.listPendingShopOwnerApplications();
    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
}

async function getApplicationById(req, res, next) {
  try {
    const application = await applicationModel.findApplicationById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (req.user.role !== 'admin' && req.user.id !== application.user_id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    res.json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
}

async function getMyApplications(req, res, next) {
  try {
    const applications = await applicationModel.listApplicationsForUser(req.user.id);
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
}

async function reviewApplication(req, res, next) {
  try {
    const { status, rejectionReason, reviewNotes } = req.body || {};

    if (status === 'rejected' && !String(rejectionReason || '').trim()) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required for rejected applications' });
    }

    const updatedApplication = await applicationModel.reviewApplication({
      applicationId: req.params.id,
      status,
      adminUserId: req.user.id,
      rejectionReason: normalizeOptionalText(rejectionReason),
      reviewNotes: normalizeOptionalText(reviewNotes),
    });

    res.json({ success: true, data: updatedApplication });
  } catch (error) {
    const statusCode = error.message === 'Application not found' ? 404 : 400;
    res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function approveShopOwnerRequest(req, res, next) {
  try {
    const updatedApplication = await applicationModel.reviewApplication({
      applicationId: req.params.id,
      status: 'approved',
      adminUserId: req.user.id,
      rejectionReason: null,
      reviewNotes: normalizeOptionalText(req.body?.reviewNotes),
    });

    res.json({ success: true, data: updatedApplication });
  } catch (error) {
    const statusCode = error.message === 'Application not found' ? 404 : 400;
    res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function rejectShopOwnerRequest(req, res, next) {
  try {
    const rejectionReason = normalizeOptionalText(req.body?.rejectionReason || req.body?.reason);
    if (!rejectionReason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    const updatedApplication = await applicationModel.reviewApplication({
      applicationId: req.params.id,
      status: 'rejected',
      adminUserId: req.user.id,
      rejectionReason,
      reviewNotes: normalizeOptionalText(req.body?.reviewNotes),
    });

    res.json({ success: true, data: updatedApplication });
  } catch (error) {
    const statusCode = error.message === 'Application not found' ? 404 : 400;
    res.status(statusCode).json({ success: false, error: error.message });
  }
}

async function uploadShopOwnerImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Image file is required' });
    }

    const host = req.get('host');
    const protocol = req.protocol || 'http';
    const fileUrl = `${protocol}://${host}/uploads/application-media/${req.file.filename}`;

    res.status(201).json({
      success: true,
      data: {
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        fileUrl,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registerCustomer,
  submitShopOwnerApplication,
  submitDriverApplication,
  getPendingApplications,
  getPendingShopOwnerRequests,
  getApplicationById,
  getMyApplications,
  reviewApplication,
  approveShopOwnerRequest,
  rejectShopOwnerRequest,
  uploadShopOwnerImage,
};
