import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC7] S2 — DIC not yet action (S2 OE)
 *
 * Spreadsheet Reference (Row 58):
 * - Code         : DIC7
 * - DIC Action   : Not yet action (S2 OE)
 * - UI VD        : -
 * - UI VA        : Waiting User
 * - UI DIC       : Need Action
 * - UI CS        : Waiting User
 * - Table Status : Waiting User
 */
describe('[DIC07] S2 — DIC not yet action (S2 OE)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'decline', va: 'accept_oe' }, { scenario: 's2' });
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);



  test('VA items show "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
  });

  test('table status is WAITING_DIC_APPROVAL', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'WAITING_DIC_APPROVAL');
  });
});
