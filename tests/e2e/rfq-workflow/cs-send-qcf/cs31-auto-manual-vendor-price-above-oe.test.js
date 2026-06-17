import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import { expireDICAndRunCron, expireCSAndRunCron } from '../helpers/workflow-actions.helper.js';
import {
  assertUIState,
  assertRFQMilestone,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

/**
 * CS31 — Auto Manual Sourcing: Vendor Price Above OE
 *
 * UAT row (line 530):
 *   Config:             CS_expiry
 *   DIC Action:         auto manual sourcing  (DIC expired → did NOT manually accept)
 *   CS Action:          No Action (OE)
 *   UI VD:              Manual Sourcing
 *   UI VA:              Manual Sourcing
 *   UI DIC:             Manual Sourcing
 *   UI CS:              Manual Sourcing
 *   Table Status:       Manual Sourcing
 *   Auto Manual Reason: Auto Manual Vendor Price Above OE
 *   Sample Data:        RFQ0004121 (VD), RFQ0004122 (VA)  ← S3, two RFQs
 *   Next Step:          END
 *
 * Scenario: S3 — both VD and VA submit above-OE price (accept_oe) → both go to DIC →
 *   DIC takes no action → DIC SLA expires → cron fires the OE path →
 *   reason: "Auto Manual Vendor Price Above OE".
 *
 * KEY DISTINCTION from CS30:
 *   - CS30: both decline → no DIC → CS expires → "No Quote"
 *   - CS31: both accept above OE → DIC stage → DIC expires → "Price Above OE"
 *
 * NOTE: The UAT sample data shows RFQ0004121 (VD) and RFQ0004122 (VA) as separate
 *   RFQ numbers, which is the S3 parallel scenario. Both VD and VA submit above-OE
 *   price, DIC receives both and times out.
 *
 * The DIC expiry cron (stage=dic, config_condition=Waiting_DIC_review_expiry)
 * calls sendActionToCS with rfq_tipe=ISOURCING, setting milestone to Manual Sourcing
 * with reason "Auto Manual Vendor Price Above OE" when items are priceNotMatch.
 */
describe('[CS31] CS31 — Auto manual sourcing (vendor price above OE)', () => {
  let ctx;

  beforeAll(async () => {
    // S3: both VD and VA submit above-OE price → DIC stage reached
    // DIC takes no action → expire DIC token → cron fires → Manual Sourcing
    ctx = await setupRFQAtCSStage({ vd: 'accept_oe', va: 'accept_oe' }, null, { 
      scenario: 's3',
      searchLibraryOverrides: { im_number: 'IM' + String(Math.floor(Math.random() * 9000000000) + 1000000000) }
    });

    // DIC received both above-OE submissions but took no action → expire DIC token
    await expireDICAndRunCron(ctx.rfqNumber, ctx.adminToken);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  // UAT: UI VD = Manual Sourcing
  test('VD UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.MANUAL_SOURCING, ctx.vendorAccountTokenVD, { pollTimeoutMs: 10000 });
  });

  // UAT: UI VA = Manual Sourcing
  test('VA UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.MANUAL_SOURCING, ctx.vendorAccountTokenVA, { pollTimeoutMs: 10000 });
  });

  // UAT: UI DIC = Manual Sourcing
  test('DIC UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.MANUAL_SOURCING, ctx.dicToken);
  });

  // UAT: UI CS = Manual Sourcing
  test('CS UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.MANUAL_SOURCING, ctx.csToken, { statusFilter: UI_STATUS.MANUAL_SOURCING });
  });

  // UAT: Table Status = Manual Sourcing → MANUAL_SOURCING (12)
  test('table status is "Manual Sourcing"', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'MANUAL_SOURCING');
  });
});
