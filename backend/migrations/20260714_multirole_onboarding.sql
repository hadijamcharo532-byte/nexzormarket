ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

CREATE TABLE IF NOT EXISTS user_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  application_type ENUM('shop_owner','driver') NOT NULL,
  status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  review_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_applications_user (user_id),
  KEY idx_user_applications_status (status),
  CONSTRAINT fk_user_applications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_applications_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shop_owner_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL,
  shop_name VARCHAR(150) NOT NULL,
  shop_category VARCHAR(100) NOT NULL,
  shop_description TEXT NULL,
  shop_logo_url TEXT NULL,
  product_categories JSON NULL,
  shop_location VARCHAR(255) NULL,
  region VARCHAR(120) NULL,
  district VARCHAR(120) NULL,
  address VARCHAR(255) NOT NULL,
  business_phone VARCHAR(50) NULL,
  national_id VARCHAR(100) NULL,
  business_registration VARCHAR(255) NULL,
  status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shop_owner_profiles_application (application_id),
  KEY idx_shop_owner_profiles_user (user_id),
  CONSTRAINT fk_shop_owner_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_owner_profiles_application FOREIGN KEY (application_id) REFERENCES user_applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS driver_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL,
  vehicle_type VARCHAR(80) NOT NULL,
  vehicle_registration_number VARCHAR(80) NOT NULL,
  driving_license_number VARCHAR(80) NOT NULL,
  operating_area VARCHAR(255) NOT NULL,
  availability_status VARCHAR(50) NOT NULL DEFAULT 'full_time',
  status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_driver_profiles_application (application_id),
  KEY idx_driver_profiles_user (user_id),
  CONSTRAINT fk_driver_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_driver_profiles_application FOREIGN KEY (application_id) REFERENCES user_applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS application_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  doc_type VARCHAR(80) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  file_url TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_application_documents_application (application_id),
  CONSTRAINT fk_application_documents_application FOREIGN KEY (application_id) REFERENCES user_applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_application_documents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS terms_acceptances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  agreement_type ENUM('shop_owner_agreement','driver_agreement') NOT NULL,
  agreement_version VARCHAR(20) NOT NULL DEFAULT 'v1',
  accepted_terms TINYINT(1) NOT NULL,
  accepted_agreement TINYINT(1) NOT NULL,
  accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_terms_acceptances_application (application_id),
  CONSTRAINT fk_terms_acceptances_application FOREIGN KEY (application_id) REFERENCES user_applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_terms_acceptances_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
