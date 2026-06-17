import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicAccept } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC8] S2 — DIC accept VA (S2)
 *
 * Spreadsheet Reference (Row 59):
 * - Code         : DIC8
 * - DIC Action   : Accept VA (S2)
 * - UI VD        : -
 * - UI VA        : Waiting Procurement
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Waiting CL
 * - Table Status : Need Action (using QCF_PENDING_CS for Need Action or QCF_PENDING_CL depending on mismatch)
 */
describe('[DIC08] S2 — DIC accept VA (S2)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'decline', va: 'accept' }, { scenario: 's2' });
    await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.AGGREGATOR);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);



  test('VA items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken);
  });

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', 'Waiting CL', ctx.csToken);
  });

  test('table status is DIC_ACCEPTED', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'DIC_ACCEPTED');
  });
});
