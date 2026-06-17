# Sinarmas AiGen API Automation Test

Comprehensive API automation testing suite for the Sinarmas AiGen procurement system using Vitest, Supertest, and Axios.

## Tech Stack

- **Vitest** - Modern, fast test runner with built-in TypeScript support
- **Supertest** - HTTP assertion library for API testing
- **Axios** - Promise-based HTTP client with interceptors
- **mysql2** - MySQL database driver for test data management
- **jsonwebtoken** - JWT token generation and verification
- **moment-timezone** - Business day calculations (matching backend logic)
- **@faker-js/faker** - Realistic test data generation
- **Mailpit API** - Email testing and verification

## Features

✅ E2E API testing against actual backend  
✅ JWT authentication and email token validation  
✅ Database integration for test data setup/cleanup  
✅ Email verification via Mailpit HTTP API  
✅ Business day calculations for token expiry  
✅ HTML test reports with detailed logs  
✅ Parallel test execution support  

## Prerequisites

Before running tests, ensure the following services are running:

1. **Backend API** - `http://localhost:3000`

   ```bash
   cd ../aigen-backend
   npm run dev
   ```

2. **MySQL Databases** (3 databases: aigen, isourcing, isearch)

   ```bash
   cd ../aigen-backend
   docker-compose up -d
   ```

3. **Mailpit** (for email testing)
   - Mailpit should be running at `http://localhost:8025`
   - Already included in `aigen-backend/docker-compose.yml`

## Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
nano .env

# Generate credentials.json from CSV (one-time setup)
npm run convert:credentials
```

**Important:** The `convert:credentials` script reads test user credentials from `docs/credential-test-data.csv` and generates `fixtures/credentials.json`. This file contains real user credentials for testing - no test users are created in the database.

## Environment Configuration

Edit `.env` file with the following settings:

```bash
# API Configuration
API_BASE_URL=http://localhost:3000/v1
API_TIMEOUT=30000

# JWT Secret (must match backend)
JWT_SECRET=your_jwt_secret_here

# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_AIGEN=aigen_db
DB_ISOURCING=task_board
DB_ISEARCH=prpo

# Mailpit
MAILPIT_API_URL=http://localhost:8025/api/v1

# Logging
LOG_LEVEL=debug
LOG_API_REQUESTS=true
LOG_API_RESPONSES=true
```

**Important:** Ensure `JWT_SECRET` matches the secret in `aigen-backend/.env`.

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Interactive UI

```bash
npm run test:ui
# Open http://localhost:51204/__vitest__/
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test Suites

TBU

## Project Structure

```bash
sinarmas-aigen-api-automation-test/
├── config/
│   ├── env.js                                  # Environment configuration loader
│   ├── database.js                             # MySQL connection pools (3 databases)
│   └── constants.js                            # API constants (status codes, roles, endpoints)
├── helpers/
│   ├── credentials.helper.js # Load user credentials from credentials.json
│   ├── auth.helper.js      # JWT/email token generation, login utilities
│   ├── api.helper.js       # Axios HTTP client with interceptors
│   ├── db.helper.js        # Database operations (CRUD, cleanup)
│   ├── mailpit.helper.js   # Email testing via Mailpit API
│   └── date.helper.js      # Business day calculations
├── fixtures/
│   ├── credentials.json    # User credentials (generated from CSV)
│   └── files/              # Test files for upload tests
│       ├── test-image.jpg
│       ├── test-document.pdf
│       └── test-evidence.png
├── scripts/
│   ├── convert-credentials.js  # CSV to JSON credential converter
│   └── verify-credentials.js  # Script to verify credentials against the database
├── docs/
│   ├── databases/         # Database schema diagrams and documentation with DBML formats
│   │   ├── aigen.dbml     # DBML for aigen database
│   │   ├── prpo.dbml      # DBML for prpo database
│   │   └── task_board.dbml # DBML for task_board database
│   ├── openapi/         # OpenAPI specification and documentation
│   │   ├── components/      # Reusable OpenAPI components (schemas, parameters)
│   │   ├── paths/           # OpenAPI paths documentation
│   │   ├── openapi.bundle.yaml # Bundled OpenAPI specification (for reference)
│   │   └── openapi.yaml     # Main OpenAPI specification file
│   └── sop-api-automation-testing.md  # Standard Operating Procedure for API Automation Testing
├── tests/
│   ├── e2e                                   # Full end-to-end workflow tests (covering multiple features)
│   ├── integrations                             # Integration tests for individual endpoints/modules
│   │   ├── 01-auth/                          # Authentication tests
│   │   │   ├── basic-login.test.js
│   │   │   └── token-validation.test.js
│   │   └── etc/                              # Other feature-specific test directories (vendor, CS, DIC, CL, email, upload, master data)
│   └── setup.js                              # Global test setup (database connections)
├── reports/                                  # Test reports (HTML, JSON)
├── .env.example                              # Environment template
├── .gitignore
├── package.json
├── vitest.config.js                          # Vitest configuration
└── README.md
```
