# Test Suite Documentation

## Overview

Comprehensive test suite for the JobNimbus MCP Attachments System with unit tests, integration tests, and end-to-end tests.

## Structure

```
tests/
├── unit/                           # Unit tests (isolated components)
│   ├── getAttachments.test.ts
│   └── analyzeJobAttachments.test.ts
├── integration/                    # Integration tests (with API mocks)
│   └── attachments.integration.test.ts
├── e2e/                           # End-to-end tests (real API)
│   └── attachments.e2e.test.ts
├── fixtures/                      # Test data and fixtures
│   └── attachments.ts
├── mocks/                         # Mock implementations
│   └── jobNimbusClient.mock.ts
├── helpers/                       # Test helper utilities
│   └── testHelpers.ts
└── setup.ts                       # Global test setup
```

## Running Tests

### All Tests
```bash
npm test                    # Run all unit and integration tests
npm run test:all           # Run unit and integration tests
```

### Unit Tests
```bash
npm run test:unit          # Run all unit tests
npm run test:attachments   # Run only attachment tests
```

### Integration Tests
```bash
npm run test:integration   # Run integration tests with API mocks
```

### End-to-End Tests
```bash
# Set environment variables first
export JOBNIMBUS_API_KEY_STAMFORD="your-api-key"
export TEST_JOB_ID="job-456"
export RUN_E2E_TESTS=true

npm run test:e2e          # Run E2E tests with real API
```

### Watch Mode
```bash
npm run test:watch         # Watch mode for development
```

### Coverage
```bash
npm run test:coverage      # Generate coverage report
```

## Test Categories

### Unit Tests
- **Isolation**: Tests individual functions and methods in isolation
- **Fast**: Execute quickly without external dependencies
- **Mocked**: All external services are mocked
- **Coverage**: Aim for 80%+ code coverage

**What's Tested:**
- Tool definitions and schemas
- Input validation
- Data transformations
- Error handling
- Edge cases
- Performance with large datasets

### Integration Tests
- **Component Interaction**: Tests how components work together
- **API Mocks**: Uses `nock` to mock HTTP requests
- **Realistic Scenarios**: Simulates real-world usage patterns
- **Error Handling**: Tests recovery from API errors

**What's Tested:**
- Tool interaction with JobNimbus client
- API request/response handling
- Error recovery and resilience
- Pagination and filtering
- Rate limiting behavior
- Data consistency

### End-to-End Tests
- **Real API**: Connects to actual JobNimbus API
- **Skipped by Default**: Requires explicit opt-in
- **Credentials Required**: Needs valid API keys
- **Slower**: Takes longer due to real network calls

**What's Tested:**
- Complete user workflows
- Real data validation
- Performance with real API
- Edge cases with actual data
- Full system integration

## Configuration

### Jest Configuration
Located in `jest.config.js`:
- ESM module support
- TypeScript transformation
- Coverage thresholds
- Test timeout settings

### Environment Variables

#### Required for E2E Tests:
```bash
JOBNIMBUS_API_KEY_STAMFORD=your-stamford-api-key
JOBNIMBUS_API_KEY_GUILFORD=your-guilford-api-key
TEST_JOB_ID=job-456                # Valid job ID with attachments
TEST_CONTACT_ID=contact-789        # Optional: contact ID for testing
RUN_E2E_TESTS=true                # Enable E2E tests
```

#### Optional:
```bash
LOG_LEVEL=error                   # Suppress logs during tests
NODE_ENV=test                     # Set test environment
```

## Test Data

### Fixtures
Predefined test data located in `tests/fixtures/attachments.ts`:
- Mock files (PDF, images, large files)
- Mock jobs and contacts
- Mock API responses
- Error scenarios

### Mocks
Mock implementations in `tests/mocks/`:
- JobNimbus API client mock
- Configurable responses
- Call history tracking

## Writing Tests

### Example: Unit Test
```typescript
import { GetAttachmentsTool } from '../../src/tools/attachments/getAttachments.js';
import { MockJobNimbusClient } from '../mocks/jobNimbusClient.mock.js';
import { mockContext } from '../fixtures/attachments.js';

describe('GetAttachmentsTool', () => {
  let tool: GetAttachmentsTool;
  let mockClient: MockJobNimbusClient;

  beforeEach(() => {
    mockClient = new MockJobNimbusClient();
    tool = new GetAttachmentsTool();
    (tool as any).client = mockClient;
  });

  it('should fetch attachments', async () => {
    const result = await tool.execute({}, mockContext);
    expect(result.files).toBeDefined();
  });
});
```

### Example: Integration Test
```typescript
import nock from 'nock';
import { setupJobNimbusApiMocks, clearApiMocks } from '../helpers/testHelpers.js';

describe('Integration Test', () => {
  beforeEach(() => {
    setupJobNimbusApiMocks();
  });

  afterEach(() => {
    clearApiMocks();
  });

  it('should interact with mocked API', async () => {
    // Test with nock-mocked API
  });
});
```

### Example: E2E Test
```typescript
const describeE2E = RUN_E2E_TESTS ? describe : describe.skip;

describeE2E('E2E Test', () => {
  it('should work with real API', async () => {
    // Test with real JobNimbus API
  });
});
```

## Test Helpers

### Available Helpers
Located in `tests/helpers/testHelpers.ts`:

```typescript
// Setup API mocks
setupJobNimbusApiMocks()
setupJobNimbusApiErrors(statusCode)
setupNetworkError()
clearApiMocks()

// Utilities
wait(ms)
createMockContext(overrides)
generateFileId()
generateJobId()
createMockFile(overrides)

// Validators
validateFileStructure(file)
validateAnalysisStructure(analysis)
assertErrorResponse(response)
assertSuccessResponse(response)

// Fetch mocking
mockFetch(url, buffer, contentType)
restoreFetch()
```

## Coverage Requirements

Current thresholds (configured in `jest.config.js`):
- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 80%
- **Statements**: 80%

View coverage report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Continuous Integration

Tests run automatically in CI/CD:
- Unit tests: Always run
- Integration tests: Always run
- E2E tests: Run only if credentials are available

## Troubleshooting

### Common Issues

#### Tests Timeout
```bash
# Increase timeout in test
jest.setTimeout(60000);

# Or in jest.config.js
testTimeout: 60000
```

#### Module Resolution Errors
```bash
# Ensure .js extensions in imports
import { Tool } from './tool.js';  // Correct
import { Tool } from './tool';     // Incorrect for ESM
```

#### Nock Not Intercepting
```bash
# Clear all mocks
nock.cleanAll();

# Check nock is active
console.log(nock.pendingMocks());
```

#### E2E Tests Not Running
```bash
# Enable E2E tests
export RUN_E2E_TESTS=true

# Verify API key
echo $JOBNIMBUS_API_KEY_STAMFORD
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clear Names**: Use descriptive test names
3. **AAA Pattern**: Arrange, Act, Assert
4. **Mock External Services**: Don't hit real APIs in unit tests
5. **Clean Up**: Always clean up after tests
6. **Fixtures**: Use fixtures for consistent test data
7. **Error Cases**: Test both success and failure scenarios
8. **Performance**: Keep unit tests fast (<100ms each)

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Nock Documentation](https://github.com/nock/nock)
- [Testing Best Practices](https://testingjavascript.com/)
- [JobNimbus API Docs](https://documenter.getpostman.com/view/3575131/SWLfbV9r)

## Contributing

When adding new tests:
1. Follow existing patterns
2. Add fixtures for new test data
3. Update this README
4. Ensure tests pass locally
5. Check coverage doesn't decrease
