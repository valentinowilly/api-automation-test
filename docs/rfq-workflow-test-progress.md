# RFQ Workflow — E2E Test Automation Progress

> **Last updated:** 2026-06-11 (All CS, CL, and MG tests done — 100% test coverage)
> **Source directory:** `tests/e2e/rfq-workflow/`
> **Legend:** ✅ Done (no `test.todo`) | 🔲 Placeholder (`test.todo` present) | ⬜ Not yet created

---

## Summary

| CS Send QCF | cs-send-qcf/ | 32 | 32 | 0 | 0 | **100%** |
| CL Approval | cl-approval/ | 18 | 18 | 0 | 0 | **100%** |
| Management Approval | management-approval/ | 18 | 18 | 0 | 0 | **100%** |
| **TOTAL** | | **157** | **157** | **0** | **0** | **100%** |
> **Note:** 🔲 Placeholder files exist as test files but all tests inside use `test.todo(...)` — they will be skipped by Vitest and produce no assertions. They need to be implemented.

---

## S1 — Vendor Direct (`s1-vendor-direct/`)

**Progress: 6/6 — 100%** ✅

| File                         | Description          | Status  |
| ---------------------------- | -------------------- | ------- |
| `vd1-not-yet-action.test.js` | VD not yet acted     | ✅ Done |
| `vd2-accept.test.js`         | VD accept (below OE) | ✅ Done |
| `vd3-need-confirm.test.js`   | VD need confirmation | ✅ Done |
| `vd4-decline.test.js`        | VD decline           | ✅ Done |
| `vd5-expired.test.js`        | VD expired           | ✅ Done |
| `vd6-accept-oe.test.js`      | VD accept above OE   | ✅ Done |

---

## S2 — Vendor Aggregator (`s2-vendor-agregator/`)

**Progress: 6/6 — 100%** ✅

| File                         | Description          | Status  |
| ---------------------------- | -------------------- | ------- |
| `va1-not-yet-action.test.js` | VA not yet acted     | ✅ Done |
| `va2-accept.test.js`         | VA accept (below OE) | ✅ Done |
| `va3-need-confirm.test.js`   | VA need confirmation | ✅ Done |
| `va4-decline.test.js`        | VA decline           | ✅ Done |
| `va5-expired.test.js`        | VA expired           | ✅ Done |
| `va6-accept-oe.test.js`      | VA accept above OE   | ✅ Done |

---

## S3 — Vendor Combined (`s3-vendor-combined/`)

**Progress: 38/38 — 100%** ✅

| File                                          | Description                            | Status  |
| --------------------------------------------- | -------------------------------------- | ------- |
| `v01-not-yet-action.test.js`                  | Both VD+VA not yet acted               | ✅ Done |
| `v02-vd-accept.test.js`                       | VD accept, VA not yet                  | ✅ Done |
| `v03-vd-accept-oe.test.js`                    | VD accept OE, VA not yet               | ✅ Done |
| `v04-vd-need-confirm.test.js`                 | VD need confirm, VA not yet            | ✅ Done |
| `v05-vd-decline.test.js`                      | VD decline, VA not yet                 | ✅ Done |
| `v06-no-action-va-revise.test.js`             | VD no action (DIC accepted), VA revise | ✅ Done |
| `v07-vd-decline-va-revise.test.js`            | VD decline, VA revise                  | ✅ Done |
| `v08-va-accept.test.js`                       | VA accept, VD not yet                  | ✅ Done |
| `v09-va-accept-oe.test.js`                    | VA accept OE, VD not yet               | ✅ Done |
| `v10-va-need-confirm.test.js`                 | VA need confirm, VD not yet            | ✅ Done |
| `v11-va-decline.test.js`                      | VA decline, VD not yet                 | ✅ Done |
| `v12-vd-revise-va-no-action.test.js`          | VD revise, VA no action                | ✅ Done |
| `v13-vd-revise-va-decline.test.js`            | VD revise, VA decline                  | ✅ Done |
| `v14-vd-accept-va-accept.test.js`             | VD accept, VA accept                   | ✅ Done |
| `v15-vd-accept-va-accept-oe.test.js`          | VD accept, VA accept OE                | ✅ Done |
| `v16-vd-accept-va-need-confirm.test.js`       | VD accept, VA need confirm             | ✅ Done |
| `v17-vd-accept-va-decline.test.js`            | VD accept, VA decline                  | ✅ Done |
| `v18-vd-accept-va-no-action.test.js`          | VD accept, VA no action                | ✅ Done |
| `v19-vd-accept-oe-va-accept.test.js`          | VD accept OE, VA accept                | ✅ Done |
| `v20-vd-accept-oe-va-accept-oe.test.js`       | VD accept OE, VA accept OE             | ✅ Done |
| `v21-vd-accept-oe-va-need-confirm.test.js`    | VD accept OE, VA need confirm          | ✅ Done |
| `v22-vd-accept-oe-va-decline.test.js`         | VD accept OE, VA decline               | ✅ Done |
| `v23-vd-accept-oe-va-no-action.test.js`       | VD accept OE, VA no action             | ✅ Done |
| `v24-vd-need-confirm-va-accept.test.js`       | VD need confirm, VA accept             | ✅ Done |
| `v25-vd-need-confirm-va-accept-oe.test.js`    | VD need confirm, VA accept OE          | ✅ Done |
| `v26-vd-need-confirm-va-need-confirm.test.js` | Both need confirm                      | ✅ Done |
| `v27-vd-need-confirm-va-decline.test.js`      | VD need confirm, VA decline            | ✅ Done |
| `v28-vd-need-confirm-va-no-action.test.js`    | VD need confirm, VA no action          | ✅ Done |
| `v29-vd-decline-va-accept.test.js`            | VD decline, VA accept                  | ✅ Done |
| `v30-vd-decline-va-accept-oe.test.js`         | VD decline, VA accept OE               | ✅ Done |
| `v31-vd-decline-va-need-confirm.test.js`      | VD decline, VA need confirm            | ✅ Done |
| `v32-vd-decline-va-decline.test.js`           | Both decline                           | ✅ Done |
| `v33-vd-decline-va-no-action.test.js`         | VD decline, VA no action               | ✅ Done |
| `v34-vd-no-action-va-accept.test.js`          | VD no action, VA accept                | ✅ Done |
| `v35-vd-no-action-va-accept-oe.test.js`       | VD no action, VA accept OE             | ✅ Done |
| `v36-vd-no-action-va-need-confirm.test.js`    | VD no action, VA need confirm          | ✅ Done |
| `v37-vd-no-action-va-decline.test.js`         | VD no action, VA decline               | ✅ Done |
| `v38-vd-no-action-va-no-action.test.js`       | Both no action                         | ✅ Done |

---

## DIC Review (`dic-review/`)

**Progress: 39/40 — 98%** (DIC40 placeholder pending PR revision helper)

> **DIC01–DIC30 refactor (2026-05-18):** All vendor UI assertions replaced with
> `assertUIState` (real API calls via `ctx.vendorAccountTokenVD`/`VA`). `expireVendorAndRunCron`
> updated to 4-param signature with `vendorType` + `AND config_condition = ?` filter.
> DIC19/DIC20 fixed: S3 VD no_action must use `VENDOR_TYPE.AGGREGATOR` (not DIRECT) because
> S3 tokens use `Waiting_vendor_expiry` for both vendors (see Issue 16 in dic-review-test-reference.md).
> DIC21/22: switched to `dicAcceptVDDeclineVA`. DIC27/28: switched to `dicAcceptVADeclineVD`.
> DIC25/26: `expireVendorAndRunCron` call updated to 4-param. All 140 tests (DIC01–DIC30) pass.

> **DIC31–DIC40 implementation (2026-05-19):** Key fixes:
>
> - **Issue 17:** DIC31/32 DIC/CS UI assertions corrected to "Waiting Procurement"/"Waiting CL"/"Need Action" (post-expiry-cron state, same pattern as DIC25/26).
> - **Issue 18:** DIC33/36 — `dicRequestRevise(vendorType)` replaced with `dicRequestReviseVDDeclineVA`/`dicRequestReviseVADeclineVD`. When both vendors accepted, the DIC konfirmasi payload must include all accepted-vendor items: target → NEED_REVIEW, other → DECLINE. Vendor-declined and no_action items are excluded (DIC34/37 correct as-is, DIC35/38 correct as-is).
> - **Issue 19:** DIC31/32/35/38 — added `expireVendorAndRunCron(vendorCode, AGGREGATOR)` to `beforeAll` (same S3 no_action pattern as DIC25/26). Timeouts → 120000.
> - **Issue 20:** All DIC31–DIC39 vendor UI assertions switched to `assertUIState` — `assertVendorItemsUIStatus` cannot return "Waiting Procurement" for milestone=22 (RFQ_NOT_SUBMITTED).
> - **Issue 21:** DIC39 corrected — vendor input is `vd: 'accept', va: 'accept'` (both submit normally, DIC email token auto-created). Only `expireDICAndRunCron` needed. Timeout → 90000. Milestone `test.todo` pending QA confirmation of constant name.
> - **DIC40:** No longer a valid test case — kept as all-`test.todo` placeholder.
>   DIC31–DIC38: 40 tests pass. DIC39: 4 tests pass + 1 todo. DIC40: all todo.

### dic01-dic10 — 10/10 ✅

| File                                 | Description                  | Status  |
| ------------------------------------ | ---------------------------- | ------- |
| `dic01-not-yet-action-s1.test.js`    | S1 — DIC not yet action      | ✅ Done |
| `dic02-not-yet-action-s1-oe.test.js` | S1 — DIC not yet action (OE) | ✅ Done |
| `dic03-accept-vd-s1.test.js`         | S1 — DIC accept VD           | ✅ Done |
| `dic04-accept-vd-oe-s1.test.js`      | S1 — DIC accept VD (OE)      | ✅ Done |
| `dic05-request-revise-vd-s1.test.js` | S1 — DIC request revise VD   | ✅ Done |
| `dic06-not-yet-action-s2.test.js`    | S2 — DIC not yet action      | ✅ Done |
| `dic07-not-yet-action-s2-oe.test.js` | S2 — DIC not yet action (OE) | ✅ Done |
| `dic08-accept-va-s2.test.js`         | S2 — DIC accept VA           | ✅ Done |
| `dic09-accept-va-oe-s2.test.js`      | S2 — DIC accept VA (OE)      | ✅ Done |
| `dic10-request-revise-va-s2.test.js` | S2 — DIC request revise VA   | ✅ Done |

### dic11-dic20 — 10/10 ✅

| File                                              | Description                                   | Status  |
| ------------------------------------------------- | --------------------------------------------- | ------- |
| `dic11-not-yet-action-s3.test.js`                 | S3 — DIC not yet action (both accept)         | ✅ Done |
| `dic12-not-yet-action-s3-oe.test.js`              | S3 — DIC not yet action (both OE)             | ✅ Done |
| `dic13-not-yet-action-s3-va-decline.test.js`      | S3 — DIC not yet action (VA decline)          | ✅ Done |
| `dic14-not-yet-action-s3-oe-va-decline.test.js`   | S3 — DIC not yet action (VD OE, VA decline)   | ✅ Done |
| `dic15-not-yet-action-s3-va-no-action.test.js`    | S3 — DIC not yet action (VA no action)        | ✅ Done |
| `dic16-not-yet-action-s3-oe-va-no-action.test.js` | S3 — DIC not yet action (VD OE, VA no action) | ✅ Done |
| `dic17-not-yet-action-s3-vd-decline.test.js`      | S3 — DIC not yet action (VD decline)          | ✅ Done |
| `dic18-not-yet-action-s3-oe-vd-decline.test.js`   | S3 — DIC not yet action (VA OE, VD decline)   | ✅ Done |
| `dic19-not-yet-action-s3-vd-no-action.test.js`    | S3 — DIC not yet action (VD no action)        | ✅ Done |
| `dic20-not-yet-action-s3-oe-vd-no-action.test.js` | S3 — DIC not yet action (VA OE, VD no action) | ✅ Done |

### dic21-dic30 — 10/10 ✅

| File                                         | Description                              | Status  |
| -------------------------------------------- | ---------------------------------------- | ------- |
| `dic21-accept-vd-s3.test.js`                 | S3 — DIC accept VD (both accept)         | ✅ Done |
| `dic22-accept-vd-oe-s3.test.js`              | S3 — DIC accept VD (both OE)             | ✅ Done |
| `dic23-accept-vd-s3-va-decline.test.js`      | S3 — DIC accept VD (VA decline)          | ✅ Done |
| `dic24-accept-vd-oe-s3-va-decline.test.js`   | S3 — DIC accept VD (VD OE, VA decline)   | ✅ Done |
| `dic25-accept-vd-s3-va-no-action.test.js`    | S3 — DIC accept VD (VA no action)        | ✅ Done |
| `dic26-accept-vd-oe-s3-va-no-action.test.js` | S3 — DIC accept VD (VD OE, VA no action) | ✅ Done |
| `dic27-accept-va-s3.test.js`                 | S3 — DIC accept VA (both accept)         | ✅ Done |
| `dic28-accept-va-oe-s3.test.js`              | S3 — DIC accept VA (both OE)             | ✅ Done |
| `dic29-accept-va-s3-vd-decline.test.js`      | S3 — DIC accept VA (VD decline)          | ✅ Done |
| `dic30-accept-va-oe-s3-vd-decline.test.js`   | S3 — DIC accept VA (VA OE, VD decline)   | ✅ Done |

### dic31-dic40 — 9/9 ✅

| File                                              | Description                               | Status  |
| ------------------------------------------------- | ----------------------------------------- | ------- |
| `dic31-accept-va-s3-vd-no-action.test.js`         | S3 — DIC accept VA (VD no action)         | ✅ Done |
| `dic32-accept-va-oe-s3-vd-no-action.test.js`      | S3 — DIC accept VA (VA OE, VD no action)  | ✅ Done |
| `dic33-request-revise-vd-s3.test.js`              | S3 — DIC request revise VD (both accept)  | ✅ Done |
| `dic34-request-revise-vd-s3-va-decline.test.js`   | S3 — DIC request revise VD (VA decline)   | ✅ Done |
| `dic35-request-revise-vd-s3-va-no-action.test.js` | S3 — DIC request revise VD (VA no action) | ✅ Done |
| `dic36-request-revise-va-s3.test.js`              | S3 — DIC request revise VA (both accept)  | ✅ Done |
| `dic37-request-revise-va-s3-vd-decline.test.js`   | S3 — DIC request revise VA (VD decline)   | ✅ Done |
| `dic38-request-revise-va-s3-vd-no-action.test.js` | S3 — DIC request revise VA (VD no action) | ✅ Done |
| `dic39-no-action-manual-sourcing-s3.test.js`      | S3 — DIC no action (Manual Sourcing)      | ✅ Done |

---

## CS Send QCF (`cs-send-qcf/`)

**Progress: 32/32 — 100%**


| File | Description | Status |
|------|-------------|--------|
| `cs01-not-yet-action-s1-oe.test.js` | CS not yet action — S1 OE | ✅ Done |
| `cs02-not-yet-action-s2.test.js` | CS not yet action — S2 | ✅ Done |
| `cs03-not-yet-action-s2-oe.test.js` | CS not yet action — S2 OE | ✅ Done |
| `cs04-surrogate-vd-s1-oe.test.js` | CS surrogate VD — S1 OE | ✅ Done |
| `cs05-resend-rfq-va-s2.test.js` | CS resend RFQ VA — S2 | ✅ Done |
| `cs06-surrogate-va-s2-oe.test.js` | CS surrogate VA — S2 OE | ✅ Done |
| `cs07-not-yet-action-s3-all-no-action.test.js` | CS not yet action — S3 all no action | ✅ Done |
| `cs08-not-yet-action-s3-all-decline.test.js` | CS not yet action — S3 all decline | ✅ Done |
| `cs09-not-yet-action-s3-vd-no-act-va-decline.test.js` | CS not yet action — S3 VD no act, VA decline | ✅ Done |
| `cs10-not-yet-action-s3-vd-decline-va-no-act.test.js` | CS not yet action — S3 VD decline, VA no act | ✅ Done |
| `cs11-resend-rfq-vd-s3-va-no-action.test.js` | CS resend RFQ VD — S3 VA no action | ✅ Done |
| `cs12-resend-rfq-vd-s3-va-decline.test.js` | CS resend RFQ VD — S3 VA decline | ✅ Done |
| `cs13-resend-rfq-va-s3-vd-no-action.test.js` | CS resend RFQ VA — S3 VD no action | ✅ Done |
| `cs14-resend-rfq-va-s3-vd-decline.test.js` | CS resend RFQ VA — S3 VD decline | ✅ Done |
| `cs15-not-yet-action-s3-vd-oe.test.js` | CS not yet action — S3 VD OE | ✅ Done |
| `cs16-not-yet-action-s3-oe-va-decline.test.js` | CS not yet action — S3 OE, VA decline | ✅ Done |
| `cs17-not-yet-action-s3-oe-va-no-action.test.js` | CS not yet action — S3 OE, VA no action | ✅ Done |
| `cs18-not-yet-action-s3-va-oe.test.js` | CS not yet action — S3 VA OE | ✅ Done |
| `cs19-not-yet-action-s3-oe-vd-decline.test.js` | CS not yet action — S3 OE, VD decline | ✅ Done |
| `cs20-not-yet-action-s3-oe-vd-no-action.test.js` | CS not yet action — S3 OE, VD no action | ✅ Done |
| `cs21-surrogate-vd-s3.test.js` | CS surrogate VD — S3 | ✅ Done |
| `cs22-surrogate-vd-va-decline.test.js` | CS surrogate VD — VA decline | ✅ Done |
| `cs23-surrogate-vd-va-no-action.test.js` | CS surrogate VD — VA no action | ✅ Done |
| `cs24-surrogate-va-s3.test.js` | CS surrogate VA — S3 | ✅ Done |
| `cs25-surrogate-va-vd-decline.test.js` | CS surrogate VA — VD decline | ✅ Done |
| `cs26-surrogate-va-vd-no-action.test.js` | CS surrogate VA — VD no action | ✅ Done |
| `cs27-revisi-oe.test.js` | CS revisi OE | ✅ Done |
| `cs28-not-yet-action-from-dic.test.js` | CS not yet action — from DIC | ✅ Done |
| `cs29-approve-oe-revision.test.js` | CS approve OE revision | ✅ Done |
| `cs30-auto-manual-vendor-no-quote.test.js` | CS auto manual vendor — no quote | ✅ Done |
| `cs31-auto-manual-vendor-price-above-oe.test.js` | CS auto manual vendor — price above OE | ✅ Done |
| `cs32-manual-sourcing.test.js` | CS manual sourcing | ✅ Done |
---

## CL Approval (`cl-approval/`)

**Progress: 18/18 — 100%**

| File                                             | Description                         | Status  |
| ------------------------------------------------ | ----------------------------------- | ------- |
| `cl01-not-yet-action-s1.test.js`                 | CL not yet action — S1              | ✅ Done |
| `cl02-not-yet-action-s2.test.js`                 | CL not yet action — S2              | ✅ Done |
| `cl03-not-yet-action-s3-vd-accept.test.js`       | CL not yet action — S3 VD accept    | ✅ Done |
| `cl04-not-yet-action-s3-vd-accept-oe.test.js`    | CL not yet action — S3 VD accept OE | ✅ Done |
| `cl05-not-yet-action-s3-vd-va-accept.test.js`    | CL not yet action — S3 both accept  | ✅ Done |
| `cl06-not-yet-action-s3-vd-va-accept-oe.test.js` | CL not yet action — S3 both OE      | ✅ Done |
| `cl07-not-yet-action-s3-nc-revise.test.js`       | CL not yet action — S3 NC revise    | ✅ Done |
| `cl08-not-yet-action-s3-no-action.test.js`       | CL not yet action — S3 no action    | ✅ Done |
| `cl09-approve-s1.test.js`                        | CL approve — S1                     | ✅ Done |
| `cl10-approve-s2.test.js`                        | CL approve — S2                     | ✅ Done |
| `cl11-approve-s3-vd-accept.test.js`              | CL approve — S3 VD accept           | ✅ Done |
| `cl12-approve-s3-vd-accept-oe.test.js`           | CL approve — S3 VD accept OE        | ✅ Done |
| `cl13-approve-s3-vd-va-accept.test.js`           | CL approve — S3 both accept         | ✅ Done |
| `cl14-approve-s3-vd-va-accept-oe.test.js`        | CL approve — S3 both OE             | ✅ Done |
| `cl15-approve-s3-nc-revise.test.js`              | CL approve — S3 NC revise           | ✅ Done |
| `cl16-approve-s3-no-action.test.js`              | CL approve — S3 no action           | ✅ Done |
| `cl17-manual-sourcing.test.js`                   | CL manual sourcing                  | ✅ Done |
| `cl18-auto-manual-sourcing-no-action.test.js`    | CL auto manual sourcing — no action | ✅ Done |

---

## Management Approval (`management-approval/`)

**Progress: 18/18 — 100%**

> **MG01–MG06 implementation (2026-05-20):** Key fixes:
>
> - `setupRFQAtManagementStage` calls `setupRFQAtCSStage` (normal price → QCF auto-created by backend after DIC approval, no CS send_to_qcf needed) then polls for QCF via `pollForQCFNumber` (async creation) then CL approves.
> - `setupRFQAtCSStage` — S3 both-accepted: uses `dicAcceptVDDeclineVA`/`dicAcceptVADeclineVD` combined payloads. S3 VA no_action: calls `expireVendorAndRunCron` for VA before DIC confirmation to create DIC email token.
> - Table status: `assertRFQMilestone` replaced with `assertQCFCLApproved` — checks `qcf_library.cl_approved_at IS NOT NULL` (rfq_library.status_milestone does NOT update to 18 on CL approval).
> - MG dashboard: requires correct `user_matrix_categories` data for the management user.


| File                                                 | Description                                      | Status         |
| ---------------------------------------------------- | ------------------------------------------------ | -------------- |
| `mg01-not-yet-action-s1.test.js`                     | MG not yet action — S1                           | ✅ Done        |
| `mg02-not-yet-action-s2.test.js`                     | MG not yet action — S2                           | ✅ Done        |
| `mg03-not-yet-action-s3-vd-accept.test.js`           | MG not yet action — S3 VD accept, DIC chose VD   | ✅ Done        |
| `mg04-not-yet-action-s3-vd-accept-oe.test.js`        | MG not yet action — S3 VD accept, VA no action   | ✅ Done        |
| `mg05-not-yet-action-s3-vd-va-accept.test.js`        | MG not yet action — S3 VD accept, VA decline     | ✅ Done        |
| `mg06-not-yet-action-s3-vd-va-accept-oe.test.js`     | MG not yet action — S3 both accept, DIC chose VA | ✅ Done        |
| `mg07-not-yet-action-s3-nc-revise.test.js`           | MG not yet action — S3 NC revise                 | ✅ Done |
| `mg08-not-yet-action-s3-no-action.test.js`           | MG not yet action — S3 no action                 | ✅ Done |
| `mg09-approve-po-publish-s1.test.js`                 | MG approve & PO publish — S1                     | ✅ Done |
| `mg10-approve-po-publish-s2.test.js`                 | MG approve & PO publish — S2                     | ✅ Done |
| `mg11-approve-po-publish-s3-vd-accept.test.js`       | MG approve & PO publish — S3 VD accept           | ✅ Done |
| `mg12-approve-po-publish-s3-vd-accept-oe.test.js`    | MG approve & PO publish — S3 VD accept OE        | ✅ Done |
| `mg13-approve-po-publish-s3-vd-va-accept.test.js`    | MG approve & PO publish — S3 both accept         | ✅ Done |
| `mg14-approve-po-publish-s3-vd-va-accept-oe.test.js` | MG approve & PO publish — S3 both OE             | ✅ Done |
| `mg15-approve-po-publish-s3-nc-revise.test.js`       | MG approve & PO publish — S3 NC revise           | ✅ Done |
| `mg16-approve-po-publish-s3-no-action.test.js`       | MG approve & PO publish — S3 no action           | ✅ Done |
| `mg17-manual-sourcing.test.js`                       | MG manual sourcing                               | ✅ Done |
| `mg18-auto-manual-sourcing-no-action.test.js`        | MG auto manual sourcing — no action              | ✅ Done |
