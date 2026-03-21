#!/usr/bin/env node
/**
 * Next standalone uses process.env.HOSTNAME for the bind address.
 * Railway/Docker set HOSTNAME to the container hostname (e.g. ffc3bd32d8b0),
 * so the server does not listen on 0.0.0.0 and platform healthchecks fail.
 * Force IPv4 all-interfaces bind before starting the standalone server.
 */
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const server = path.join(root, ".next", "standalone", "server.js");

process.env.HOSTNAME = "0.0.0.0";

const child = spawn(process.execPath, [server], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code == null ? 1 : code);
});
