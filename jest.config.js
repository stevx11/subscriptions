/**
 * Tests cover src/domain only — it is pure TypeScript with no React or
 * react-native imports, so it runs under plain ts-jest on Windows with no
 * native toolchain. That is the whole reason the money and date logic lives
 * there: it is the part that must be correct, and this is the only place it
 * can actually be verified.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/domain'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', target: 'es2022' } }],
  },
};
