import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicRequestRevise } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC37] S3 — DIC request revise VA (S3 - VD Decline)
 *
 * Spreadsheet Reference (Row 88):
 * - Code         : DIC37
 * - Vendor input : VD decline, VA accept (below OE)
 * - DIC Action   : Request Revise VA (S3 - VD Decline)
 * - UI VD        : No Quote      (VD declined → status_vendor=REJECT)
 * - UI VA        : Need Action   (dicRequestRevise resets VA status_vendor=0)
 * - UI DIC       : Waiting Vendor
 * - UI CS        : Waiting Vendor
 * - Table Status : Spreadsheet col Q = "Waiting Vendor" (UI label).
 *                  DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (AGGREGATOR row checked)
 * - Rule 4: VD declined → status_vendor=REJECT → "No Quote"
 * - Milestone ref table: DIC_REQUEST_REVISE = 9
 */
describe('[DIC37] S3 — DIC request revise VA (S3 - VD Decline)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'decline', va: 'accept' }, { scenario: 's3' });
    await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'Please revise your quote', VENDOR_TYPE.AGGREGATOR);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVD);
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
