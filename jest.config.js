/**
 * Tests cover the pure layers only: domain logic, the brand catalogue and
 * migrations, colour maths, and form validation. None of those import React or
 * react-native, so they run under plain ts-jest on Windows with no native
 * toolchain — which is the entire reason the logic that must be correct lives
 * outside components.
 *
 * A module that imports react-native does not belong under these roots.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>/src/domain',
    '<rootDir>/src/data',
    '<rootDir>/src/ui',
    '<rootDir>/src/features',
  ],
  testMatch: ['**/*.test.ts'],
  // Mirrors the "@/*" alias from tsconfig.json so tests resolve imports the
  // same way the bundler does.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', target: 'es2022' } }],
  },
};
