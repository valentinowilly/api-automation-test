# OpenAPI Verification Discrepancies

This document tracks all discrepancies found between the OpenAPI documentation and the actual backend implementation.

## Summary Statistics
- **Total Discrepancies:** 7
- **Critical:** 0
- **High:** 4 (D001, D004, D006, D007)
- **Medium:** 2 (D002, D003)
- **Low:** 1 (D005)

## Discrepancy Template

```markdown
---

## Discrepancy #XXX

**Batch:** [Batch Number]
**Endpoint:** [METHOD] [PATH]
**OpenAPI File:** [filename.yaml]
**Backend File:** [path/to/controller.js:line]

### Issue Type
- [ ] Route Path Mismatch
- [ ] HTTP Method Mismatch
- [ ] Response Schema Mismatch
- [ ] Request Schema Mismatch
- [ ] Example Incorrect
- [ ] Missing Endpoint
- [ ] Undocumented Endpoint

### Severity
- [ ] Critical
- [ ] High
- [ ] Medium
- [ ] Low

### Description
[Detailed description of the discrepancy]

**What OpenAPI Says:**
[OpenAPI specification excerpt]

**What Backend Implements:**
[Backend implementation excerpt]

### Recommendation
[Recommended fix with rationale]

### Affected Files
- [List of files that need updates]

### Action Items
- [ ] [Action item 1]
- [ ] [Action item 2]
```

---

## Discrepancies Log

---

## Discrepancy #D001

**Batch:** 1
**Endpoint:** GET /health
**OpenAPI File:** `docs/openapi/paths/health.yaml`
**Backend File:** `aigen-backend/src/controllers/healthController.js:4-10`

### Issue Type
- [ ] Route Path Mismatch
- [ ] HTTP Method Mismatch
- [x] Response Schema Mismatch
- [ ] Request Schema Mismatch
- [ ] Example Incorrect
- [ ] Missing Endpoint
- [ ] Undocumented Endpoint

### Severity
- [ ] Critical
- [x] High
- [ ] Medium
- [ ] Low

### Description
The health check endpoint returns a different response structure than documented in OpenAPI.

**What OpenAPI Says:**
```yaml
responses:
  '200':
    content:
      application/json:
        schema:
          type: object
          properties:
            status:
              type: string
              example: "healthy"
            timestamp:
              type: string
              format: date-time
            uptime:
              type: number
        example:
          status: "healthy"
          timestamp: "2026-04-23T10:30:00.000Z"
          uptime: 3600
```

**What Backend Implements:**
```javascript
// healthController.js:6
return sendResponse(res, {}, 'API is healthy', 200);

// sendResponse wraps as:
{
  "message": "API is healthy",
  "data": {}
}
```

### Recommendation
**Option 1 (Recommended):** Update health controller to match OpenAPI spec:
```javascript
exports.healthCheck = async (req, res) => {
    try {
        return res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
}
```

**Option 2:** Update OpenAPI to match current implementation (use StandardResponse format).

### Affected Files
- `docs/openapi/paths/health.yaml`
- `aigen-backend/src/controllers/healthController.js`

### Action Items
- [ ] Decide on standard: OpenAPI spec or backend implementation
- [ ] Update code/documentation accordingly
- [ ] Test health check endpoint
- [ ] Update any monitoring tools that rely on health check response

---

## Discrepancy #D002

**Batch:** 1
**Endpoint:** GET /auth/me
**OpenAPI File:** `docs/openapi/paths/auth_me.yaml`
**Backend File:** `aigen-backend/src/services/authService.js:417-451`

### Issue Type
- [ ] Route Path Mismatch
- [ ] HTTP Method Mismatch
- [x] Response Schema Mismatch
- [ ] Request Schema Mismatch
- [ ] Example Incorrect
- [ ] Missing Endpoint
- [ ] Undocumented Endpoint

### Severity
- [ ] Critical
- [ ] High
- [x] Medium
- [ ] Low

### Description
OpenAPI documentation shows `access_token` in the /auth/me response, but the backend does not return this field. This makes sense because the endpoint requires authentication (user already has a valid token).

**What OpenAPI Says:**
```yaml
data:
  current_user: {...}
  available_roles: [...]
  access_token: "eyJhbGci..."  # ← This field is documented
```

**What Backend Implements:**
```javascript
// authService.js:442-450
return {
  current_user: {...},
  available_roles: roles,
  available_vendor_codes: vendorCodes,
  // No access_token returned
}
```

### Recommendation
Remove `access_token` from OpenAPI response schema and example for /auth/me endpoint. The user already has a valid token to call this endpoint.

### Affected Files
- `docs/openapi/paths/auth_me.yaml` (lines 65-66, 92)

### Action Items
- [ ] Remove `access_token` from response schema
- [ ] Remove `access_token` from example response
- [ ] Verify no frontend code expects this field

---

## Discrepancy #D003

**Batch:** 1
**Endpoint:** GET /auth/me
**OpenAPI File:** `docs/openapi/paths/auth_me.yaml`
**Backend File:** `aigen-backend/src/services/authService.js:417-451`

### Issue Type
- [ ] Route Path Mismatch
- [ ] HTTP Method Mismatch
- [x] Response Schema Mismatch
- [ ] Request Schema Mismatch
- [ ] Example Incorrect
- [ ] Missing Endpoint
- [ ] Undocumented Endpoint

### Severity
- [ ] Critical
- [ ] High
- [x] Medium
- [ ] Low

### Description
Backend returns `available_vendor_codes` array for vendor-type users, but this field is not properly documented in the OpenAPI schema (only appears in example).

**What OpenAPI Says:**
```yaml
# Schema does not include available_vendor_codes
data:
  properties:
    current_user: {...}
    available_roles: {...}
    access_token: {...}
  # missing: available_vendor_codes

# But example shows:
example:
  ...
  available_vendor_codes: []  # ← Only in example
```

**What Backend Implements:**
```javascript
// authService.js:448
return {
  current_user: {...},
  available_roles: roles,
  available_vendor_codes: vendorCodes,  // ← Backend returns this
}
```

### Recommendation
Add `available_vendor_codes` to the OpenAPI response schema:
```yaml
data:
  type: object
  properties:
    current_user: {...}
    available_roles:
      type: array
      items:
        type: string
    available_vendor_codes:
      type: array
      items:
        type: string
      description: Available vendor codes for vendor-type users
```

### Affected Files
- `docs/openapi/paths/auth_me.yaml`

### Action Items
- [ ] Add `available_vendor_codes` to response schema
- [ ] Update schema description to clarify when this field is populated
- [ ] Verify example is accurate

---

## Discrepancy #D004

**Batch:** 1
**Endpoint:** PUT /auth/switch-role
**OpenAPI File:** `docs/openapi/paths/auth_switch-role.yaml`
**Backend File:** `aigen-backend/src/services/authService.js:390-415`

### Issue Type
- [ ] Route Path Mismatch
- [ ] HTTP Method Mismatch
- [ ] Response Schema Mismatch
- [x] Request Schema Mismatch
- [ ] Example Incorrect
- [ ] Missing Endpoint
- [ ] Undocumented Endpoint

### Severity
- [ ] Critical
- [x] High
- [ ] Medium
- [ ] Low

### Description
OpenAPI shows empty request schema `properties: {}`, but the backend expects `role_id` parameter.

**What OpenAPI Says:**
```yaml
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties: {}  # ← Empty!
      example:
        role_id: 1  # ← Only in example
```

**What Backend Implements:**
```javascript
// authService.js:390
exports.switchRole = async ({ role_id }, decodedToken) => {
  // Expects role_id in request body
```

### Recommendation
Update OpenAPI schema to include `role_id`:
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - role_id
        properties:
          role_id:
            type: integer
            description: ID of the role to switch to
            example: 1
```

### Affected Files
- `docs/openapi/paths/auth_switch-role.yaml` (lines 12-13)

### Action Items
- [ ] Add `role_id` to request schema
- [ ] Mark as required field
- [ ] Add description

---

## Discrepancy #D005

**Batch:** 1
**Endpoint:** GET /auth/login/oauth/google
**OpenAPI File:** `docs/openapi/paths/auth_login_oauth_google.yaml`
**Backend File:** `aigen-backend/src/routes/authRoutes.js:41-45`

### Issue Type
- [ ] Route Path Mismatch
- [ ] HTTP Method Mismatch
- [ ] Response Schema Mismatch
- [ ] Request Schema Mismatch
- [ ] Example Incorrect
- [x] Other: Incorrect security scheme

### Severity
- [ ] Critical
- [ ] High
- [ ] Medium
- [x] Low

### Description
OpenAPI shows that this endpoint requires bearer token authentication, but it should be publicly accessible (it's used to initiate OAuth flow).

**What OpenAPI Says:**
```yaml
security:
  - bearer: []  # ← Requires authentication
```

**What Backend Implements:**
```javascript
// authRoutes.js:41-45
router.get(
  '/login/oauth/google',
  validatorMiddleware(authSchema.schemaGetGoogleOAuthUrl, QUERY),
  asyncWrap(authController.getGoogleOAuthUrl)
);
// No authService.authenticateToken middleware
```

### Recommendation
Remove or override security requirement in OpenAPI:
```yaml
security: []  # No authentication required
```

### Affected Files
- `docs/openapi/paths/auth_login_oauth_google.yaml` (lines 34-35)

### Action Items
- [ ] Change `security: - bearer: []` to `security: []`

---

## Discrepancy #D006

**Batch:** 1
**Endpoint:** POST /auth/login/oauth/google
**OpenAPI File:** `docs/openapi/paths/auth_login_oauth_google.yaml`
**Backend File:** `aigen-backend/src/services/authService.js:481-542`

### Issue Type
- [ ] Route Path Mismatch
- [ ] HTTP Method Mismatch
- [ ] Response Schema Mismatch
- [x] Request Schema Mismatch
- [ ] Example Incorrect
- [ ] Missing Endpoint
- [ ] Undocumented Endpoint

### Severity
- [ ] Critical
- [x] High
- [ ] Medium
- [ ] Low

### Description
OpenAPI shows empty request schema, but backend expects `authorization_code` or `access_token`.

**What OpenAPI Says:**
```yaml
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties: {}  # ← Empty!
      example:
        authorization_code: "4/0AfrIepAOtuBlkq05..."
```

**What Backend Implements:**
```javascript
// authService.js:481
exports.authenticateGoogleOauth = async ({ authorization_code, access_token }) => {
  // Accepts authorization_code OR access_token
```

### Recommendation
Update OpenAPI schema:
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        properties:
          authorization_code:
            type: string
            description: Authorization code from Google OAuth callback
          access_token:
            type: string
            description: Access token (alternative to authorization_code for advanced flows)
        oneOf:
          - required: [authorization_code]
          - required: [access_token]
```

### Affected Files
- `docs/openapi/paths/auth_login_oauth_google.yaml` (lines 46-48)

### Action Items
- [ ] Add `authorization_code` and `access_token` to schema
- [ ] Use `oneOf` to indicate either field is required
- [ ] Add descriptions

---

## Discrepancy #D007

**Batch:** 1
**Endpoint:** POST /auth/basic/forgot-password
**OpenAPI File:** `docs/openapi/paths/auth_basic_forgot-password.yaml`
**Backend File:** `aigen-backend/src/controllers/authController.js:170-174`

### Issue Type
- [ ] Route Path Mismatch
- [ ] HTTP Method Mismatch
- [ ] Response Schema Mismatch
- [x] Request Schema Mismatch
- [x] Example Incorrect
- [ ] Missing Endpoint
- [ ] Undocumented Endpoint

### Severity
- [ ] Critical
- [x] High
- [ ] Medium
- [ ] Low

### Description
OpenAPI shows empty request schema and incorrect security requirement.

**What OpenAPI Says:**
```yaml
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties: {}  # ← Empty!
      example:
        email: user@example.com

security:
  - bearer: []  # ← Requires auth (wrong!)
```

**What Backend Implements:**
```javascript
// authController.js:171
const { email } = req.dto;
// Expects email in request body

// authRoutes.js:22-26 - No authentication middleware
```

### Recommendation
1. Update request schema:
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - email
        properties:
          email:
            type: string
            format: email
            description: User's registered email address
```

2. Remove authentication requirement:
```yaml
security: []  # Public endpoint
```

3. Fix response example (backend returns `data: null`, not `data: {success: true}`)

### Affected Files
- `docs/openapi/paths/auth_basic_forgot-password.yaml`

### Action Items
- [ ] Add `email` to request schema
- [ ] Remove security requirement
- [ ] Fix response example
