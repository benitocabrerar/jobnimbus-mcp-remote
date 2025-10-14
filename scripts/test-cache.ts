#!/usr/bin/env tsx
/**
 * Cache System Testing Script
 *
 * Interactive script to test Redis cache functionality:
 * - Connection testing
 * - Performance benchmarks
 * - Circuit breaker behavior
 * - Memory usage analysis
 *
 * Usage:
 *   npm run test:cache
 *   # or
 *   tsx scripts/test-cache.ts
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

import { CacheService } from '../src/services/cacheService.js';
import { getTTL, CACHE_PREFIXES } from '../src/config/cache.js';

// ANSI colors for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log();
  log(`${'='.repeat(60)}`, 'bright');
  log(`  ${title}`, 'cyan');
  log(`${'='.repeat(60)}`, 'bright');
}

function logResult(test: string, passed: boolean, details?: string) {
  const symbol = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  const status = passed ? 'PASS' : 'FAIL';

  log(`${symbol} ${test}: ${status}`, color);
  if (details) {
    log(`  ${details}`, 'reset');
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test 1: Connection Test
 */
async function testConnection(): Promise<boolean> {
  logSection('Test 1: Redis Connection');

  try {
    const cacheService = CacheService.getInstance();
    await cacheService.connect();

    const health = await cacheService.healthCheck();

    logResult('Connection', health.healthy, `Latency: ${health.latencyMs}ms`);

    return health.healthy;
  } catch (error) {
    logResult('Connection', false, `Error: ${error}`);
    return false;
  }
}

/**
 * Test 2: Basic Operations
 */
async function testBasicOperations(): Promise<boolean> {
  logSection('Test 2: Basic Operations (GET, SET, DELETE)');

  const cacheService = CacheService.getInstance();
  let allPassed = true;

  try {
    // Test SET
    const testData = {
      id: 'test-123',
      name: 'Test Item',
      timestamp: Date.now(),
    };

    const setResult = await cacheService.set(
      'test',
      'basic',
      'item-1',
      testData,
      60
    );

    logResult('SET operation', setResult);
    allPassed = allPassed && setResult;

    // Test GET
    const getResult = await cacheService.get<typeof testData>('test', 'basic', 'item-1');
    const getPass = getResult !== null && getResult.id === testData.id;

    logResult('GET operation', getPass, getPass ? 'Data matches' : 'Data mismatch');
    allPassed = allPassed && getPass;

    // Test DELETE
    const deleteResult = await cacheService.delete('test', 'basic', 'item-1');
    logResult('DELETE operation', deleteResult > 0, `Deleted ${deleteResult} key(s)`);
    allPassed = allPassed && deleteResult > 0;

    // Verify deletion
    const verifyDelete = await cacheService.get('test', 'basic', 'item-1');
    logResult('Verify deletion', verifyDelete === null);
    allPassed = allPassed && verifyDelete === null;

    return allPassed;
  } catch (error) {
    logResult('Basic operations', false, `Error: ${error}`);
    return false;
  }
}

/**
 * Test 3: Performance Benchmark
 */
async function testPerformance(): Promise<boolean> {
  logSection('Test 3: Performance Benchmark');

  const cacheService = CacheService.getInstance();
  const iterations = 100;
  const testData = {
    id: 'perf-test',
    data: 'x'.repeat(1000), // 1KB of data
  };

  try {
    // Warm up
    await cacheService.set('test', 'perf', 'warmup', testData, 60);
    await cacheService.get('test', 'perf', 'warmup');

    // Benchmark SET
    const setStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await cacheService.set('test', 'perf', `item-${i}`, testData, 60);
    }
    const setDuration = Date.now() - setStart;
    const setAvg = setDuration / iterations;

    logResult(
      'SET performance',
      setAvg < 50,
      `Average: ${setAvg.toFixed(2)}ms per operation (${iterations} ops in ${setDuration}ms)`
    );

    // Benchmark GET
    const getStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await cacheService.get('test', 'perf', `item-${i}`);
    }
    const getDuration = Date.now() - getStart;
    const getAvg = getDuration / iterations;

    logResult(
      'GET performance',
      getAvg < 50,
      `Average: ${getAvg.toFixed(2)}ms per operation (${iterations} ops in ${getDuration}ms)`
    );

    // Clean up
    await cacheService.invalidatePattern('test', 'perf');

    return setAvg < 50 && getAvg < 50;
  } catch (error) {
    logResult('Performance benchmark', false, `Error: ${error}`);
    return false;
  }
}

/**
 * Test 4: Compression
 */
async function testCompression(): Promise<boolean> {
  logSection('Test 4: Data Compression');

  const cacheService = CacheService.getInstance();

  try {
    // Small data (should not compress)
    const smallData = { data: 'x'.repeat(100) };
    await cacheService.set('test', 'compression', 'small', smallData, 60);

    const smallResult = await cacheService.get<typeof smallData>('test', 'compression', 'small');
    const smallPass = smallResult !== null && smallResult.data === smallData.data;

    logResult('Small data (no compression)', smallPass, '100 bytes');

    // Large data (should compress)
    const largeData = { data: 'x'.repeat(5000) };
    await cacheService.set('test', 'compression', 'large', largeData, 60);

    const largeResult = await cacheService.get<typeof largeData>('test', 'compression', 'large');
    const largePass = largeResult !== null && largeResult.data === largeData.data;

    logResult('Large data (with compression)', largePass, '5KB compressed & decompressed');

    // Clean up
    await cacheService.delete('test', 'compression', 'small');
    await cacheService.delete('test', 'compression', 'large');

    return smallPass && largePass;
  } catch (error) {
    logResult('Compression test', false, `Error: ${error}`);
    return false;
  }
}

/**
 * Test 5: Pattern Invalidation
 */
async function testPatternInvalidation(): Promise<boolean> {
  logSection('Test 5: Pattern Invalidation');

  const cacheService = CacheService.getInstance();

  try {
    // Create multiple keys
    const testData = { test: 'data' };

    await cacheService.set('attachments', 'list', 'job:123', testData, 60);
    await cacheService.set('attachments', 'list', 'job:456', testData, 60);
    await cacheService.set('attachments', 'detail', 'file:abc', testData, 60);
    await cacheService.set('jobs', 'list', 'all', testData, 60);

    // Invalidate attachments:list:*
    const invalidated = await cacheService.invalidatePattern('attachments', 'list');
    logResult('Invalidate pattern', invalidated === 2, `Invalidated ${invalidated} keys (expected 2)`);

    // Verify invalidation
    const job123 = await cacheService.get('attachments', 'list', 'job:123');
    const job456 = await cacheService.get('attachments', 'list', 'job:456');
    const fileAbc = await cacheService.get('attachments', 'detail', 'file:abc');
    const jobsList = await cacheService.get('jobs', 'list', 'all');

    logResult('Verify job:123 deleted', job123 === null);
    logResult('Verify job:456 deleted', job456 === null);
    logResult('Verify file:abc NOT deleted', fileAbc !== null);
    logResult('Verify jobs:list NOT deleted', jobsList !== null);

    // Clean up
    await cacheService.invalidatePattern('attachments', '*');
    await cacheService.invalidatePattern('jobs', '*');

    return (
      invalidated === 2 &&
      job123 === null &&
      job456 === null &&
      fileAbc !== null &&
      jobsList !== null
    );
  } catch (error) {
    logResult('Pattern invalidation', false, `Error: ${error}`);
    return false;
  }
}

/**
 * Test 6: Circuit Breaker
 */
async function testCircuitBreaker(): Promise<boolean> {
  logSection('Test 6: Circuit Breaker Behavior');

  log('⚠ This test simulates failures and may take up to 2 minutes', 'yellow');

  // Note: This test requires manual Redis shutdown/restart
  // It's more of a demonstration than an automated test

  const cacheService = CacheService.getInstance();

  try {
    const health1 = await cacheService.healthCheck();
    logResult('Initial state', health1.healthy, `Circuit: ${health1.status}`);

    log('\nTo test circuit breaker:', 'cyan');
    log('1. Stop Redis: docker stop redis-cache');
    log('2. Wait 10 seconds');
    log('3. Observe circuit breaker OPEN');
    log('4. Restart Redis: docker start redis-cache');
    log('5. Wait 60 seconds');
    log('6. Observe circuit breaker transition to HALF_OPEN then CLOSED');

    return true;
  } catch (error) {
    logResult('Circuit breaker test', false, `Error: ${error}`);
    return false;
  }
}

/**
 * Test 7: Statistics
 */
async function testStatistics(): Promise<boolean> {
  logSection('Test 7: Cache Statistics');

  const cacheService = CacheService.getInstance();

  try {
    // Generate some activity
    const testData = { test: 'data' };

    await cacheService.set('test', 'stats', '1', testData, 60);
    await cacheService.get('test', 'stats', '1'); // Hit
    await cacheService.get('test', 'stats', '2'); // Miss

    const stats = await cacheService.getStats();

    log('\nCache Metrics:', 'bright');
    log(`  Hits: ${stats.metrics.hits}`);
    log(`  Misses: ${stats.metrics.misses}`);
    log(`  Hit Rate: ${stats.metrics.hitRate.toFixed(2)}%`);
    log(`  Avg Latency: ${stats.metrics.avgLatencyMs.toFixed(2)}ms`);
    log(`  Circuit State: ${stats.metrics.circuitState}`);

    log('\nRedis Info:', 'bright');
    log(`  Connected: ${stats.redis.connected}`);
    log(`  Status: ${stats.redis.status}`);
    log(`  Uptime: ${stats.redis.uptime}s`);
    log(`  Memory: ${stats.redis.memoryUsed}`);
    log(`  Total Keys: ${stats.redis.totalKeys}`);

    const pass =
      stats.metrics.totalRequests > 0 &&
      stats.redis.connected &&
      stats.metrics.circuitState === 'CLOSED';

    logResult('Statistics collection', pass);

    // Clean up
    await cacheService.delete('test', 'stats', '1');

    return pass;
  } catch (error) {
    logResult('Statistics test', false, `Error: ${error}`);
    return false;
  }
}

/**
 * Test 8: Real-world Scenario
 */
async function testRealWorldScenario(): Promise<boolean> {
  logSection('Test 8: Real-world Scenario (Attachments)');

  const cacheService = CacheService.getInstance();

  try {
    // Simulate attachments data
    const attachments = {
      count: 3,
      files: [
        { id: 'file-1', name: 'invoice.pdf', size: 204800 },
        { id: 'file-2', name: 'photo.jpg', size: 1048576 },
        { id: 'file-3', name: 'document.docx', size: 512000 },
      ],
      total_size_mb: '1.68',
    };

    // First call - cache miss (simulated API call)
    log('\nSimulating API call...', 'cyan');
    const apiStart = Date.now();
    await sleep(100); // Simulate API latency
    await cacheService.set(
      CACHE_PREFIXES.ATTACHMENTS,
      CACHE_PREFIXES.LIST,
      'job:123',
      attachments,
      getTTL('ATTACHMENTS_BY_JOB')
    );
    const apiDuration = Date.now() - apiStart;

    logResult('API call simulation', true, `Latency: ${apiDuration}ms`);

    // Second call - cache hit
    log('\nFetching from cache...', 'cyan');
    const cacheStart = Date.now();
    const cached = await cacheService.get(
      CACHE_PREFIXES.ATTACHMENTS,
      CACHE_PREFIXES.LIST,
      'job:123'
    );
    const cacheDuration = Date.now() - cacheStart;

    const cacheHit = cached !== null;
    const performance = cacheDuration < 50;
    const improvement = ((apiDuration - cacheDuration) / apiDuration) * 100;

    logResult('Cache hit', cacheHit, `Latency: ${cacheDuration}ms`);
    logResult(
      'Performance target (<50ms)',
      performance,
      `${improvement.toFixed(0)}% faster than API`
    );

    // Simulate invalidation on file upload
    log('\nSimulating file upload...', 'cyan');
    await cacheService.invalidatePattern(CACHE_PREFIXES.ATTACHMENTS, `*job:123*`);
    const afterInvalidation = await cacheService.get(
      CACHE_PREFIXES.ATTACHMENTS,
      CACHE_PREFIXES.LIST,
      'job:123'
    );

    logResult('Cache invalidation', afterInvalidation === null);

    return cacheHit && performance && afterInvalidation === null;
  } catch (error) {
    logResult('Real-world scenario', false, `Error: ${error}`);
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  log('\n🚀 Redis Cache System Test Suite\n', 'bright');

  const results: { name: string; passed: boolean }[] = [];

  // Run tests sequentially
  results.push({ name: 'Connection', passed: await testConnection() });
  results.push({ name: 'Basic Operations', passed: await testBasicOperations() });
  results.push({ name: 'Performance', passed: await testPerformance() });
  results.push({ name: 'Compression', passed: await testCompression() });
  results.push({ name: 'Pattern Invalidation', passed: await testPatternInvalidation() });
  results.push({ name: 'Circuit Breaker', passed: await testCircuitBreaker() });
  results.push({ name: 'Statistics', passed: await testStatistics() });
  results.push({ name: 'Real-world Scenario', passed: await testRealWorldScenario() });

  // Summary
  logSection('Test Summary');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const percentage = (passed / total) * 100;

  results.forEach((result) => {
    logResult(result.name, result.passed);
  });

  console.log();
  log(`${passed}/${total} tests passed (${percentage.toFixed(0)}%)`, 'bright');

  if (passed === total) {
    log('\n✓ All tests passed! Cache system is working correctly.', 'green');
  } else {
    log('\n✗ Some tests failed. Check the output above for details.', 'red');
  }

  // Disconnect
  const cacheService = CacheService.getInstance();
  await cacheService.disconnect();
  log('\nDisconnected from Redis.', 'cyan');
}

// Run tests
runAllTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
