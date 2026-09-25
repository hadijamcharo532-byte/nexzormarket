const db = require('../config/database');

const APPLICATION_TYPES = {
  shop_owner: 'shop_owner',
  driver: 'driver',
};

const ALLOWED_FILE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) return [];

  return documents
    .filter((doc) => doc && typeof doc === 'object')
    .map((doc) => ({
      doc_type: String(doc.doc_type || '').trim(),
      file_name: String(doc.file_name || '').trim(),
      mime_type: String(doc.mime_type || '').trim(),
      file_size: Number(doc.file_size || 0),
      file_url: String(doc.file_url || '').trim(),
    }))
    .filter((doc) => doc.doc_type && doc.file_name && doc.mime_type && doc.file_size > 0 && doc.file_url);
}

function validateDocuments(documents) {
  for (const doc of documents) {
    if (!ALLOWED_FILE_TYPES.has(doc.mime_type)) {
      throw new Error(`Unsupported document type: ${doc.mime_type}`);
    }

    if (doc.file_size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Document ${doc.file_name} exceeds 8MB limit`);
    }
  }
}

async function submitApplication({
  userId,
  type,
  personalInfo,
  applicationData,
  agreement,
  documents,
}) {
  if (!Object.values(APPLICATION_TYPES).includes(type)) {
    throw new Error('Invalid application type');
  }

  if (!agreement?.accepted || !agreement?.accepted_terms || !agreement?.accepted_agreement) {
    throw new Error('Agreement acceptance is required');
  }

  const normalizedDocuments = normalizeDocuments(documents);
  validateDocuments(normalizedDocuments);

  const connection = await db.pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingApplicationRows] = await connection.query(
      'SELECT id, status FROM user_applications WHERE user_id = ? AND application_type = ? ORDER BY created_at DESC LIMIT 1',
      [userId, type]
    );

    if (existingApplicationRows.length && existingApplicationRows[0].status === 'pending') {
      throw new Error('You already have a pending application');
    }

    await connection.query(
      `UPDATE users
       SET full_name = ?, phone = ?, avatar_url = COALESCE(?, avatar_url), account_status = ?, rejection_reason = NULL, updated_at = NOW()
       WHERE id = ?`,
      [personalInfo.full_name, personalInfo.phone || null, personalInfo.profile_photo_url || null, 'pending', userId]
    );

    const [applicationInsert] = await connection.query(
      `INSERT INTO user_applications (user_id, application_type, status, submitted_at)
       VALUES (?, ?, 'pending', NOW())`,
      [userId, type]
    );

    const applicationId = applicationInsert.insertId;

    await connection.query(
      `INSERT INTO terms_acceptances
       (application_id, user_id, agreement_type, agreement_version, accepted_terms, accepted_agreement, accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [applicationId, userId, agreement.type, agreement.version || 'v1', 1, 1]
    );

    if (type === APPLICATION_TYPES.shop_owner) {
      await connection.query(
        `INSERT INTO shop_owner_profiles
        (user_id, application_id, shop_name, shop_category, shop_description, shop_logo_url, product_categories, shop_location, region, district, address, business_phone, national_id, business_registration, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          userId,
          applicationId,
          applicationData.shop_name,
          applicationData.shop_category,
          applicationData.shop_description || null,
          applicationData.shop_logo_url || null,
          JSON.stringify(applicationData.product_categories || []),
          applicationData.shop_location || null,
          applicationData.region || null,
          applicationData.district || null,
          applicationData.address,
          applicationData.business_phone || null,
          applicationData.national_id || null,
          applicationData.business_registration || null,
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO driver_profiles
        (user_id, application_id, vehicle_type, vehicle_registration_number, driving_license_number, operating_area, availability_status, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          userId,
          applicationId,
          applicationData.vehicle_type,
          applicationData.vehicle_registration_number,
          applicationData.driving_license_number,
          applicationData.operating_area,
          applicationData.availability_status || 'full_time',
        ]
      );
    }

    for (const doc of normalizedDocuments) {
      await connection.query(
        `INSERT INTO application_documents
         (application_id, user_id, doc_type, file_name, mime_type, file_size, file_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [applicationId, userId, doc.doc_type, doc.file_name, doc.mime_type, doc.file_size, doc.file_url]
      );
    }

    await connection.commit();
    return findApplicationById(applicationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findApplicationById(applicationId) {
  const applicationResult = await db.query(
    `SELECT a.*, u.full_name, u.email, u.phone, u.account_status, u.avatar_url
     FROM user_applications a
     JOIN users u ON u.id = a.user_id
     WHERE a.id = ?`,
    [applicationId]
  );

  const application = applicationResult.rows[0] || null;
  if (!application) return null;

  const docsResult = await db.query(
    'SELECT id, doc_type, file_name, mime_type, file_size, file_url, created_at FROM application_documents WHERE application_id = ? ORDER BY created_at DESC',
    [applicationId]
  );

  let roleProfile = null;

  if (application.application_type === APPLICATION_TYPES.shop_owner) {
    const profileResult = await db.query('SELECT * FROM shop_owner_profiles WHERE application_id = ?', [applicationId]);
    roleProfile = profileResult.rows[0] || null;
    if (roleProfile?.product_categories) {
      try {
        roleProfile.product_categories = JSON.parse(roleProfile.product_categories);
      } catch (_error) {
        roleProfile.product_categories = [];
      }
    }
  } else if (application.application_type === APPLICATION_TYPES.driver) {
    const profileResult = await db.query('SELECT * FROM driver_profiles WHERE application_id = ?', [applicationId]);
    roleProfile = profileResult.rows[0] || null;
  }

  const termsResult = await db.query(
    'SELECT agreement_type, agreement_version, accepted_terms, accepted_agreement, accepted_at FROM terms_acceptances WHERE application_id = ? ORDER BY accepted_at DESC LIMIT 1',
    [applicationId]
  );

  return {
    ...application,
    documents: docsResult.rows,
    profile: roleProfile,
    terms: termsResult.rows[0] || null,
  };
}

async function listPendingApplications() {
  const result = await db.query(
    `SELECT
      a.id,
      a.user_id,
      a.application_type,
      a.status,
      a.submitted_at,
      u.full_name,
      u.phone,
      u.email,
      sp.shop_name,
      sp.shop_location,
      dp.vehicle_type,
      dp.vehicle_registration_number,
      dp.operating_area
    FROM user_applications a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN shop_owner_profiles sp ON sp.application_id = a.id
    LEFT JOIN driver_profiles dp ON dp.application_id = a.id
    WHERE a.status = 'pending'
    ORDER BY a.submitted_at ASC`
  );

  return result.rows;
}

async function listPendingShopOwnerApplications() {
  const result = await db.query(
    `SELECT
      a.id,
      a.user_id,
      a.application_type,
      a.status,
      a.submitted_at,
      u.full_name,
      u.phone,
      u.email,
      sp.shop_name,
      sp.shop_location,
      sp.region,
      sp.district,
      sp.address,
      sp.business_phone
    FROM user_applications a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN shop_owner_profiles sp ON sp.application_id = a.id
    WHERE a.status = 'pending' AND a.application_type = 'shop_owner'
    ORDER BY a.submitted_at ASC`
  );

  return result.rows;
}

async function listApplicationsForUser(userId) {
  const result = await db.query(
    `SELECT id, user_id, application_type, status, submitted_at, reviewed_at, review_notes, rejection_reason
     FROM user_applications
     WHERE user_id = ?
     ORDER BY submitted_at DESC`,
    [userId]
  );

  return result.rows;
}

async function reviewApplication({ applicationId, status, adminUserId, rejectionReason, reviewNotes }) {
  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    throw new Error('Invalid review status');
  }

  const connection = await db.pool.getConnection();

  try {
    await connection.beginTransaction();

    const [applicationRows] = await connection.query(
      'SELECT id, user_id, application_type, status FROM user_applications WHERE id = ? FOR UPDATE',
      [applicationId]
    );

    if (!applicationRows.length) {
      throw new Error('Application not found');
    }

    const application = applicationRows[0];

    await connection.query(
      `UPDATE user_applications
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?, review_notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [status, adminUserId, rejectionReason || null, reviewNotes || null, applicationId]
    );

    await connection.query(
      'UPDATE users SET account_status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      [status, rejectionReason || null, application.user_id]
    );

    if (application.application_type === APPLICATION_TYPES.shop_owner && status === 'approved') {
      await connection.query(
        'UPDATE users SET role_id = 2, updated_at = NOW() WHERE id = ?',
        [application.user_id]
      );

      await connection.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read)
         VALUES (?, 'approval', ?, ?, 0)`,
        [
          application.user_id,
          'Shop Owner Approval',
          'Hongera! Umepitishwa kuwa Shop Owner kwenye NEXZOR MARKET. Sasa unaweza kuanza kuuza bidhaa zako.',
        ]
      );
    }

    if (application.application_type === APPLICATION_TYPES.shop_owner) {
      await connection.query('UPDATE shop_owner_profiles SET status = ?, updated_at = NOW() WHERE application_id = ?', [status, applicationId]);
    }

    if (application.application_type === APPLICATION_TYPES.driver) {
      await connection.query('UPDATE driver_profiles SET status = ?, updated_at = NOW() WHERE application_id = ?', [status, applicationId]);
    }

    await connection.commit();
    return findApplicationById(applicationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  APPLICATION_TYPES,
  submitApplication,
  findApplicationById,
  listPendingApplications,
  listPendingShopOwnerApplications,
  listApplicationsForUser,
  reviewApplication,
};
