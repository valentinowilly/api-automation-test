import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicRequestReviseVDDeclineVA } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC33] S3 — DIC request revise VD (S3)
 *
 * Spreadsheet Reference (Row 84):
 * - Code         : DIC33
 * - Vendor input : VD accept (below OE), VA accept (below OE)
 * - DIC Action   : Request Revise VD (S3)
 * - UI VD        : Need Action   (dicRequestRevise resets status_vendor=0)
 * - UI VA        : Waiting Procurement (spreadsheet col J; dicRequestRevise on VD may promote VA to DIC_ACCEPTED)
 * - UI DIC       : Waiting Vendor (VD sent back for revision → DIC waits for VD resubmit)
 * - UI CS        : Waiting Vendor (VD is direct vendor, not yet resubmitted)
 * - Table Status : Spreadsheet col Q = "Waiting Vendor" (UI label).
 *                  DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (DIRECT row checked — revision targets VD)
 * - Milestone ref table: DIC_REQUEST_REVISE = 9
 * - After dicRequestRevise, backend resets status_vendor = NO_ACTION (0) for VD items
 */
describe('[DIC33] S3 — DIC request revise VD (S3)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'accept' }, { scenario: 's3' });
    await dicRequestReviseVDDeclineVA(ctx.rfqNumber, ctx.dicToken);
  }, 90000);

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
    // VD sent back for revision → DIC waits for VD resubmission
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken);
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    // CS tracks direct vendor (VD). VD in revision state → "Waiting Vendor"
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting Vendor" (UI label). DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
  test('table status is DIC_REQUEST_REVISE (VD row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'DIC_REQUEST_REVISE');
  });
});
