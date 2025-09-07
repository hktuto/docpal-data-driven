module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/poc-test.ts'],
  testTimeout: 30000, // 30 seconds for workflow tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'development/poc-*.ts',
    '!development/poc-test.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
