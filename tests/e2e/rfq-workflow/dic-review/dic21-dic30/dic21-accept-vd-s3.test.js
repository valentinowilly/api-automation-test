import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicAcceptVDDeclineVA } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC21] S3 — DIC accept VD (S3)
 *
 * Spreadsheet Reference (Row 72):
 * - Code         : DIC21
 * - Vendor input : VD accept, VA accept (both below OE)
 * - DIC Action   : Accept VD (S3)
 * - UI VD        : Waiting Procurement
 * - UI VA        : Waiting Procurement
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Waiting CL
 * - Table Status : DIC_ACCEPTED (VD row, standard path)
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → use assertVendorTypeMilestone (DIRECT row checked)
 * - Rule 2: below-OE → DIC_ACCEPTED (10)
 * - Rule 5: import assertVendorTypeMilestone for S3
 */
describe('[DIC21] S3 — DIC accept VD (S3)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'accept' }, { scenario: 's3' });
    await dicAcceptVDDeclineVA(ctx.rfqNumber, ctx.dicToken);
  }, 90000);

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
  test('table status is DIC_ACCEPTED (VD row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'DIC_ACCEPTED');
  });
});
