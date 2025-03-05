module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/routes/__tests__/**/*.test.ts'],
  globals: {
    NODE_ENV: 'test'
  },
  transform: {
    '^.+\\.ts$': 'ts-jest'
  }
};