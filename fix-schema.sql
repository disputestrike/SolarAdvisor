-- SolarAdvisor — Schema repair
-- Run this in Railway MySQL → Database → Data tab query box
-- Safe to run multiple times (uses IF NOT EXISTS / IGNORE errors)

SET FOREIGN_KEY_CHECKS = 0;

-- Drop and recreate leads table with full schema
DROP TABLE IF EXISTS `leads`;

CREATE TABLE `leads` (
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
  `consent_given` BOOLEAN DEFAULT FALSE,
  `consent_text` TEXT,
  `webhook_sent` BOOLEAN DEFAULT FALSE,
  `webhook_sent_at` TIMESTAMP NULL,
  `webhook_response` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- lead_activity
CREATE TABLE IF NOT EXISTS `lead_activity` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `description` TEXT,
  `metadata` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_lead_activity_lead_id` (`lead_id`)
);

-- drip_messages
CREATE TABLE IF NOT EXISTS `drip_messages` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `channel` ENUM('sms','email') NOT NULL,
  `sequence_step` INT NOT NULL DEFAULT 1,
  `scheduled_at` TIMESTAMP NOT NULL,
  `sent_at` TIMESTAMP NULL,
  `status` ENUM('pending','sent','failed','skipped') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_drip_lead_id` (`lead_id`),
  INDEX `idx_drip_scheduled` (`scheduled_at`, `status`)
);

-- admin_users
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('superadmin','admin','viewer') DEFAULT 'admin',
  `last_login` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- state_incentives
CREATE TABLE IF NOT EXISTS `state_incentives` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `state` VARCHAR(2) NOT NULL UNIQUE,
  `net_metering` BOOLEAN DEFAULT TRUE,
  `state_rebate` INT DEFAULT 0,
  `srec_market` BOOLEAN DEFAULT FALSE,
  `avg_sun_hours` DECIMAL(4,2) DEFAULT 5.00,
  `avg_electricity_cost` DECIMAL(6,4) DEFAULT 0.1300,
  `notes` TEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- zip_cache
CREATE TABLE IF NOT EXISTS `zip_cache` (
  `zip_code` VARCHAR(10) NOT NULL PRIMARY KEY,
  `city` VARCHAR(100),
  `state` VARCHAR(2),
  `lat` DECIMAL(10,7),
  `lng` DECIMAL(10,7),
  `cached_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET FOREIGN_KEY_CHECKS = 1;

-- Seed state incentives (all 50 states)
INSERT IGNORE INTO `state_incentives` (`state`, `net_metering`, `state_rebate`, `srec_market`, `avg_sun_hours`, `avg_electricity_cost`) VALUES
('AL',1,0,0,5.30,0.1300),('AK',1,0,0,3.50,0.2200),('AZ',1,1000,0,6.50,0.1200),
('AR',1,0,0,5.20,0.1000),('CA',1,2000,0,5.80,0.2500),('CO',1,500,0,5.80,0.1200),
('CT',1,0,1,4.50,0.2300),('DE',1,0,1,4.60,0.1300),('FL',1,0,0,5.50,0.1200),
('GA',1,0,0,5.20,0.1200),('HI',1,0,0,5.90,0.3300),('ID',1,0,0,4.80,0.1000),
('IL',1,0,1,4.50,0.1200),('IN',1,0,0,4.60,0.1100),('IA',1,0,0,4.60,0.1100),
('KS',1,0,0,5.20,0.1100),('KY',1,0,0,4.60,0.1100),('LA',1,0,0,5.40,0.1000),
('ME',1,0,0,4.50,0.1800),('MD',1,0,1,4.70,0.1400),('MA',1,0,1,4.50,0.2200),
('MI',1,0,0,4.30,0.1600),('MN',1,0,0,4.50,0.1300),('MS',1,0,0,5.20,0.1100),
('MO',1,0,0,4.90,0.1100),('MT',1,0,0,4.90,0.1100),('NE',1,0,0,5.00,0.1000),
('NV',1,0,0,6.40,0.1100),('NH',1,0,0,4.40,0.1900),('NJ',1,0,1,4.60,0.1600),
('NM',1,1000,0,6.40,0.1300),('NY',1,0,1,4.50,0.1900),('NC',1,0,0,5.10,0.1100),
('ND',1,0,0,4.80,0.1000),('OH',1,0,1,4.40,0.1300),('OK',1,0,0,5.60,0.1000),
('OR',1,0,0,4.40,0.1100),('PA',1,0,1,4.50,0.1400),('RI',1,0,1,4.40,0.2200),
('SC',1,0,0,5.10,0.1300),('SD',1,0,0,5.00,0.1100),('TN',1,0,0,4.90,0.1100),
('TX',1,0,0,5.50,0.1200),('UT',1,0,0,5.70,0.1000),('VT',1,0,1,4.40,0.1900),
('VA',1,0,0,4.80,0.1200),('WA',1,0,0,4.00,0.1000),('WV',1,0,0,4.40,0.1100),
('WI',1,0,0,4.40,0.1400),('WY',1,0,0,5.30,0.1000),('DC',1,0,1,4.70,0.1400);

-- Default admin user (password: Admin@Solar2024!)
INSERT IGNORE INTO `admin_users` (`email`, `password_hash`, `role`) VALUES
('admin@solaradvisor.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaXimFruVkSdSF0O.EE.4IXSW', 'superadmin');
