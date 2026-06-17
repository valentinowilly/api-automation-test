import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicAcceptVADeclineVD } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC27] S3 — DIC accept VA (S3)
 *
 * Spreadsheet Reference (Row 78):
 * - Code         : DIC27
 * - Vendor input : VD accept (below OE), VA accept (below OE)
 * - DIC Action   : Accept VA (S3)
 * - UI VD        : Waiting Procurement
 * - UI VA        : Waiting Procurement
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Waiting CL
 * - Table Status : DIC_ACCEPTED (VA row, standard path)
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (AGGREGATOR row checked)
 * - Rule 2: below-OE → DIC_ACCEPTED (10)
 * - Note: 'Waiting CL' is a string literal — UI_STATUS.WAITING_CL does not exist
 */
describe('[DIC27] S3 — DIC accept VA (S3)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'accept' }, { scenario: 's3' });
    await dicAcceptVADeclineVD(ctx.rfqNumber, ctx.dicToken);
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
  test('table status is DIC_ACCEPTED (VA row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'DIC_ACCEPTED');
  });
});
