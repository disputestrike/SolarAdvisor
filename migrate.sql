-- SolarAdvisor MySQL Migration Script
-- Run this against your Railway MySQL instance
-- mysql -h HOST -P PORT -u USER -p DATABASE < migrate.sql

SET FOREIGN_KEY_CHECKS = 0;

-- ─── Leads ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `leads` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `contact_preference` ENUM('sms','call','email') DEFAULT 'call',

  `zip_code` VARCHAR(10) NOT NULL,
  `street_address` VARCHAR(255) NULL,
  `formatted_address` TEXT NULL,
  `latitude` DECIMAL(10,7) NULL,
  `longitude` DECIMAL(10,7) NULL,
  `place_id` VARCHAR(255) NULL,
  `utility_provider` VARCHAR(255) NULL,
  `building_type` VARCHAR(32) NULL,
  `stories` VARCHAR(32) NULL,
  `state` VARCHAR(2),
  `city` VARCHAR(100),
  `is_homeowner` BOOLEAN NOT NULL,
  `monthly_bill` INT NOT NULL,
  `roof_type` VARCHAR(50),
  `roof_slope` ENUM('flat','low','medium','steep'),
  `shading_level` ENUM('none','light','moderate','heavy'),
  `is_decision_maker` BOOLEAN DEFAULT TRUE,

  `estimated_system_kw` DECIMAL(5,2),
  `estimated_panels` INT,
  `estimated_monthly_savings` INT,
  `estimated_annual_savings` INT,
  `estimated_roi` DECIMAL(5,2),
  `preferred_financing` ENUM('lease','loan','cash','undecided'),

  `score` INT NOT NULL DEFAULT 0,
  `tier` ENUM('hot','medium','cold') NOT NULL DEFAULT 'cold',

  `status` ENUM('new','contacted','appointment_set','quoted','converted','lost','sold') DEFAULT 'new',
  `assigned_to` VARCHAR(100),
  `appointment_at` TIMESTAMP NULL,
  `notes` TEXT,

  `sold_at` TIMESTAMP NULL,
  `sold_price` INT,
  `sold_to` VARCHAR(255),
  `commission_earned` INT,

  `utm_source` VARCHAR(100),
  `utm_medium` VARCHAR(100),
  `utm_campaign` VARCHAR(100),
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `referrer` TEXT,

  `consent_given` BOOLEAN DEFAULT TRUE,
  `consent_text` TEXT,

  `webhook_sent` BOOLEAN DEFAULT FALSE,
  `webhook_sent_at` TIMESTAMP NULL,
  `webhook_response` TEXT,

  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `email_idx` (`email`),
  INDEX `zip_idx` (`zip_code`),
  INDEX `tier_idx` (`tier`),
  INDEX `status_idx` (`status`),
  INDEX `created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Lead Activity ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `lead_activity` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `type` ENUM('created','status_changed','sms_sent','email_sent','call_made','appointment_set','note_added','webhook_sent','sold') NOT NULL,
  `description` TEXT,
  `metadata` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `lead_id_idx` (`lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drip Messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `drip_messages` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `channel` ENUM('sms','email') NOT NULL,
  `sequence_step` INT NOT NULL DEFAULT 1,
  `scheduled_at` TIMESTAMP NOT NULL,
  `sent_at` TIMESTAMP NULL,
  `status` ENUM('pending','sent','failed','skipped') DEFAULT 'pending',
  `content` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `lead_id_idx` (`lead_id`),
  INDEX `scheduled_idx` (`scheduled_at`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Admin Users ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100),
  `role` ENUM('superadmin','admin','viewer') DEFAULT 'viewer',
  `last_login_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── State Incentives ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `state_incentives` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `state` VARCHAR(2) NOT NULL UNIQUE,
  `state_name` VARCHAR(50),
  `net_metering_available` BOOLEAN DEFAULT TRUE,
  `state_rebate` INT DEFAULT 0,
  `srec_available` BOOLEAN DEFAULT FALSE,
  `additional_incentives` TEXT,
  `avg_electricity_cost` DECIMAL(5,4),
  `avg_sun_hours` DECIMAL(4,2),
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Zip Cache ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `zip_cache` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `zip_code` VARCHAR(10) NOT NULL UNIQUE,
  `city` VARCHAR(100),
  `state` VARCHAR(2),
  `lat` DECIMAL(10,7),
  `lng` DECIMAL(10,7),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Seed: State Incentives ───────────────────────────────────────────────────
INSERT IGNORE INTO `state_incentives` (`state`, `state_name`, `net_metering_available`, `state_rebate`, `srec_available`, `avg_electricity_cost`, `avg_sun_hours`) VALUES
('AL','Alabama',TRUE,0,FALSE,0.1279,4.50),
('AK','Alaska',TRUE,0,FALSE,0.2277,3.99),
('AZ','Arizona',TRUE,1000,FALSE,0.1237,6.57),
('AR','Arkansas',TRUE,0,FALSE,0.1020,4.67),
('CA','California',TRUE,2000,FALSE,0.2218,5.82),
('CO','Colorado',TRUE,500,FALSE,0.1263,5.37),
('CT','Connecticut',TRUE,0,TRUE,0.2099,4.67),
('DE','Delaware',TRUE,0,TRUE,0.1291,4.67),
('FL','Florida',TRUE,0,FALSE,0.1271,5.67),
('GA','Georgia',TRUE,0,FALSE,0.1264,5.02),
('HI','Hawaii',TRUE,0,FALSE,0.3278,5.59),
('ID','Idaho',TRUE,0,FALSE,0.1021,4.92),
('IL','Illinois',TRUE,0,TRUE,0.1292,4.68),
('IN','Indiana',TRUE,0,FALSE,0.1280,4.55),
('IA','Iowa',TRUE,0,FALSE,0.1100,4.61),
('KS','Kansas',TRUE,0,FALSE,0.1168,5.00),
('KY','Kentucky',TRUE,0,FALSE,0.1151,4.44),
('LA','Louisiana',TRUE,0,FALSE,0.1012,5.00),
('ME','Maine',TRUE,0,FALSE,0.1690,4.50),
('MD','Maryland',TRUE,1000,TRUE,0.1407,4.50),
('MA','Massachusetts',TRUE,1000,TRUE,0.2181,4.28),
('MI','Michigan',TRUE,0,FALSE,0.1666,4.21),
('MN','Minnesota',TRUE,0,FALSE,0.1302,4.53),
('MS','Mississippi',TRUE,0,FALSE,0.1228,5.00),
('MO','Missouri',TRUE,0,FALSE,0.1132,4.73),
('MT','Montana',TRUE,0,FALSE,0.1175,5.13),
('NE','Nebraska',TRUE,0,FALSE,0.1095,4.81),
('NV','Nevada',TRUE,2600,FALSE,0.1123,6.41),
('NH','New Hampshire',TRUE,0,FALSE,0.2117,4.39),
('NJ','New Jersey',TRUE,0,TRUE,0.1704,4.55),
('NM','New Mexico',TRUE,6000,FALSE,0.1309,6.77),
('NY','New York',TRUE,5000,TRUE,0.1885,4.36),
('NC','North Carolina',TRUE,0,FALSE,0.1182,5.00),
('ND','North Dakota',TRUE,0,FALSE,0.1107,4.78),
('OH','Ohio',TRUE,0,FALSE,0.1390,4.15),
('OK','Oklahoma',TRUE,0,FALSE,0.1105,5.21),
('OR','Oregon',TRUE,0,FALSE,0.1132,4.22),
('PA','Pennsylvania',TRUE,0,TRUE,0.1421,4.25),
('RI','Rhode Island',TRUE,0,TRUE,0.2299,4.29),
('SC','South Carolina',TRUE,0,FALSE,0.1398,5.00),
('SD','South Dakota',TRUE,0,FALSE,0.1211,4.81),
('TN','Tennessee',TRUE,0,FALSE,0.1243,4.73),
('TX','Texas',TRUE,0,FALSE,0.1196,5.79),
('UT','Utah',TRUE,400,FALSE,0.1023,5.26),
('VT','Vermont',TRUE,0,FALSE,0.1944,4.00),
('VA','Virginia',TRUE,0,FALSE,0.1285,4.72),
('WA','Washington',TRUE,0,FALSE,0.1038,3.57),
('WV','West Virginia',TRUE,0,FALSE,0.1288,4.08),
('WI','Wisconsin',TRUE,0,FALSE,0.1510,4.29),
('WY','Wyoming',TRUE,0,FALSE,0.1116,5.37);

-- ─── Seed: Default Admin ──────────────────────────────────────────────────────
-- Password: Admin@Solar2024! (change immediately after first login)
-- Hash generated with bcrypt rounds=12
INSERT IGNORE INTO `admin_users` (`email`, `password_hash`, `name`, `role`) VALUES
('admin@solaradvisor.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaXimFruVkSdSF0O.EE.4IXSW', 'Admin', 'superadmin');

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration complete.' AS status;
