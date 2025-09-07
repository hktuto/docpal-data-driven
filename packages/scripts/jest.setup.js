// Jest setup for Temporal workflow tests
// This file runs before each test suite

// Increase timeout for workflow tests
jest.setTimeout(30000);

// Mock console methods to reduce test output noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Only show errors in tests, suppress info logs
  console.log = jest.fn();
  console.error = originalConsoleError;
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
