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
 * [DIC32] S3 — DIC accept VA (OE S3 - VD No Action)
 *
 * Spreadsheet Reference (Row 83):
 * - Code         : DIC32
 * - Vendor input : VD no_action, VA accept_oe (above OE)
 * - DIC Action   : Accept VA (OE S3 - VD No Action)
 * - UI VD        : Waiting Procurement (VD token expired via cron → backend promotes to DIC stage)
 * - UI VA        : Waiting Procurement (DIC accepted VA → milestone ≥ 10)
 * - UI DIC       : Waiting Procurement (DIC accepted VA → RFQ advances; VD expired = resolved)
 * - UI CS        : Need Action (VA accepted above OE → CS needs to act on OE revision)
 * - Table Status : Spreadsheet col Q = "Waiting CS" (UI label).
 *                  DB value after DIC accepts above-OE = WAITING_OE_REVISION (14).
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (AGGREGATOR row checked)
 * - Rule 2: above-OE → WAITING_OE_REVISION (14)
 * - S3 no_action rule: expire VD token with VENDOR_TYPE.AGGREGATOR (Waiting_vendor_expiry config)
 *   → cron creates DIC email token so dicAccept can proceed
 */
describe('[DIC32] S3 — DIC accept VA (OE S3 - VD No Action)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'no_action', va: 'accept_oe' }, { scenario: 's3' });
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

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting CS" (UI label). DB value after DIC accepts above-OE = WAITING_OE_REVISION (14).
  test('table status is WAITING_OE_REVISION (VA row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'WAITING_OE_REVISION');
  });
});
