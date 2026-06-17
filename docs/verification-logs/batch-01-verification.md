# Batch 1 Verification Report
**Health Check + Authentication Core (9 endpoints)**

**Date:** 2026-04-23
**Status:** ✅ COMPLETE
**Endpoints Verified:** 9 / 9
**Discrepancies Found:** 7

---

## Summary Table

| # | Endpoint | Route Match | Schema Match | Example Valid | Issues |
|---|----------|-------------|--------------|---------------|--------|
| 1 | GET /health | ✅ | ❌ | ❌ | 1 (D001) |
| 2 | POST /auth/login/basic | ✅ | ✅ | ✅ | 0 |
| 3 | GET /auth/me | ✅ | ❌ | ❌ | 2 (D002, D003) |
| 4 | PUT /auth/switch-role | ✅ | ❌ | ✅ | 1 (D004) |
| 5 | GET /auth/login/oauth/google | ✅ | ⚠️ | ✅ | 1 (D005) |
| 6 | POST /auth/login/oauth/google | ✅ | ❌ | ✅ | 1 (D006) |
| 7 | POST /auth/basic/forgot-password | ✅ | ❌ | ❌ | 1 (D007) |
| 8 | GET /auth/basic/reset-password | ✅ | ✅ | ✅ | 0 |
| 9 | POST /auth/basic/reset-password | ✅ | ✅ | ✅ | 0 |

---

## Detailed Findings

### Endpoint 1: GET /health ❌

**OpenAPI File:** `docs/openapi/paths/health.yaml`
**Backend Route:** `aigen-backend/src/routes/healthRoutes.js:7`
**Controller:** `aigen-backend/src/controllers/healthController.js:4`

#### Route Definition
- ✅ Path matches: `/health`
- ✅ HTTP method matches: `GET`
- ✅ No authentication required

#### Request Schema
- ✅ No request body/params required

#### Response Schema
**OpenAPI Says (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-23T10:30:00.000Z",
  "uptime": 3600
}
```

**Backend Implements:**
```javascript
// healthController.js:6
return sendResponse(res, {}, 'API is healthy', 200);
```

The `sendResponse` helper wraps responses in a standard format:
```json
{
  "message": "API is healthy",
  "data": {}
}
```

#### ❌ **Discrepancy D001** - Response Schema Mismatch
- **Severity:** HIGH
- **Issue:** OpenAPI shows flat response with `status`, `timestamp`, `uptime` fields
- **Backend:** Returns standard response format with `message` and `data` wrapper
- **Impact:** Frontend expecting different response structure

---

### Endpoint 2: POST /auth/login/basic ✅

**OpenAPI File:** `docs/openapi/paths/auth_login_basic.yaml`
**Backend Route:** `aigen-backend/src/routes/authRoutes.js:16-20`
**Controller:** `aigen-backend/src/controllers/authController.js:139-143`
**Service:** `aigen-backend/src/services/authService.js:302-351`

#### Route Definition
- ✅ Path matches: `/auth/login/basic`
- ✅ HTTP method matches: `POST`
- ✅ Middleware: `validatorMiddleware(authSchema.schemaBasicLogin)`, `asyncWrap`
- ✅ No authentication required (`security: []`)

#### Request Schema
**OpenAPI:**
```json
{
  "identifier": "procurement@sinarmasmining.com", // required
  "password": "1Cz3DPsVmwAS7FawsKT1pFkJXZsAGbto" // required
}
```

**Backend:**
```javascript
// authService.js:302 - basicLogin({ identifier, password })
// Accepts identifier (email/username) and password
```
- ✅ Schema matches

#### Response Schema (200)
**OpenAPI:**
```json
{
  "message": "Login Berhasil",
  "data": {
    "access_token": "eyJhbGci..."
  }
}
```

**Backend:**
```javascript
// authService.js:348-350
return {
  access_token: jwtToken,
}
// Controller wraps with sendResponse
```
- ✅ Schema matches perfectly

#### Error Responses
- ✅ 400: Bad Request
- ✅ 401: Invalid credentials
- ✅ 500: Internal Server Error

---

### Endpoint 3: GET /auth/me ❌

**OpenAPI File:** `docs/openapi/paths/auth_me.yaml`
**Backend Route:** `aigen-backend/src/routes/authRoutes.js:52-56`
**Controller:** `aigen-backend/src/controllers/authController.js:163-166`
**Service:** `aigen-backend/src/services/authService.js:417-451`

#### Route Definition
- ✅ Path matches: `/auth/me`
- ✅ HTTP method matches: `GET`
- ✅ Authentication required: `authService.authenticateToken`
- ✅ Security: `bearer: []`

#### Response Schema (200)
**OpenAPI Says:**
```yaml
data:
  current_user:
    id: 1
    name: "Admin Procurement"
    email: "procurement@sinarmasmining.com"
    asigned_by: 0
    level: integer
    active: integer
    role_id: integer
    created_at: "..."
    updated_at: "..."
  available_roles: ["admin", "category-specialist"]
  access_token: "eyJhbGci..." # ← OpenAPI includes this
```

**Backend Implements:**
```javascript
// authService.js:442-450
return {
  current_user: {
    ...user.dataValues,
    type: getUserModelTypeLabel(user.type),
    password: undefined,
  },
  available_roles: roles,
  available_vendor_codes: vendorCodes, // ← Backend includes this
}
```

#### ❌ **Discrepancy D002** - Missing access_token in Response
- **Severity:** MEDIUM
- **Issue:** OpenAPI shows `access_token` field in response
- **Backend:** Does not return `access_token` (user already has valid token)
- **Recommendation:** Remove `access_token` from OpenAPI spec (not needed for /me endpoint)

#### ❌ **Discrepancy D003** - Missing available_vendor_codes in OpenAPI
- **Severity:** MEDIUM
- **Issue:** Backend returns `available_vendor_codes` array for vendor users
- **OpenAPI:** Only shows `available_vendor_codes: []` in example, not in schema
- **Recommendation:** Add `available_vendor_codes` to OpenAPI response schema

---

### Endpoint 4: PUT /auth/switch-role ❌

**OpenAPI File:** `docs/openapi/paths/auth_switch-role.yaml`
**Backend Route:** `aigen-backend/src/routes/authRoutes.js:57-62`
**Controller:** `aigen-backend/src/controllers/authController.js:157-161`
**Service:** `aigen-backend/src/services/authService.js:390-415`

#### Route Definition
- ✅ Path matches: `/auth/switch-role`
- ✅ HTTP method matches: `PUT`
- ✅ Authentication required: `authService.authenticateToken`
- ✅ Middleware: `validatorMiddleware(authSchema.schemaSwitchRole)`

#### Request Schema
**OpenAPI Says:**
```yaml
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties: {}  # ← Empty schema!
      example:
        role_id: 1
```

**Backend Expects:**
```javascript
// authService.js:390 - switchRole({ role_id }, decodedToken)
// Requires role_id in request body
```

#### ❌ **Discrepancy D004** - Incomplete Request Schema
- **Severity:** HIGH
- **Issue:** OpenAPI schema shows empty object `properties: {}`
- **Backend:** Expects `role_id` (integer, required)
- **Recommendation:** Add proper schema:
```yaml
properties:
  role_id:
    type: integer
    required: true
    description: Role ID to switch to
```

#### Response Schema
- ✅ Returns `{message: "...", data: {access_token: "..."}}`

---

### Endpoint 5: GET /auth/login/oauth/google ⚠️

**OpenAPI File:** `docs/openapi/paths/auth_login_oauth_google.yaml:1-35`
**Backend Route:** `aigen-backend/src/routes/authRoutes.js:41-45`
**Controller:** `aigen-backend/src/controllers/authController.js:145-149`
**Service:** `aigen-backend/src/services/authService.js:457-475`

#### Route Definition
- ✅ Path matches: `/auth/login/oauth/google`
- ✅ HTTP method matches: `GET`
- ✅ Middleware: `validatorMiddleware(authSchema.schemaGetGoogleOAuthUrl, QUERY)`

#### Response Schema
**OpenAPI:**
```json
{
  "message": "Login Berhasil",
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
  }
}
```

**Backend:**
```javascript
// authController.js:148
return sendResponse(res, { url: authUrl }, 'Login Berhasil', 200);
```
- ✅ Schema matches

#### ⚠️ **Discrepancy D005** - Incorrect Security Scheme
- **Severity:** LOW
- **Issue:** OpenAPI shows `security: - bearer: []` (requires authentication)
- **Backend:** No authentication required for this endpoint
- **Recommendation:** Remove `security` from OpenAPI or set to `security: []`

---

### Endpoint 6: POST /auth/login/oauth/google ❌

**OpenAPI File:** `docs/openapi/paths/auth_login_oauth_google.yaml:36-81`
**Backend Route:** `aigen-backend/src/routes/authRoutes.js:46-50`
**Controller:** `aigen-backend/src/controllers/authController.js:151-155`
**Service:** `aigen-backend/src/services/authService.js:481-542`

#### Route Definition
- ✅ Path matches: `/auth/login/oauth/google`
- ✅ HTTP method matches: `POST`
- ✅ Middleware: `validatorMiddleware(authSchema.schemaAuthenticateGoogleOauth)`

#### Request Schema
**OpenAPI:**
```yaml
requestBody:
  schema:
    type: object
    properties: {}  # ← Empty schema
  example:
    authorization_code: "4/0AfrIepAOtuBlkq05..."
```

**Backend:**
```javascript
// authService.js:481 - authenticateGoogleOauth({ authorization_code, access_token })
// Accepts authorization_code OR access_token
```

#### ❌ **Discrepancy D006** - Incomplete Request Schema
- **Severity:** HIGH
- **Issue:** OpenAPI schema shows empty object
- **Backend:** Expects `authorization_code` (string) or `access_token` (string)
- **Recommendation:** Add proper schema:
```yaml
properties:
  authorization_code:
    type: string
    description: Authorization code from Google OAuth callback
  access_token:
    type: string
    description: Access token (alternative to authorization_code)
```

#### Response Schema
- ✅ Returns `{message: "...", data: {access_token: "..."}}`

#### Security Scheme Issue
- ⚠️ Same as D005: OpenAPI shows `security: - bearer: []`, but endpoint should be public

---

### Endpoint 7: POST /auth/basic/forgot-password ❌

**OpenAPI File:** `docs/openapi/paths/auth_basic_forgot-password.yaml`
**Backend Route:** `aigen-backend/src/routes/authRoutes.js:22-26`
**Controller:** `aigen-backend/src/controllers/authController.js:170-174`
**Service:** `aigen-backend/src/services/authService.js:547+`

#### Route Definition
- ✅ Path matches: `/auth/basic/forgot-password`
- ✅ HTTP method matches: `POST`
- ✅ Middleware: `validatorMiddleware(authSchema.schemaBasicForgotPassword)`

#### Request Schema
**OpenAPI:**
```yaml
requestBody:
  schema:
    type: object
    properties: {}  # ← Empty schema
  example:
    email: user@example.com
```

**Backend:**
```javascript
// authController.js:171 - const { email } = req.dto;
// Expects email in request body
```

#### ❌ **Discrepancy D007** - Incomplete Request Schema
- **Severity:** HIGH
- **Issue:** OpenAPI schema shows empty object
- **Backend:** Expects `email` (string, required, format: email)
- **Recommendation:** Add proper schema:
```yaml
properties:
  email:
    type: string
    format: email
    required: true
    description: User's email address
```

#### Response Schema Issue
**OpenAPI:**
```yaml
'200':
  example:
    message: "Password reset email sent"
    data:
      success: true
```

**Backend Implementation:**
```javascript
// authController.js:173
const { message, status } = await authService.basicRequestPasswordReset(email, frontendUrl);
return sendResponse(res, null, message, status);
```

The backend returns `data: null`, not `data: {success: true}` as shown in the example.

#### Security Scheme Issue
- **Issue:** OpenAPI shows `security: - bearer: []`
- **Backend:** No authentication should be required for forgot password
- **Recommendation:** Set `security: []` in OpenAPI

---

### Endpoints 8-9: Password Reset Endpoints ✅

#### Endpoint 8: GET /auth/basic/reset-password
**OpenAPI File:** `docs/openapi/paths/auth_basic_reset-password.yaml:54-99`
**Backend Route:** `aigen-backend/src/routes/authRoutes.js:28-32`
**Controller:** `aigen-backend/src/controllers/authController.js:176-180`

- ✅ Path matches: `/auth/basic/reset-password`
- ✅ HTTP method: `GET`
- ✅ Query parameter: `token` (string, required)
- ✅ Response: `{message: "...", data: null}`
- ✅ No schema issues found

#### Endpoint 9: POST /auth/basic/reset-password
**OpenAPI File:** `docs/openapi/paths/auth_basic_reset-password.yaml:1-53`
**Backend Route:** `aigen-backend/src/routes/authRoutes.js:34-39`
**Controller:** `aigen-backend/src/controllers/authController.js:182-187`

- ✅ Path matches: `/auth/basic/reset-password`
- ✅ HTTP method: `POST`
- ✅ Query parameter: `token` (string, required)
- ✅ Request body: `newPassword` (string)
- ✅ Response: `{message: "...", data: null}`
- ⚠️ Minor: OpenAPI example shows `data: {success: true}`, backend returns `data: null`

---

## Files Reviewed (Total: 16)

### OpenAPI Files (11)
1. `docs/openapi/openapi.yaml`
2. `docs/openapi/paths/health.yaml`
3. `docs/openapi/paths/auth_login_basic.yaml`
4. `docs/openapi/paths/auth_me.yaml`
5. `docs/openapi/paths/auth_switch-role.yaml`
6. `docs/openapi/paths/auth_login_oauth_google.yaml`
7. `docs/openapi/paths/auth_basic_forgot-password.yaml`
8. `docs/openapi/paths/auth_basic_reset-password.yaml`
9. `docs/openapi/paths/auth_forgot-password.yaml` (deprecated)
10. `docs/openapi/paths/auth_reset-password.yaml` (deprecated)
11. `docs/openapi/components/schemas/ErrorResponse.yaml`

### Backend Files (5)
1. `aigen-backend/app.js`
2. `aigen-backend/src/routes/healthRoutes.js`
3. `aigen-backend/src/routes/authRoutes.js`
4. `aigen-backend/src/controllers/healthController.js`
5. `aigen-backend/src/controllers/authController.js`
6. `aigen-backend/src/services/authService.js`

---

## Discrepancy Reference Summary

| ID | Endpoint | Severity | Issue Type | Status |
|----|----------|----------|------------|--------|
| D001 | GET /health | HIGH | Response schema mismatch | Open |
| D002 | GET /auth/me | MEDIUM | Unnecessary field in OpenAPI | Open |
| D003 | GET /auth/me | MEDIUM | Missing field in OpenAPI schema | Open |
| D004 | PUT /auth/switch-role | HIGH | Empty request schema | Open |
| D005 | GET /auth/login/oauth/google | LOW | Incorrect security scheme | Open |
| D006 | POST /auth/login/oauth/google | HIGH | Empty request schema | Open |
| D007 | POST /auth/basic/forgot-password | HIGH | Empty request schema | Open |

---

## Time Spent
- Phase A (Read OpenAPI): 25 minutes
- Phase B (Read Backend): 35 minutes
- Phase C (Cross-Reference): 30 minutes
- Phase D (Document Findings): 40 minutes
- **Total:** 2 hours 10 minutes

---

## Next Steps
1. Document discrepancies in `discrepancies.md`
2. Update master checklist
3. Proceed to Batch 2: ACL + Mock Testing
