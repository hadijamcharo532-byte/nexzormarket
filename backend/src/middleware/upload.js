const fs = require('fs');
const path = require('path');
const multer = require('multer');

const PRODUCT_MEDIA_UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads', 'product-media');
const APPLICATION_UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads', 'application-media');

const ALLOWED_PRODUCT_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
]);

const ALLOWED_APPLICATION_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const PRODUCT_MEDIA_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const APPLICATION_IMAGE_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function ensureUploadDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFileName(name = '') {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 140);
}

function createStorage(uploadRoot) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDir(uploadRoot);
      cb(null, uploadRoot);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '';
      const base = sanitizeFileName(path.basename(file.originalname || 'file', ext));
      const safeExt = ext.toLowerCase();
      const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      cb(null, `${base}-${uniqueSuffix}${safeExt}`);
    },
  });
}

function createFileFilter(allowedMimeTypes) {
  return (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error(`Unsupported file format: ${file.mimetype}`));
    }

    cb(null, true);
  };
}

const upload = multer({
  storage: createStorage(PRODUCT_MEDIA_UPLOAD_ROOT),
  fileFilter: createFileFilter(ALLOWED_PRODUCT_MEDIA_MIME_TYPES),
  limits: {
    fileSize: PRODUCT_MEDIA_MAX_FILE_SIZE_BYTES,
    files: 10,
  },
});

const onboardingImageUpload = multer({
  storage: createStorage(APPLICATION_UPLOAD_ROOT),
  fileFilter: createFileFilter(ALLOWED_APPLICATION_IMAGE_MIME_TYPES),
  limits: {
    fileSize: APPLICATION_IMAGE_MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

module.exports = {
  upload,
  onboardingImageUpload,
  ALLOWED_PRODUCT_MEDIA_MIME_TYPES,
  PRODUCT_MEDIA_MAX_FILE_SIZE_BYTES,
  ALLOWED_APPLICATION_IMAGE_MIME_TYPES,
  APPLICATION_IMAGE_MAX_FILE_SIZE_BYTES,
};
