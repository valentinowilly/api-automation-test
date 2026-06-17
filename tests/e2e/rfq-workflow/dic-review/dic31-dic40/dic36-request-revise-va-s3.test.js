import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicRequestReviseVADeclineVD } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC36] S3 — DIC request revise VA (S3)
 *
 * Spreadsheet Reference (Row 87):
 * - Code         : DIC36
 * - Vendor input : VD accept (below OE), VA accept (below OE)
 * - DIC Action   : Request Revise VA (S3)
 * - UI VD        : Waiting Procurement (VD submitted & accepted by DIC; unaffected by VA revision)
 * - UI VA        : Need Action   (dicRequestRevise resets VA status_vendor=0)
 * - UI DIC       : Waiting Vendor (VA sent back for revision → DIC waits for VA resubmit)
 * - UI CS        : Waiting Vendor
 * - Table Status : Spreadsheet col Q = "Waiting Vendor" (UI label).
 *                  DB value after dicRequestRevise = DIC_REQUEST_REVISE (9).
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (AGGREGATOR row checked — revision targets VA)
 * - Milestone ref table: DIC_REQUEST_REVISE = 9
 * - After dicRequestRevise(AGGREGATOR), backend resets status_vendor = NO_ACTION (0) for VA items
 */
describe('[DIC36] S3 — DIC request revise VA (S3)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'accept' }, { scenario: 's3' });
    await dicRequestReviseVADeclineVD(ctx.rfqNumber, ctx.dicToken);
  }, 90000);

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
    // VA sent back for revision → DIC waits for VA resubmission
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
