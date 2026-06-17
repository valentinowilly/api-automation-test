# Standard Operating Procedure: API Automation Testing

This document serves as the primary guideline for backend engineers to build a scalable, maintainable, and reliable test suite.

## 1. Test Pyramid Strategy

Prioritize test coverage to maintain a fast and stable feedback loop.

* **Integration Tests (60-70%):** Validation per endpoint/module (input validation, logic, status codes). This is the primary focus for safe refactoring.
* **E2E Workflow Tests (20-30%):** Simulation of Happy Paths and Negative Paths for long business workflows (e.g., Procurement).

## 2. Database Access Protocol (The "Golden Rule")

Database access is a tool to **set the stage** and **check evidence**, NOT a player in the scenario.

| Phase | Action | Status |
| :--- | :--- | :--- |
| **Arrange** | Setup data (Seeding), system config. | ✅ **Allowed** |
| **Act** | Triggering business logic (Approval process, Create Order). | ❌ **FORBIDDEN** |
| **Assert** | Checking state changes (e.g., status in DB). | ✅ **Allowed** |

* **Forbidden:** Performing `UPDATE` or `INSERT` via SQL to trigger business logic (e.g., changing an order status to "Approved"). This bypasses the application logic.
* **Mandatory:** Use APIs to trigger business logic. If you want to change a status to "Approved," call the `/approve` API.
* **Best Practice:** Use the *Factory/Builder Pattern* for seeding and ensure tests are *Idempotent* (each test cleans up or rolls back its own data).

## 3. Service Virtualization

It is strictly forbidden to integrate with real systems (SAP/Email/Third-party) during test execution.

* **SAP/External API:** Use `nock` or `WireMock`. Program the mock to return expected responses (Success 200, Error 400/500) based on the test scenario.
* **Email:** Use **MailHog** or **Mailtrap**. Redirect your application's SMTP configuration to these tools.
* **Verification:** Use the MailHog API to validate the generated email content/links, rather than sending real emails.

## 4. Coding Standards (Jest + Supertest)

* **AAA Pattern:** Every test must follow the `Arrange` (Setup), `Act` (Hit API), `Assert` (Check Result) pattern.
* **API Chaining:** Store response results (e.g., `order_id`) as variables to be used in subsequent requests within an E2E scenario.
* **No Manual Sleep:** Do not use `setTimeout` or `sleep`. Use *polling* or *wait-for* to validate asynchronous processes.
* **Environment:** Always use `.env.test`. Never execute tests against development or production databases.

***

> **"Database access is a tool to set the stage (setup) and check evidence (assert), NOT a player in the scenario (execution)."**
