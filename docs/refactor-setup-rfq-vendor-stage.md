# Refactor: Unify `setupRFQAtVendorStage` S1/S2/S3

## Background

Three exported functions in `pre-test.helper.js` share identical login, config-save, and RFQ-creation logic. They diverge only in `skip_level_1` config target, vendor token polling strategy, and what extra data is returned. This refactor collapses them into one function dispatching to three private sub-functions (`runScenarioS1`, `runScenarioS2`, `runScenarioS3`), then updates all 11 callers in test files.

**Functions being removed:**
- `setupRFQAtVendorStageS2`
- `setupRFQAtVendorStageS3`

**Functions being updated:**
- `setupRFQAtVendorStage` (unified replacement)
- `setupRFQAtVendorStageS3WithVARevise` (internal call updated)
- `setupRFQAtDICStage` (two internal calls updated)

---

## Files to Change

| File | Type of change |
|---|---|
| `tests/e2e/rfq-workflow/helpers/pre-test.helper.js` | Major refactor |
| `tests/e2e/rfq-workflow/s2-vendor-agregator/va1-not-yet-action.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s2-vendor-agregator/va2-accept.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s2-vendor-agregator/va3-need-confirm.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s2-vendor-agregator/va4-decline.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s2-vendor-agregator/va5-expired.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s2-vendor-agregator/va6-accept-oe.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s3-vendor-combined/v01-not-yet-action.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s3-vendor-combined/v02-vd-accept.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s3-vendor-combined/v03-vd-accept-oe.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s3-vendor-combined/v04-vd-need-confirm.test.js` | Import + call |
| `tests/e2e/rfq-workflow/s3-vendor-combined/v05-vd-decline.test.js` | Import + call |

---

## Step 1 — `pre-test.helper.js`

### 1a. Insert three private sub-functions before line 132

Insert these three functions between the `// ─── Stage-entry functions ───` banner (line 114) and the existing `export async function setupRFQAtVendorStage` at line 132.

```js
async function runScenarioS1(rfqNumber) {
  const vendorTokenVD = await pollForVendorToken(rfqNumber, VENDOR_TYPE.DIRECT);
  return { vendorTokenVD, vendorTokenVA: null, vendorCodeVD: null, vendorCodeVA: null };
}

async function runScenarioS2(rfqNumber) {
  const vendorTokenVD = await pollForVendorToken(rfqNumber, VENDOR_TYPE.DIRECT);
  const rfqItemsVD = await getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT);
  await applyVendorAction(rfqItemsVD, 'decline', vendorTokenVD);
  const vendorTokenVA = await pollForVendorToken(rfqNumber, VENDOR_TYPE.AGGREGATOR);
  return { vendorTokenVD, vendorTokenVA, vendorCodeVD: null, vendorCodeVA: null };
}

async function runScenarioS3(rfqNumber) {
  const [vendorTokenVD, vendorTokenVA] = await Promise.all([
    pollForVendorToken(rfqNumber, VENDOR_TYPE.DIRECT),
    pollForVendorToken(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const [rfqItemsVD, rfqItemsVA] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  return {
    vendorTokenVD,
    vendorTokenVA,
    vendorCodeVD: rfqItemsVD[0]?.vendor_code ?? null,
    vendorCodeVA: rfqItemsVA[0]?.vendor_code ?? null,
  };
}
```

> `runScenarioS2` calls `applyVendorAction` which is defined at line 421 in the same file. This is safe — JS function declarations are hoisted within a module.

---

### 1b. Replace `setupRFQAtVendorStage` body (lines 132–160)

**Old:**
```js
export async function setupRFQAtVendorStage({ scenario = 's1', itemCount = 1, serverGroup = 'BCG' } = {}) {
  const [adminToken, csToken, clToken, dicToken, mgToken] = await Promise.all([
    loginAs(ROLES.ADMIN),
    loginAs(ROLES.CS, 'mrr'),
    loginAs(ROLES.CL, 'mrr'),
    loginAs(ROLES.DIC),
    loginManagement(),
  ]);

  const savedConfig = await saveCurrentConfigState(serverGroup, adminToken);
  if (savedConfig.skipLevel1?.config_value !== 'no') {
    await updateSkipLevel1Config(serverGroup, 'no', adminToken);
  }

  const { rfqRecord, prNumber } = await createRFQBase(adminToken, itemCount);
  const rfqNumber = rfqRecord.rfq_number;

  const vendorTokenVD = await pollForVendorToken(rfqNumber, VENDOR_TYPE.DIRECT);
  const vendorTokenVA = scenario === 's3'
    ? await pollForVendorToken(rfqNumber, VENDOR_TYPE.AGGREGATOR)
    : null; // s2: VA token not yet active — VD must decline first

  const cleanup = async (qcfNumber = null) => {
    await restoreConfigState(savedConfig, adminToken);
    await cleanupAllTestData(rfqNumber, qcfNumber, prNumber);
  };

  return { rfqNumber, prNumber, rfqRecord, vendorTokenVD, vendorTokenVA, adminToken, csToken, clToken, dicToken, mgToken, cleanup };
}
```

**New:**
```js
export async function setupRFQAtVendorStage({ scenario = 's1', itemCount, serverGroup = 'BCG' } = {}) {
  const resolvedItemCount = itemCount ?? (scenario === 's3' ? 3 : 1);

  const [adminToken, csToken, clToken, dicToken, mgToken] = await Promise.all([
    loginAs(ROLES.ADMIN),
    loginAs(ROLES.CS, 'mrr'),
    loginAs(ROLES.CL, 'mrr'),
    loginAs(ROLES.DIC),
    loginManagement(),
  ]);

  const savedConfig = await saveCurrentConfigState(serverGroup, adminToken);
  const targetSkip = scenario === 's3' ? 'yes' : 'no';
  if (savedConfig.skipLevel1?.config_value !== targetSkip) {
    await updateSkipLevel1Config(serverGroup, targetSkip, adminToken);
  }

  const { rfqRecord, prNumber } = await createRFQBase(adminToken, resolvedItemCount);
  const rfqNumber = rfqRecord.rfq_number;

  const { vendorTokenVD, vendorTokenVA, vendorCodeVD, vendorCodeVA } =
    scenario === 's2' ? await runScenarioS2(rfqNumber) :
    scenario === 's3' ? await runScenarioS3(rfqNumber) :
                        await runScenarioS1(rfqNumber);

  const cleanup = async (qcfNumber = null) => {
    await restoreConfigState(savedConfig, adminToken);
    await cleanupAllTestData(rfqNumber, qcfNumber, prNumber);
  };

  return {
    rfqNumber, prNumber, rfqRecord,
    vendorTokenVD, vendorTokenVA,
    vendorCodeVD, vendorCodeVA,
    adminToken, csToken, clToken, dicToken, mgToken,
    cleanup,
  };
}
```

> `itemCount` now defaults to `undefined` so `??` can apply the scenario-specific default (3 for s3, 1 otherwise). An explicit value from the caller always wins.

---

### 1c. Delete `setupRFQAtVendorStageS2` — remove lines 162–205

Delete from the JSDoc comment `/** S2 Stage 1 — ...` (line 162) through the closing `}` at line 205 inclusive.

---

### 1d. Delete `setupRFQAtVendorStageS3` — remove lines 207–252

Delete from the JSDoc comment `/** S3 Stage 1 — ...` (line 207) through the closing `}` at line 252 inclusive.

> After deletions 1c and 1d, `setupRFQAtVendorStageS3WithVARevise` will start at approximately line 162. Line numbers below reference the **original** file.

---

### 1e. Update `setupRFQAtVendorStageS3WithVARevise` — line 269

```js
// Before:
const ctx = await setupRFQAtVendorStageS3({ serverGroup, itemCount });

// After:
const ctx = await setupRFQAtVendorStage({ scenario: 's3', serverGroup, itemCount });
```

---

### 1f. Update `setupRFQAtDICStage` — lines 325 and 329

```js
// Line 325 — Before:
ctx = await setupRFQAtVendorStageS2({ itemCount: 1 });
// Line 325 — After:
ctx = await setupRFQAtVendorStage({ scenario: 's2', itemCount: 1 });

// Line 329 — Before:
ctx = await setupRFQAtVendorStageS3({ itemCount: 1 });
// Line 329 — After:
ctx = await setupRFQAtVendorStage({ scenario: 's3', itemCount: 1 });
```

---

## Step 2 — S2 test files (6 files, identical change each)

Each file in `tests/e2e/rfq-workflow/s2-vendor-agregator/` follows this exact pattern:

**Line 2 — import:**
```js
// Before:
import { setupRFQAtVendorStageS2 } from '../helpers/pre-test.helper.js';

// After:
import { setupRFQAtVendorStage } from '../helpers/pre-test.helper.js';
```

**Line 16 — call inside `beforeAll`:**
```js
// Before:
ctx = await setupRFQAtVendorStageS2();

// After:
ctx = await setupRFQAtVendorStage({ scenario: 's2' });
```

Files to change:
- `va1-not-yet-action.test.js`
- `va2-accept.test.js`
- `va3-need-confirm.test.js`
- `va4-decline.test.js`
- `va5-expired.test.js`
- `va6-accept-oe.test.js`

---

## Step 3 — S3 test files (5 files, identical change each)

Each file in `tests/e2e/rfq-workflow/s3-vendor-combined/` follows this exact pattern:

**Line 2 — import:**
```js
// Before:
import { setupRFQAtVendorStageS3 } from '../helpers/pre-test.helper.js';

// After:
import { setupRFQAtVendorStage } from '../helpers/pre-test.helper.js';
```

**Call inside `beforeAll` (line 15 in v01–v02, line 16 in v03–v05):**
```js
// Before:
ctx = await setupRFQAtVendorStageS3();

// After:
ctx = await setupRFQAtVendorStage({ scenario: 's3' });
```

Files to change:
- `v01-not-yet-action.test.js` (call on line 15)
- `v02-vd-accept.test.js` (call on line 15)
- `v03-vd-accept-oe.test.js` (call on line 16)
- `v04-vd-need-confirm.test.js` (call on line 16)
- `v05-vd-decline.test.js` (call on line 16)

---

## Callers That Do NOT Need Changes

| Caller | Why untouched |
|---|---|
| `setupRFQAtDICStageMixed` (line 300) | Already calls `setupRFQAtVendorStage({ scenario, itemCount })` |
| `setupRFQAtDICStage` s1 branch (line 335) | Already calls `setupRFQAtVendorStage({ scenario })` |
| `v06-no-action-va-revise.test.js` | Uses `setupRFQAtVendorStageS3WithVARevise`, not the deleted functions |
| `v07-vd-decline-va-revise.test.js` | Uses `setupRFQAtVendorStageS3WithVARevise`, not the deleted functions |
| All DIC/CS/CL/management test files | Already import and call `setupRFQAtVendorStage({ scenario: 's3' })` |

---

## Return Shape After Refactor

The unified function always returns the same shape regardless of scenario:

```js
{
  rfqNumber,      // string
  prNumber,       // string
  rfqRecord,      // object
  vendorTokenVD,  // string
  vendorTokenVA,  // string | null  (null for s1)
  vendorCodeVD,   // string | null  (null for s1, s2)
  vendorCodeVA,   // string | null  (null for s1, s2)
  adminToken,     // string
  csToken,        // string
  clToken,        // string
  dicToken,       // string
  mgToken,        // string
  cleanup,        // async function(qcfNumber?)
}
```

Existing S2 test files never destructured `vendorCodeVD`/`vendorCodeVA` so the additional fields are ignored without any changes.

---

## Verification

After all changes are applied:

```bash
# 1. Confirm deleted function names have no remaining references
grep -r "setupRFQAtVendorStageS2\|setupRFQAtVendorStageS3[^W]" tests/
# Expected: 0 results

# 2. Run S2 suite
npx vitest run tests/e2e/rfq-workflow/s2-vendor-agregator/

# 3. Run S3 suite
npx vitest run tests/e2e/rfq-workflow/s3-vendor-combined/
```
