import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStageMixed } from '../../helpers/pre-test.helper.js';
import {
  assertRFQMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';

/**
 * DIC1 — Not yet action (S1)
 *
 * Spreadsheet row 52 | From Step: VD2, VD3 (accept + need_confirm)
 *
 * Setup: S1 PR with 3 line items submitted by vendor direct with mixed statuses:
 *   - Item 1: accept (below OE)
 *   - Item 2: accept_oe (above OE)
 *   - Item 3: need_confirm
 * DIC has not yet acted.
 */
describe('[DIC01] S1 — DIC not yet action (3 items: accept / accept_oe / need_confirm)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStageMixed();
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
