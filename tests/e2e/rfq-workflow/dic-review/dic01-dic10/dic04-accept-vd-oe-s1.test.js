import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicAccept } from '../../helpers/workflow-actions.helper.js';
import {
  assertRFQMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';

/**
 * [DIC4] S1 — DIC accept VD (OE S1)
 *
 * Spreadsheet Reference (Row 55):
 * - Code         : DIC4
 * - DIC Action   : Accept VD (OE S1)
 * - UI VD        : Waiting Procurement
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Need Action
 * - Table Status : Need Action
 */
describe('[DIC04] S1 — DIC accept VD (OE S1)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept_oe' });
    await dicAccept(ctx.rfqNumber, ctx.dicToken);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items all show "Waiting Procurement" status', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken);
  });

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });

  test('table status is WAITING_OE_REVISION', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'WAITING_OE_REVISION');
  });
});
