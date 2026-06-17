# E2E API Automation Testing Framework - Procurement Workflow

## 📖 Overview

This project is a robust End-to-End (E2E) API Automation Testing Framework built with **Node.js** and **Vitest**. It is designed to automatically test and validate complex business workflows within a digital procurement system.

The framework simulates real-world interactions between multiple user roles (e.g., Admin, Category Specialists, Approvers, and Vendors) across various stages of a bidding and procurement lifecycle (Request for Quotation to Purchase Order).

## 🚀 Key Features

- **Complex Workflow Simulation:** Automates multi-step processes including vendor bidding, multi-level approvals, and automated background job (cron) evaluations.
- **Direct Database Validation:** Integrates `mysql2` to perform direct database queries, ensuring that API actions correctly reflect accurate milestone and state changes at the database level.
- **Custom Assertion Library:** Utilizes centralized, reusable helper functions to validate UI states, token expiries, and milestone transitions.
- **Data-Driven Testing:** Employs dynamic mock data generators to simulate varying test conditions without relying on static, hardcoded payloads.
- **Clean Architecture:** Organized into modular layers (`helpers`, `constants`, `scenarios`) for high maintainability and readability.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Test Runner / Framework:** Vitest
- **HTTP Client:** Axios
- **Database Driver:** MySQL2
- **Code Formatter:** Prettier

## 📂 Project Structure

```text
├── config/                  # Database and global configurations (Mocked)
├── fixtures/                # Mock data and test files for upload endpoints
├── tests/
│   ├── e2e/                 # End-to-End workflow test scenarios (e.g., RFQ/Bidding)
│   └── integrations/        # Standalone API integration tests (e.g., Auth, Role Switching)
├── utils/
│   ├── constants/           # Centralized enums, milestones, and mock API endpoints
│   └── helpers/             # Core utilities (API clients, DB executors, data builders)
├── vitest.config.js         # Vitest test runner configuration
└── README.md
```
