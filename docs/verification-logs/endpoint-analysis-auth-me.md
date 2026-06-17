# Deep Analysis: GET /auth/me

## 1. Model Analysis

### User Model Definition
**File:** `aigen-backend/src/models/default/user.js`

```javascript
const User = sequelize.define('users', {
    name: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    type: { type: DataTypes.INTEGER, allowNull: false },
    asigned_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
});
```

### Actual Model Fields:
- `id` (auto-generated primary key)
- `name` (STRING)
- `email` (STRING)
- `password` (STRING)
- `type` (INTEGER) ← Will be transformed
- `asigned_by` (INTEGER)
- `created_at` (auto-generated timestamp)
- `updated_at` (auto-generated timestamp)
- `deleted_at` (auto-generated timestamp, nullable)

### Fields NOT in Model:
- ❌ `level`
- ❌ `active`
- ❌ `role_id`

---

## 2. Data Flow Trace

### Route Definition
**File:** `aigen-backend/src/routes/authRoutes.js:52-56`

```javascript
router.get(
  '/me',
  authService.authenticateToken,  // Middleware: validates JWT
  asyncWrap(authController.tokenProfile)
);
```

### Controller
**File:** `aigen-backend/src/controllers/authController.js:163-166`

```javascript
exports.tokenProfile = async (req, res) => {
  const result = await authService.tokenProfile(req.user);
  return sendResponse(res, result, 'Profile Berhasil', 200);
};
```

### Service Logic
**File:** `aigen-backend/src/services/authService.js:417-451`

```javascript
exports.tokenProfile = async (tokenPayload) => {
    const user = await userQueryRepository.findUserByEmail(tokenPayload.data.email);
    if (!user) {
        throw new UnauthorizedError('User not found');
    }

    const roles = [];
    const vendorCodes = [];

    if (user.type === USER_MODEL_TYPE.INTERNAL) {
        const userMatrix = await userMatrixQueryRepository.findManyUserMatrixByUserId(user.id, { includeRole: true });
        userMatrix.forEach(um => {
            if (!roles.includes(um.role.slug)) {
                roles.push(um.role.slug);
            }
        });
    } else {
        const vendors = await vendorQueryRepository.findManyVendorByEmail(user.email);
        vendors.forEach(v => {
            if (!vendorCodes.includes(v.vendor_number)) {
                vendorCodes.push(v.vendor_number);
            }
        });
    }

    return {
        current_user: {
            ...user.dataValues,  // ← Spreads User model fields
            type: getUserModelTypeLabel(user.dataValues.type),  // ← Transforms type
            password: undefined  // ← Excludes password
        },
        available_roles: roles,  // ← Array of string slugs
        available_vendor_codes: vendorCodes  // ← Array of vendor codes
    }
};
```

---

## 3. Transformations Applied

### Transformation 1: getUserModelTypeLabel
**File:** `aigen-backend/src/services/userService.js:12`

```javascript
exports.getUserModelTypeLabel = (value = null) => getConstObjectLabel(value, USER_MODEL_TYPE);
```

**Input:** `type: 1` (integer)
**Output:** `type: {value: 1, label: "INTERNAL"}` (object)

**USER_MODEL_TYPE constant:**
```javascript
{
  INTERNAL: 1,
  VENDOR: 2
}
```

### Transformation 2: Spread Operator
```javascript
...user.dataValues
```

Takes all fields from User model:
- `id`
- `name`
- `email`
- `type` (will be overwritten)
- `asigned_by`
- `created_at`
- `updated_at`
- `deleted_at`
- `password` (will be set to undefined)

### Transformation 3: Password Exclusion
```javascript
password: undefined
```

Removes password from response.

### Transformation 4: Response Wrapper
**File:** `aigen-backend/src/helper/log.js:37-44`

```javascript
function sendResponse(res, data, message, status = 200) {
    const response = {
        message: message,
        data: data,
    };
    return res.status(status).json(response);
}
```

Wraps all responses in `{message, data}` format.

---

## 4. Actual Response Structure (from code analysis)

```json
{
  "message": "Profile Berhasil",
  "data": {
    "current_user": {
      "id": number,
      "name": string,
      "email": string,
      "type": {
        "value": number,
        "label": string
      },
      "asigned_by": number,
      "created_at": string (ISO 8601),
      "updated_at": string (ISO 8601),
      "deleted_at": string | null
    },
    "available_roles": string[],
    "available_vendor_codes": string[]
  }
}
```

---

## 5. User-Provided Actual Response (for validation)

```json
{
    "message": "Profile Berhasil",
    "data": {
        "current_user": {
            "id": 1,
            "name": "Admin Procurement",
            "email": "procurement@sinarmasmining.com",
            "type": {
                "value": 1,
                "label": "INTERNAL"
            },
            "asigned_by": 0,
            "created_at": "2026-04-23T11:07:05.000Z",
            "updated_at": "2026-04-23T11:07:05.000Z",
            "deleted_at": null
        },
        "available_roles": [
            "admin",
            "category-specialist"
        ],
        "available_vendor_codes": []
    }
}
```

### ✅ Validation Result
**Code analysis matches user-provided response 100%**

---

## 6. Current OpenAPI Schema

**File:** `docs/openapi/paths/auth_me.yaml`

### Schema Definition (lines 14-70):
```yaml
data:
  type: object
  properties:
    current_user:
      type: object
      properties:
        id: {type: integer}
        name: {type: string}
        email: {type: string}
        asigned_by: {type: integer}
        level: {type: integer}           # ❌ NOT in actual response
        active: {type: integer}          # ❌ NOT in actual response
        role_id: {type: integer}         # ❌ NOT in actual response
        created_at: {type: string}
        updated_at: {type: string}
      required:
        - id
        - name
        - email
        - asigned_by
        - level              # ❌ Wrong
        - active             # ❌ Wrong
        - role_id            # ❌ Wrong
        - created_at
        - updated_at
    available_roles:
      type: array
      items:
        type: object         # ❌ Wrong! Should be string
        properties:
          id: {type: integer}
          slug: {type: string}
          name: {type: string}
          is_active: {type: boolean}
    access_token: {type: string}  # ❌ NOT in actual response
  required:
    - current_user
    - available_roles
    - access_token            # ❌ Wrong
```

### Example (lines 74-92):
```yaml
example:
  message: Profile Berhasil
  data:
    current_user:
      id: 1
      name: Admin Procurement
      email: procurement@sinarmasmining.com
      type:
        value: 1
        label: INTERNAL
      asigned_by: 0
      created_at: '2026-03-05T10:46:05.000Z'
      updated_at: '2026-03-05T10:46:05.000Z'
      deleted_at: null
    available_roles:
      - admin
      - category-specialist
    available_vendor_codes: []
```

**Note:** Example is mostly correct, but schema is wrong!

---

## 7. Discrepancies Found

### Issue 1: Extra Fields in Schema (NOT in actual response)
- ❌ `current_user.level`
- ❌ `current_user.active`
- ❌ `current_user.role_id`
- ❌ `access_token` (top-level in data)

### Issue 2: Missing Field in Schema
- ❌ `current_user.type` - Not defined in schema!

### Issue 3: Wrong Field Type
- ❌ `available_roles` defined as `array of objects`
- ✅ Should be: `array of strings`

### Issue 4: Missing Field in Schema
- ❌ `available_vendor_codes` - Not in schema (only in example)
- ❌ `current_user.deleted_at` - Not in schema

---

## 8. Recommended Fixes

### Fix 1: Remove Extra Fields from Schema
Remove these from schema definition and required array:
- `level`
- `active`
- `role_id`
- `access_token`

### Fix 2: Add Missing Field
Add to `current_user` properties:
```yaml
type:
  type: object
  properties:
    value:
      type: integer
      description: Numeric user type (1=INTERNAL, 2=VENDOR)
    label:
      type: string
      enum: [INTERNAL, VENDOR]
      description: Human-readable user type label
  required:
    - value
    - label
deleted_at:
  type: string
  format: date-time
  nullable: true
```

### Fix 3: Correct available_roles Type
Change from:
```yaml
available_roles:
  type: array
  items:
    type: object
    properties: {...}
```

To:
```yaml
available_roles:
  type: array
  items:
    type: string
  description: Array of role slugs available to the user
  example: ["admin", "category-specialist"]
```

### Fix 4: Add available_vendor_codes to Schema
```yaml
available_vendor_codes:
  type: array
  items:
    type: string
  description: Array of vendor codes for vendor-type users (empty for internal users)
  example: []
```

---

## 9. Corrected Schema (Proposed)

```yaml
data:
  type: object
  properties:
    current_user:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        email:
          type: string
        type:
          type: object
          properties:
            value:
              type: integer
              description: Numeric user type (1=INTERNAL, 2=VENDOR)
            label:
              type: string
              enum: [INTERNAL, VENDOR]
          required:
            - value
            - label
        asigned_by:
          type: integer
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        deleted_at:
          type: string
          format: date-time
          nullable: true
      required:
        - id
        - name
        - email
        - type
        - asigned_by
        - created_at
        - updated_at
    available_roles:
      type: array
      items:
        type: string
      description: Array of role slugs available to the user
    available_vendor_codes:
      type: array
      items:
        type: string
      description: Array of vendor codes for vendor-type users
  required:
    - current_user
    - available_roles
    - available_vendor_codes
```

---

## 10. Confidence Level

✅ **100% Confident** - Code analysis matches user-provided actual response exactly.

### Evidence:
1. ✅ User model definition read and verified
2. ✅ Helper function `getUserModelTypeLabel` traced
3. ✅ Service logic analyzed line-by-line
4. ✅ Response wrapper `sendResponse` verified
5. ✅ Actual API response provided by user confirms analysis

**Status:** Ready to apply fixes
