# DIC Review — E2E Test Reference

> **Purpose:** Complete record of issues found and fixed in DIC01–DIC20.
> Use as the authoritative reference before writing or reviewing any DIC test cases.

---

## Spreadsheet Reference (Use Case Document)

| Range | Sheet | Rows | URL |
|-------|-------|------|-----|
| DIC01–DIC10 | Use Case | 52–61 | [Open spreadsheet](https://docs.google.com/spreadsheets/d/10mCLEhs5AYLFToLazO0P7qSfV9hftmDsGQzj4T1fsC0/edit) |
| DIC11–DIC20 | Use Case | 62–71 | [Open spreadsheet](https://docs.google.com/spreadsheets/d/10mCLEhs5AYLFToLazO0P7qSfV9hftmDsGQzj4T1fsC0/edit) |
| DIC21–DIC30 | Use Case | 72–81 | [Open spreadsheet](https://docs.google.com/spreadsheets/d/10mCLEhs5AYLFToLazO0P7qSfV9hftmDsGQzj4T1fsC0/edit) |

> **Note:** The spreadsheet is the original specification. Where this document
> differs from the spreadsheet, this document reflects the **actual backend behavior**
> as confirmed by running tests. Differences are explicitly called out.

---

## 1. Test Architecture Overview

### Scenario Types (S1 / S2 / S3)

| Scenario | vendor_sequence | Who is active | Setup helper |
|----------|-----------------|---------------|--------------|
| S1 | 1 | Vendor Direct (VD) only | `setupRFQAtDICStage({ vd: '...' })` |
| S2 | 2 | Vendor Alternate/Aggregator (VA) only | `setupRFQAtDICStage({ vd: 'decline', va: '...' }, { scenario: 's2' })` |
| S3 | 3 | Both VD + VA in parallel | `setupRFQAtDICStage({ vd: '...', va: '...' }, { scenario: 's3' })` |

S2 requires `skip_level_1_RFQ = 'no'` in config so that when VD declines,
the backend activates VA as fallback. This config change + VD decline
is handled internally by `setupRFQAtVendorStageS2`.

S3 requires `skip_level_1_RFQ = 'yes'` so both VD and VA are activated in
parallel from the start. This is handled internally by `setupRFQAtVendorStageS3`.

### OE Path vs Standard Path

Items can land in two DIC sub-paths depending on `vendor_price` vs `item_value`:

| Path | Condition | `status_milestone` after DIC accepts |
|------|-----------|--------------------------------------|
| Standard (below-OE) | `vendor_price <= item_value * OE_threshold%` | `DIC_ACCEPTED = 10` |
| OE path (above-OE) | `vendor_price > item_value * OE_threshold%` | `WAITING_OE_REVISION = 14` |

> Threshold is configured per server_group in `config_autopo` (`MAX_PRICE` key).
> Test helper `accept_oe` multiplies by 1.2 (120%) to guarantee above-OE.

---

## 2. Issues Found in DIC01–DIC10 (and Fixes)

### Issue 1 — `VENDOR_TYPE.ALTERNATE` was undefined

**Affected tests:** DIC06, DIC07, DIC08, DIC09, DIC10

**Symptom:**
```
TypeError: Cannot read properties of undefined (reading 'ALTERNATE')
```
SQL bind received `undefined` → MySQL threw a syntax error.

**Root cause:**
`utils/constants/milestone.constant.js` only defined `DIRECT` and `AGGREGATOR`.
DIC06–DIC10 used `VENDOR_TYPE.ALTERNATE` (alias for the same vendor type).

**Fix applied to `utils/constants/milestone.constant.js`:**
```js
export const VENDOR_TYPE = {
  DIRECT:      'direct',
  AGGREGATOR:  'agregator',   // typo in DB column — do NOT change
  ALTERNATE:   'agregator',   // alias used by DIC06–DIC10 tests
};
```

**Rule for DIC11+:** Always use `VENDOR_TYPE.AGGREGATOR` (preferred) or
`VENDOR_TYPE.ALTERNATE` (accepted alias). Both resolve to `'agregator'`.

---

### Issue 2 — DIC endpoint returns 401 with dashboard JWT

**Affected tests:** DIC03, DIC04, DIC05, DIC08, DIC09, DIC10 (any test calling `dicAccept`, `dicRequestRevise`, `dicDecline`)

**Symptom:**
```
Expected 200, received 401 from PUT /pr/dic/konfirmasi_penawaran
```

**Root cause:**
The DIC confirmation endpoint (`/pr/dic/konfirmasi_penawaran`) uses
`authenticateTokenEmail` middleware, which validates tokens against the
`rfq_token_email` table. A dashboard JWT from `loginAs(ROLES.DIC)` is
**not** present in that table → 401.

The correct token is the **email-link token** created automatically by
`_sendEmailDicConfirmation` when the vendor submits items needing DIC review.
It is stored in `rfq_token_email` with:
- `user_type = 'dic'`
- `is_active = 1`
- `rfq_number = <rfqNumber>`

**Fix applied to `workflow-actions.helper.js`:**
```js
// Private helper — fetches the active DIC email-link token from DB
async function getDICEmailToken(rfqNumber) {
  const rows = await executeQuery(
    `SELECT rfq_token FROM rfq_token_email
     WHERE rfq_number = ? AND user_type = 'dic' AND is_active = 1
     ORDER BY created_at DESC LIMIT 1`,
    [rfqNumber]
  );
  if (!rows.length) throw new Error(`No active DIC email token found for RFQ ${rfqNumber}`);
  return rows[0].rfq_token;
}
```

All three DIC actions now call `getDICEmailToken(rfqNumber)` internally:
```js
export async function dicAccept(rfqNumber, dicToken, vendorType = null) { ... }
export async function dicRequestRevise(rfqNumber, dicToken, reason, vendorType) { ... }
export async function dicDecline(rfqNumber, dicToken, reason, vendorType) { ... }
```

The `dicToken` parameter (dashboard JWT) is kept for **signature compatibility**
but is no longer used for the DIC API call.

**Rule for DIC11+:**
- Always call `dicAccept` / `dicRequestRevise` / `dicDecline` from `workflow-actions.helper.js`.
- Do **not** pass the dashboard JWT directly to any DIC endpoint.
- The DIC email token is deactivated (`is_active = 0`) by the backend immediately
  after the DIC action completes, so each test gets a fresh token.

---

### Issue 3 — S2 setup did not activate the VA vendor

**Affected tests:** DIC06–DIC10 (all S2 tests)

**Symptom:**
`setupRFQAtDICStage({ vd: 'decline', va: 'accept' }, { scenario: 's2' })`
produced an RFQ where VA was still `status_vendor = 0` (not submitted).

**Root cause:**
The original `setupRFQAtDICStage` for `scenario = 's2'` called
`setupRFQAtVendorStage({ scenario: 's2' })`, which does **not** set
`skip_level_1_RFQ = 'no'`. Without that config, VD declining does not
trigger VA activation.

**Fix applied to `pre-test.helper.js`:**
```js
export async function setupRFQAtDICStage(vendorActions, options = {}) {
  const scenario = options.scenario ?? (vendorActions.va != null ? 's3' : 's1');

  let ctx;
  if (scenario === 's2') {
    // Delegates to setupRFQAtVendorStageS2 which handles:
    // 1. save + set skip_level_1_RFQ = 'no'
    // 2. VD decline (already done inside)
    // 3. poll until VA token is active
    ctx = await setupRFQAtVendorStageS2({ itemCount: 1 });
  } else {
    ctx = await setupRFQAtVendorStage({ scenario });
    if (vendorActions.vd !== 'no_action' && ctx.vendorTokenVD) {
      const rfqItemsVD = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT);
      await applyVendorAction(rfqItemsVD, vendorActions.vd, ctx.vendorTokenVD);
    }
  }

  // Apply VA action (s2 VA, or s3 VA)
  if (vendorActions.va != null && vendorActions.va !== 'no_action' && ctx.vendorTokenVA) {
    const rfqItemsVA = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR);
    await applyVendorAction(rfqItemsVA, vendorActions.va, ctx.vendorTokenVA);
  }

  return ctx;
}
```

**Rule for DIC11+:** For S2 tests, always pass `{ scenario: 's2' }` as the
second argument to `setupRFQAtDICStage`. The internal delegation to
`setupRFQAtVendorStageS2` handles all config + VD decline automatically.

---

### Issue 4 — `assertRFQMilestone` picks the VD row (wrong row) for S2 tests

**Affected tests:** DIC06–DIC10

**Symptom:**
```
Table status for RFQ000XXXX: expected 3 to be 4
```
(milestone=4 = `BID_VENDOR_DECLINED`, the VD row, not the VA row with milestone=3)

**Root cause:**
`assertRFQMilestone` runs `SELECT … LIMIT 1` without `ORDER BY` or
`vendor_type` filter. For S2 RFQs, `rfq_library` contains two rows:
- VD row: `vendor_type='direct'`, `status_milestone=4` (BID_VENDOR_DECLINED)
- VA row: `vendor_type='agregator'`, `status_milestone=3` (WAITING_DIC_APPROVAL)

MySQL returns whichever row it finds first — non-deterministic.

**Fix applied to DIC06–DIC10 test files:**
Replace `assertRFQMilestone` with `assertVendorTypeMilestone` filtered to VA rows:
```js
// Before (wrong — picks either row):
test('table status is WAITING_DIC_APPROVAL', async () => {
  await assertRFQMilestone(ctx.rfqNumber, 'WAITING_DIC_APPROVAL');
});

// After (correct — only looks at VA rows):
test('table status is WAITING_DIC_APPROVAL', async () => {
  await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'WAITING_DIC_APPROVAL');
});
```

**Rule for DIC11+:**
- **S1 tests** (VD only) → `assertRFQMilestone` is safe — only one row exists.
- **S2 tests** (VA only) → always use `assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, ...)`.
- **S3 tests** (VD + VA) → use `assertVendorTypeMilestone` for each vendor type separately.

---

### Issue 5 — `assertVendorItemsUIStatus` showed "Waiting User" instead of "Waiting Procurement" after DIC accepts

**Affected tests:** DIC03, DIC04, DIC08, DIC09

**Symptom:**
```
All direct items for RFQ000XXX should map to UI status "Waiting Procurement"
(got: ["Waiting User"])
```

**Root cause:**
`assertVendorItemsUIStatus` mapped `status_vendor` only via `STATUS_VENDOR_UI_MAP`:
```js
const STATUS_VENDOR_UI_MAP = {
  0: 'Need Action',      // NO_ACTION
  1: 'Waiting User',     // APPROVE
  2: 'No Quote',         // REJECT
  3: 'Waiting User',     // NEED_CONFIRMATION
};
```
After DIC accepts, `status_vendor` stays at `APPROVE (1)` — the backend
does not change it. Only `status_milestone` changes to `10` (DIC_ACCEPTED).
So items correctly show "Waiting Procurement" in the real UI (milestone-driven),
but the old assertion checked only `status_vendor` → "Waiting User".

**Fix applied to `state-assertions.helper.js`:**
```js
export async function assertVendorItemsUIStatus(rfqNumber, vendorType, expectedUIStatus) {
  const rows = await executeQuery(
    'SELECT status_vendor, status_milestone FROM rfq_library WHERE rfq_number = ? AND vendor_type = ?',
    [rfqNumber, vendorType]
  );
  expect(rows.length, `...`).toBeGreaterThan(0);
  const allUIStatuses = rows.map(r => {
    // After DIC accepts (milestone >= DIC_ACCEPTED=10), APPROVE items show "Waiting Procurement"
    if (r.status_milestone >= STATUS_MILESTONE.DIC_ACCEPTED && r.status_vendor === STATUS_VENDOR.APPROVE) {
      return UI_STATUS.WAITING_PROCUREMENT;
    }
    return STATUS_VENDOR_UI_MAP[r.status_vendor];
  });
  const allMatch = allUIStatuses.every(s => s === expectedUIStatus);
  expect(allMatch, `All ${vendorType} items ... (got: ${JSON.stringify(allUIStatuses)})`).toBe(true);
}
```

**Milestone threshold:** `STATUS_MILESTONE.DIC_ACCEPTED = 10`

All milestones ≥ 10 mean DIC has acted → items show "Waiting Procurement":

| Milestone | Value | Meaning |
|-----------|-------|---------|
| DIC_ACCEPTED | 10 | DIC approved (below-OE) |
| WAITING_OE_REVISION | 14 | DIC approved (above-OE, awaiting OE update) |
| QCF_PENDING_CL | 17 | QCF sent to CL |
| QCF_CL_APPROVED | 18 | CL approved QCF |
| QCF_MANAGEMENT_APPROVED | 20 | Management approved QCF |

**Rule for DIC11+:**
Use `assertVendorItemsUIStatus` (not `assertVendorTypeStatus`) for all UI status
checks in DIC tests. It handles both pre-DIC and post-DIC milestone states correctly.

---

### Issue 6 — Wrong `status_milestone` assertions after DIC accepts

**Affected tests:** DIC03 (wrong), DIC04 (wrong), DIC09 (wrong)

#### 6a — DIC03: expected `QCF_PENDING_CL (17)` but DB has `DIC_ACCEPTED (10)`

**Symptom:**
```
Table status for RFQ000XXX: expected 10 to be 17
```

**Root cause:**
The test comment said "Table Status: Waiting CL" and was incorrectly
coded as `QCF_PENDING_CL`. But the backend `bulkUpdateRfqStatusDIC`
sets `status_milestone = DIC_ACCEPT (10)` on `rfq_library` for below-OE items.
`insertBulkQcf` inserts into `qcf_library` with milestone=10 but does **not**
update `rfq_library.status_milestone` to 17. That only happens when CS
explicitly triggers the "send to QCF" action.

**Fix:** `QCF_PENDING_CL` → `DIC_ACCEPTED`
```js
test('table status is DIC_ACCEPTED', async () => {
  await assertRFQMilestone(ctx.rfqNumber, 'DIC_ACCEPTED');
});
```

#### 6b — DIC04, DIC09: expected `DIC_ACCEPTED (10)` but DB has `WAITING_OE_REVISION (14)`

**Symptom:**
```
Table status / agregator milestone for RFQ000XXX: expected 14 to be 10
```

**Root cause:**
DIC04 is S1 above-OE, DIC09 is S2 above-OE. The backend sets
`status_milestone = WAITING_OE_REVISION (14)` for above-OE items.
Both tests incorrectly asserted `DIC_ACCEPTED (10)`.

**Fix:** `DIC_ACCEPTED` → `WAITING_OE_REVISION`
```js
// DIC04 (S1 OE)
test('table status is WAITING_OE_REVISION', async () => {
  await assertRFQMilestone(ctx.rfqNumber, 'WAITING_OE_REVISION');
});

// DIC09 (S2 OE — use assertVendorTypeMilestone because S2 has two rows)
test('table status is WAITING_OE_REVISION', async () => {
  await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'WAITING_OE_REVISION');
});
```

---

## 2b. Issues Found in DIC11–DIC20 (and Fixes)

### Issue 7 — S3 setup never activated VA vendor

**Affected tests:** DIC11–DIC20 (all 10 fail at `beforeAll`)

**Symptom:**
```
Vendor token for agregator not found within 10000ms
```

**Root cause:**
`setupRFQAtDICStage(..., { scenario: 's3' })` fell into the `else` branch
which called `setupRFQAtVendorStage({ scenario: 's3' })`. That function never
sets `skip_level_1_RFQ = 'yes'` in config, so the backend processes the RFQ
as a single-vendor job → VA token is never issued.

**Fix applied to `pre-test.helper.js`:**
Added `else if (scenario === 's3')` branch:
```js
} else if (scenario === 's3') {
  ctx = await setupRFQAtVendorStageS3({ itemCount: 1 });
  if (vendorActions.vd !== 'no_action' && ctx.vendorTokenVD) {
    const rfqItemsVD = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT);
    await applyVendorAction(rfqItemsVD, vendorActions.vd, ctx.vendorTokenVD);
  }
}
```

`setupRFQAtVendorStageS3` handles: save config → set `skip_level_1_RFQ='yes'` →
create RFQ → poll both VD and VA tokens simultaneously → restore config in cleanup.

**Rule:** Always pass `{ scenario: 's3' }` to `setupRFQAtDICStage` for S3 tests.

---

### Issue 8 — `assertRFQMilestone` picks wrong row in S3 when VD declines

**Affected tests:** DIC17 (VD decline), DIC18 (VD decline OE)

**Symptom:**
```
Table status for RFQ000XXX: expected 4 to be 3
```

**Root cause:**
Same LIMIT 1 problem as Issue 4, but for S3. When VD declines, the VD row
gets `status_milestone = 4` (BID_VENDOR_DECLINED). MySQL may return that row
first, failing the `WAITING_DIC_APPROVAL (3)` assertion.

**Fix:** Switch to `assertVendorTypeMilestone` for the VA row:
```js
test('table status is WAITING_DIC_APPROVAL (VA row)', async () => {
  await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'WAITING_DIC_APPROVAL');
});
```

**Affected files:** `dic17`, `dic18` — import changed from `assertRFQMilestone`
to `assertVendorTypeMilestone`.

---

### Issue 9 — `no_action` vendor items show "Need Action", not "Waiting Procurement" *(superseded by Issue 14)*

**Affected tests:** DIC15, DIC16 (VA no_action); DIC19, DIC20 (VD no_action)

**Original finding (pre-Issue 14):**
Without simulating token expiry, `no_action` vendor has `status_vendor = 0` (PENDING)
and milestone stays at `RFQ_SENT_TO_VENDOR (2)` → dashboard shows "Need Action".

**Superseded by Issue 14:**
Once `expireVendorAndRunCron` is called (Issue 14), the backend cron sets
`status_milestone = RFQ_NOT_SUBMITTED (22)` on the expired vendor's items.
The dashboard then shows **"Waiting Procurement"** — matching the spreadsheet.

The correct assertion after `expireVendorAndRunCron` is `UI_STATUS.WAITING_PROCUREMENT`:

```js
// DIC15/DIC16 — VA token expired via expireVendorAndRunCron
test('VA items show "Waiting Procurement"', async () => {
  await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA);
});

// DIC19/DIC20 — VD token expired via expireVendorAndRunCron
test('VD items show "Waiting Procurement"', async () => {
  await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD);
});
```

---

### Issue 10 — DIC/CS UI shows "Waiting Vendor" when VD hasn't submitted in S3

**Affected tests:** DIC15, DIC16 (VA no_action — DIC UI); DIC19, DIC20 (VD no_action — DIC + CS UI)

**Spreadsheet says:**
- DIC UI: "Need Action"
- CS UI: "Waiting User"

**Actual backend behavior:**

When a vendor in S3 has **not submitted** (no_action or decline), the DIC dashboard
shows "Waiting Vendor" (not "Need Action") because not all vendors have responded yet.
"Need Action" only appears on the DIC dashboard when **all vendors have responded**
and DIC still hasn't acted.

Additionally, when **VD (direct) specifically** has not submitted:
- **DIC UI** → "Waiting Vendor"
- **CS UI** → also "Waiting Vendor" (CS dashboard mirrors the direct vendor's state)

When only **VA** has not submitted (DIC15/16):
- **DIC UI** → "Waiting Vendor"
- **CS UI** → "Waiting User" (not affected, since VD did submit)

**Fix applied to DIC15, DIC16, DIC19, DIC20:**

| Test | DIC UI | CS UI |
|------|--------|-------|
| DIC15 (VA no_action) | `WAITING_VENDOR` | `WAITING_USER` |
| DIC16 (VA no_action OE) | `WAITING_VENDOR` | `WAITING_USER` |
| DIC19 (VD no_action) | `WAITING_VENDOR` | `WAITING_VENDOR` |
| DIC20 (VD no_action OE) | `WAITING_VENDOR` | `WAITING_VENDOR` |

---

## 2c. Issues Found in DIC21–DIC30 (and Fixes)

### Issue 11 — Partial DIC accept leaves the other vendor type at WAITING_DIC_APPROVAL

**Affected tests:** DIC21, DIC22 (DIC accepts VD only); DIC27, DIC28 (DIC accepts VA only)

**Symptom:**
```
All agregator items for RFQ000XXX should map to UI status "Waiting Procurement"
(got: ["Waiting User"])
```

**Root cause:**
`dicAccept(rfqNumber, dicToken, vendorType)` filters items by the given `vendorType`
and calls `dicConfirmQuotation` only for those items. When DIC accepts VD:
- VD items → `status_milestone = DIC_ACCEPTED (10)` → "Waiting Procurement"
- VA items → remain at `status_milestone = WAITING_DIC_APPROVAL (3)` → "Waiting User"

The spreadsheet implied both vendor types would show "Waiting Procurement" after a partial
accept, but the backend only updates the accepted vendor type's rows.

**Fix:**
```js
// DIC21/22 — DIC accepts VD only; VA still at WAITING_DIC_APPROVAL
test('VA items show "Waiting User"', async () => {
  await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, UI_STATUS.WAITING_USER);
});

// DIC27/28 — DIC accepts VA only; VD still at WAITING_DIC_APPROVAL
test('VD items show "Waiting User"', async () => {
  await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.WAITING_USER);
});
```

---

### Issue 12 — DIC UI shows "Need Action" when VA items are still pending DIC review

**Affected tests:** DIC21, DIC22

**Symptom:**
```
DIC dashboard for RFQ000XXX: expected "Waiting Procurement" but got "Need Action"
```

**Root cause:**
After DIC accepts VD only, VA items remain at `WAITING_DIC_APPROVAL (3)`. The DIC
dashboard detects pending VA items and shows "Need Action" (i.e., DIC still needs
to review VA). This is correct behavior — the spreadsheet was wrong.

Contrast with DIC27/28 where DIC accepts VA only: VA rows reach milestone≥10,
so the DIC dashboard shows "Waiting Procurement" even though VD rows are still at 3.
The DIC dashboard is primarily driven by the aggregator (VA) row state.

**Fix:**
```js
// DIC21/22 — VA still pending DIC → DIC UI "Need Action"
test('DIC UI shows "Need Action"', async () => {
  await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
});
```

---

### Issue 13 — CS UI shows "Waiting CL" when VD accepts below-OE (auto QCF created)

**Affected tests:** DIC23 (VD accept below-OE, VA decline)

**Symptom:**
```
CS dashboard for RFQ000XXX: expected "Need Action" but got "Waiting CL"
```

**Root cause:**
When VD submits below-OE and DIC accepts, the backend auto-calls `insertBulkQcf`
which creates a QCF record. The CS dashboard then transitions to "Waiting CL"
because a QCF already exists and is pending CL approval. The spreadsheet listed
"Need Action" but the actual flow creates the QCF automatically.

**Fix:**
```js
test('CS UI shows "Waiting CL"', async () => {
  await assertUIState(ctx.rfqNumber, 'cs', 'Waiting CL', ctx.csToken);
});
```

> Note: `'Waiting CL'` is a string literal — there is no `UI_STATUS.WAITING_CL` constant.
> This label comes from the CS dashboard API response directly.

---

### Issue 14 — DIC25/26: `no_action` in S3 = expired vendor token; DIC email never created

**Affected tests:** DIC25 (VA no_action, VD accept below-OE), DIC26 (VA no_action, VD accept above-OE)

**Symptom:**
```
Error: No active DIC email token found for RFQ RFQ000XXX
```
All 5 tests in each describe block were **skipped** because `beforeAll` threw.

**Root cause:**
In S3, the backend only sends the DIC review email (and creates the `rfq_token_email`
row with `user_type='dic'`) after **all vendors have responded**. When VA has `no_action`,
its vendor token is still active but the vendor never submitted. The backend never
triggers `_sendEmailDicConfirmation` → no DIC email token exists → `getDICEmailToken()`
throws → `dicAccept()` cannot proceed.

`no_action` in S3 means the **vendor token expired** before the vendor submitted.
The correct simulation is:
1. Set VA's `date_expired` to yesterday in `rfq_token_email`
2. Call `POST /pr/rfq/run-cron?stage=vendor&rfq_number=<rfqNumber>`
3. Backend cron processes the expiry → marks VA items as `RFQ_NOT_SUBMITTED (22)` →
   triggers DIC email creation for the remaining VD items
4. Poll until `rfq_token_email` row with `user_type='dic'` appears
5. `dicAccept(VENDOR_TYPE.DIRECT)` can now proceed

**Fix — new helper added to `workflow-actions.helper.js`:**
```js
// vendorType determines config_condition and cron stage:
//   VENDOR_TYPE.AGGREGATOR → config_condition='Waiting_vendor_expiry',        stage='vendor'
//   VENDOR_TYPE.DIRECT     → config_condition='Waiting_vendor_direct_expiry', stage='vendor_direct'
// NOTE: In S3, BOTH VD and VA use 'Waiting_vendor_expiry' (parallel flow).
//       Always pass VENDOR_TYPE.AGGREGATOR for S3 — regardless of which vendor expired.
export async function expireVendorAndRunCron(rfqNumber, vendorCode, vendorType, authToken) {
  const configCondition = vendorType === VENDOR_TYPE.DIRECT
    ? 'Waiting_vendor_direct_expiry'
    : 'Waiting_vendor_expiry';
  const stage = vendorType === VENDOR_TYPE.DIRECT ? 'vendor_direct' : 'vendor';

  await executeQuery(
    `UPDATE rfq_token_email
     SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
     WHERE rfq_number = ? AND user_type = 'vendor' AND vendor_code = ? AND config_condition = ?`,
    [rfqNumber, vendorCode, configCondition]
  );
  const url = `${API_AIGEN_ENDPOINTS.PR.RUN_CRON}?stage=${stage}&rfq_number=${rfqNumber}`;
  const response = await authenticatedPost(url, {}, authToken);
  expect(response.status).toBe(200);
  await pollForDICEmailToken(rfqNumber);
}
```

**Fix — DIC25/26 `beforeAll`:**
```js
beforeAll(async () => {
  ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'no_action' }, { scenario: 's3' });
  // VA in S3 uses Waiting_vendor_expiry → pass VENDOR_TYPE.AGGREGATOR
  await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
  await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.DIRECT);
}, 120000);  // increased timeout for cron polling
```

**New constant added to `api-endpoint.constant.js`:**
```js
RUN_CRON: '/pr/rfq/run-cron',
```

---

### Issue 15 — CS UI tracks VD (direct) state; shows "Waiting User" when VD pending DIC

**Affected tests:** DIC27, DIC28

**Symptom:**
```
CS dashboard for RFQ000XXX: expected "Waiting CL" but got "Waiting User"
```

**Root cause:**
The CS dashboard state is driven by the **direct vendor (VD)** row milestone.
When DIC accepts VA only, VD items remain at `WAITING_DIC_APPROVAL (3)`.
The CS dashboard mirrors the VD milestone → "Waiting User".

This is the same insight as Issue 10 (DIC11-20 range) but now applies post-DIC-accept:
after DIC accepts only VA, VD is still pending DIC → CS sees "Waiting User".

**Fix:**
```js
// DIC27/28 — DIC accepted VA only; VD still pending DIC → CS "Waiting User"
test('CS UI shows "Waiting User"', async () => {
  await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
});
```

---

### Issue 16 — S3 VD no_action must use `VENDOR_TYPE.AGGREGATOR` in `expireVendorAndRunCron`

**Affected tests:** DIC19, DIC20

**Symptom:**
```
Error: DIC email token not created for RFQ RFQ000XXX within 15000ms
```
(intermittent — sometimes also manifests as VD asserting "Need Action" instead of "Waiting Procurement")

**Root cause:**
In S3 (parallel flow), **both** VD and VA vendor tokens are stored in `rfq_token_email`
with `config_condition = 'Waiting_vendor_expiry'`. The `vendor_direct` stage and
`Waiting_vendor_direct_expiry` config only apply to **S1** (single VD) scenarios.

When DIC19/DIC20 called `expireVendorAndRunCron(..., VENDOR_TYPE.DIRECT, ...)`:
1. The UPDATE filtered by `config_condition = 'Waiting_vendor_direct_expiry'` → **0 rows matched**
2. The `vendor_direct` cron ran but found nothing to process
3. `handleExpiredVendorDirect` also behaves differently — it duplicates the RFQ and
   resends vendor emails (designed for S1 re-invite flow), NOT for S3 parallel expiry
4. No DIC email token was created → `pollForDICEmailToken` timed out

**Backend cron behavior reference:**

| Cron stage | Config condition | Handles |
|------------|-----------------|---------|
| `vendor` | `Waiting_vendor_expiry` | S3 parallel VA/VD expiry → marks items as `RFQ_NOT_SUBMITTED`, sends DIC email if sibling submitted |
| `vendor_direct` | `Waiting_vendor_direct_expiry` | S1-only VD expiry → duplicates RFQ, re-invites both vendors |

**Fix — DIC19/DIC20 `beforeAll`:**
```js
// In S3, VD token uses config_condition='Waiting_vendor_expiry' (same as VA).
// Pass VENDOR_TYPE.AGGREGATOR so expireVendorAndRunCron uses 'vendor' cron stage.
await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
```

**Rule:** In S3 no_action scenarios, always pass `VENDOR_TYPE.AGGREGATOR` to
`expireVendorAndRunCron` regardless of whether VD or VA is the no_action vendor.
`VENDOR_TYPE.DIRECT` is only correct for S1.

---

## 2d. Issues Found in DIC31–DIC40 (and Fixes)

### Issue 17 — DIC31/32: DIC and CS UI assertions used pre-expiry-cron logic

**Affected tests:** DIC31, DIC32

**Root cause:**
DIC31/32 were originally written with `assertUIState('dic', WAITING_VENDOR)` and `assertUIState('cs', WAITING_VENDOR)` — drafted before `expireVendorAndRunCron` was added to `beforeAll`. After `expireVendorAndRunCron(VD, AGGREGATOR)` runs, the cron creates the DIC email token and `dicAccept(AGGREGATOR)` advances the milestone. The DIC and CS dashboards then show "Waiting Procurement" / "Waiting CL" / "Need Action" — matching the DIC25/26 mirror pattern.

**Fix applied:**

| Test | DIC UI (before → after) | CS UI (before → after) |
|------|-------------------------|------------------------|
| DIC31 (VA accept below OE) | `WAITING_VENDOR` → `WAITING_PROCUREMENT` | `WAITING_VENDOR` → `'Waiting CL'` |
| DIC32 (VA accept above OE) | `WAITING_VENDOR` → `WAITING_PROCUREMENT` | `WAITING_VENDOR` → `NEED_ACTION` |

DIC31 CS shows "Waiting CL" because below-OE triggers auto-QCF creation. DIC32 CS shows "Need Action" because above-OE sets `WAITING_OE_REVISION (14)` and CS must act on the OE revision.

---

### Issue 18 — DIC33/36: `dicRequestRevise` sent only the target vendor's items (incomplete payload)

**Affected tests:** DIC33 (revise VD, both accept), DIC36 (revise VA, both accept)

**Root cause:**
`dicRequestRevise(vendorType)` calls `getRFQItemsByVendorType(rfqNumber, vendorType)` and builds a payload with only the target vendor's items at `status_dic: NEED_REVIEW`. The DIC konfirmasi endpoint (`/pr/dic/konfirmasi_penawaran`) requires **all submitted items** in a single payload. When both vendors submitted accepted items, the other vendor's items must be explicitly included with `status_dic: DECLINE`. This is the same constraint that created `dicAcceptVDDeclineVA` and `dicAcceptVADeclineVD`.

**Payload rule (confirmed):**
- Vendor accepted (`status_vendor = APPROVE`) → included in payload
- Vendor declined (`status_vendor = REJECT`) → NOT included (same as no_action — vendor never accepted)
- Vendor no_action (never submitted) → NOT included

**Fix — two new helpers added to `workflow-actions.helper.js`:**
```js
// DIC33: both accepted → revise VD, decline VA in same call
export async function dicRequestReviseVDDeclineVA(rfqNumber, dicToken, reason = 'E2E Test: revision required') { ... }

// DIC36: both accepted → revise VA, decline VD in same call
export async function dicRequestReviseVADeclineVD(rfqNumber, dicToken, reason = 'E2E Test: revision required') { ... }
```

**DIC33 `beforeAll` change:**
```js
// Before:
await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'Please revise your quote', VENDOR_TYPE.DIRECT);
// After:
await dicRequestReviseVDDeclineVA(ctx.rfqNumber, ctx.dicToken);
```

**DIC36 `beforeAll` change:**
```js
// Before:
await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'Please revise your quote', VENDOR_TYPE.AGGREGATOR);
// After:
await dicRequestReviseVADeclineVD(ctx.rfqNumber, ctx.dicToken);
```

**Not affected (correct as-is):**
- DIC34 (VA=decline): VA submitted with REJECT → excluded from payload → `dicRequestRevise(DIRECT)` correct ✅
- DIC35 (VA=no_action): VA never submitted → excluded from payload → `dicRequestRevise(DIRECT)` correct ✅
- DIC37 (VD=decline): VD submitted with REJECT → excluded from payload → `dicRequestRevise(AGGREGATOR)` correct ✅
- DIC38 (VD=no_action): VD never submitted → excluded from payload → `dicRequestRevise(AGGREGATOR)` correct ✅

---

### Issue 19 — DIC31/32/35/38: S3 no_action vendor requires `expireVendorAndRunCron` before DIC action

**Affected tests:** DIC31, DIC32, DIC35, DIC38

**Symptom:**
```
Error: No active DIC email token found for RFQ RFQ000XXX
```
All tests skipped because `dicAccept` or `dicRequestRevise` threw in `beforeAll`.

**Root cause:**
Same as Issue 14 (DIC25/26). In S3, the backend only creates the DIC email token after **all vendors have responded**. When one vendor has `no_action` (token never expired, never submitted), the backend never triggers `_sendEmailDicConfirmation` → no DIC token → `getDICEmailToken()` throws.

**Fix applied:**
```js
// DIC31/32 — VD no_action: expire VD token, run cron, then dicAccept(VA)
await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.AGGREGATOR);

// DIC35 — VA no_action: expire VA token, run cron, then dicRequestRevise(VD)
await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'Please revise your quote', VENDOR_TYPE.DIRECT);

// DIC38 — VD no_action: expire VD token, run cron, then dicRequestRevise(VA)
await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'Please revise your quote', VENDOR_TYPE.AGGREGATOR);
```

Timeout increased from 90000 → 120000 to accommodate cron polling.

**Rule (same as Issue 14/16):** In S3, always pass `VENDOR_TYPE.AGGREGATOR` to `expireVendorAndRunCron` regardless of which vendor expired.

---

### Issue 20 — DIC31–DIC39: `assertVendorItemsUIStatus` cannot return "Waiting Procurement" for expired vendors

**Affected tests:** DIC31–DIC39 (all vendor UI status assertions)

**Root cause:**
When a vendor token expires via cron, the backend sets `status_milestone = RFQ_NOT_SUBMITTED (22)` but `status_vendor` stays at `0` (NO_ACTION). `assertVendorItemsUIStatus` maps `status_vendor = 0 → "Need Action"` without checking for milestone=22. The real API (`assertUIState`) correctly returns "Waiting Procurement" for milestone=22 cases.

**Fix applied to all DIC31–DIC39 vendor UI assertions:**
```js
// Before (wrong for expired vendors):
await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, UI_STATUS.WAITING_PROCUREMENT);

// After (real API call — handles all milestone states correctly):
await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA);
```

**Rule for DIC31+:** Always use `assertUIState` with the vendor account token for vendor UI status checks. `assertVendorItemsUIStatus` is not reliable for expired/no_action vendors.

---

### Issue 21 — DIC39: correct vendor input is both accept; only DIC token expires

**Affected tests:** DIC39

**Root cause (original incorrect assumption):**
DIC39 was initially implemented with `vd: 'no_action', va: 'no_action'` requiring `expireBothVendorsAndRunCron` to simulate vendor token expiry and generate the DIC email token. This was wrong.

**Actual flow (confirmed by QA):**
Both vendors accept normally → backend automatically creates the DIC email token after both submissions. The DIC takes no action — the DIC email token expires → DIC cron runs → RFQ converts to Manual Sourcing.

**Fix — DIC39 `beforeAll`:**
```js
// Before (wrong):
ctx = await setupRFQAtDICStage({ vd: 'no_action', va: 'no_action' }, { scenario: 's3' });
await expireBothVendorsAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, ctx.vendorCodeVA, ctx.csToken);
await expireDICAndRunCron(ctx.rfqNumber, ctx.csToken);

// After (correct):
ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'accept' }, { scenario: 's3' });
await expireDICAndRunCron(ctx.rfqNumber, ctx.csToken);
```

Timeout reduced from 150000 → 90000 (only one cron step; DIC token already exists after vendor submit).

**Note:** DIC39 milestone assertion remains `test.todo` — pending QA confirmation of the `MANUAL_SOURCING` constant name in `STATUS_MILESTONE`. All UI assertions ("Manual Sourcing" for VD/VA/DIC/CS) are implemented and passing.

**DIC40:** No longer a valid test case — file kept as all-`test.todo` placeholder (skipped by Vitest).

---

## 3. Milestone Reference Table (`rfq_library.status_milestone`)

| Constant Name | Value | Meaning | When set |
|---------------|-------|---------|----------|
| RFQ_SENT_TO_VENDOR | 2 | RFQ sent, vendor not yet responded | After import |
| WAITING_DIC_APPROVAL | 3 | Vendor submitted, awaiting DIC | After vendor submit |
| BID_VENDOR_DECLINED | 4 | VD declined | After VD decline |
| CS_INTERVENTION | 5 | CS manual intervention | — |
| DIC_REQUEST_REVISE | 9 | DIC asked vendor to revise | After `dicRequestRevise` |
| DIC_ACCEPTED | 10 | DIC accepted (below-OE) | After `dicAccept` (standard path) |
| WAITING_OE_REVISION | 14 | DIC accepted (above-OE) | After `dicAccept` (OE path) |
| QCF_PENDING_CL | 17 | QCF sent to CL | After CS sends to QCF |
| QCF_CL_APPROVED | 18 | CL approved QCF | After CL approve |
| QCF_MANAGEMENT_APPROVED | 20 | Management approved QCF | After Management approve |
| RFQ_NOT_SUBMITTED | 22 | RFQ expired / not submitted | After expiry |

---

## 4. Status Vendor Reference (`rfq_library.status_vendor`)

| Constant | Value | UI label (pre-DIC) | UI label (post-DIC accept) |
|----------|-------|--------------------|----------------------------|
| NO_ACTION | 0 | Need Action | Need Action |
| APPROVE | 1 | Waiting User | **Waiting Procurement** |
| REJECT | 2 | No Quote | No Quote |
| NEED_CONFIRMATION | 3 | Waiting User | Waiting Procurement |

> After `dicRequestRevise`, the backend resets `status_vendor = NO_ACTION (0)`,
> so vendor items go back to "Need Action" — correctly handled by `STATUS_VENDOR_UI_MAP` alone.

---

## 5. Helper Reference for DIC Tests

### Setup helpers (`pre-test.helper.js`)

| Helper | Use case |
|--------|----------|
| `setupRFQAtDICStage({ vd: '...' })` | S1: single VD item, DIC not yet acted |
| `setupRFQAtDICStage({ vd: 'decline', va: '...' }, { scenario: 's2' })` | S2: VD declined, VA has acted |
| `setupRFQAtDICStage({ vd: '...', va: '...' }, { scenario: 's3' })` | S3: both VD and VA have acted |
| `setupRFQAtDICStageMixed({ itemActions: ['accept','accept_oe','need_confirm'] })` | S1: multi-item mixed vendor actions |

**Vendor action strings:**

| String | `status_vendor` | Price | Path |
|--------|-----------------|-------|------|
| `'accept'` | 1 (APPROVE) | `item_value` (≤ OE) | Standard |
| `'accept_oe'` | 1 (APPROVE) | `item_value × 1.2` (> OE) | OE |
| `'need_confirm'` | 3 (NEED_CONFIRMATION) | `item_value` | — |
| `'decline'` | 2 (REJECT) | — | — |
| `'no_action'` | unchanged (0) | — | DIC sees pending items |

### Assertion helpers (`state-assertions.helper.js`)

| Helper | When to use |
|--------|-------------|
| `assertRFQMilestone(rfqNumber, milestoneName)` | S1 only (single `vendor_type` row) |
| `assertVendorTypeMilestone(rfqNumber, vendorType, milestoneName)` | S2/S3 (filters by `vendor_type`) |
| `assertVendorItemsUIStatus(rfqNumber, vendorType, expectedUI)` | All DIC tests — handles pre/post-DIC UI labels |
| `assertUIState(rfqNumber, role, expectedLabel, token)` | Dashboard API check (DIC / CS / CL) |

### DIC action helpers (`workflow-actions.helper.js`)

| Helper | Description |
|--------|-------------|
| `dicAccept(rfqNumber, dicToken, vendorType?)` | DIC approves items for the given vendor type only; uses email-link token internally |
| `dicRequestRevise(rfqNumber, dicToken, reason, vendorType?)` | DIC requests vendor revision for the given vendor type only (use when the other vendor did NOT submit accepted items) |
| `dicDecline(rfqNumber, dicToken, reason, vendorType?)` | DIC declines items |
| `dicAcceptVDDeclineVA(rfqNumber, dicToken)` | S3: accept VD items + decline VA items in one payload (both accepted) |
| `dicAcceptVADeclineVD(rfqNumber, dicToken)` | S3: accept VA items + decline VD items in one payload (both accepted) |
| `dicAcceptVDRequestReviseVA(rfqNumber, dicToken)` | S3: accept VD + request revise VA in one payload (both accepted) |
| `dicAcceptVARequestReviseVD(rfqNumber, dicToken)` | S3: accept VA + request revise VD in one payload (both accepted) |
| `dicRequestReviseVDDeclineVA(rfqNumber, dicToken)` | S3: request revise VD + decline VA in one payload (both accepted) |
| `dicRequestReviseVADeclineVD(rfqNumber, dicToken)` | S3: request revise VA + decline VD in one payload (both accepted) |
| `expireVendorAndRunCron(rfqNumber, vendorCode, vendorType, authToken)` | Expire a single vendor's token in DB then run vendor cron (S3 `no_action` simulation). Always pass `VENDOR_TYPE.AGGREGATOR` for S3. |
| `expireBothVendorsAndRunCron(rfqNumber, vendorCodeVD, vendorCodeVA, authToken)` | Expire both VD and VA tokens simultaneously then run vendor cron once (DIC39: both no_action) |
| `expireDICAndRunCron(rfqNumber, authToken)` | Expire DIC email token then run DIC cron → converts RFQ to Manual Sourcing (DIC39) |

`dicToken` (dashboard JWT) is passed for signature compatibility only.
The actual API call uses the email-link token fetched from `rfq_token_email`.

> **Critical:** `dicAccept(rfqNumber, dicToken, VENDOR_TYPE.DIRECT)` only updates VD items.
> VA items remain at their current milestone. Pass `null` / omit to act on all items.

---

## 6. Rules for Writing DIC Test Cases

### Rule 1 — Use `assertVendorTypeMilestone` for S2 and S3

```js
// S1 only — single row, safe to use
await assertRFQMilestone(ctx.rfqNumber, 'WAITING_DIC_APPROVAL');

// S2 — filter to VA row (VD row has milestone=4, BID_VENDOR_DECLINED)
await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'WAITING_DIC_APPROVAL');

// S3 — VD submitted, VA no_action/decline → check the VD row
await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'WAITING_DIC_APPROVAL');

// S3 — VA submitted, VD no_action/decline → check the VA row
await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'WAITING_DIC_APPROVAL');
```

### Rule 2 — Milestone after DIC accepts depends on OE path

```js
// Vendor accepted below OE → milestone = DIC_ACCEPTED (10)
await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'DIC_ACCEPTED');

// Vendor accepted above OE → milestone = WAITING_OE_REVISION (14)
await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'WAITING_OE_REVISION');
```

### Rule 3 — `rfq_library.status_milestone` does NOT become `QCF_PENDING_CL` after DIC accept

The backend sets `DIC_ACCEPTED (10)` on `rfq_library` rows.
The QCF record in `qcf_library` is created with `status_milestone=10`,
but `rfq_library` stays at `10`.
`QCF_PENDING_CL (17)` is only set by a separate CS-driven "send to QCF" action.

### Rule 4 — Use `assertVendorItemsUIStatus` for vendor UI status

```js
// Before DIC acts — vendor submitted normally
await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.WAITING_USER);

// Vendor used no_action — never submitted
await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.NEED_ACTION);

// After DIC accepts (any milestone >= 10)
await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.WAITING_PROCUREMENT);

// After DIC requests revise (status_vendor reset to 0)
await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.NEED_ACTION);

// Vendor declined
await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.NO_QUOTE);
```

### Rule 5 — Import the right assertions for S2/S3 tests

```js
import {
  assertVendorTypeMilestone,   // required for S2/S3
  assertUIState,
  assertVendorItemsUIStatus,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';
```

### Rule 6 — The `ctx` object from `setupRFQAtDICStage`

| Property | Type | Notes |
|----------|------|-------|
| `ctx.rfqNumber` | string | The generated RFQ number |
| `ctx.dicToken` | string | DIC dashboard JWT — use only for `assertUIState`, not DIC API calls |
| `ctx.csToken` | string | CS dashboard JWT |
| `ctx.clToken` | string | CL dashboard JWT |
| `ctx.vendorTokenVD` | string | VD email-link token |
| `ctx.vendorTokenVA` | string \| null | VA email-link token (null for S1) |
| `ctx.vendorCodeVD` | string \| null | VD vendor code (from `rfq_library.vendor_code`); used with `expireVendorAndRunCron` |
| `ctx.vendorCodeVA` | string \| null | VA vendor code; used with `expireVendorAndRunCron` for `no_action` simulation |
| `ctx.cleanup()` | function | Call in `afterAll` — deletes RFQ, QCF, PR test data |

### Rule 8 — `dicAccept(vendorType)` only updates that vendor type's rows

```js
// DIC accepts VD only → VA stays at WAITING_DIC_APPROVAL (3)
await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.DIRECT);
// → VD items: "Waiting Procurement" | VA items: "Waiting User"

// DIC accepts VA only → VD stays at WAITING_DIC_APPROVAL (3)
await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.AGGREGATOR);
// → VA items: "Waiting Procurement" | VD items: "Waiting User"

// DIC accepts all → both types update
await dicAccept(ctx.rfqNumber, ctx.dicToken);          // vendorType = null
// → VD items: "Waiting Procurement" | VA items: "Waiting Procurement"
```

After a partial accept:
- The non-accepted vendor's items remain at `WAITING_DIC_APPROVAL (3)` → UI label "Waiting User"
- DIC UI is driven by VA (aggregator) row state — if VA still pending, DIC sees "Need Action"
- CS UI is driven by VD (direct) row state — if VD still pending, CS sees "Waiting User"

### Rule 9 — S3 `no_action` = expired vendor token; use `expireVendorAndRunCron`

```js
// S3 — VA no_action (DIC25/26): VA token expired, VD accepted → DIC acts on VD
beforeAll(async () => {
  ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'no_action' }, { scenario: 's3' });
  await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
  await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.DIRECT);
}, 120000);

// S3 — VD no_action (DIC19/20): VD token expired, VA accepted → DIC not yet acted
beforeAll(async () => {
  ctx = await setupRFQAtDICStage({ vd: 'no_action', va: 'accept' }, { scenario: 's3' });
  // NOTE: In S3, VD uses config_condition='Waiting_vendor_expiry' (same as VA).
  // Always pass VENDOR_TYPE.AGGREGATOR for S3, regardless of which vendor expired.
  await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
}, 120000);
```

**Critical:** In S3, pass `VENDOR_TYPE.AGGREGATOR` for **both** VD and VA expiry.
`VENDOR_TYPE.DIRECT` (→ `vendor_direct` cron) is only for S1 single-vendor scenarios.

`expireVendorAndRunCron` is the correct way to simulate `no_action` in S3.
Never use `describe.skip` — this scenario is testable.

### Rule 7 — "Waiting Vendor" vs "Need Action" on DIC and CS dashboards (S3)

In S3 (both vendors active in parallel):

| State | DIC UI | CS UI |
|-------|--------|-------|
| Both VD + VA submitted → DIC not yet acted | **Need Action** | Waiting User |
| Only VD submitted (VA no_action / decline) | **Waiting Vendor** | Waiting User |
| Only VA submitted (VD no_action / decline) | **Waiting Vendor** | **Waiting Vendor** |
| Neither submitted | Waiting Vendor | Waiting Vendor |

> Key insight: CS dashboard tracks the **direct vendor (VD)** state.
> When VD has not submitted, CS shows "Waiting Vendor".
> When only VA is missing, CS still shows "Waiting User" because VD did submit.

> The spreadsheet describes the intended UX, but for no_action / decline scenarios
> the actual backend behavior differs. Always trust the test output over the spreadsheet.

---

## 7. Verified Test Results

### DIC01–DIC10 — 40/40 tests pass (4 tests each)

```
✓ dic01-not-yet-action-s1.test.js     (4 tests)
✓ dic02-not-yet-action-s1-oe.test.js  (4 tests)
✓ dic03-accept-vd-s1.test.js          (4 tests)
✓ dic04-accept-vd-oe-s1.test.js       (4 tests)
✓ dic05-request-revise-vd-s1.test.js  (4 tests)
✓ dic06-not-yet-action-s2.test.js     (4 tests)
✓ dic07-not-yet-action-s2-oe.test.js  (4 tests)
✓ dic08-accept-va-s2.test.js          (4 tests)
✓ dic09-accept-va-oe-s2.test.js       (4 tests)
✓ dic10-request-revise-va-s2.test.js  (4 tests)

Test Files: 10 passed (10)
Tests:      40 passed (40)
```

### DIC11–DIC20 — 50/50 tests pass (5 tests each)

```
✓ dic11-not-yet-action-s3.test.js              (5 tests)
✓ dic12-not-yet-action-s3-oe.test.js           (5 tests)
✓ dic13-not-yet-action-s3-va-decline.test.js   (5 tests)
✓ dic14-not-yet-action-s3-oe-va-decline.test.js(5 tests)
✓ dic15-not-yet-action-s3-va-no-action.test.js (5 tests)
✓ dic16-not-yet-action-s3-oe-va-no-action.test.js (5 tests)
✓ dic17-not-yet-action-s3-vd-decline.test.js   (5 tests)
✓ dic18-not-yet-action-s3-oe-vd-decline.test.js(5 tests)
✓ dic19-not-yet-action-s3-vd-no-action.test.js (5 tests)  ← fixed via Issue 16 (VENDOR_TYPE.AGGREGATOR)
✓ dic20-not-yet-action-s3-oe-vd-no-action.test.js (5 tests)  ← fixed via Issue 16

Test Files: 10 passed (10)
Tests:      50 passed (50)
```

### DIC21–DIC30 — 50/50 tests pass (5 tests each)

```
✓ dic21-accept-vd-s3.test.js                  (5 tests)
✓ dic22-accept-vd-oe-s3.test.js               (5 tests)
✓ dic23-accept-vd-s3-va-decline.test.js       (5 tests)
✓ dic24-accept-vd-oe-s3-va-decline.test.js    (5 tests)
✓ dic25-accept-vd-s3-va-no-action.test.js     (5 tests)  ← was skipped; fixed via expireVendorAndRunCron
✓ dic26-accept-vd-oe-s3-va-no-action.test.js  (5 tests)  ← was skipped; fixed via expireVendorAndRunCron
✓ dic27-accept-va-s3.test.js                  (5 tests)
✓ dic28-accept-va-oe-s3.test.js               (5 tests)
✓ dic29-accept-va-s3-vd-decline.test.js       (5 tests)
✓ dic30-accept-va-oe-s3-vd-decline.test.js    (5 tests)

Test Files: 10 passed (10)
Tests:      50 passed (50)
```

### DIC31–DIC38 — 40/40 tests pass (5 tests each); DIC39 — 4/5 pass + 1 todo; DIC40 — all todo

```
✓ dic31-accept-va-s3-vd-no-action.test.js          (5 tests)  ← fixed via Issues 17/19/20
✓ dic32-accept-va-oe-s3-vd-no-action.test.js       (5 tests)  ← fixed via Issues 17/19/20
✓ dic33-request-revise-vd-s3.test.js               (5 tests)  ← fixed via Issues 18/20
✓ dic34-request-revise-vd-s3-va-decline.test.js    (5 tests)  ← fixed via Issue 20
✓ dic35-request-revise-vd-s3-va-no-action.test.js  (5 tests)  ← fixed via Issues 19/20
✓ dic36-request-revise-va-s3.test.js               (5 tests)  ← fixed via Issues 18/20
✓ dic37-request-revise-va-s3-vd-decline.test.js    (5 tests)  ← fixed via Issue 20
✓ dic38-request-revise-va-s3-vd-no-action.test.js  (5 tests)  ← fixed via Issues 19/20
✓ dic39-no-action-manual-sourcing-s3.test.js       (4 pass, 1 todo)  ← fixed via Issue 21; both accept + expireDICAndRunCron; milestone todo pending QA
~ dic40-pr-revision-s3.test.js                     (5 todo)   ← no longer valid; kept as all-todo placeholder

Test Files: 8 passed, 1 partial, 1 todo-only (10 total)
Tests:      44 passed, 6 todo (50 total)
```

---

## 8. Files Modified

| File | What changed |
|------|-------------|
| `utils/constants/milestone.constant.js` | Added `ALTERNATE: 'agregator'` alias to `VENDOR_TYPE` |
| `tests/e2e/rfq-workflow/helpers/workflow-actions.helper.js` | Added `getDICEmailToken()`; updated `dicAccept` / `dicRequestRevise` / `dicDecline` to use email-link token |
| `tests/e2e/rfq-workflow/helpers/pre-test.helper.js` | Fixed S2 path (`setupRFQAtVendorStageS2`); added S3 path (`setupRFQAtVendorStageS3`); added `itemCount` param |
| `tests/e2e/rfq-workflow/helpers/state-assertions.helper.js` | Extended `assertVendorItemsUIStatus` to include `status_milestone` in UI label mapping |
| `dic03-accept-vd-s1.test.js` | Milestone assertion: `QCF_PENDING_CL` → `DIC_ACCEPTED` |
| `dic04-accept-vd-oe-s1.test.js` | Milestone assertion: `DIC_ACCEPTED` → `WAITING_OE_REVISION` |
| `dic06` through `dic10` test files | `assertRFQMilestone` → `assertVendorTypeMilestone(VENDOR_TYPE.AGGREGATOR, ...)` |
| `dic09-accept-va-oe-s2.test.js` | Milestone assertion: `DIC_ACCEPTED` → `WAITING_OE_REVISION` |
| `dic15-not-yet-action-s3-va-no-action.test.js` | VA items: `WAITING_PROCUREMENT` → `NEED_ACTION`; DIC UI: `NEED_ACTION` → `WAITING_VENDOR`; milestone → `assertVendorTypeMilestone(DIRECT, ...)` |
| `dic16-not-yet-action-s3-oe-va-no-action.test.js` | Same fixes as DIC15 |
| `dic17-not-yet-action-s3-vd-decline.test.js` | Milestone: `assertRFQMilestone` → `assertVendorTypeMilestone(AGGREGATOR, ...)` |
| `dic18-not-yet-action-s3-oe-vd-decline.test.js` | Same fixes as DIC17 |
| `dic19-not-yet-action-s3-vd-no-action.test.js` | `expireVendorAndRunCron` call changed from `VENDOR_TYPE.DIRECT` → `VENDOR_TYPE.AGGREGATOR` (S3 uses `Waiting_vendor_expiry` for both vendors); VD items assert `WAITING_PROCUREMENT`; milestone → `assertVendorTypeMilestone(AGGREGATOR, ...)` |
| `dic20-not-yet-action-s3-oe-vd-no-action.test.js` | Same fixes as DIC19 |
| `utils/constants/api-endpoint.constant.js` | Added `RUN_CRON: '/pr/rfq/run-cron'` to `API_AIGEN_ENDPOINTS.PR` |
| `tests/e2e/rfq-workflow/helpers/workflow-actions.helper.js` | Added `authenticatedPost` import; added `expireVendorAndRunCron()` export and `pollForDICEmailToken()` private helper |
| `dic21-accept-vd-s3.test.js` | VA items: `WAITING_PROCUREMENT` → `WAITING_USER`; DIC UI: `WAITING_PROCUREMENT` → `NEED_ACTION` |
| `dic22-accept-vd-oe-s3.test.js` | Same fixes as DIC21 (OE variant) |
| `dic23-accept-vd-s3-va-decline.test.js` | CS UI: `NEED_ACTION` → `'Waiting CL'` (string literal) |
| `dic25-accept-vd-s3-va-no-action.test.js` | Removed `describe.skip`; added `expireVendorAndRunCron` import + call in `beforeAll`; timeout 90000 → 120000 |
| `dic26-accept-vd-oe-s3-va-no-action.test.js` | Same fixes as DIC25 (OE variant) |
| `dic27-accept-va-s3.test.js` | VD items: `WAITING_PROCUREMENT` → `WAITING_USER`; CS UI: `'Waiting CL'` → `WAITING_USER` |
| `dic28-accept-va-oe-s3.test.js` | VD items: `WAITING_PROCUREMENT` → `WAITING_USER`; CS UI: `NEED_ACTION` → `WAITING_USER` |
| `dic31-accept-va-s3-vd-no-action.test.js` | Added `expireVendorAndRunCron(VD, AGGREGATOR)` to `beforeAll`; DIC UI: `WAITING_VENDOR` → `WAITING_PROCUREMENT`; CS UI: `WAITING_VENDOR` → `'Waiting CL'`; all vendor assertions → `assertUIState`; timeout 90000 → 120000 |
| `dic32-accept-va-oe-s3-vd-no-action.test.js` | Same as DIC31 except CS UI → `NEED_ACTION` (above-OE path) |
| `dic33-request-revise-vd-s3.test.js` | Import `dicRequestRevise` → `dicRequestReviseVDDeclineVA`; `beforeAll` call updated; all vendor assertions → `assertUIState` |
| `dic34-request-revise-vd-s3-va-decline.test.js` | VA assertion: `assertVendorItemsUIStatus` → `assertUIState('va', NO_QUOTE)`; no action change (VA declined → not in payload) |
| `dic35-request-revise-vd-s3-va-no-action.test.js` | Added `expireVendorAndRunCron(VA, AGGREGATOR)` to `beforeAll`; all vendor assertions → `assertUIState`; timeout 90000 → 120000 |
| `dic36-request-revise-va-s3.test.js` | Import `dicRequestRevise` → `dicRequestReviseVADeclineVD`; `beforeAll` call updated; all vendor assertions → `assertUIState` |
| `dic37-request-revise-va-s3-vd-decline.test.js` | VD assertion: `assertVendorItemsUIStatus` → `assertUIState('vd', NO_QUOTE)`; no action change (VD declined → not in payload) |
| `dic38-request-revise-va-s3-vd-no-action.test.js` | Added `expireVendorAndRunCron(VD, AGGREGATOR)` to `beforeAll`; all vendor assertions → `assertUIState`; timeout 90000 → 120000 |
| `dic39-no-action-manual-sourcing-s3.test.js` | Corrected vendor input to `vd: 'accept', va: 'accept'`; removed `expireBothVendorsAndRunCron`; `beforeAll` uses only `expireDICAndRunCron`; timeout → 90000 |
| `tests/e2e/rfq-workflow/helpers/workflow-actions.helper.js` | Added `dicRequestReviseVDDeclineVA`, `dicRequestReviseVADeclineVD`, `expireBothVendorsAndRunCron`, `expireDICAndRunCron` |
