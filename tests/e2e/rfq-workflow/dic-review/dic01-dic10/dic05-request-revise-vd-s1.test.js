import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicRequestRevise } from '../../helpers/workflow-actions.helper.js';
import {
  assertRFQMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';

/**
 * [DIC5] S1 — DIC request revise VD (S1)
 *
 * Spreadsheet Reference (Row 56):
 * - Code         : DIC5
 * - DIC Action   : Request Revise VD (S1)
 * - UI VD        : Need Action
 * - UI DIC       : Waiting Vendor
 * - UI CS        : Waiting Vendor
 * - Table Status : Waiting Vendor
 */
describe('[DIC05] S1 — DIC request revise VD (S1)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept' });
    await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'E2E Test: Request Revise VD');
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items all show "Need Action" status', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVD);
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken);
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });

  test('table status is DIC_REQUEST_REVISE', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'DIC_REQUEST_REVISE');
  });
});
