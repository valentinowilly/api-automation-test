# OpenAPI Verification - All Issues Found

## Analysis Status

**Methodology:** Deep code tracing with model verification
- ✅ Batch 1 (Auth): Complete - 3 errors found
- 🔄 Batch 2 (Users/Roles): In progress
- ⏳ Batches 3-18: Pending

---

## BATCH 1: Authentication Endpoints (9 total)

### ❌ Error 1: GET `/auth/me`
**File:** `docs/openapi/paths/auth_me.yaml`

**Issues:**
1. Missing field: `current_user.type` object `{value, label}`
2. Extra fields NOT in response: `level`, `active`, `role_id`
3. Wrong `available_roles` type: array of objects → should be array of strings
4. Missing fields: `deleted_at`, `available_vendor_codes`

**Confidence:** 100% (verified with user's actual API response)

---

### ❌ Error 2: GET `/auth/basic/reset-password`
**File:** `docs/openapi/paths/auth_basic_reset-password.yaml` (lines 54-99)

**Issue:** Response `data` shows `{success: true}` but actual is `null`

**Evidence:** `authController.basicVerifyResetToken` line 179: `sendResponse(res, null, 'Token valid.', 200)`

---

### ❌ Error 3: POST `/auth/basic/reset-password`
**File:** `docs/openapi/paths/auth_basic_reset-password.yaml` (lines 1-52)

**Issues:**
1. Response `data` shows `{success: true}` but actual is `null`
2. Request body schema missing `newPassword` property
3. Wrong security: `bearer: []` → should be `security: []` (public endpoint)

**Evidence:** `authController.basicResetPassword` line 186: `sendResponse(res, null, '...', 200)`

---

## BATCH 2: User & Role Management Endpoints

### ❌ Error 4: GET `/master/users` (Pagination)
**File:** `docs/openapi/paths/master_users.yaml` (GET method, lines 43-280)

**Issues:**
1. Schema shows `username` as required field (lines 130, 152)
   - ❌ User model does NOT have `username` field
   - Model fields: id, name, email, password, type, asigned_by, timestamps

2. Schema may show `asigned_by` field
   - ❌ Service explicitly removes it: `asigned_by: undefined` (userService.js:67)
   - Should NOT appear in response

**Evidence:**
- Model: `aigen-backend/src/models/default/user.js` (no username field)
- Service: `userService.paginateUser` line 67 removes `asigned_by`

**Actual Response Structure:**
```json
{
  "data": {
    "data": [
      {
        "id": number,
        "name": string,
        "email": string,
        "type": {
          "value": number,
          "label": string
        },
        "created_at": string,
        "updated_at": string,
        "deleted_at": string | null
      }
    ],
    "pagination": {...}
  }
}
```

---

## Summary So Far

**Total Endpoints Analyzed:** 10
**Errors Found:** 4 endpoints with issues
**Error Rate:** 40%

### Common Patterns Identified:
1. ✅ Authentication endpoints mostly correct (6/9)
2. ❌ Password reset endpoints have wrong `data` type
3. ❌ User-related fields often incorrect (username, level, active, role_id)
4. ❌ Type transformations not reflected in schemas (`type` object)

---

## Next: Continue Batch 2-18 Analysis

Remaining to analyze: ~120 endpoints

**Strategy:** Quick pattern scan + deep dive on suspicious schemas

