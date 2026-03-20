#!/usr/bin/env node
/**
 * SolarAdvisor Admin Seeder
 * Creates or resets the superadmin user.
 *
 * Usage:
 *   node scripts/seed-admin.mjs
 *   node scripts/seed-admin.mjs admin@yourdomain.com "YourSecurePass123!"
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load env
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const email = process.argv[2] || "admin@solaradvisor.com";
const passwordArg = process.argv[3];

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("\n☀  SolarAdvisor Admin Seeder\n");

  let password = passwordArg;
  if (!password) {
    password = await prompt(`Password for ${email}: `);
  }

  if (!password || password.length < 8) {
    console.error("✗ Password must be at least 8 characters");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    database: process.env.MYSQL_DATABASE || "solaradvisor",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const conn = await pool.getConnection();

    // Upsert admin
    await conn.execute(
      `INSERT INTO admin_users (email, password_hash, name, role)
       VALUES (?, ?, 'Admin', 'superadmin')
       ON DUPLICATE KEY UPDATE password_hash = ?, role = 'superadmin'`,
      [email, hash, hash]
    );

    conn.release();
    await pool.end();

    console.log(`✓ Admin user ready: ${email}`);
    console.log(`✓ Password set (bcrypt rounds=12)`);
    console.log(`\n  Login at: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin\n`);
  } catch (err) {
    console.error("✗ Database error:", err.message);
    console.error("  Make sure the DB is running and migrate.sql has been applied.");
    process.exit(1);
  }
}

main();
