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
 * [DIC35] S3 — DIC request revise VD (S3 - VA No Action)
 *
 * Spreadsheet Reference (Row 86):
 * - Code         : DIC35
 * - Vendor input : VD accept (below OE), VA no_action
 * - DIC Action   : Request Revise VD (S3 - VA No Action)
 * - UI VD        : Need Action   (dicRequestRevise resets status_vendor=0)
 * - UI VA        : Waiting Procurement (VA token expired via cron → backend promotes to DIC stage)
 * - UI DIC       : Waiting Vendor
 * - UI CS        : Waiting Vendor
 * - Table Status : Spreadsheet col Q = "Waiting Vendor" (UI label).
 *                  DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (DIRECT row checked)
 * - S3 no_action rule: expire VA token with VENDOR_TYPE.AGGREGATOR (Waiting_vendor_expiry config)
 *   → cron creates DIC email token so dicRequestRevise can proceed
 * - Milestone ref table: DIC_REQUEST_REVISE = 9
 */
describe('[DIC35] S3 — DIC request revise VD (S3 - VA No Action)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'no_action' }, { scenario: 's3' });
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
    await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'Please revise your quote', VENDOR_TYPE.DIRECT);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVD);
  });

  test('VA items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken);
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting Vendor" (UI label). DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
  test('table status is DIC_REQUEST_REVISE (VD row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'DIC_REQUEST_REVISE');
  });
});
