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
 * [DIC34] S3 — DIC request revise VD (S3 - VA Decline)
 *
 * Spreadsheet Reference (Row 85):
 * - Code         : DIC34
 * - Vendor input : VD accept (below OE), VA decline
 * - DIC Action   : Request Revise VD (S3 - VA Decline)
 * - UI VD        : Need Action   (dicRequestRevise resets status_vendor=0)
 * - UI VA        : No Quote      (VA declined → status_vendor=REJECT)
 * - UI DIC       : Waiting Vendor
 * - UI CS        : Waiting Vendor
 * - Table Status : Spreadsheet col Q = "Waiting Vendor" (UI label).
 *                  DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (DIRECT row checked)
 * - Rule 4: VA declined → status_vendor=REJECT → "No Quote"
 * - Milestone ref table: DIC_REQUEST_REVISE = 9
 */
describe('[DIC34] S3 — DIC request revise VD (S3 - VA Decline)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'decline' }, { scenario: 's3' });
    await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'Please revise your quote', VENDOR_TYPE.DIRECT);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVD);
  });

  test('VA items show "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVA);
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
