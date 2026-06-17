# E2E Test Scenarios Analysis - PR Import Workflow

## Executive Summary

This document provides comprehensive test scenario analysis for the AiGen PR Import workflow, driven by configurations in the `config_autopo` table. All test scenarios are differentiated by **server group** (BCG vs GEMS) and **configuration state** (is_active).

**Key Findings:**

- BCG uses `value`/`convert_value` (USD) for price threshold validation
- GEMS uses `src_value` (IDR/original currency) for price threshold validation
- Multi-config AND logic: ALL active configs must pass for PR to proceed
- 4 priority levels: P0 (happy path), P1 (SLA expiry), P2 (operator coverage), P3 (edge cases)
- 30+ distinct test scenarios identified

**Complete E2E Core Feature Procurement Workflow Overview (15 Steps):**

```
1. Mock Data Creation
   POST /mock/search-library
   → Inserts PR data into search_library table (prpo database)

2. Import Trigger
   POST /pr-sourcing/aigen/import-pr
   → Gateway publishes event to Kafka topic

3. Kafka Consumer Processing
   aigen-import-pr worker consumes event
   → Reads PR from search_library

4. Config Validation (9 PR validations - ALL must pass)
   → Validates: is_da, im_number, is_delete, is_oa, oem, plant_code, pr_type, value/src_value
   → AND logic: ONE failure = entire PR rejected

5. RFQ Generation
   → Inserts into rfq_library table (aigen database)
   → Auto-generates rfq_number (RFQ0000XXX)
   → status_milestone = 2 (VENDOR_PENDING)

6. Vendor Email Token & RFQ Notification
   → Generates JWT token with expiry based on config 
    → vendor direct SLA (config_autopo condition `Waiting_vendor_direct_expiry`) (ex: config_value = 3 → token expires in 3 days)
    → vendor aggregator SLA (config_autopo condition `Waiting_vendor_expiry`) (ex: config_value = 3 → token expires in 3 days)
   → Inserts into rfq_token_email table
   → Sends email with quotation link

7. Vendor Submission 
   PUT /vendor/submit_penawaran
   → Validates SLA based on config_autopo conditions:
      → SLA for vendor direct (Level 1) get value from config_autopo condition `Waiting_vendor_direct_expiry` (ex: config_value = 3 → 3 days to submit)
      → SLA for vendor aggregator (Level 2) get value from config_autopo condition `Waiting_vendor_expiry` (ex: config_value = 3 → 3 days to submit)
   → Updates status_milestone = 3 (VENDOR_ACCEPTED)
   → Vendor price validated (80-110% of OE)

8. DIC Email Token & Confirmation Request
   → Generates JWT token with config_autopo condition `Waiting_DIC_review_expiry` value expiry (ex: config_value = 30 → token expires in 30 days)
   → Inserts into rfq_token_email table
   → Sends email to DIC for review

9. DIC Confirmation 
   PUT /dic/konfirmasi_penawaran
   → Validates SLA based on config_autopo condition `Waiting_DIC_review_expiry` (ex: config_value = 30 → 30 days to confirm)
   → Validates DIC decision (accept/reject)
     - If reject → Updates status_milestone = 16 (DIC_REJECTED)
     - If accept → Update status_milestone = 18 (DIC_APPROVED) and proceed to CS action
   → Updates status_milestone = 10 (DIC_ACCEPTED)

10. CS Action - Send to QCF 
    POST /cs/send_to_qcf/{rfq_number}/{vendor_batch}
    → Validates CS action SLA based on config_autopo condition `Waiting_CS_expiry` (ex: config_value = 3 → 3 days to take action)
     - If SLA expired → Updates status_milestone = 19 (CS_SLA_EXPIRED)
     - If within SLA → Proceeds to create QCF record
    → Creates QCF record in qcf_library
    → Auto-generates qcf_number (QCF0000XXX)
    → status_milestone = 17 (QCF_PENDING_CL)

11. QCF Creation & CL Email Token
    → Generates JWT token with config_autopo condition `Waiting_CL_review_expiry` value expiry (ex: config_value = 3 → token expires in 3 days)
    → Inserts into qcf_token_email table
    → Sends email to CL for approval

12. CL Approval (3-day SLA)
    PUT /cl/approve_qcf/{qcf_number}
    → Updates status_milestone = 18 (QCF_CL_APPROVED)
    → GEMS: FINAL STATE (ready for SAP sync)
    → BCG: Proceeds to Management approval

13. [BCG ONLY] Management Email Token & Approval Request
    → Generates JWT token with config auto po config condition `Waiting_Management_review_expiry` expiry
    → Sends email to Management

14. [BCG ONLY] Management Approval (3-day SLA)
    PUT /management/approve_qcf/{qcf_number}
    → Updates status_milestone = 20 (QCF_MANAGEMENT_APPROVED)

15. SAP Auto PO Sync (Cron Job)
    src/sync.js runs periodically
    → Calls rfqController.getSyncSAPPO()
    → Sends QCF data to SAP
    → Updates status_milestone = 21 (SAP_PO_SYNCED)
    → PO created in SAP system
```

**Critical SLA Differences:**

- Vendor Direct: config_autopo condition `Waiting_vendor_direct_expiry` (ex: config_value = 3 → 3 days to submit)
- Vendor Aggregator: config_autopo condition `Waiting_vendor_expiry` (ex: config_value = 3 → 3 days to submit)
- DIC: config_autopo condition `Waiting_DIC_review_expiry` (ex: config_value = 30 → 30 days to confirm)
- CS: config_autopo condition `Waiting_CS_expiry` (ex: config_value = 3 → 3 days to take action)
- CL: config_autopo condition `Waiting_CL_review_expiry` (ex: config_value = 3 → 3 days to approve)
- Management (BCG only): config_autopo condition `Waiting_Management_review_expiry` (ex: config_value = 3 → 3 days to approve)

---

## config_autopo Table Reference

### Table Schema

```sql
CREATE TABLE config_autopo (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_type VARCHAR(50),           -- 'validation' | 'sla_expiry' | 'approval_level'
  server_group VARCHAR(20),          -- 'BCG' | 'GEMS'
  config_condition VARCHAR(100),     -- Field to validate (e.g., 'is_da', 'value')
  config_operator VARCHAR(20),       -- '=', '>', '<', 'in', 'not_in', 'is_null', 'not_null'
  config_value VARCHAR(255),         -- Expected value or threshold
  active_when TIMESTAMP,             -- Config activation timestamp
  is_active TINYINT(1),              -- 1 = active, 0 = inactive
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Active BCG Configurations (22 configs)

**PR Validation Configs (9 configs):**

| ID  | config_condition | config_operator | config_value | Purpose                                    |
|-----|------------------|-----------------|--------------|-------------------------------------------|
| 269 | im_number        | =               | ""           | IM number must be empty string            |
| 39  | is_da            | in              | "1, 0"       | DA can be either 1 or 0 (both accepted)   |
| 10  | is_delete        | =               | "0"          | PR must not be marked as deleted          |
| 6   | is_oa            | =               | "0"          | PR must not be Outline Agreement          |
| 14  | oem              | =               | is_null      | OEM field must be null                    |
| 37  | plant_code       | not_in          | "A100, B100, B300, B400, B500, B600, B700, D100, E100, E200, G100" | Exclude specific plants |
| 17  | pr_type          | in              | "ZST, ZDC, ZPM, ZMR" | Only specific PR types allowed      |
| 26  | value            | <               | "5000"       | Value must be LESS than 5000 USD          |

**Setting Parameter Configs (13 configs):**

| ID  | config_condition                  | config_operator | config_value                  | Purpose                                    |
|-----|-----------------------------------|-----------------|-------------------------------|-------------------------------------------|
| 32  | DIC_Email_Reminder_interval       | =               | "1"                           | DIC reminder interval (days)              |
| 36  | hide_oe_in_vendor_rfq             | =               | yes                           | Hide OE price from vendor                 |
| 29  | hide_price_negotiation            | =               | no                            | Show price negotiation UI                 |
| 4   | Max_price                         | <=              | "110"                         | Vendor price max 110% of OE               |
| 31  | Min_price                         | >=              | "80"                          | Vendor price min 80% of OE                |
| 41  | qcf_approval_level                | in              | "category leader, management" | Requires CL + Management approval         |
| 43  | skip_level_1_RFQ                  | =               | no                            | If value no send RFQ to Vendor Direct (Level 1). If value yes send RFQ to Vendor Direct (Level 1) and Vendor Aggregator (Level 2)               |
| 47  | Waiting_CL_review_expiry          | =               | "3"                           | CL approval deadline (3 days)             |
| 45  | Waiting_CS_expiry                 | =               | "3"                           | CS action deadline (3 days)               |
| 35  | Waiting_DIC_review_expiry         | =               | "30"                          | DIC confirmation deadline (30 days!)      |
| 48  | Waiting_Management_review_expiry  | =               | "3"                           | Management approval deadline (3 days)     |
| 46  | Waiting_OE_revision_expiry        | =               | "3"                           | OE revision deadline (3 days)             |
| 44  | Waiting_vendor_direct_expiry      | =               | "3"                           | Vendor direct submission deadline (3 days)|
| 38  | Waiting_vendor_expiry             | =               | "3"                           | Vendor RFQ submission deadline (3 days)   |

### Active GEMS Configurations (22 configs)

**PR Validation Configs (9 configs):**

| ID  | config_condition | config_operator | config_value | Purpose                                    |
|-----|------------------|-----------------|--------------|-------------------------------------------|
| 62  | im_number        | =               | not null     | IM number must be present (uses "not null" as value) |
| 61  | is_da            | in              | "1, 0"       | DA can be either 1 or 0 (both accepted)   |
| 51  | is_delete        | =               | "0"          | PR must not be marked as deleted          |
| 50  | is_oa            | =               | "0"          | PR must not be Outline Agreement          |
| 52  | oem              | =               | is_null      | OEM field must be null                    |
| 59  | plant_code       | not_in          | "A100, B100, B300, B400, B500, B600, B700, D100, E100, E200, G100" | Exclude specific plants |
| 53  | pr_type          | in              | "ZST, ZDC, ZPM, ZMR" | Only specific PR types allowed      |
| 80  | src_value        | <               | "5000"       | src_value must be LESS than 5000 (IDR)    |

**Setting Parameter Configs (13 configs):**

| ID  | config_condition                  | config_operator | config_value       | Purpose                                    |
|-----|-----------------------------------|-----------------|--------------------|-------------------------------------------|
| 56  | DIC_Email_Reminder_interval       | =               | "1"                | DIC reminder interval (days)              |
| 58  | hide_oe_in_vendor_rfq             | =               | yes                | Hide OE price from vendor                 |
| 54  | hide_price_negotiation            | =               | no                 | Show price negotiation UI                 |
| 49  | Max_price                         | <=              | "110"              | Vendor price max 110% of OE               |
| 55  | Min_price                         | >=              | "80"               | Vendor price min 80% of OE                |
| 42  | qcf_approval_level                | in              | category leader    | Requires only CL approval (NOT management)|
| 63  | skip_level_1_RFQ                  | =               | no                 | If value no send RFQ to Vendor Direct (Level 1). If value yes send RFQ to Vendor Direct (Level 1) and Vendor Aggregator (Level 2)                |
| 67  | Waiting_CL_review_expiry          | =               | "3"                | CL approval deadline (3 days)             |
| 65  | Waiting_CS_expiry                 | =               | "3"                | CS action deadline (3 days)               |
| 57  | Waiting_DIC_review_expiry         | =               | "30"               | DIC confirmation deadline (30 days!)      |
| 68  | Waiting_Management_review_expiry  | =               | "3"                | Management approval deadline (3 days)     |
| 66  | Waiting_OE_revision_expiry        | =               | "3"                | OE revision deadline (3 days)             |
| 64  | Waiting_vendor_direct_expiry      | =               | "3"                | Vendor direct submission deadline (3 days)|
| 60  | Waiting_vendor_expiry             | =               | "3"                | Vendor RFQ submission deadline (3 days)   |

**Critical Differences:**

**BCG vs GEMS:**

- **Value field:** BCG uses `value < 5000` (USD), GEMS uses `src_value < 5000` (IDR/original currency)
- **IM number:** BCG requires `im_number = ""` (empty), GEMS requires `im_number = not null` (present)
- **QCF approval:** BCG requires `category leader, management`, GEMS requires `category leader` only

**Common Validations (Both BCG and GEMS):**

- is_da can be 1 OR 0 (both accepted via `in` operator)
- is_delete must be "0" (not deleted)
- is_oa must be "0" (not Outline Agreement)
- oem must be null (using `= is_null` pattern)
- plant_code must not be in excluded list (11 plants)
- pr_type must be in allowed list (ZST, ZDC, ZPM, ZMR)
- DIC expiry is **30 days** (NOT 3 days like other roles!)
- Vendor price must be between 80-110% of OE price

---

## Configuration Logic & Evaluation

**Key Characteristics:**

- **AND semantics**: ALL active configs must pass (one failure = entire PR rejected)
- **Most recent config wins**: `MAX(active_when)` selects latest config per condition
- **Server group isolation**: BCG configs don't affect GEMS PRs and vice versa
- **Active flag check**: Only configs with `is_active=1` are evaluated

### Operator Support

**Location:** `aigen-import-pr/utils/operator-checker.js:1-15`

| Operator    | Type      | Example Usage                                  | Evaluation Logic                          |
|-------------|-----------|------------------------------------------------|-------------------------------------------|
| `=`         | Numeric   | `value = 10000`                                | `fieldValue == expectedValue`             |
| `>`         | Numeric   | `value > 0`                                    | `fieldValue > expectedValue`              |
| `<`         | Numeric   | `value < 50000`                                | `fieldValue < expectedValue`              |
| `>=`        | Numeric   | `value >= 5000`                                | `fieldValue >= expectedValue`             |
| `<=`        | Numeric   | `value <= 100000`                              | `fieldValue <= expectedValue`             |
| `in`        | Array     | `qcf_approval_level in category leader,management` | `expectedValues.includes(fieldValue)` |
| `not_in`    | Array     | `status not_in rejected,expired`               | `!expectedValues.includes(fieldValue)`    |
| `is_null`   | Null check| `discount_code is_null`                        | `fieldValue === null`                     |
| `not_null`  | Null check| `im_number not_null`                           | `fieldValue !== null`                     |

---

## Comprehensive Configuration Business Logic Analysis

This section provides detailed business logic descriptions for each configuration, including scenarios, decision trees, and workflow impacts.

**⚙️ Important Note on Configuration Values:**
> All configuration values referenced in this document (e.g., "3 business days", "80%", "110%", "5000") are **dynamic and configurable** via the admin interface. The values shown are current snapshots from the database export (`config_autopo_202604241348.csv`) and can be updated at any time through the `config_autopo` table. When you see specific numeric values or thresholds in the descriptions below, understand that these are **current settings**, not hardcoded constants.

### Table of Contents - Configuration Categories

**A. SLA/Expiry Configurations (8 configs)**

1. [Waiting_vendor_direct_expiry](#1-waiting_vendor_direct_expiry) - Direct vendor submission SLA (3 days)
2. [Waiting_vendor_expiry](#2-waiting_vendor_expiry) - Aggregator vendor submission SLA (3 days)
3. [Waiting_DIC_review_expiry](#3-waiting_dic_review_expiry) - DIC confirmation SLA (30 days)
4. [Waiting_CS_expiry](#4-waiting_cs_expiry) - CS review SLA (3 days)
5. [Waiting_CL_review_expiry](#5-waiting_cl_review_expiry) - CL approval SLA (3 days)
6. [Waiting_Management_review_expiry](#6-waiting_management_review_expiry) - Management approval SLA (3 days)
7. [Waiting_OE_revision_expiry](#7-waiting_oe_revision_expiry) - OE revision SLA (3 days)
8. [DIC_Email_Reminder_interval](#8-dic_email_reminder_interval) - DIC reminder frequency (1 day)

**B. Workflow Control Configurations (4 configs)**

9. [skip_level_1_RFQ](#9-skip_level_1_rfq) - Vendor routing strategy (parallel vs sequential)
10. [qcf_approval_level](#10-qcf_approval_level) - Approval hierarchy (CL vs CL+Management)
11. [hide_oe_in_vendor_rfq](#11-hide_oe_in_vendor_rfq) - OE price visibility control
12. [hide_price_negotiation](#12-hide_price_negotiation) - Min/Max price range visibility

**C. Price Validation Configurations (2 configs)**

13. [Min_price](#13-min_price) - Minimum acceptable vendor price (80%)
14. [Max_price](#14-max_price) - Maximum acceptable vendor price (110%)

**D. PR Import Validation Configurations (9 configs)**

15. [value / src_value](#15-value--src_value) - PR value threshold (< 5000)
16. [im_number](#16-im_number) - Investment Management number validation
17. [is_da](#17-is_da) - Distribution Authority flag validation
18. [is_delete](#18-is_delete) - Deletion status validation
19. [is_oa](#19-is_oa) - Outline Agreement validation
20. [oem](#20-oem) - OEM field validation
21. [plant_code](#21-plant_code) - Plant location validation
22. [pr_type](#22-pr_type) - PR document type validation

---

## A. SLA/Expiry Configurations

### 1. Waiting_vendor_direct_expiry

**Current Value:** `config_value = 3` → N business days (currently: 3, configurable via admin)

**Business Process:** Direct Vendor (Level 1) RFQ submission workflow

**Business Logic:**

When an RFQ is sent to a direct vendor (Level 1), the vendor has **N business days** (configured value: 3) to submit their quotation. The system tracks this via email token expiry and daily cron job checks.

**Scenarios:**

**Scenario A: Vendor submits within N business days** (currently: 3 days)
- ✅ Submission accepted
- Status changes to VENDOR_ACCEPTED (milestone 3)
- RFQ proceeds to DIC confirmation workflow
- Email sent to DIC for quotation review

**Scenario B: Vendor does NOT submit within N business days** (currently: 3 days)
- ❌ Token expires (detected by daily cron job)
- System triggers Level 2 fallback mechanism:
  1. Duplicates RFQ for both vendors (Level 1 and Level 2)
  2. Updates both vendors to "PARALLEL" sequence (sent simultaneously)
  3. Sends new email tokens to BOTH vendors:
     - Level 1 (original direct vendor) - gets new N-day token (configured value: 3)
     - Level 2 (aggregator vendor) - gets token based on Waiting_vendor_expiry config (configured value: 3)
  4. Logs SLA milestones for both vendor batches
  5. Deactivates original expired token
- Both vendors can now submit in parallel
- First valid submission accepted OR best price if both submit

**Decision Tree:**
```
Day 0: RFQ sent to Level 1 vendor
└─> Vendor receives email with N-day business day token (configured: 3 days)

Day 1-N: Waiting for vendor submission (currently N=3)
└─> Vendor submits?
    ├─> YES:
    │   └─> ✅ Accept submission → DIC confirmation
    └─> NO (Day N expires):
        └─> Cron job detects expiry
            ├─> Send to Level 1 (direct) + Level 2 (aggregator)
            ├─> Both get new tokens (N days each, configured: 3 days)
            └─> Parallel submission mode activated
```

**Related Configurations:**
- **skip_level_1_RFQ**: If "yes", Level 2 already involved from start (no fallback needed)
- **Waiting_vendor_expiry**: Level 2 SLA that applies to aggregator vendor

**Workflow Impact:**
- Increases vendor pool when direct vendor fails to respond
- Extends total procurement time by additional 3 days
- Improves quotation submission success rate
- Allows price competition between direct and aggregator vendors

---

### 2. Waiting_vendor_expiry

**Current Value:** `config_value = 3` → N business days (currently: 3, configurable via admin)

**Business Process:** Aggregator Vendor (Level 2) RFQ submission workflow

**Business Logic:**

When an RFQ is sent to an aggregator vendor (Level 2), either from the start (if skip_level_1_RFQ = "yes") or after Level 1 fails, the vendor has **N business days** (configured value: 3) to submit their quotation.

**Scenarios:**

**Scenario A: Aggregator vendor submits within N business days** (currently: 3 days)
- ✅ Submission accepted
- Status changes to VENDOR_ACCEPTED (milestone 3)
- RFQ proceeds to DIC confirmation workflow
- Email sent to DIC for quotation review

**Scenario B: Aggregator vendor does NOT submit within N business days** (currently: 3 days)
- ❌ Token expires (detected by daily cron job)
- System escalates to CS (Category Specialist):
  1. Status changes to RFQ_NOT_SUBMITTED (milestone 22)
  2. Email sent to CS with "Quotation Not Yet Submitted" notification
  3. CS receives action link with new token (Waiting_CS_expiry - configured value: 3)
  4. CS must manually handle the RFQ (options: contact vendor, reassign, cancel)
  5. Logs milestone 22 with actor: SYSTEM

**Decision Tree:**
```
RFQ sent to Level 2 (Aggregator)
└─> Vendor receives email with N-day business day token (configured: 3 days)

Day 1-N: Waiting for aggregator submission (currently N=3)
└─> Aggregator submits?
    ├─> YES:
    │   └─> ✅ Accept submission → DIC confirmation
    └─> NO (Day N expires):
        └─> Escalate to CS
            ├─> Status = RFQ_NOT_SUBMITTED (22)
            ├─> Email CS with action link
            └─> CS has N days (Waiting_CS_expiry, configured: 3) to handle
```

**Related Configurations:**
- **Waiting_vendor_direct_expiry**: Level 1 SLA that can trigger this config
- **Waiting_CS_expiry**: CS SLA after vendor fails to submit (configured value: 3)
- **skip_level_1_RFQ**: If "yes", this applies from the start

**Workflow Impact:**
- Final automated vendor outreach attempt
- Escalation to manual CS intervention if both vendor levels fail
- Prevents RFQ from stalling indefinitely
- CS can decide: retry with different vendor, negotiate directly, or cancel

---

### 3. Waiting_DIC_review_expiry

**Current Value:** `config_value = 30` → N business days (currently: 30, configurable via admin)

**Business Process:** DIC (Department In Charge) confirmation workflow

**Business Logic:**

After a vendor successfully submits their quotation, the DIC has **N business days** (configured value: 30) to review and make a decision (accept, decline, or request revision). This is significantly longer than other SLA timeouts (configured: 30 days vs 3 days for most others).

**Scenarios:**

**Scenario A: DIC confirms within N business days** (currently: 30 days)
- ✅ DIC accepts quotation:
  - Status changes to DIC_ACCEPT (milestone 5)
  - RFQ proceeds to CS review workflow
  - CS receives notification for next action
- ✅ DIC declines quotation:
  - Status changes to DIC_DECLINED (milestone 6)
  - Vendor notified of rejection
  - May return to vendor for revision or sourcing restart
- ✅ DIC requests revision:
  - Status changes to DIC_REQUEST_REVISE (milestone 9)
  - Vendor receives new token to resubmit
  - Process returns to vendor submission step

**Scenario B: DIC does NOT respond within N business days** (currently: 30 days)
- ❌ Token expires (detected by daily cron job)
- System auto-converts to iSourcing (manual procurement workflow):
  1. Changes RFQ type to "iSourcing"
  2. Simulates system action to qcfController.sendActionToCS()
  3. Reason logged: "Auto-converted to iSourcing due to expired DIC action"
  4. RFQ moves to manual sourcing workflow for CS handling
  5. Automatic procurement terminated, requires manual intervention

**Decision Tree:**
```
Vendor submits quotation
└─> DIC receives confirmation email with N-day token (configured: 30 days)

Day 1-N: Waiting for DIC decision (currently N=30)
└─> DIC responds?
    ├─> YES - Accept:
    │   └─> ✅ Status = DIC_ACCEPT → CS review
    ├─> YES - Decline:
    │   └─> ❌ Status = DIC_DECLINED → Notify vendor
    ├─> YES - Request Revision:
    │   └─> 🔄 Status = DIC_REQUEST_REVISE → Resend to vendor
    └─> NO (Day N expires):
        └─> Auto-convert to iSourcing
            ├─> RFQ type = "isourcing"
            ├─> Manual sourcing workflow
            └─> CS handles manually
```

**Related Configurations:**
- **DIC_Email_Reminder_interval**: Daily reminders sent during 30-day period (1 day interval)
- **Waiting_CS_expiry**: CS SLA after iSourcing conversion (3 days)

**Workflow Impact:**
- Longest SLA in the workflow (30 days vs 3 days for others)
- Recognizes DIC needs significant time for technical review
- Auto-conversion to iSourcing prevents indefinite stalling
- Manual sourcing allows complex cases to be handled outside automation

**Why 30 days?**
DIC performs detailed technical validation: specifications match, quality standards met, vendor qualifications verified, safety requirements confirmed, etc.

---

### 4. Waiting_CS_expiry

**Current Value:** `config_value = 3` → N business days (currently: 3, configurable via admin)

**Business Process:** CS (Category Specialist) review and action workflow

**Business Logic:**

CS has **N business days** (configured value: 3) to review quotations and take action across multiple scenarios: DIC-accepted quotations, price mismatches, not-submitted items, declined items, OE revisions, and surrogate items.

**Scenarios:**

**Scenario A: CS takes action within N business days** (currently: 3 days)
- ✅ CS approves quotation:
  - Creates QCF (Quotation Comparison Form)
  - Routes to approval based on qcf_approval_level config:
    - If "category leader" → Send to CL (Waiting_CL_review_expiry)
    - If "category leader, management" → Send to CL first, then Management
  - Status changes to QCF_WAITING_APPROVAL (milestone 14) or MANAGEMENT_APPROVAL (milestone 16)
- ✅ CS handles special cases:
  - Price mismatch → Negotiate or request OE revision
  - Not submitted → Contact vendor or reassign
  - Surrogate items → Approve substitute products
  - Declined items → Find alternative vendors

**Scenario B: CS does NOT respond within N business days** (currently: 3 days)
- ❌ Token expires (detected by daily cron job)
- System auto-converts to iSourcing (escalation to manual workflow):
  1. Changes RFQ type to "iSourcing"
  2. Simulates system action to qcfController.sendActionToCS()
  3. Reason logged: "Auto-converted to iSourcing due to expired CS action"
  4. Escalates to manual procurement process
  5. Requires senior procurement team intervention

**Decision Tree:**
```
CS receives review notification
└─> CS has N business days to act (configured: 3 days)

Day 1-N: Waiting for CS action (currently N=3)
└─> CS responds?
    ├─> YES - Approve:
    │   └─> Create QCF → Route based on qcf_approval_level
    │       ├─> "category leader" → Send to CL
    │       └─> "category leader, management" → Send to CL → Management
    ├─> YES - Handle special case:
    │   ├─> Price mismatch → Negotiate/Revise OE
    │   ├─> Not submitted → Reassign/Contact vendor
    │   └─> Other cases → CS resolution
    └─> NO (Day N expires):
        └─> Auto-convert to iSourcing
            ├─> Manual sourcing workflow
            └─> Escalate to senior team
```

**Related Configurations:**
- **Waiting_CL_review_expiry**: CL approval SLA after CS creates QCF (3 days)
- **Waiting_Management_review_expiry**: Management approval SLA if required (3 days)
- **Waiting_OE_revision_expiry**: OE revision SLA if triggered (3 days)
- **qcf_approval_level**: Determines routing after CS approval

**Workflow Impact:**
- Critical gateway for QCF creation and approval routing
- Handles multiple edge cases (price, availability, surrogates)
- Auto-escalation prevents bottlenecks
- Ensures complex cases get manual attention

**CS Responsibilities:**
- Validate vendor quotations against requirements
- Resolve price discrepancies
- Handle vendor non-submissions
- Approve surrogate/alternate products
- Create and route QCF for final approval

---

### 5. Waiting_CL_review_expiry

**Current Value:** `config_value = 3` → N business days (currently: 3, configurable via admin)

**Business Process:** CL (Category Leader) QCF approval workflow

**Business Logic:**

After CS creates a QCF (Quotation Comparison Form), the Category Leader has **N business days** (configured value: 3) to review and approve or reject. This is the first approval level in the QCF workflow.

**Scenarios:**

**Scenario A: CL approves within N business days** (currently: 3 days)
- ✅ CL approves - Check qcf_approval_level config:
  - **GEMS** (qcf_approval_level = "category leader"):
    - Status changes to QCF_CL_APPROVED (milestone 18)
    - **Final approval** - Ready for SAP Auto PO creation
    - No Management approval required
    - Proceeds directly to SAP sync
  - **BCG** (qcf_approval_level = "category leader, management"):
    - Status changes to QCF_CL_APPROVED
    - **Not final** - Still requires Management approval
    - Email sent to Management with new token (Waiting_Management_review_expiry - configured value: 3)
    - Workflow continues to Management approval step

**Scenario B: CL rejects within N business days** (currently: 3 days)
- ❌ CL rejects quotation:
  - QCF sent back to CS with rejection reason
  - CS must revise and resubmit QCF
  - Workflow returns to CS review step
  - May require vendor renegotiation or new sourcing

**Scenario C: CL does NOT respond within N business days** (currently: 3 days)
- ❌ Token expires (detected by daily cron job)
- System auto-converts to iSourcing (escalation):
  1. Gets RFQ item IDs from qcfLibrary
  2. Queries rfqLibrary for full RFQ details
  3. Changes to iSourcing manual workflow
  4. Reason logged: "Auto-converted to iSourcing due to expired CL action"
  5. Requires manual procurement intervention

**Decision Tree:**
```
CS creates QCF
└─> CL receives approval email with N-day token (configured: 3 days)

Day 1-N: Waiting for CL decision (currently N=3)
└─> CL responds?
    ├─> YES - Approve:
    │   └─> Check qcf_approval_level
    │       ├─> "category leader" (GEMS):
    │       │   └─> ✅ Final approval → SAP Auto PO
    │       └─> "category leader, management" (BCG):
    │           └─> ✅ Send to Management (next step)
    ├─> YES - Reject:
    │   └─> ❌ Return to CS for revision
    └─> NO (Day 3 expires):
        └─> Auto-convert to iSourcing
            └─> Manual sourcing workflow
```

**Related Configurations:**
- **qcf_approval_level**: Determines if Management approval also required
  - BCG: "category leader, management" (2-level approval)
  - GEMS: "category leader" (1-level approval)
- **Waiting_Management_review_expiry**: BCG only - Management approval SLA (3 days)
- **Waiting_CS_expiry**: CS SLA before QCF creation (3 days)

**Workflow Impact:**
- First approval gate after QCF creation
- **GEMS**: CL is final approver (faster procurement)
- **BCG**: CL approval required before Management review (dual approval)
- Auto-escalation prevents approval delays
- Ensures leadership oversight on procurement decisions

**CL Responsibilities:**
- Review quotation comparison analysis
- Validate price competitiveness
- Confirm vendor selection aligns with category strategy
- Approve or reject based on business impact
- Escalate concerns to Management (BCG only)

---

### 6. Waiting_Management_review_expiry

**Current Value:** `config_value = 3` → N business days (currently: 3, configurable via admin)

**Business Process:** Management QCF approval workflow (BCG only, based on qcf_approval_level)

**Business Logic:**

For BCG server group, after CL approves the QCF, Management has **N business days** (configured value: 3) to provide final approval. This is the second and final approval level for BCG. **GEMS skips this step** because their qcf_approval_level = "category leader" (no Management approval required).

**Scenarios:**

**Scenario A: Management approves within N business days** (currently: 3 days)
- ✅ Management approves:
  - Status changes to QCF_MANAGEMENT_APPROVED (milestone 20)
  - **Final approval** - Ready for SAP Auto PO creation
  - QCF data prepared for SAP synchronization
  - Cron job (sync.js) will pick up for PO creation
  - Proceeds to SAP Auto PO workflow

**Scenario B: Management rejects within N business days** (currently: 3 days)
- ❌ Management rejects:
  - QCF sent back to CL/CS with rejection reason
  - May require complete workflow restart
  - CS must address Management concerns
  - New vendor sourcing may be required

**Scenario C: Management does NOT respond within N business days** (currently: 3 days)
- ❌ Token expires (detected by daily cron job)
- System auto-converts to iSourcing (escalation):
  1. Gets RFQ item IDs from qcfLibrary
  2. Queries rfqLibrary for full RFQ details
  3. Changes to iSourcing manual workflow
  4. Reason logged: "Auto-converted to iSourcing due to expired Management action"
  5. Requires high-level manual intervention for resolution

**Decision Tree:**
```
BCG only: CL approves QCF
└─> Management receives approval email with N-day token (configured: 3 days)

Day 1-3: Waiting for Management decision
└─> Management responds?
    ├─> YES - Approve:
    │   └─> ✅ Final approval → SAP Auto PO creation
    ├─> YES - Reject:
    │   └─> ❌ Return to CL/CS for major revision
    └─> NO (Day 3 expires):
        └─> Auto-convert to iSourcing
            ├─> Manual sourcing workflow
            └─> High-level intervention required
```

**Related Configurations:**
- **qcf_approval_level**: Determines if Management approval is required
  - BCG: "category leader, management" → Management approval REQUIRED
  - GEMS: "category leader" → Management approval SKIPPED
- **Waiting_CL_review_expiry**: CL approval SLA before Management (3 days)

**Workflow Impact:**
- **BCG only**: Second approval gate (dual approval system)
- **GEMS**: This step is completely skipped (single approval system)
- Ensures executive oversight for BCG procurement
- Extends BCG approval time vs GEMS (6 days vs 3 days total)
- Auto-escalation prevents high-value procurement from stalling

**Server Group Differences:**

| Server Group | Approval Workflow | Total Approval Time | Management Step |
|--------------|-------------------|---------------------|-----------------|
| **BCG** | CS → CL (3 days) → Management (3 days) → SAP PO | 6 days | ✅ Required |
| **GEMS** | CS → CL (3 days) → SAP PO | 3 days | ❌ Skipped |

**Management Responsibilities (BCG only):**
- Final executive review of procurement decisions
- Validate business impact and budget alignment
- Approve high-value or strategic purchases
- Escalate policy violations or concerns
- Authorize SAP PO creation

---

### 7. Waiting_OE_revision_expiry

**Current Value:** `config_value = 3` → N business days (currently: 3, configurable via admin)

**Business Process:** OE (Original Estimate) revision workflow when vendor price exceeds acceptable range

**Business Logic:**

When a vendor's quotation price exceeds the OE (Original Estimate) beyond the acceptable threshold (Max_price - configured value: 110%), the system triggers an OE revision workflow. CS has **N business days** (configured value: 3) to revise the OE or take corrective action.

**Scenarios:**

**Scenario A: CS revises OE within N business days** (currently: 3 days)
- ✅ CS updates OE to match vendor price (or negotiates):
  - OE price updated in system
  - Vendor quotation re-validated against new OE
  - If now within acceptable range (configured: 80-110%), workflow continues
  - May require DIC re-confirmation if significant change
  - Proceeds to next milestone

**Scenario B: CS rejects vendor price within N business days** (currently: 3 days)
- ✅ CS rejects excessive vendor price:
  - Quotation rejected with reason
  - Vendor notified to resubmit with lower price
  - New email token sent to vendor
  - Workflow returns to vendor submission step

**Scenario C: CS negotiates price within N business days** (currently: 3 days)
- ✅ CS negotiates with vendor:
  - Vendor agrees to reduce price
  - Price updated in system
  - Re-validated against OE and Max_price threshold
  - Workflow continues if acceptable

**Scenario D: CS does NOT respond within N business days** (currently: 3 days)
- ❌ Token expires (detected by daily cron job)
- System auto-converts to iSourcing (escalation):
  1. Changes RFQ type to "iSourcing"
  2. Simulates system action to qcfController.sendActionToCS()
  3. Reason logged: "Auto-converted to iSourcing due to expired CS OE action"
  4. Manual price resolution required
  5. Senior procurement team handles pricing negotiation

**Decision Tree:**
```
Vendor quotation price > Max_price (110% of OE)
└─> System detects price mismatch
    └─> Status = WAITING_OE_REVISION (milestone 11)
        └─> CS receives OE revision email with 3-day token

Day 1-3: Waiting for CS to revise OE
└─> CS responds?
    ├─> YES - Update OE:
    │   └─> ✅ OE revised → Re-validate quotation → Continue workflow
    ├─> YES - Reject vendor price:
    │   └─> ❌ Reject quotation → Vendor resubmits
    ├─> YES - Negotiate:
    │   └─> 🔄 Vendor reduces price → Continue workflow
    └─> NO (Day 3 expires):
        └─> Auto-convert to iSourcing
            ├─> Manual price resolution
            └─> Procurement team negotiates
```

**Related Configurations:**
- **Max_price**: Trigger threshold for OE revision (110% of OE)
- **Min_price**: Lower bound for price validation (80% of OE)
- **Waiting_CS_expiry**: General CS review SLA (3 days)

**Workflow Impact:**
- Triggered by price validation failure (vendor price > 110% OE)
- Prevents automatic procurement of overpriced items
- Allows OE adjustments for market price changes
- Provides negotiation opportunity before rejection
- Auto-escalation ensures pricing issues don't stall workflow indefinitely

**Trigger Conditions:**
- Vendor quotation price > (OE × 110%)
- Detected during vendor submission validation
- May also occur after DIC requests revision

**CS Actions Available:**
1. **Revise OE upward** - If market price legitimately higher
2. **Reject vendor price** - If vendor is overcharging
3. **Negotiate** - Try to get vendor to lower price
4. **Cancel/Reassign** - Find alternative vendor

---

### 8. DIC_Email_Reminder_interval

**Current Value:** `config_value = 1` → N days (currently: 1, configurable via admin)

**Business Process:** Periodic reminder emails to DIC for pending confirmations

**Business Logic:**

Sends reminder emails to DIC every **N days** (configured value: 1) for pending quotation confirmations that haven't been addressed yet. Works in conjunction with Waiting_DIC_review_expiry (configured value: 30 days) - reminders sent every N days until DIC acts or the expiry triggers escalation.

**Scenarios:**

**Scenario A: DIC_Email_Reminder_interval = N days (Current: 1 day)**
```
Day 0: Vendor submits quotation
└─> DIC receives initial confirmation email

Day N: DIC hasn't responded (currently: Day 1)
└─> Reminder #1 sent (N day interval)

Day 2N: DIC still hasn't responded (currently: Day 2)
└─> Reminder #2 sent (N day interval)

Day 3N: DIC still hasn't responded (currently: Day 3)
└─> Reminder #3 sent (N day interval)

...continues every N days until Day 30 or DIC responds

Day 30: If no response
└─> Waiting_DIC_review_expiry triggers
    └─> Auto-convert to iSourcing
```

**Scenario B: If DIC_Email_Reminder_interval = 2 days (Example)**
```
Day 0: Vendor submits → DIC initial email

Day 2: Reminder #1 (skips Day 1)

Day 4: Reminder #2 (skips Day 3)

Day 6: Reminder #3 (skips Day 5)

...reminders every 2 days until Day 30
```

**Decision Tree:**
```
Daily Cron Job Runs
└─> Check for DIC pending confirmations
    ├─> Has token expired (30 days)?
    │   ├─> YES: Escalate to iSourcing (Waiting_DIC_review_expiry)
    │   └─> NO: Continue checking reminder interval
    └─> Is today a business day?
        ├─> NO: Skip reminder (weekends excluded)
        └─> YES: Has reminder interval passed?
            ├─> YES: Send reminder email
            │   ├─> Email contains: Quotation details, vendor info
            │   └─> Link to confirm/decline/request revision
            └─> NO: Skip reminder today
```

**Related Configurations:**
- **Waiting_DIC_review_expiry**: Maximum time DIC has to respond (30 days)
- Works together: Daily reminders within 30-day window

**Workflow Impact:**
- Prevents DIC confirmations from being forgotten
- Proactive notification system reduces delays
- Balances between urgency and non-intrusiveness
- Stops after DIC action (accept/decline/request revision)
- Stops after 30-day expiry triggers iSourcing conversion

**Reminder Behavior:**
- ✅ Sent on business days only (excludes weekends)
- ✅ Stops after DIC takes action
- ✅ Stops after Waiting_DIC_review_expiry (30 days) triggers
- ✅ Includes clickable action links (confirm/decline/revise)
- ❌ Does NOT send on weekends
- ❌ Does NOT send if DIC already responded
- ❌ Does NOT send if RFQ converted to iSourcing

**Email Template Content:**
- RFQ number and details
- Vendor information and quotation price
- Original Estimate (OE) comparison
- Action links: Accept / Decline / Request Revision
- Deadline: X days remaining out of 30 days

---

## B. Workflow Control Configurations

### 9. skip_level_1_RFQ

**Current Value:** `config_value = "no"` → yes/no (currently: "no", configurable via admin)

**Business Process:** Vendor routing strategy - controls whether RFQs are sent to direct vendor (Level 1) only or to both direct and aggregator (Level 1 + Level 2) simultaneously

**Business Logic:**

Determines the initial vendor outreach strategy. When set to "no" (current setting), the system uses a sequential approach: try Level 1 first, then fallback to Level 2 if Level 1 fails. When set to "yes", the system sends to both levels simultaneously (parallel approach).

**Scenarios:**

**Scenario A: skip_level_1_RFQ = "no" (Current Setting - Sequential Mode)**
```
RFQ Generated
└─> Send to Level 1 (Direct Vendor) ONLY
    ├─> Vendor gets N-day token (Waiting_vendor_direct_expiry, configured: 3)
    └─> Wait for Level 1 response

Timeline:
Day 0: Level 1 receives RFQ email
Day 1-N: Waiting for Level 1 submission (currently N=3)
Day N: Level 1 token expires (if no submission, currently: Day 3)
    └─> Cron job triggers fallback mechanism
        ├─> Duplicate RFQ for Level 2 (Aggregator)
        ├─> Send email to Level 2
        ├─> Also resend to Level 1 with new token
        ├─> Both vendors now in PARALLEL mode
        └─> Level 2 gets N-day token (Waiting_vendor_expiry, configured: 3)

Day N+1 to 2N: Waiting for Level 1 OR Level 2 submission (currently Day 4-6)
Day 2N: Level 2 token expires (if neither submits, currently: Day 6)
    └─> Escalate to CS (RFQ_NOT_SUBMITTED - milestone 22)
```

**Scenario B: skip_level_1_RFQ = "yes" (Parallel Mode - Alternative Setting)**
```
RFQ Generated
└─> Send to BOTH Level 1 and Level 2 SIMULTANEOUSLY
    ├─> Level 1 (Direct) gets N-day token (Waiting_vendor_direct_expiry, configured: 3)
    └─> Level 2 (Aggregator) gets N-day token (Waiting_vendor_expiry, configured: 3)

Timeline:
Day 0: Both vendors receive RFQ emails simultaneously
Day 1-N: Both vendors can submit (parallel submission, currently N=3)
    ├─> Level 1 submits → ✅ Accept Level 1 quotation
    ├─> Level 2 submits → ✅ Accept Level 2 quotation
    ├─> Both submit → Select best price/terms
    └─> Neither submits → Continue waiting

Day N: Level 1 token expires (if no submission, currently: Day 3)
Day 3: Level 2 token also expires (if no submission)
    └─> Escalate to CS (RFQ_NOT_SUBMITTED - milestone 22)
```

**Decision Tree:**
```
RFQ Created
└─> Check skip_level_1_RFQ config
    ├─> Value = "no" (Sequential - Current):
    │   └─> Send to Level 1 ONLY
    │       ├─> Level 1 submits within 3 days?
    │       │   ├─> YES: ✅ Use Level 1 quotation → DIC confirmation
    │       │   └─> NO: Send to Level 1 + Level 2 (fallback)
    │       └─> Level 1 or Level 2 submits within next 3 days?
    │           ├─> YES: ✅ Use quotation → DIC confirmation
    │           └─> NO: ❌ Escalate to CS
    └─> Value = "yes" (Parallel):
        └─> Send to Level 1 AND Level 2 SIMULTANEOUSLY
            ├─> Any vendor submits within 3 days?
            │   ├─> YES: ✅ Use quotation (best price) → DIC confirmation
            │   └─> NO: ❌ Both expire → Escalate to CS
```

**Related Configurations:**
- **Waiting_vendor_direct_expiry**: Level 1 SLA (3 days)
- **Waiting_vendor_expiry**: Level 2 SLA (3 days)

**Workflow Impact:**

**Sequential Mode ("no" - Current):**
- ✅ Prefers direct vendor (potentially better pricing/relationship)
- ✅ Reduces vendor notification volume (only Level 2 if needed)
- ❌ Slower: Adds 3 days if Level 1 fails (total 6 days possible)
- ❌ Risk: No quotation if both levels fail (6 days wasted)

**Parallel Mode ("yes"):**
- ✅ Faster: Both vendors respond simultaneously (3 days max)
- ✅ Higher success rate: Two vendors from the start
- ✅ Price competition: Can compare direct vs aggregator pricing
- ❌ More vendor notifications (may strain vendor relationships)
- ❌ No preference for direct vendor

**Business Rationale:**

**Current Setting ("no" - Sequential):**
- Company prefers direct vendor relationships
- Aggregator vendors used as backup only
- Willing to wait additional 3 days for direct vendor
- Reduces administrative overhead (fewer vendor communications)

**Alternative Setting ("yes" - Parallel):**
- Faster procurement critical
- Price competition valued over vendor relationships
- Higher urgency materials
- Risk mitigation: Always have backup option

---

### 10. qcf_approval_level

**Current Value:** (configurable via admin)
- **BCG**: `config_value = "category leader, management"` (two-level approval: CL then Management)
- **GEMS**: `config_value = "category leader"` (single-level approval: CL only)

**Business Process:** QCF (Quotation Comparison Form) approval routing workflow - determines approval hierarchy after CS creates QCF

**Business Logic:**

Controls the approval chain for QCF (Quotation Comparison Form) after CS completes quotation review. The config value is a comma-separated list of roles that must approve in sequence.

**Scenarios:**

**Scenario A: BCG - Two-Level Approval** (currently: "category leader, management")
```
CS Approves Quotation & Creates QCF
└─> Parse config: "category leader, management".split(',')
    └─> Approvers: ["category leader", "management"]

Step 1: Send to Category Leader (CL)
├─> CL receives email with N-day token (Waiting_CL_review_expiry, configured: 3)
└─> CL Response:
    ├─> Approve → Proceed to Step 2 (Management)
    ├─> Reject → Return to CS for revision
    └─> No response (N days, configured: 3) → Auto-convert to iSourcing

Step 2: Send to Management (triggered by CL approval)
├─> Management receives email with N-day token (Waiting_Management_review_expiry, configured: 3)
└─> Management Response:
    ├─> Approve → ✅ FINAL APPROVAL → SAP Auto PO
    ├─> Reject → Return to CS/CL for major revision
    └─> No response (N days, configured: 3) → Auto-convert to iSourcing

Total Approval Time: Up to 2N business days (configured: 6 days total)
```

**Scenario B: GEMS - Single-Level Approval** (currently: "category leader")
```
CS Approves Quotation & Creates QCF
└─> Parse config: "category leader"
    └─> Approvers: ["category leader"]

Step 1: Send to Category Leader (CL)
├─> CL receives email with N-day token (Waiting_CL_review_expiry, configured: 3)
└─> CL Response:
    ├─> Approve → ✅ FINAL APPROVAL → SAP Auto PO (skips Management)
    ├─> Reject → Return to CS for revision
    └─> No response (N days, configured: 3) → Auto-convert to iSourcing

Step 2: No Management step (skipped)
└─> CL approval is FINAL → Proceed directly to SAP PO creation

Total Approval Time: Up to N business days (configured: 3 days)
```

**Decision Tree:**
```
QCF Created by CS
└─> Parse qcf_approval_level config
    └─> Split by comma: "category leader, management" → ["category leader", "management"]
        OR "category leader" → ["category leader"]

Approval Chain:
└─> Contains "category leader"?
    ├─> YES: Send to CL (always first)
    │   └─> CL Approves?
    │       ├─> YES: Check if "management" also in config
    │       │   ├─> YES (BCG): Send to Management → Final approval
    │       │   └─> NO (GEMS): ✅ CL is final → SAP Auto PO
    │       └─> NO: Reject or Expire → Escalate
    └─> NO: Error (config must include CL)
```

**Related Configurations:**
- **Waiting_CL_review_expiry**: CL approval timeout (3 days)
- **Waiting_Management_review_expiry**: Management approval timeout (3 days)
- **Waiting_CS_expiry**: CS review before QCF creation (3 days)

**Workflow Impact:**

**BCG ("category leader, management"):**
- Dual approval system (CL + Management)
- Longer approval time (6 days total)
- Higher oversight for procurement decisions
- Management veto power over CL decisions
- Suitable for high-value or strategic purchases

**GEMS ("category leader"):**
- Single approval system (CL only)
- Faster approval time (3 days total)
- Streamlined procurement process
- CL has final decision authority
- Suitable for routine procurement

**Comparison:**

| Aspect | BCG | GEMS |
|--------|-----|------|
| **Approval Levels** | 2 (CL + Management) | 1 (CL only) |
| **Total Approval Time** | Up to 6 days | Up to 3 days |
| **Workflow** | CS → CL → Management → SAP PO | CS → CL → SAP PO |
| **Management Involvement** | Required | Not required |
| **Speed** | Slower (more oversight) | Faster (less oversight) |
| **Use Case** | High-value, strategic items | Routine procurement |

**Business Rationale:**

**BCG (Dual Approval):**
- Higher risk tolerance requires executive oversight
- Strategic procurement decisions
- Budget approval at multiple levels
- Policy compliance verification
- Audit trail for high-value purchases

**GEMS (Single Approval):**
- Lower risk procurement
- Operational efficiency priority
- Category Leader trusted as final authority
- Faster turnaround critical for operations
- Lower administrative overhead

---

### 11. hide_oe_in_vendor_rfq

**Current Value:** `config_value = "yes"` → yes/no (currently: "yes" for BCG and GEMS, configurable via admin)

**Business Process:** Vendor RFQ form display - controls visibility of OE (Original Estimate) price to vendors

**Business Logic:**

Controls whether vendors can see the Original Estimate (OE) price when submitting their quotations via the RFQ form. When set to "yes" (current setting), vendors submit quotations "blind" without knowing the estimated price.

**Scenarios:**

**Scenario A: hide_oe_in_vendor_rfq = "yes" (Current Setting - Hide OE)**
```
Vendor Receives RFQ Email
└─> Clicks quotation link
    └─> RFQ form loads

Vendor Form Displays:
├─> Item description: ✅ Visible
├─> Quantity: ✅ Visible
├─> Specifications: ✅ Visible
├─> Original Estimate (OE): ❌ HIDDEN
└─> Your Quotation Price: [Input field]

Vendor Behavior:
└─> Submits price based on:
    ├─> Market price knowledge
    ├─> Cost + margin calculation
    └─> Competitive positioning (NO OE anchoring)

Result:
└─> ✅ Prevents price anchoring to OE
    ├─> Vendor may quote below OE (better deal for company)
    ├─> Vendor may quote above OE (reveals true market price)
    └─> More competitive, unbiased pricing
```

**Scenario B: hide_oe_in_vendor_rfq = "no" (Show OE - Not Current Setting)**
```
Vendor Receives RFQ Email
└─> Clicks quotation link
    └─> RFQ form loads

Vendor Form Displays:
├─> Item description: ✅ Visible
├─> Quantity: ✅ Visible
├─> Specifications: ✅ Visible
├─> Original Estimate (OE): ✅ VISIBLE ($1,000)
└─> Your Quotation Price: [Input field]

Vendor Behavior:
└─> Submits price based on:
    ├─> OE as anchor ($1,000 shown)
    ├─> Likely quotes close to OE
    └─> Less likely to underbid significantly

Result:
└─> ⚠️ Price anchoring effect
    ├─> Vendor uses OE as reference point
    ├─> Less competitive pricing
    └─> Company may pay more than necessary
```

**Decision Tree:**
```
Vendor Opens RFQ Form
└─> API fetches hide_oe_in_vendor_rfq config
    ├─> Config value = "yes" (Current):
    │   └─> Frontend hides OE price field
    │       ├─> Vendor quotes without OE knowledge
    │       ├─> Prevents anchoring bias
    │       └─> Encourages competitive pricing
    └─> Config value = "no":
        └─> Frontend shows OE price field
            ├─> Vendor sees target price
            ├─> May anchor to OE
            └─> Helps vendor stay within budget
```

**Related Configurations:**
- **hide_price_negotiation**: Controls min/max range visibility (80%-110%)
- **Min_price**: Minimum acceptable price threshold (80% of OE)
- **Max_price**: Maximum acceptable price threshold (110% of OE)

**Workflow Impact:**

**Hide OE ("yes" - Current Setting):**
- ✅ No price anchoring - vendors quote their true price
- ✅ Potential cost savings - vendor may underbid OE
- ✅ Market price discovery - reveals true market rates
- ❌ Risk: Vendor may significantly overprice
- ❌ May receive out-of-range quotes (triggers OE revision)

**Show OE ("no"):**
- ✅ Helps vendors understand budget constraints
- ✅ Reduces out-of-range quotations
- ✅ Transparency in procurement process
- ❌ Price anchoring - vendor targets OE
- ❌ Less competitive pricing
- ❌ May miss cost-saving opportunities

**Combination with hide_price_negotiation:**

| hide_oe_in_vendor_rfq | hide_price_negotiation | Vendor Sees |
|----------------------|------------------------|-------------|
| "yes" | "yes" | Nothing (completely blind quotation) |
| "yes" | "no" | Min/Max range only (80%-110%, no OE) |
| "no" | "yes" | OE price only (no range) |
| "no" | "no" | OE + Min/Max range (full transparency) |

**Current Setting:** "yes" + "no" → Vendor sees 80%-110% range but NOT the OE value

**Business Rationale:**

**Current Setting ("yes" - Hide OE):**
- Encourages competitive bidding
- Prevents psychological anchoring
- Discovers true market pricing
- Vendor quotes based on cost + fair margin
- Company may get better deals than estimated

**Alternative ("no" - Show OE):**
- Helps vendors quote within budget
- Reduces wasted quotes (out of range)
- Transparency builds trust
- Good for specialized/custom items with unclear market price

---

### 12. hide_price_negotiation

**Current Value:** `config_value = "no"` → yes/no (currently: "no" for BCG and GEMS, configurable via admin)

**Business Process:** Vendor RFQ form display - controls visibility of min/max acceptable price range to vendors

**Business Logic:**

Controls whether vendors can see the acceptable price range (Min_price - configured: 80%, Max_price - configured: 110% of OE) when submitting quotations. When set to "no" (current setting), vendors see the acceptable range boundaries, helping them quote within acceptable limits.

**Scenarios:**

**Scenario A: hide_price_negotiation = "no" (Current Setting - Show Range)**
```
Vendor Receives RFQ Email
└─> Clicks quotation link
    └─> RFQ form loads

Vendor Form Displays:
├─> Item description: ✅ Visible
├─> Quantity: ✅ Visible
├─> Original Estimate (OE): ❌ Hidden (per hide_oe_in_vendor_rfq = "yes")
├─> Acceptable Price Range: ✅ VISIBLE
│   └─> "Please quote between 80% - 110% of estimated value"
│       OR "Acceptable range: $800 - $1,100" (if OE shown)
└─> Your Quotation Price: [Input field]

Vendor Behavior:
└─> Submits price with range guidance:
    ├─> Knows acceptable boundaries (80%-110%)
    ├─> Less likely to quote out of range
    ├─> Can strategically price within limits
    └─> Avoids quotes triggering OE revision (>110%)

Result:
└─> ✅ Higher quote acceptance rate
    ├─> Fewer out-of-range rejections
    ├─> Less OE revision workflow triggers
    └─> Faster procurement (fewer revisions)
```

**Scenario B: hide_price_negotiation = "yes" (Hide Range - Not Current Setting)**
```
Vendor Receives RFQ Email
└─> Clicks quotation link
    └─> RFQ form loads

Vendor Form Displays:
├─> Item description: ✅ Visible
├─> Quantity: ✅ Visible
├─> Original Estimate (OE): ❌ Hidden
├─> Acceptable Price Range: ❌ HIDDEN
└─> Your Quotation Price: [Input field]

Vendor Behavior:
└─> Submits price completely blind:
    ├─> No knowledge of acceptable boundaries
    ├─> May quote significantly above 110% (triggers OE revision)
    ├─> May quote significantly below 80% (quality concern, rejection)
    └─> True market price discovery

Result:
└─> ⚠️ Higher out-of-range quote rate
    ├─> More OE revision workflows
    ├─> More vendor rejections
    ├─> Slower procurement process
    └─> Better price discovery (no range gaming)
```

**Decision Tree:**
```
Vendor Opens RFQ Form
└─> API fetches hide_price_negotiation config
    ├─> Config value = "no" (Current):
    │   └─> Frontend shows min/max price range
    │       ├─> Display: "Acceptable range: 80% - 110%"
    │       ├─> Vendor quotes within range
    │       └─> Fewer out-of-range quotes
    └─> Config value = "yes":
        └─> Frontend hides min/max price range
            ├─> Vendor quotes without range knowledge
            ├─> True market price discovery
            └─> Higher out-of-range quote risk
```

**Price Validation (Always Enforced Server-Side):**
```
Vendor Submits Quotation
└─> Server validates price (regardless of visibility)
    ├─> Price < Min_price (80%):
    │   └─> ❌ Reject: "Price too low, quality concern"
    ├─> Price > Max_price (110%):
    │   └─> ⚠️ Trigger OE revision workflow
    │       ├─> Status = WAITING_OE_REVISION
    │       ├─> CS has 3 days to revise OE
    │       └─> Email sent to CS
    └─> 80% ≤ Price ≤ 110%:
        └─> ✅ Accept: Proceed to DIC confirmation
```

**Related Configurations:**
- **Min_price**: Lower bound (80% of OE)
- **Max_price**: Upper bound (110% of OE)
- **hide_oe_in_vendor_rfq**: Controls OE visibility
- **Waiting_OE_revision_expiry**: Triggered if price > Max_price (3 days)

**Workflow Impact:**

**Show Range ("no" - Current Setting):**
- ✅ Reduces out-of-range quotes (vendor knows boundaries)
- ✅ Faster procurement (fewer rejections/revisions)
- ✅ Helps vendors avoid wasted effort
- ✅ Lower OE revision workflow triggers
- ❌ Vendor may game the range (always quote near max)
- ❌ Less true market price discovery

**Hide Range ("yes"):**
- ✅ True market price discovery (no range gaming)
- ✅ Vendor quotes honest market price
- ✅ May get better deals (vendor undercuts without knowing)
- ❌ Higher out-of-range quote rate
- ❌ More OE revision workflows
- ❌ Slower procurement (more iterations)

**Combination with hide_oe_in_vendor_rfq:**

| hide_oe_in_vendor_rfq | hide_price_negotiation | Vendor Sees | Price Discovery | Quote Success Rate |
|----------------------|------------------------|-------------|-----------------|-------------------|
| "yes" | "yes" | Nothing | ✅ Best | ❌ Lowest (many out-of-range) |
| "yes" | "no" (Current) | Range only (80%-110%) | ⚖️ Good | ✅ High |
| "no" | "yes" | OE only | ⚖️ Moderate | ⚖️ Moderate |
| "no" | "no" | OE + Range | ❌ Poor (anchoring) | ✅ Highest |

**Current Setting:** hide_oe = "yes" + hide_range = "no" → **Balanced approach**
- Vendor sees acceptable boundaries (80%-110%)
- Vendor does NOT see actual OE value
- Reduces out-of-range quotes while avoiding OE anchoring
- Good balance between efficiency and price discovery

**Business Rationale:**

**Current Setting ("no" - Show Range):**
- Practical approach: Reduces vendor wasted effort
- Efficiency: Fewer quote revisions and rejections
- Fairness: Vendors know rules before bidding
- Still prevents OE anchoring (OE hidden separately)
- Good for routine procurement with established pricing

**Alternative ("yes" - Hide Range):**
- Maximum price discovery
- Good for new/unique items with unknown market price
- Willing to accept slower process for better pricing
- Research-focused procurement strategy

---

## C. Price Validation Configurations

### 13. Min_price

**Current Value:** `config_value = 80` → N% of OE (currently: 80%, configurable via admin)

**Business Process:** Vendor quotation price validation - lower bound threshold

**Business Logic:**

Defines the minimum acceptable percentage of OE (Original Estimate) that a vendor can quote. Prevents suspiciously low prices that may indicate quality issues, data entry errors, or unsustainable vendor pricing.

**Scenarios:**

**Scenario A: Vendor price ≥ N% of OE (Within Acceptable Range)** (currently N=80%)
```
OE Price: $1,000
Vendor Quote: $850
Calculation: ($850 / $1,000) × 100 = 85%
Min_price threshold: N% (configured: 80%)
Comparison: 85% ≥ 80%

Result: ✅ PASS
Action: Proceed to next validation (Max_price check)
Status: Price acceptable, continue to DIC confirmation
```

**Scenario B: Vendor price < N% of OE (Below Minimum)** (currently N=80%)
```
OE Price: $1,000
Vendor Quote: $700
Calculation: ($700 / $1,000) × 100 = 70%
Min_price threshold: N% (configured: 80%)
Comparison: 70% < 80%

Result: ❌ FAIL
Action: Reject quotation OR flag for CS review
Reason: "Price suspiciously low - quality concern"
Status: Quotation rejected, vendor may resubmit

Possible CS Actions:
├─> Verify OE is correct (maybe OE was overestimated)
├─> Contact vendor to verify pricing (avoid errors)
├─> Investigate quality concerns (inferior materials?)
└─> Approve exception (vendor has cost advantage)
```

**Decision Tree:**
```
Vendor Submits Quotation
└─> Calculate price percentage: (Vendor Price / OE) × 100

Price Validation:
└─> Vendor % ≥ Min_price (80%)?
    ├─> YES: ✅ Pass Min_price check
    │   └─> Continue to Max_price check (110%)
    │       ├─> Also pass Max_price → Accept quotation
    │       └─> Fail Max_price → OE revision workflow
    └─> NO: ❌ Price too low
        └─> Reject quotation OR CS review
            ├─> Reason: "Suspiciously low pricing"
            ├─> Quality concern flagged
            └─> Vendor notified to resubmit or verify
```

**Related Configurations:**
- **Max_price**: Upper bound (110% of OE)
- **hide_price_negotiation**: Controls visibility of min/max range to vendor
  - "no" (current) → Vendor sees 80%-110% range
  - "yes" → Vendor does NOT see range
- **Waiting_OE_revision_expiry**: Triggered if vendor price > Max_price (not for Min_price)

**Workflow Impact:**

**Quality Concerns with Low Prices:**
- ⚠️ Inferior materials or components
- ⚠️ Vendor cost-cutting on quality
- ⚠️ Unsustainable pricing (vendor may default mid-project)
- ⚠️ Data entry error by vendor
- ⚠️ Vendor misunderstood requirements

**Rejection Reasons:**
1. **Quality Risk** - Price too low suggests corners being cut
2. **Error Detection** - Vendor may have made pricing mistake
3. **Sustainability** - Vendor may not be able to deliver at that price
4. **Compliance** - Some industries require minimum pricing standards

**CS Review Options (if flagged instead of auto-reject):**
```
CS Reviews Low-Price Quotation
└─> CS Actions:
    ├─> Approve Exception:
    │   └─> Vendor has legitimate cost advantage
    │       (e.g., bulk purchasing, efficient processes)
    ├─> Reject:
    │   └─> Quality concern too high, require higher-quality vendor
    ├─> Investigate:
    │   └─> Contact vendor to verify:
    │       ├─> Pricing breakdown
    │       ├─> Material specifications
    │       └─> Quality certifications
    └─> Revise OE:
        └─> OE was overestimated, adjust downward
```

**Business Rationale:**

**Why 80% minimum?**
- Allows 20% cost savings vs estimate (reasonable vendor efficiency)
- Flags prices beyond 20% discount as unusual
- Balances cost savings vs quality risk
- Industry standard for procurement price floors

**Alternative Thresholds:**
- **70%**: More aggressive cost savings, higher quality risk
- **90%**: Conservative, less quality risk, fewer savings
- **80% (current)**: Balanced approach

**Example Scenarios:**

**Acceptable (85%):**
```
OE: $1,000 → Vendor quotes $850 (85%)
✅ Reasonable: Vendor has 15% cost advantage
✅ Quality risk: Low
✅ Action: Accept quotation
```

**Borderline (78%):**
```
OE: $1,000 → Vendor quotes $780 (78%)
⚠️ Just below threshold
❌ Action: Reject, ask vendor to verify pricing
```

**Suspicious (60%):**
```
OE: $1,000 → Vendor quotes $600 (60%)
🚨 Major red flag: 40% below OE
❌ Quality risk: Very high
❌ Action: Reject, investigate vendor credibility
```

---

### 14. Max_price

**Current Value:** `config_value = 110` → N% of OE (currently: 110%, configurable via admin)

**Business Process:** Vendor quotation price validation - upper bound threshold

**Business Logic:**

Defines the maximum acceptable percentage of OE (Original Estimate) that a vendor can quote. When vendor price exceeds this threshold, the system triggers an OE revision workflow, giving CS N business days (Waiting_OE_revision_expiry - configured: 3) to revise the OE, negotiate with the vendor, or reject the quotation.

**Scenarios:**

**Scenario A: Vendor price ≤ N% of OE (Within Acceptable Range)** (currently N=110%)
```
OE Price: $1,000
Vendor Quote: $1,080
Calculation: ($1,080 / $1,000) × 100 = 108%
Max_price threshold: N% (configured: 110%)
Comparison: 108% ≤ 110%

Result: ✅ PASS
Action: Accept quotation (also passed Min_price check)
Status: Proceed to DIC confirmation
```

**Scenario B: Vendor price > N% of OE (Exceeds Maximum)** (currently N=110%)
```
OE Price: $1,000
Vendor Quote: $1,250
Calculation: ($1,250 / $1,000) × 100 = 125%
Max_price threshold: N% (configured: 110%)
Comparison: 125% > 110%

Result: ❌ FAIL (Exceeds Max_price)
Action: Trigger OE Revision Workflow
Status: WAITING_OE_REVISION (milestone 11)

Workflow Triggered:
├─> Email sent to CS: "Vendor price exceeds OE"
├─> CS gets N-day token (Waiting_OE_revision_expiry, configured: 3)
└─> CS Options:
    ├─> 1. Revise OE upward:
    │   └─> Update OE to $1,250 (or negotiate down)
    │       └─> Re-validate quotation → If now ≤110%, accept
    ├─> 2. Reject vendor price:
    │   └─> Vendor notified: "Price too high, resubmit"
    │       └─> Vendor gets new token to resubmit lower price
    ├─> 3. Negotiate with vendor:
    │   └─> Vendor agrees to reduce to $1,100 (110%)
    │       └─> Update quotation → Accept
    └─> 4. No response (3 days expire):
        └─> Auto-convert to iSourcing (manual sourcing)
```

**Decision Tree:**
```
Vendor Submits Quotation
└─> Calculate price percentage: (Vendor Price / OE) × 100

Price Validation:
└─> Vendor % ≤ Max_price (110%)?
    ├─> YES: ✅ Pass Max_price check
    │   └─> Also check Min_price (80%)
    │       ├─> Pass both → Accept quotation
    │       └─> Fail Min_price → Reject (quality concern)
    └─> NO: ❌ Price too high
        └─> Trigger OE Revision Workflow
            ├─> Status = WAITING_OE_REVISION (11)
            ├─> Email CS with details:
            │   ├─> Vendor quotation: $1,250
            │   ├─> Original OE: $1,000
            │   ├─> Percentage: 125% (exceeds 110%)
            │   └─> Action required: Revise/Reject/Negotiate
            └─> CS has 3 days (Waiting_OE_revision_expiry)
                ├─> Revise OE → Continue workflow
                ├─> Reject/Negotiate → Vendor resubmits
                └─> No response → iSourcing conversion
```

**Related Configurations:**
- **Min_price**: Lower bound (80% of OE)
- **Waiting_OE_revision_expiry**: CS SLA for OE revision (3 days)
- **hide_price_negotiation**: Controls visibility of max range to vendor
  - "no" (current) → Vendor sees 110% max
  - "yes" → Vendor does NOT see max

**Workflow Impact:**

**Price Exceeds Max_price Triggers:**
1. **OE Revision Request** - Email sent to CS
2. **Status Change** - WAITING_OE_REVISION (milestone 11)
3. **CS Token Created** - 3-day business day expiry
4. **Workflow Pause** - Procurement paused until CS acts

**CS Actions Available:**

**Option 1: Revise OE Upward (Market Price Adjustment)**
```
Situation: Market price increased since OE created
CS Action: Update OE from $1,000 to $1,250
Result:
├─> Vendor quotation $1,250 now = 100% of new OE
├─> Passes validation (≤110% of new OE)
└─> Workflow continues to DIC confirmation
```

**Option 2: Reject Vendor Quotation (Overpricing)**
```
Situation: Vendor is overcharging vs market rate
CS Action: Reject quotation with reason
Result:
├─> Vendor notified: "Price exceeds acceptable range"
├─> Vendor gets new token to resubmit
└─> Vendor must lower price to ≤110% of OE ($1,100 max)
```

**Option 3: Negotiate (Price Reduction)**
```
Situation: Vendor willing to reduce price
CS Action: Contact vendor, negotiate to $1,100 (110%)
Result:
├─> Vendor updates quotation to $1,100
├─> System re-validates: $1,100 = 110% of $1,000 ✅
└─> Workflow continues to DIC confirmation
```

**Option 4: No Response (3 days expire)**
```
Situation: CS doesn't act within 3 business days
System Action: Auto-convert to iSourcing
Result:
├─> RFQ type changed to "isourcing"
├─> Manual sourcing workflow activated
├─> Reason: "Expired CS OE action"
└─> Senior procurement team handles manually
```

**Business Rationale:**

**Why 110% maximum?**
- Allows 10% cost overrun vs estimate (reasonable market fluctuation)
- Flags prices beyond 10% premium as unusual
- Requires CS review for significant overruns
- Prevents automatic acceptance of overpriced quotations

**Alternative Thresholds:**
- **105%**: Stricter, less tolerance for price variance
- **120%**: More lenient, allows higher market fluctuations
- **110% (current)**: Balanced approach

**Example Scenarios:**

**Acceptable (108%):**
```
OE: $1,000 → Vendor quotes $1,080 (108%)
✅ Reasonable: Market price slightly higher than estimate
✅ Within tolerance: 8% premium
✅ Action: Accept quotation automatically
```

**Borderline (112%):**
```
OE: $1,000 → Vendor quotes $1,120 (112%)
⚠️ Just above threshold (2% over limit)
❌ Action: Trigger OE revision
└─> CS Options:
    ├─> Revise OE to $1,020 (makes 112% → 110% ✅)
    └─> Negotiate vendor down to $1,100 (110%)
```

**Significant Overprice (130%):**
```
OE: $1,000 → Vendor quotes $1,300 (130%)
🚨 Major flag: 30% above OE
❌ Action: Trigger OE revision
└─> CS Options:
    ├─> Revise OE to $1,182 (makes 130% → 110% ✅)
    ├─> Reject: Vendor overcharging significantly
    └─> Investigate: Market price changed or vendor error?
```

---

## D. PR Import Validation Configurations

These configurations are used during the **PR import process** (aigen-import-pr service) to validate whether a PR is eligible for Auto PO workflow. **ALL validations must pass** (AND logic) - if ANY single validation fails, the entire PR is rejected from Auto PO and will not generate an RFQ.

### 15. value / src_value

**Current Value:** `config_value = "5000"` → < N (currently: < 5000, configurable via admin; BCG uses "value", GEMS uses "src_value")

**Business Process:** PR import eligibility - total PR value threshold for Auto PO qualification

**Business Logic:**

During PR import from SAP, the system checks if the total PR value (sum of all line items) is below a threshold (configured value: 5000) to qualify for automated RFQ workflow. PRs with values at or above the threshold are excluded from Auto PO and likely require manual sourcing with competitive bidding.

**Server Group Differences:**

**BCG - Uses "value" Field (USD converted):**
```
Configuration:
├─> config_condition: "value"
├─> config_operator: "<"
├─> config_value: N (currently: "5000", configurable)
└─> Data field: SUM(convert_value) AS total_price_item

Process:
1. PR imported from SAP
2. System sums all line item values (in converted USD)
3. Compares: total_price_item < N (configured: 5000)
4. If true → Qualifies for Auto PO
5. If false → Skip Auto PO, manual sourcing required
```

**GEMS - Uses "src_value" Field (Original Currency):**
```
Configuration:
├─> config_condition: "src_value"
├─> config_operator: "<"
├─> config_value: N (currently: "5000", configurable)
└─> Data field: SUM(src_value) AS total_price_item

Process:
1. PR imported from SAP
2. System sums all line item values (in original currency, e.g., IDR)
3. Compares: total_price_item < N (configured: 5000)
4. If true → Qualifies for Auto PO
5. If false → Skip Auto PO, manual sourcing required
```

**Scenarios:**

**Scenario A: PR Value BELOW Threshold (Auto PO Eligible)**
```
BCG Example:
├─> PR Number: PR123456
├─> Line Item 1: $1,200
├─> Line Item 2: $2,300
├─> Line Item 3: $1,000
└─> Total convert_value: $4,500

Validation:
├─> config_condition: "value"
├─> config_operator: "<"
├─> config_value: "5000"
└─> Check: 4500 < 5000

Result: ✅ PASS

Actions:
1. Generate RFQ number (e.g., RFQ0000042)
2. Insert PR data into pr_library table
3. Insert RFQ data into rfq_library table
4. Create email tokens for vendors
5. Send RFQ emails to vendors
6. Proceed with Auto PO workflow
```

**Scenario B: PR Value AT OR ABOVE Threshold (Manual Sourcing Required)**
```
BCG Example:
├─> PR Number: PR789012
├─> Line Item 1: $2,000
├─> Line Item 2: $2,500
├─> Line Item 3: $1,000
└─> Total convert_value: $5,500

Validation:
├─> config_condition: "value"
├─> config_operator: "<"
├─> config_value: "5000"
└─> Check: 5500 < 5000

Result: ❌ FAIL

Actions:
1. Skip RFQ generation (no RFQ number created)
2. Do NOT insert into pr_library or rfq_library
3. PR remains in search_library for manual handling
4. Likely requires:
   ├─> Competitive bidding process
   ├─> Multiple vendor quotes
   ├─> Management approval
   └─> Formal tender process
```

**Scenario C: GEMS with src_value (Original Currency)**
```
GEMS Example:
├─> PR Number: PR555555
├─> Line Item 1: 15,000,000 IDR
├─> Line Item 2: 20,000,000 IDR
└─> Total src_value: 35,000,000 IDR

Validation:
├─> config_condition: "src_value"
├─> config_operator: "<"
├─> config_value: "5000"
└─> Check: 35000000 < 5000

Result: ❌ FAIL (value way above threshold)

Note: This suggests config_value "5000" may be in different units
      for GEMS (perhaps "5000" means 5,000,000 IDR or 5000 USD equivalent)
```

**Decision Tree:**
```
PR Imported from SAP
└─> Group PR items by pr_number, vendor_code, cs_id
    └─> Calculate total value:
        ├─> BCG: SUM(convert_value)
        └─> GEMS: SUM(src_value)

    └─> Compare to threshold:
        ├─> Total < config_value (5000):
        │   ├─> ✅ Auto PO eligible
        │   ├─> Generate RFQ number
        │   ├─> Insert into pr_library
        │   ├─> Insert into rfq_library
        │   └─> Send to vendor
        └─> Total ≥ config_value (5000):
            ├─> ❌ Not eligible for Auto PO
            ├─> Skip RFQ generation
            ├─> Remain in search_library
            └─> Manual sourcing workflow required
```

**Related Configurations:**
- **qcf_approval_level**: Higher values may require Management approval even if below threshold
- All other PR validation configs must also pass (is_da, is_delete, is_oa, oem, plant_code, pr_type, im_number)

**Workflow Impact:**

**Below Threshold (< 5000):**
- ✅ Automated procurement via RFQ workflow
- ✅ Faster processing (Auto PO)
- ✅ Reduced administrative overhead
- ✅ Suitable for routine, low-value purchases

**At or Above Threshold (≥ 5000):**
- ❌ Manual sourcing required
- ⚠️ Competitive bidding process
- ⚠️ Multiple vendor quotes required
- ⚠️ Management approval likely needed
- ⚠️ Tender documentation required
- ⚠️ Longer procurement cycle
- ✅ Better oversight for high-value purchases

**Business Rationale:**

**Why < 5000 threshold?**
- Low-value PRs: Streamlined automated procurement
- High-value PRs: Require competitive bidding and oversight
- Risk management: Higher values need more scrutiny
- Compliance: Procurement policies often require competitive quotes above certain thresholds
- Efficiency: Don't waste RFQ automation on complex high-value items

**Alternative Thresholds:**
- **< 1000**: Very conservative, only lowest-value items automated
- **< 10000**: More aggressive, automate more PRs
- **< 5000 (current)**: Balanced approach

---

### 16. im_number

**Current Value:** (configurable via admin)
- **BCG**: `config_value = ""` (empty string - IM number must be empty)
- **GEMS**: `config_value = "not null"` (IM number must exist)

**Business Process:** PR import eligibility - Investment Management (IM) number validation

**Business Logic:**

Validates the presence or absence of an Investment Management (IM) number in the PR. **BCG and GEMS have opposite requirements** - BCG requires IM number to be empty (non-investment PRs), while GEMS requires IM number to exist (investment PRs).

**Server Group Differences:**

**BCG - Requires Empty IM Number:**
```
Configuration:
├─> config_condition: "im_number"
├─> config_operator: "="
├─> config_value: "" (empty string)
└─> Validation: pr.im_number === "" OR pr.im_number === null

Business Meaning:
└─> BCG Auto PO handles NON-INVESTMENT procurement
    ├─> Operational purchases (maintenance, supplies)
    ├─> Routine procurement
    └─> NOT capital expenditure/investment projects
```

**GEMS - Requires IM Number Present:**
```
Configuration:
├─> config_condition: "im_number"
├─> config_operator: "="
├─> config_value: "not null"
└─> Validation: pr.im_number !== "" AND pr.im_number !== null

Business Meaning:
└─> GEMS Auto PO handles INVESTMENT procurement
    ├─> Capital expenditure tracking
    ├─> Investment project purchases
    └─> Budget allocation to specific IM numbers
```

**Scenarios:**

**Scenario A: BCG - PR with Empty IM Number (Auto PO Eligible)**
```
PR Data:
├─> pr_number: PR123456
├─> im_number: "" (empty) OR null
├─> server_group: BCG
└─> Description: "Office supplies - routine procurement"

Validation:
├─> config_condition: "im_number"
├─> config_operator: "="
├─> config_value: ""
└─> Check: pr.im_number === "" OR pr.im_number === null

Result: ✅ PASS

Interpretation:
└─> Non-investment, operational procurement
    ├─> Suitable for automated RFQ
    └─> No investment tracking required
```

**Scenario B: BCG - PR with IM Number Present (Rejected from Auto PO)**
```
PR Data:
├─> pr_number: PR789012
├─> im_number: "IM-2024-001" (has value)
├─> server_group: BCG
└─> Description: "Equipment for Investment Project ABC"

Validation:
├─> config_condition: "im_number"
├─> config_operator: "="
├─> config_value: ""
└─> Check: pr.im_number === "" OR pr.im_number === null

Result: ❌ FAIL

Reason: "PR has IM number, BCG Auto PO only for non-investment"
Action:
├─> Skip RFQ generation
├─> Do NOT insert into pr_library
└─> Manual sourcing required (investment project procurement)
```

**Scenario C: GEMS - PR with IM Number Present (Auto PO Eligible)**
```
PR Data:
├─> pr_number: PR555555
├─> im_number: "IM-2024-002" (has value)
├─> server_group: GEMS
└─> Description: "Equipment for Investment Project XYZ"

Validation:
├─> config_condition: "im_number"
├─> config_operator: "="
├─> config_value: "not null"
└─> Check: pr.im_number !== "" AND pr.im_number !== null

Result: ✅ PASS

Interpretation:
└─> Investment procurement tracked via IM number
    ├─> Suitable for automated RFQ
    └─> Budget allocated to investment project
```

**Scenario D: GEMS - PR without IM Number (Rejected from Auto PO)**
```
PR Data:
├─> pr_number: PR999999
├─> im_number: "" (empty) OR null
├─> server_group: GEMS
└─> Description: "Office supplies"

Validation:
├─> config_condition: "im_number"
├─> config_operator: "="
├─> config_value: "not null"
└─> Check: pr.im_number !== "" AND pr.im_number !== null

Result: ❌ FAIL

Reason: "PR missing IM number, GEMS Auto PO only for investment"
Action:
├─> Skip RFQ generation
├─> Do NOT insert into pr_library
└─> Manual sourcing required (non-investment procurement)
```

**Decision Tree:**
```
PR Import Process
└─> Validate im_number config
    ├─> Server Group: BCG
    │   └─> Config: im_number = "" (empty required)
    │       ├─> pr.im_number is empty OR null:
    │       │   └─> ✅ PASS - Non-investment procurement
    │       └─> pr.im_number has value:
    │           └─> ❌ FAIL - Investment procurement (not for BCG Auto PO)
    └─> Server Group: GEMS
        └─> Config: im_number = "not null" (must exist)
            ├─> pr.im_number has value:
            │   └─> ✅ PASS - Investment procurement
            └─> pr.im_number is empty OR null:
                └─> ❌ FAIL - Non-investment (not for GEMS Auto PO)
```

**Related Configurations:**
- All other PR validation configs must also pass (is_da, is_delete, is_oa, oem, plant_code, pr_type, value/src_value)

**Workflow Impact:**

**BCG (im_number must be empty):**
- ✅ Auto PO for: Operational procurement, routine purchases, maintenance
- ❌ Auto PO excluded: Investment projects, capital expenditure
- Business Focus: Day-to-day operational needs

**GEMS (im_number must exist):**
- ✅ Auto PO for: Investment projects, capital expenditure tracked via IM
- ❌ Auto PO excluded: Operational procurement without IM tracking
- Business Focus: Investment project procurement

**Server Group Philosophy:**

| Aspect | BCG | GEMS |
|--------|-----|------|
| **IM Number** | Must be empty | Must exist |
| **Auto PO for** | Operational procurement | Investment procurement |
| **Excluded** | Investment projects | Operational purchases |
| **Tracking** | No IM tracking | IM-based budget tracking |
| **Use Case** | Routine supplies, maintenance | Capital expenditure, projects |

**Business Rationale:**

**BCG (empty IM):**
- Automate routine operational procurement
- Investment projects use different workflow
- Clear separation: operational vs investment

**GEMS (IM required):**
- Automate investment project procurement
- Track expenditure against investment budgets
- All Auto PO items linked to specific investment projects

---

### 17. is_da

**Current Value:** `config_value = "1, 0"` (currently: accepts both DA and non-DA for BCG and GEMS, configurable via admin)

**Business Process:** PR import eligibility - Distribution Authority (DA) flag validation

**Business Logic:**

Validates that the PR's Distribution Authority (DA) flag is within acceptable values. The current configuration accepts **both** DA (1) and non-DA (0) PRs, meaning this validation effectively accepts all PRs regardless of DA status.

**Scenarios:**

**Scenario A: PR is DA (is_da = 1) - Auto PO Eligible**
```
PR Data:
├─> pr_number: PR123456
├─> is_da: 1 (Distribution Authority = true)
└─> server_group: BCG

Validation:
├─> config_condition: "is_da"
├─> config_operator: "in"
├─> config_value: "1, 0"
└─> Check: "1" IN ["1", "0"]

Result: ✅ PASS

Interpretation:
└─> Distribution/logistics-related PR
    ├─> Qualifies for Auto PO
    └─> DA status acceptable
```

**Scenario B: PR is NOT DA (is_da = 0) - Also Eligible**
```
PR Data:
├─> pr_number: PR789012
├─> is_da: 0 (Distribution Authority = false)
└─> server_group: BCG

Validation:
├─> config_condition: "is_da"
├─> config_operator: "in"
├─> config_value: "1, 0"
└─> Check: "0" IN ["1", "0"]

Result: ✅ PASS

Interpretation:
└─> Non-distribution PR
    ├─> Qualifies for Auto PO
    └─> DA status acceptable
```

**Scenario C: Invalid is_da Value (Hypothetical)**
```
PR Data:
├─> pr_number: PR999999
├─> is_da: 2 (Invalid value)
└─> server_group: BCG

Validation:
├─> config_condition: "is_da"
├─> config_operator: "in"
├─> config_value: "1, 0"
└─> Check: "2" IN ["1", "0"]

Result: ❌ FAIL

Reason: "Invalid DA value, only 1 or 0 accepted"
Action: Skip PR import
```

**Decision Tree:**
```
PR Import Process
└─> Validate is_da config
    ├─> pr.is_da = 1 (DA):
    │   ├─> Check: "1" IN ["1", "0"]
    │   └─> ✅ PASS - DA PRs accepted
    ├─> pr.is_da = 0 (non-DA):
    │   ├─> Check: "0" IN ["1", "0"]
    │   └─> ✅ PASS - Non-DA PRs also accepted
    └─> pr.is_da = other value:
        ├─> Check: "other" IN ["1", "0"]
        └─> ❌ FAIL - Invalid DA value
```

**Config Value Variations:**

**Current: "1, 0" (Accept Both - Current Setting)**
```
Result: Both DA and non-DA PRs qualify for Auto PO
└─> Most permissive configuration
    ├─> Maximizes Auto PO coverage
    └─> No DA-based filtering
```

**Alternative: "1" (DA Only)**
```
Result: Only DA PRs qualify for Auto PO
└─> Restricts to distribution/logistics PRs only
    ├─> Non-DA PRs excluded from Auto PO
    └─> Manual sourcing for non-DA items
```

**Alternative: "0" (Non-DA Only)**
```
Result: Only non-DA PRs qualify for Auto PO
└─> Restricts to non-distribution PRs
    ├─> DA PRs excluded from Auto PO
    └─> Manual sourcing for DA items
```

**Related Configurations:**
- All other PR validation configs must also pass (is_delete, is_oa, oem, plant_code, pr_type, value/src_value, im_number)

**Workflow Impact:**

**Current Setting ("1, 0" - Accept Both):**
- ✅ Maximizes Auto PO coverage (no DA filtering)
- ✅ Both distribution and non-distribution PRs automated
- ✅ Simplest configuration (no DA-based exclusions)
- ⚠️ No differentiation between DA types

**Alternative ("1" - DA Only):**
- ⚠️ Restricts Auto PO to distribution/logistics PRs
- ❌ Non-DA PRs require manual sourcing
- Use case: If DA items have different procurement requirements

**Alternative ("0" - Non-DA Only):**
- ⚠️ Restricts Auto PO to non-distribution PRs
- ❌ DA PRs require manual sourcing
- Use case: If DA items need specialized handling

**Business Rationale:**

**Current Setting ("1, 0"):**
- Company policy: Both DA and non-DA can use Auto PO
- No special handling required based on DA status
- Maximizes automation efficiency
- Simplifies procurement process

**What is Distribution Authority (DA)?**
- Indicates distribution/logistics-related procurement
- May relate to:
  - Warehouse/distribution center items
  - Logistics equipment
  - Storage/handling materials
- Current config treats DA and non-DA items equally

---

### 18. is_delete

**Current Value:** `config_value = "0"` (currently: "0" for BCG and GEMS - PR must NOT be deleted, configurable via admin)

**Business Process:** PR import eligibility - filters out deleted/cancelled PRs

**Business Logic:**

Validates that the PR has not been marked as deleted or cancelled in SAP. Prevents deleted/cancelled PRs from entering the Auto PO workflow.

**Scenarios:**

**Scenario A: PR is Active (is_delete = 0) - Auto PO Eligible**
```
PR Data:
├─> pr_number: PR123456
├─> is_delete: 0 (Active PR)
└─> server_group: BCG

Validation:
├─> config_condition: "is_delete"
├─> config_operator: "="
├─> config_value: "0"
└─> Check: pr.is_delete === "0"

Result: ✅ PASS

Interpretation:
└─> Active, non-deleted PR
    ├─> Qualifies for Auto PO
    └─> Procurement should proceed
```

**Scenario B: PR is Deleted (is_delete = 1) - Rejected from Auto PO**
```
PR Data:
├─> pr_number: PR789012
├─> is_delete: 1 (Deleted/Cancelled PR)
└─> server_group: BCG

Validation:
├─> config_condition: "is_delete"
├─> config_operator: "="
├─> config_value: "0"
└─> Check: pr.is_delete === "0"

Result: ❌ FAIL

Reason: "PR is marked as deleted/cancelled"
Action:
├─> Skip RFQ generation
├─> Do NOT insert into pr_library
└─> PR excluded from Auto PO (no procurement needed)
```

**Decision Tree:**
```
PR Import Process
└─> Validate is_delete config
    ├─> pr.is_delete = 0 (Active):
    │   ├─> Check: 0 === 0
    │   └─> ✅ PASS - Active PR, proceed to Auto PO
    └─> pr.is_delete = 1 (Deleted):
        ├─> Check: 1 === 0
        └─> ❌ FAIL - Deleted PR, skip Auto PO
```

**Related Configurations:**
- All other PR validation configs must also pass (is_da, is_oa, oem, plant_code, pr_type, value/src_value, im_number)

**Workflow Impact:**

**Active PR (is_delete = 0):**
- ✅ Proceeds to Auto PO workflow
- ✅ RFQ generated and sent to vendors
- ✅ Normal procurement process

**Deleted PR (is_delete = 1):**
- ❌ Excluded from Auto PO
- ❌ No RFQ generation
- ❌ No vendor notification
- ✅ Prevents wasted effort on cancelled requests

**Why PRs Get Deleted:**
- ❌ Purchase request cancelled (no longer needed)
- ❌ Duplicate PR created by mistake
- ❌ Requirements changed (new PR created)
- ❌ Budget not approved
- ❌ Project cancelled
- ❌ Vendor/material substitution (superseded by new PR)

**Business Rationale:**

**Why Exclude Deleted PRs:**
- Prevents wasted procurement effort
- Avoids vendor confusion (RFQ for cancelled item)
- Maintains data integrity (only active PRs in workflow)
- Reduces administrative overhead
- Prevents creating POs for cancelled requests

**SAP Integration:**
- SAP marks PRs as deleted when:
  - User cancels PR in SAP
  - PR superseded by another PR
  - Budget/approval revoked
- Deletion flag synced to search_library
- Auto PO respects SAP deletion status

---

### 19. is_oa

**Current Value:** `config_value = "0"` (currently: "0" for BCG and GEMS - PR must NOT be Outline Agreement, configurable via admin)

**Business Process:** PR import eligibility - filters out Outline Agreement (OA) PRs

**Business Logic:**

Validates that the PR is not an Outline Agreement (OA). Outline Agreements in SAP are long-term purchasing agreements with vendors for recurring purchases at predetermined prices and terms. These require different procurement handling than standard PRs.

**Scenarios:**

**Scenario A: PR is NOT Outline Agreement (is_oa = 0) - Auto PO Eligible**
```
PR Data:
├─> pr_number: PR123456
├─> is_oa: 0 (Standard PR, not OA)
└─> server_group: BCG

Validation:
├─> config_condition: "is_oa"
├─> config_operator: "="
├─> config_value: "0"
└─> Check: pr.is_oa === "0"

Result: ✅ PASS

Interpretation:
└─> Standard purchase request
    ├─> Qualifies for Auto PO RFQ workflow
    └─> Normal vendor quotation process
```

**Scenario B: PR is Outline Agreement (is_oa = 1) - Rejected from Auto PO**
```
PR Data:
├─> pr_number: PR789012
├─> is_oa: 1 (Outline Agreement)
└─> server_group: BCG

Validation:
├─> config_condition: "is_oa"
├─> config_operator: "="
├─> config_value: "0"
└─> Check: pr.is_oa === "0"

Result: ❌ FAIL

Reason: "PR is Outline Agreement, requires different handling"
Action:
├─> Skip RFQ generation
├─> Do NOT insert into pr_library
└─> Use OA process (pre-negotiated terms, no RFQ needed)
```

**Decision Tree:**
```
PR Import Process
└─> Validate is_oa config
    ├─> pr.is_oa = 0 (Standard PR):
    │   ├─> Check: 0 === 0
    │   └─> ✅ PASS - Standard PR, proceed to Auto PO
    └─> pr.is_oa = 1 (Outline Agreement):
        ├─> Check: 1 === 0
        └─> ❌ FAIL - OA PR, use OA workflow (not RFQ)
```

**Related Configurations:**
- All other PR validation configs must also pass (is_da, is_delete, oem, plant_code, pr_type, value/src_value, im_number)

**Workflow Impact:**

**Standard PR (is_oa = 0):**
- ✅ Proceeds to Auto PO RFQ workflow
- ✅ Vendor quotation process
- ✅ Price comparison and negotiation
- ✅ Normal procurement cycle

**Outline Agreement (is_oa = 1):**
- ❌ Excluded from Auto PO RFQ workflow
- ✅ Uses existing OA terms (pre-negotiated)
- ✅ Direct PO creation (no quotation needed)
- ✅ Faster processing (skip RFQ step)
- ⚠️ Different procurement path

**What is an Outline Agreement (OA)?**

An Outline Agreement is a long-term purchasing agreement in SAP with:
- **Pre-negotiated prices** - No quotation/bidding needed
- **Pre-defined terms** - Delivery, payment terms already agreed
- **Recurring purchases** - For items bought regularly
- **Validity period** - Agreement active for specific timeframe
- **Release orders** - Individual POs issued against agreement

**Examples of OA Use Cases:**
- Office supplies (monthly recurring)
- IT equipment (framework agreement)
- Maintenance services (annual contract)
- Raw materials (quarterly purchases)
- Utilities (long-term contracts)

**Why Exclude OA from Auto PO?**
- OAs already have negotiated prices (no RFQ needed)
- Vendor already selected (no quotation comparison)
- Faster procurement (direct PO creation)
- Different approval workflow
- Different SAP document type

**Business Rationale:**

**Exclude OA PRs (is_oa = 0 required):**
- Auto PO designed for one-off/ad-hoc procurement
- OA has own optimized workflow (faster, pre-approved)
- No need for RFQ quotation process (prices already set)
- Avoids confusion (vendor already contracted)
- Maintains clear separation of procurement types

**Procurement Paths:**

| PR Type | Auto PO | Vendor Selection | Pricing | Speed |
|---------|---------|------------------|---------|-------|
| **Standard PR** (is_oa=0) | ✅ Yes | RFQ quotation process | Competitive bidding | Normal |
| **Outline Agreement** (is_oa=1) | ❌ No | Pre-selected vendor | Pre-negotiated | Fast |

---

### 20. oem

**Current Value:** `config_value = "is_null"` (currently: "is_null" for BCG and GEMS - OEM field must be null, configurable via admin)

**Business Process:** PR import eligibility - validates OEM (Original Equipment Manufacturer) requirements

**Business Logic:**

Validates that the OEM field in the PR is null. When OEM field is populated, it indicates the item requires original manufacturer parts (brand-specific), which may need specialized procurement handling outside the standard Auto PO workflow.

**Scenarios:**

**Scenario A: OEM Field is Null (Auto PO Eligible)**
```
PR Data:
├─> pr_number: PR123456
├─> oem: null (No OEM requirement)
├─> item_description: "Standard bolt M8x20mm"
└─> server_group: BCG

Validation:
├─> config_condition: "oem"
├─> config_operator: "="
├─> config_value: "is_null"
└─> Check: pr.oem === null

Result: ✅ PASS

Interpretation:
└─> Generic/standard item
    ├─> No brand requirement
    ├─> Multiple vendors can supply
    ├─> Qualifies for Auto PO RFQ
    └─> Competitive pricing possible
```

**Scenario B: OEM Field Has Value (Rejected from Auto PO)**
```
PR Data:
├─> pr_number: PR789012
├─> oem: "Siemens" (OEM brand specified)
├─> item_description: "Siemens PLC module S7-1200"
└─> server_group: BCG

Validation:
├─> config_condition: "oem"
├─> config_operator: "="
├─> config_value: "is_null"
└─> Check: pr.oem === null

Result: ❌ FAIL

Reason: "OEM field populated, brand-specific item"
Action:
├─> Skip RFQ generation
├─> Do NOT insert into pr_library
└─> Manual sourcing required (OEM-certified vendors only)
```

**Decision Tree:**
```
PR Import Process
└─> Validate oem config
    ├─> pr.oem = null (No OEM requirement):
    │   ├─> Check: null === null
    │   └─> ✅ PASS - Generic item, proceed to Auto PO
    └─> pr.oem has value (OEM brand specified):
        ├─> Check: "brand_name" === null
        └─> ❌ FAIL - OEM item, manual sourcing required
```

**Related Configurations:**
- All other PR validation configs must also pass (is_da, is_delete, is_oa, plant_code, pr_type, value/src_value, im_number)

**Workflow Impact:**

**Generic Item (oem = null):**
- ✅ Proceeds to Auto PO RFQ workflow
- ✅ Multiple vendors can quote
- ✅ Competitive pricing
- ✅ Flexible sourcing options
- ✅ Standard procurement process

**OEM-Specific Item (oem has value):**
- ❌ Excluded from Auto PO
- ⚠️ Requires OEM-certified vendors
- ⚠️ Limited vendor pool
- ⚠️ Higher prices (brand premium)
- ⚠️ Different procurement workflow
- ✅ Manual sourcing ensures authenticity

**Why OEM Items Need Special Handling:**

**Technical Reasons:**
- Compatibility requirements (must match existing equipment)
- Warranty preservation (generic parts void warranty)
- Quality assurance (OEM certification required)
- Safety compliance (critical components)
- Technical specifications (exact match needed)

**Procurement Reasons:**
- Limited vendor pool (authorized distributors only)
- Higher prices (no generic alternatives)
- Authenticity verification (prevent counterfeit)
- Different approval workflow
- May require manufacturer quotes

**Examples:**

**Generic Items (oem = null, Auto PO OK):**
```
✅ Standard bolts/nuts
✅ Office supplies
✅ Common electrical components
✅ Maintenance materials
✅ Consumables
```

**OEM Items (oem populated, Manual Sourcing):**
```
❌ Siemens PLC modules
❌ ABB motor parts
❌ SAP software licenses
❌ Caterpillar engine components
❌ Medical device replacement parts
```

**Business Rationale:**

**Exclude OEM Items (oem = null required):**
- Auto PO designed for competitive bidding
- OEM items have limited vendor choices (no competition)
- Price comparison meaningless (single brand)
- Vendor qualification critical (prevent counterfeit)
- Manual verification ensures authenticity
- Different approval process (brand justification)

**Procurement Paths:**

| Item Type | OEM Field | Auto PO | Vendor Pool | Pricing | Handling |
|-----------|-----------|---------|-------------|---------|----------|
| **Generic** | null | ✅ Yes | Multiple vendors | Competitive | Automated |
| **OEM-Specific** | "Brand Name" | ❌ No | Authorized only | Fixed/Premium | Manual |

---

### 21. plant_code

**Current Value:** `config_value = "A100, B100, B300, B400, B500, B600, B700, D100, E100, E200, G100"` (currently: these plants EXCLUDED for BCG and GEMS using "not_in" operator, configurable via admin)

**Business Process:** PR import eligibility - validates plant location for Auto PO qualification

**Business Logic:**

Validates that the PR's plant code is NOT in the excluded list. The config uses **"not_in"** operator, meaning PRs from the 11 specified plant codes are **excluded** from Auto PO and require manual sourcing.

**Scenarios:**

**Scenario A: PR from Approved Plant (NOT in Excluded List) - Auto PO Eligible**
```
PR Data:
├─> pr_number: PR123456
├─> plant_code: "P001" (Not in excluded list)
└─> server_group: BCG

Validation:
├─> config_condition: "plant_code"
├─> config_operator: "not_in"
├─> config_value: "A100, B100, B300, B400, B500, B600, B700, D100, E100, E200, G100"
├─> Excluded plants: ["A100", "B100", "B300", "B400", "B500", "B600", "B700", "D100", "E100", "E200", "G100"]
└─> Check: "P001" NOT IN excluded list

Result: ✅ PASS

Interpretation:
└─> Plant P001 is approved for Auto PO
    ├─> Qualifies for automated RFQ workflow
    └─> Standard procurement process applies
```

**Scenario B: PR from Excluded Plant - Rejected from Auto PO**
```
PR Data:
├─> pr_number: PR789012
├─> plant_code: "B300" (IN excluded list)
└─> server_group: BCG

Validation:
├─> config_condition: "plant_code"
├─> config_operator: "not_in"
├─> config_value: "A100, B100, B300, B400, B500, B600, B700, D100, E100, E200, G100"
├─> Excluded plants: ["A100", "B100", "B300", "B400", "B500", "B600", "B700", "D100", "E100", "E200", "G100"]
└─> Check: "B300" NOT IN excluded list

Result: ❌ FAIL (B300 IS in excluded list)

Reason: "Plant B300 is excluded from Auto PO"
Action:
├─> Skip RFQ generation
├─> Do NOT insert into pr_library
└─> Manual sourcing required for this plant location
```

**Decision Tree:**
```
PR Import Process
└─> Validate plant_code config
    ├─> pr.plant_code NOT in excluded list:
    │   ├─> Examples: P001, P002, C100, F100, etc.
    │   └─> ✅ PASS - Approved plant, proceed to Auto PO
    └─> pr.plant_code IN excluded list:
        ├─> Excluded: A100, B100, B300, B400, B500, B600, B700, D100, E100, E200, G100
        └─> ❌ FAIL - Excluded plant, manual sourcing required
```

**Excluded Plants (11 total):**
```
A100 - Excluded from Auto PO
B100 - Excluded from Auto PO
B300 - Excluded from Auto PO
B400 - Excluded from Auto PO
B500 - Excluded from Auto PO
B600 - Excluded from Auto PO
B700 - Excluded from Auto PO
D100 - Excluded from Auto PO
E100 - Excluded from Auto PO
E200 - Excluded from Auto PO
G100 - Excluded from Auto PO
```

**Related Configurations:**
- All other PR validation configs must also pass (is_da, is_delete, is_oa, oem, pr_type, value/src_value, im_number)

**Workflow Impact:**

**Approved Plant (NOT in excluded list):**
- ✅ Proceeds to Auto PO RFQ workflow
- ✅ Automated vendor sourcing
- ✅ Standard procurement process
- ✅ Faster turnaround time

**Excluded Plant (IN excluded list - A100, B100, etc.):**
- ❌ Excluded from Auto PO
- ⚠️ Manual sourcing required
- ⚠️ Plant-specific procurement rules
- ⚠️ Different vendor relationships
- ⚠️ Custom approval workflows

**Why Plants Get Excluded:**

**Possible Reasons for Exclusion:**
- **Special procurement rules** - Plant has unique requirements
- **Local vendor relationships** - Plant uses specific local vendors
- **Different approval process** - Plant requires different sign-offs
- **Pilot rollout** - Auto PO not yet rolled out to these plants
- **System integration issues** - Plant systems not fully integrated
- **High-risk items** - Plants handle sensitive/critical materials
- **Remote locations** - Require specialized logistics handling
- **Transition period** - Plants migrating to different procurement system

**Business Rationale:**

**Exclude Specific Plants (not_in approach):**
- Allows phased Auto PO rollout (exclude plants not ready)
- Accommodates plant-specific procurement requirements
- Maintains existing vendor relationships for certain locations
- Provides flexibility for special cases
- Enables pilot testing in approved plants first

**Procurement Paths:**

| Plant Location | Auto PO Eligible | Sourcing Method | Reason |
|----------------|------------------|-----------------|---------|
| **P001, C100, F100, etc.** | ✅ Yes | Automated RFQ | Approved for Auto PO |
| **A100** | ❌ No | Manual sourcing | Excluded plant |
| **B100-B700** | ❌ No | Manual sourcing | Excluded plant group |
| **D100, E100, E200** | ❌ No | Manual sourcing | Excluded plants |
| **G100** | ❌ No | Manual sourcing | Excluded plant |

---

### 22. pr_type

**Current Value:** `config_value = "ZST, ZDC, ZPM, ZMR"` (currently: these PR types ALLOWED for BCG and GEMS using "in" operator, configurable via admin)

**Business Process:** PR import eligibility - validates PR document type for Auto PO qualification

**Business Logic:**

Validates that the PR's document type is in the approved list of PR types for Auto PO. The config uses **"in"** operator, meaning only PRs with these 4 specific SAP document types qualify for automated procurement. Other PR types (services, stock transfers, etc.) require manual sourcing.

**Scenarios:**

**Scenario A: PR with Allowed Type (IN Approved List) - Auto PO Eligible**
```
PR Data:
├─> pr_number: PR123456
├─> document_type: "ZST" (Standard materials PR)
└─> server_group: BCG

Validation:
├─> config_condition: "pr_type"
├─> config_operator: "in"
├─> config_value: "ZST, ZDC, ZPM, ZMR"
├─> Allowed types: ["ZST", "ZDC", "ZPM", "ZMR"]
└─> Check: "ZST" IN allowed list

Result: ✅ PASS

Interpretation:
└─> Standard material PR type
    ├─> Qualifies for Auto PO RFQ
    └─> Material procurement workflow
```

**Scenario B: PR with Disallowed Type (NOT in List) - Rejected from Auto PO**
```
PR Data:
├─> pr_number: PR789012
├─> document_type: "SR" (Service PR)
└─> server_group: BCG

Validation:
├─> config_condition: "pr_type"
├─> config_operator: "in"
├─> config_value: "ZST, ZDC, ZPM, ZMR"
├─> Allowed types: ["ZST", "ZDC", "ZPM", "ZMR"]
└─> Check: "SR" IN allowed list

Result: ❌ FAIL (SR is NOT in allowed list)

Reason: "PR type SR not allowed for Auto PO (service PR)"
Action:
├─> Skip RFQ generation
├─> Do NOT insert into pr_library
└─> Manual sourcing required (service procurement different workflow)
```

**Decision Tree:**
```
PR Import Process
└─> Validate pr_type config
    ├─> pr.document_type IN ["ZST", "ZDC", "ZPM", "ZMR"]:
    │   ├─> ZST: Standard materials PR ✅
    │   ├─> ZDC: Distribution center PR ✅
    │   ├─> ZPM: Plant maintenance PR ✅
    │   └─> ZMR: Material reservation PR ✅
    │   └─> PASS - Proceed to Auto PO
    └─> pr.document_type NOT in list:
        ├─> Examples: SR (service), SB (subcontract), BE (stock transfer)
        └─> ❌ FAIL - Manual sourcing required
```

**Allowed PR Types (4 types):**

**ZST - Standard Material PR:**
```
Description: Standard purchase requisition for materials
Use Case: Routine material procurement
Auto PO: ✅ Eligible
Example: Office supplies, production materials, spare parts
```

**ZDC - Distribution Center PR:**
```
Description: PRs for distribution center operations
Use Case: Warehouse/distribution procurement
Auto PO: ✅ Eligible
Example: Packaging materials, logistics equipment
```

**ZPM - Plant Maintenance PR:**
```
Description: PRs for plant maintenance activities
Use Case: Maintenance and repair materials
Auto PO: ✅ Eligible
Example: Maintenance supplies, repair parts, tools
```

**ZMR - Material Reservation PR:**
```
Description: PRs with material reservations
Use Case: Reserved materials for specific projects
Auto PO: ✅ Eligible
Example: Project-specific materials, allocated inventory
```

**Common PR Types EXCLUDED from Auto PO:**

**SR - Service PR:**
```
Description: Service purchase requisitions
Why Excluded:
├─> Services require different contract terms
├─> Statement of Work (SOW) needed
├─> Different approval workflow
├─> Performance metrics/SLAs required
└─> Manual negotiation typically needed
Manual Sourcing Required
```

**SB - Subcontracting PR:**
```
Description: Subcontracting services
Why Excluded:
├─> Complex contracts required
├─> Labor law compliance
├─> Specialized vendor qualification
└─> Custom terms and conditions
Manual Sourcing Required
```

**BE - Stock Transfer PR:**
```
Description: Internal stock transfers between plants
Why Excluded:
├─> Internal transaction (not external procurement)
├─> No vendor/quotation needed
├─> Different SAP workflow (transfer order)
└─> No RFQ applicable
Not Procurement - Internal Transfer
```

**Related Configurations:**
- All other PR validation configs must also pass (is_da, is_delete, is_oa, oem, plant_code, value/src_value, im_number)

**Workflow Impact:**

**Allowed PR Types (ZST, ZDC, ZPM, ZMR):**
- ✅ Proceeds to Auto PO RFQ workflow
- ✅ Material/goods procurement
- ✅ Vendor quotation process applicable
- ✅ Standard procurement cycle
- ✅ Automated PO creation

**Excluded PR Types (SR, SB, BE, etc.):**
- ❌ Excluded from Auto PO
- ⚠️ Services require different workflow (SOW, contracts)
- ⚠️ Subcontracting needs labor compliance
- ⚠️ Stock transfers are internal (no vendor)
- ✅ Manual sourcing with appropriate workflows

**Business Rationale:**

**Allow Only Material PRs (ZST, ZDC, ZPM, ZMR):**
- Auto PO designed for material/goods procurement
- Standardized RFQ quotation process works for materials
- Price comparison straightforward for goods
- Vendor qualification simpler for materials
- Automated workflow suitable for tangible items

**Exclude Service/Transfer PRs:**
- Services need custom contracts (not simple quotations)
- Terms and conditions vary widely for services
- Stock transfers don't involve external vendors
- Different approval requirements
- Complex vendor qualification for services

**Procurement Paths:**

| PR Type | Description | Auto PO | Workflow |
|---------|-------------|---------|----------|
| **ZST** | Standard materials | ✅ Yes | Auto PO RFQ |
| **ZDC** | Distribution center | ✅ Yes | Auto PO RFQ |
| **ZPM** | Plant maintenance | ✅ Yes | Auto PO RFQ |
| **ZMR** | Material reservation | ✅ Yes | Auto PO RFQ |
| **SR** | Services | ❌ No | Manual (SOW/Contract) |
| **SB** | Subcontracting | ❌ No | Manual (Labor contract) |
| **BE** | Stock transfer | ❌ No | Internal transfer order |

---

**End of Comprehensive Configuration Business Logic Analysis**

---
