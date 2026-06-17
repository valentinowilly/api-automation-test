import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { expireDICAndRunCron } from '../../helpers/workflow-actions.helper.js';
import {
  assertRFQMilestone,
  assertUIState,
} from '../../helpers/state-assertions.helper.js';

/**
 * [DIC39] S3 — DIC no action (Manual Sourcing)
 *
 * Spreadsheet Reference (Row 90):
 * - Code         : DIC39
 * - Vendor input : VD accept, VA accept
 * - DIC Action   : No Action (DIC email token expired → cron converts to Manual Sourcing)
 * - UI VD        : Manual Sourcing
 * - UI VA        : Manual Sourcing
 * - UI DIC       : Manual Sourcing
 * - UI CS        : Manual Sourcing
 * - Table Status : Manual Sourcing
 *
 * Flow:
 * 1. Both vendors accept → backend automatically creates DIC email token
 * 2. DIC email token is expired in DB then DIC cron runs
 *    → backend converts RFQ to Manual Sourcing state
 *
 * Note: 'Manual Sourcing' is used as a string literal — not in UI_STATUS constants.
 * assertRFQMilestone('MANUAL_SOURCING') is left as test.todo until milestone constant is confirmed.
 */
describe('[DIC39] S3 — DIC no action (Manual Sourcing)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'accept' }, { scenario: 's3' });
    await expireDICAndRunCron(ctx.rfqNumber, ctx.csToken);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', 'Manual Sourcing', ctx.vendorAccountTokenVD);
  });

  test('VA items show "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', 'Manual Sourcing', ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', 'Manual Sourcing', ctx.dicToken);
  });

  test('CS UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', 'Manual Sourcing', ctx.csToken);
  });

  test('table status is MANUAL_SOURCING', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'MANUAL_SOURCING');
  });
});
