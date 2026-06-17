import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import {
  assertRFQMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';

/**
 * [DIC2] S1 — DIC not yet action (S1 OE)
 *
 * Spreadsheet Reference (Row 53):
 * - Code         : DIC2
 * - VD Action    : (From Step: VD6) -> Accept (OE)
 * - DIC Action   : Not yet action (S1 OE)
 * - UI VD        : Waiting User
 * - UI DIC       : Need Action
 * - UI CS        : Waiting User
 * - Table Status : Waiting User
 */
describe('[DIC02] S1 — DIC not yet action (S1 OE)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept_oe' });
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('table status is WAITING_DIC_APPROVAL', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'WAITING_DIC_APPROVAL');
  });

  test('VD items all show "Waiting User" status', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVD);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
  });
});
