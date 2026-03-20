-- Run on existing SolarAdvisor MySQL (e.g. Railway) once:
-- mysql ... < migrate_lead_address_utility.sql

ALTER TABLE `leads`
  ADD COLUMN `street_address` VARCHAR(255) NULL AFTER `zip_code`,
  ADD COLUMN `formatted_address` TEXT NULL AFTER `street_address`,
  ADD COLUMN `latitude` DECIMAL(10,7) NULL AFTER `formatted_address`,
  ADD COLUMN `longitude` DECIMAL(10,7) NULL AFTER `latitude`,
  ADD COLUMN `place_id` VARCHAR(255) NULL AFTER `longitude`,
  ADD COLUMN `utility_provider` VARCHAR(255) NULL AFTER `place_id`,
  ADD COLUMN `building_type` VARCHAR(32) NULL AFTER `utility_provider`,
  ADD COLUMN `stories` VARCHAR(32) NULL AFTER `building_type`;
