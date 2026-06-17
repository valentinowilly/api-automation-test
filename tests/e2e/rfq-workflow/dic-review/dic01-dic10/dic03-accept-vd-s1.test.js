import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicAccept } from '../../helpers/workflow-actions.helper.js';
import {
  assertRFQMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';

/**
 * [DIC3] S1 — DIC accept VD (S1)
 *
 * Spreadsheet Reference (Row 54):
 * - Code         : DIC3
 * - DIC Action   : Accept VD (S1)
 * - UI VD        : Waiting Procurement
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Waiting CL
 * - Table Status : Waiting CL
 */
describe('[DIC03] S1 — DIC accept VD (S1)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept' });
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

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', 'Waiting CL', ctx.csToken);
  });

  test('table status is DIC_ACCEPTED', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'DIC_ACCEPTED');
  });
});
