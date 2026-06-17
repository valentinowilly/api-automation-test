import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicAccept, expireVendorAndRunCron } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC31] S3 — DIC accept VA (S3 - VD No Action)
 *
 * Spreadsheet Reference (Row 82):
 * - Code         : DIC31
 * - Vendor input : VD no_action, VA accept (below OE)
 * - DIC Action   : Accept VA (S3 - VD No Action)
 * - UI VD        : Waiting Procurement (VD token expired via cron → backend promotes to DIC stage)
 * - UI VA        : Waiting Procurement (DIC accepted VA → milestone ≥ 10)
 * - UI DIC       : Waiting Procurement (DIC accepted VA → RFQ advances; VD expired = resolved)
 * - UI CS        : Waiting CL (mirrors DIC25 pattern: after DIC accepts, CS advances to CL stage)
 * - Table Status : Spreadsheet col Q = "Waiting CS" (UI label).
 *                  DB value after DIC accepts below-OE = DIC_ACCEPTED (10).
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (AGGREGATOR row checked)
 * - Rule 2: below-OE → DIC_ACCEPTED (10)
 * - S3 no_action rule: expire VD token with VENDOR_TYPE.AGGREGATOR (Waiting_vendor_expiry config)
 *   → cron creates DIC email token so dicAccept can proceed
 */
describe('[DIC31] S3 — DIC accept VA (S3 - VD No Action)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'no_action', va: 'accept' }, { scenario: 's3' });
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
    await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.AGGREGATOR);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD);
  });

  test('VA items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken);
  });

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', 'Waiting CL', ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting CS" (UI label). DB value after DIC accepts below-OE = DIC_ACCEPTED (10).
  test('table status is DIC_ACCEPTED (VA row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'DIC_ACCEPTED');
  });
});
