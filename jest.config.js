/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^next/headers$": "<rootDir>/src/__mocks__/next-headers.ts",
    // Redirect jose to our CJS-compatible shim
    "^jose$": "<rootDir>/src/__mocks__/jose.ts",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: ["src/lib/**/*.ts", "src/db/**/*.ts"],
};

module.exports = config;
