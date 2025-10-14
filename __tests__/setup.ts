/**
 * Global Jest Setup
 * FASE 0: Testing Infrastructure
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JOBNIMBUS_BASE_URL = 'https://app.jobnimbus.com/api1';
process.env.LOG_LEVEL = 'error';

// Suppress expected console warnings in tests
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Not implemented') || args[0].includes('deprecated'))
    ) {
      return;
    }
    originalConsoleWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.warn = originalConsoleWarn;
});
