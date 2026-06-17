# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

API automation testing suite for the **Sinarmas AiGen** procurement system backend. This test suite validates API endpoints, authentication flows, database integrations, and email notifications using Vitest as the test runner.

**Tech Stack:**
- **Vitest** - Test runner with ES modules support
- **Axios** - HTTP client with interceptors for API testing
- **mysql2** - Direct database access for test setup/verification
- **jsonwebtoken** - JWT token generation/validation
- **Ajv** - OpenAPI schema validation
- **Mailpit API** - Email testing and verification

## Prerequisites

Before running tests, ensure these services are running:

1. **Backend API** (`aigen-backend`)
   ```bash
   cd ../aigen-backend
   npm run dev  # API at http://localhost:3000
   ```

2. **MySQL + Mailpit** (via Docker in `aigen-backend`)
   ```bash
   cd ../aigen-backend
   docker-compose up -d  # MySQL:3306, Mailpit:8025
   ```

3. **Credentials Setup** (one-time)
   ```bash
   npm run convert:credentials  # Generate fixtures/credentials.json from CSV
   ```

## Common Commands

### Test Execution
```bash
npm test                          # Run all tests
npm run test:watch                # Watch mode with auto-rerun
npm run test:ui                   # Interactive UI at http://localhost:51204/__vitest__/
npm run test:coverage             # Generate coverage report

# Run specific test suites
npm run test:integrations:authentication
npm run test:integrations:autpo
npm run test:e2e
```

### OpenAPI Schema Management
```bash
npm run redocly:bundle            # Bundle OpenAPI spec to openapi.bundle.yaml
npm run redocly:lint:bundle       # Lint bundled spec
npm run redocly:lint:split        # Lint split OpenAPI files
```

### Credential Management
```bash
npm run convert:credentials       # Convert CSV credentials to JSON
```

## Architecture & Key Concepts

### Test Types & Organization

**Integration Tests** (`tests/integrations/`):
- Test individual endpoints or modules in isolation
- 60-70% of test coverage (primary focus)
- Examples: `01-authentication/`, `02-autopo/`

**E2E Tests** (`tests/e2e/`):
- Test complete business workflows end-to-end
- 20-30% of test coverage
- Simulate real user journeys (PR → RFQ → Vendor → DIC → Approval → QCF)

### Database Access Protocol ("Golden Rule")

**CRITICAL**: Database access is ONLY allowed for **Arrange** (setup) and **Assert** (verification), NEVER for **Act** (business logic execution).

```javascript
// ✅ CORRECT - Use API to trigger business logic
const response = await authenticatedPost('/rfq/approve', { rfqId: 123 }, token);

// ❌ WRONG - Do NOT bypass API by directly updating database
await executeQuery("UPDATE rfqLibrary SET status = 'APPROVED' WHERE id = ?", [123]);
```

**Allowed database operations:**
- **Arrange**: Seed test data, configure system state
- **Assert**: Verify state changes after API calls

**Forbidden database operations:**
- **Act**: DO NOT use SQL to trigger business logic (approvals, status changes, etc.)

### Helper Architecture

**API Helpers** (`utils/helpers/api.helper.js`):
- `get()`, `post()`, `put()`, `patch()`, `del()` - Basic HTTP methods
- `authenticatedGet()`, `authenticatedPost()`, etc. - Auto-inject JWT token
- `uploadFile()`, `uploadMultipleFiles()` - File upload support
- `expectSuccess()`, `expectError()` - Quick assertions

**Authentication Helpers** (`utils/helpers/auth.helper.js`):
- `loginAs(role, category)` - Login as CS/CL/DIC/ADMIN
  - Roles: `ROLES.CS`, `ROLES.CL`, `ROLES.DIC`, `ROLES.ADMIN`
  - Categories: `'mrr'`, `'it'`, `'gsl'` (for CS/CL roles)
  - Returns JWT token for authenticated requests

**Database Helpers** (`utils/helpers/db.helper.js`):
- `executeQuery(sql, params, dbName)` - Execute queries on aigen/isourcing/isearch
- `getAigenPool()`, `getIsourcingPool()`, `getIsearchPool()` - Get connection pools
- **Important**: Only use for test setup and verification, NOT for business logic

**Schema Helpers** (`utils/helpers/schema.helper.js`):
- `expectResponseToMatchSchema(response, path, method, statusCode)` - Validate against OpenAPI spec
- `expectStandardResponseStructure(data)` - Verify `{message, data}` structure
- `expectErrorResponse(data)` - Verify error response format
- `expectValidPagination(pagination)` - Verify pagination structure

**Credentials Helper** (`utils/helpers/credentials.helper.js`):
- `getCSCredential(category)` - Get CS user credentials (mrr/it/gsl)
- `getCLCredential(category)` - Get CL user credentials
- `getDicCredential()` - Get DIC user credentials
- `getAdminCredential()` - Get admin credentials
- Credentials loaded from `fixtures/credentials.json`

### Three-Database Architecture

Tests connect to three separate MySQL databases (same server, different schemas):

1. **aigen** (`DB_AIGEN`) - Main application database
2. **isourcing** (`DB_ISOURCING`) - iSourcing task board
3. **isearch** (`DB_ISEARCH`) - SAP PR search library

Specify database in queries:
```javascript
await executeQuery(sql, params, 'aigen');      // Primary DB
await executeQuery(sql, params, 'isourcing');  // iSourcing DB
await executeQuery(sql, params, 'isearch');    // Search DB
```

### OpenAPI Schema Validation

All API responses are validated against `docs/openapi/openapi.bundle.yaml`:

```javascript
import { expectResponseToMatchSchema } from '../../../utils/helpers/schema.helper.js';
import { HTTP_METHODS, HTTP_STATUS } from '../../../utils/constants/http.constant.js';

// Validates response status code, Content-Type header, and response body schema
expectResponseToMatchSchema(
  response,
  '/auth/login/basic',  // API path
  HTTP_METHODS.POST,    // HTTP method
  HTTP_STATUS.OK        // Expected status code
);
```

**Schema workflow:**
1. Define/update OpenAPI spec in `docs/openapi/paths/` and `docs/openapi/components/`
2. Bundle spec: `npm run redocly:bundle`
3. Test automatically validates responses against bundled spec

## Test Patterns & Best Practices

### AAA Pattern (Arrange-Act-Assert)

Every test must follow this structure:

```javascript
test('should approve RFQ successfully', async () => {
  // ARRANGE - Setup test data and authenticate
  const token = await loginAs(ROLES.CL, 'mrr');
  const rfqId = 123;  // From test data

  // ACT - Call the API endpoint (business logic)
  const response = await authenticatedPost(
    `/rfq/${rfqId}/approve`,
    { comments: 'Approved by CL' },
    token
  );

  // ASSERT - Verify response and side effects
  expectResponseToMatchSchema(response, '/rfq/{id}/approve', HTTP_METHODS.POST, HTTP_STATUS.OK);
  expect(response.data.data.status).toBe('APPROVED');

  // Verify database state changed (using database helper)
  const [rfq] = await executeQuery('SELECT status FROM rfqLibrary WHERE id = ?', [rfqId]);
  expect(rfq.status).toBe('APPROVED');
});
```

### Credential Management

**DO NOT hardcode credentials**. Use the credential helper system:

```javascript
import { getCSCredential, getCLCredential } from '../../../utils/helpers/credentials.helper.js';

// Use real credentials from fixtures/credentials.json
const csUser = getCSCredential('mrr');  // CS user for MRR category
const clUser = getCLCredential('it');   // CL user for IT category

const response = await post('/auth/login/basic', {
  identifier: csUser.email,
  password: csUser.password
});
```

**Regenerate credentials.json:**
1. Update `docs/credential-test-data.csv` with new test user data
2. Run `npm run convert:credentials`
3. Commit updated `fixtures/credentials.json`

### Email Testing with Mailpit

Use Mailpit HTTP API to verify emails (DO NOT send real emails):

```javascript
import { getLatestEmail, deleteAllEmails } from '../../../utils/helpers/mailpit.helper.js';

// Clear emails before test
await deleteAllEmails();

// Trigger email-sending API
await post('/auth/password/forgot', { email: 'test@example.com' });

// Verify email was sent
const email = await getLatestEmail('test@example.com');
expect(email.subject).toBe('Password Reset Request');
expect(email.html).toContain('reset-password');
```

### Business Day Calculations

Token expiry uses **business days** (excludes weekends), matching backend logic:

```javascript
import { addBusinessDays, isBusinessDay } from '../../../utils/helpers/date.helper.js';

// Add 5 business days (excludes Sat/Sun)
const expiryDate = addBusinessDays(new Date(), 5);

// Check if date is a business day
expect(isBusinessDay(new Date('2024-04-22'))).toBe(true);  // Monday
expect(isBusinessDay(new Date('2024-04-27'))).toBe(false); // Saturday
```

## Environment Configuration

**Critical**: `JWT_SECRET` in `.env` must match `aigen-backend/.env` for token validation to work.

```bash
# .env (must match backend configuration)
API_BASE_URL=http://localhost:3000/v1
JWT_SECRET=your_jwt_secret_here  # ⚠️ MUST match backend

# Database (same MySQL server, 3 databases)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_AIGEN=aigen_db          # Primary database
DB_ISOURCING=task_board    # iSourcing database
DB_ISEARCH=prpo            # Search library database

# Mailpit (for email testing)
MAILPIT_API_URL=http://localhost:8025/api/v1

# Logging (enable for debugging)
LOG_LEVEL=debug
LOG_API_REQUESTS=true
LOG_API_RESPONSES=true
```

## Vitest Configuration

Key settings in `vitest.config.js`:

- **Test timeout**: 30 seconds (adjustable for slow endpoints)
- **Setup file**: `tests/setup.js` (runs before all tests, connects to databases)
- **Parallel execution**: Enabled via `pool: 'forks'`
- **Retry**: Disabled (tests should be deterministic)
- **Globals**: Enabled (no need to import `describe`, `test`, `expect`)

## Writing Tests

### Step-by-Step Guide

1. **Identify test type**:
   - Single endpoint validation → Integration test (`tests/integrations/`)
   - Multi-step workflow → E2E test (`tests/e2e/`)

2. **Create test file**:
   ```javascript
   import { describe, test, expect } from 'vitest';
   import { authenticatedPost, post } from '../../../utils/helpers/api.helper.js';
   import { loginAs } from '../../../utils/helpers/auth.helper.js';
   import { ROLES } from '../../../utils/constants/role.constant.js';
   import { API_AIGEN_ENDPOINTS } from '../../../utils/constants/api-endpoint.constant.js';
   import { HTTP_METHODS, HTTP_STATUS } from '../../../utils/constants/http.constant.js';
   import { expectResponseToMatchSchema } from '../../../utils/helpers/schema.helper.js';

   describe('Feature - Test Suite', () => {
     test('should perform expected behavior', async () => {
       // Arrange
       const token = await loginAs(ROLES.CS, 'mrr');

       // Act
       const response = await authenticatedGet('/endpoint', token);

       // Assert
       expectResponseToMatchSchema(response, '/endpoint', HTTP_METHODS.GET, HTTP_STATUS.OK);
       expect(response.data.data).toBeDefined();
     });
   });
   ```

3. **Update OpenAPI spec** (if testing new endpoint):
   - Add path definition in `docs/openapi/paths/`
   - Add schemas in `docs/openapi/components/schemas/`
   - Run `npm run redocly:bundle`

4. **Run tests**:
   ```bash
   npm run test:watch  # Watch mode for development
   npm test            # Full test run
   ```

## Important Reminders

### Authentication Tokens

- **Dashboard users** (CS/CL/DIC/Admin): Use `loginAs()` to get JWT token
- **Vendor users**: Generate email-based JWT tokens (use `jwt.sign()` with vendor payload)
- All tokens expire after `JWT_EXPIRY` (default: 2 days)

### Service Virtualization

**FORBIDDEN**: Integration with real external systems (SAP, production email servers)

**REQUIRED**: Use Mailpit for email testing (configured in `aigen-backend/.env`)

### Test Data Management

- Tests use **real database users** (no test users created)
- Credentials loaded from `fixtures/credentials.json`
- Clean up test data after tests (use `afterEach` or `afterAll` hooks)
- Ensure tests are **idempotent** (can run multiple times without conflicts)

### File Structure

```
sinarmas-aigen-api-automation-test/
├── config/                        # Environment and database configuration
│   ├── env.js                     # Centralized config loader
│   └── database.js                # MySQL connection pools (3 databases)
├── utils/
│   ├── constants/                 # API endpoints, HTTP codes, roles, etc.
│   └── helpers/                   # Reusable test utilities
│       ├── api.helper.js          # HTTP client wrapper
│       ├── auth.helper.js         # Authentication utilities
│       ├── db.helper.js           # Database operations
│       ├── schema.helper.js       # OpenAPI validation
│       ├── mailpit.helper.js      # Email testing
│       └── credentials.helper.js  # Load user credentials
├── fixtures/
│   ├── credentials.json           # User credentials (generated from CSV)
│   └── files/                     # Test files for uploads
├── tests/
│   ├── integrations/              # Integration tests (per endpoint/module)
│   ├── e2e/                       # End-to-end workflow tests
│   └── setup.js                   # Global test setup (DB connections)
├── docs/
│   ├── openapi/                   # OpenAPI specification
│   │   ├── openapi.yaml           # Main spec file
│   │   ├── openapi.bundle.yaml    # Bundled spec (used for validation)
│   │   ├── paths/                 # Endpoint definitions
│   │   └── components/            # Reusable schemas
│   └── databases/                 # DBML database schemas
└── scripts/
    └── convert-credentials.js     # CSV to JSON credential converter
```

## Debugging Tips

### Enable Detailed Logging

Set in `.env`:
```bash
LOG_LEVEL=debug
LOG_API_REQUESTS=true
LOG_API_RESPONSES=true
```

### Database Connection Issues

Verify connections in test setup:
```bash
# Check MySQL containers
cd ../aigen-backend
docker ps | grep mysql

# Test database access
npm test  # Will fail with connection error if DB is down
```

### Schema Validation Failures

1. Check OpenAPI spec is up-to-date: `npm run redocly:lint:split`
2. Rebuild bundle: `npm run redocly:bundle`
3. Compare actual response vs expected schema (error messages show details)

### Token Authentication Failures

1. Verify `JWT_SECRET` matches between `.env` and `aigen-backend/.env`
2. Check token expiry hasn't passed (default: 2 days)
3. Ensure user credentials are valid (run `npm run convert:credentials`)