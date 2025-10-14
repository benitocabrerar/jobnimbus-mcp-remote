/**
 * Global test setup
 * Runs before all tests
 */

export {}; // Make this file a module

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JOBNIMBUS_BASE_URL = 'https://api.jobnimbus.com/api1';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(), // Suppress console.log
  debug: jest.fn(), // Suppress console.debug
  info: jest.fn(), // Suppress console.info
  warn: console.warn, // Keep warnings
  error: console.error, // Keep errors
};

// Add custom matchers if needed
expect.extend({
  toBeValidTimestamp(received: number) {
    const pass = typeof received === 'number' && received > 0;
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid timestamp`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid timestamp`,
        pass: false,
      };
    }
  },
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTimestamp(): R;
    }
  }
}
