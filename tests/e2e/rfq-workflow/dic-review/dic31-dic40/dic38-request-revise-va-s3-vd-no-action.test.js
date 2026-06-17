import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicRequestRevise, expireVendorAndRunCron } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC38] S3 — DIC request revise VA (S3 - VD No Action)
 *
 * Spreadsheet Reference (Row 89):
 * - Code         : DIC38
 * - Vendor input : VD no_action, VA accept (below OE)
 * - DIC Action   : Request Revise VA (S3 - VD No Action)
 * - UI VD        : Waiting Procurement (VD token expired via cron → backend promotes to DIC stage)
 * - UI VA        : Need Action   (dicRequestRevise resets VA status_vendor=0)
 * - UI DIC       : Waiting Vendor
 * - UI CS        : Waiting Vendor
 * - Table Status : Spreadsheet col Q = "Waiting Vendor" (UI label).
 *                  DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (AGGREGATOR row checked)
 * - S3 no_action rule: expire VD token with VENDOR_TYPE.AGGREGATOR (Waiting_vendor_expiry config)
 *   → cron creates DIC email token so dicRequestRevise can proceed
 * - Milestone ref table: DIC_REQUEST_REVISE = 9
 */
describe('[DIC38] S3 — DIC request revise VA (S3 - VD No Action)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'no_action', va: 'accept' }, { scenario: 's3' });
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
    await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'Please revise your quote', VENDOR_TYPE.AGGREGATOR);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD);
  });

  test('VA items show "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken);
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting Vendor" (UI label). DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
  test('table status is DIC_REQUEST_REVISE (VA row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'DIC_REQUEST_REVISE');
  });
});
