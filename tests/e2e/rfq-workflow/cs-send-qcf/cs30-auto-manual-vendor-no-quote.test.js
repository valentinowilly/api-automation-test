import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import { expireCSAndRunCron } from '../helpers/workflow-actions.helper.js';
import {
  assertUIState,
  assertRFQMilestone,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

/**
 * CS30 — Auto Manual Sourcing: Vendor No Quote
 *
 * UAT row (line 529):
 *   Config:            CS_expiry
 *   DIC Action:        auto manual sourcing  (both vendors declined → skipped DIC → went to CS)
 *   CS Action:         No Action
 *   UI VD:             Manual Sourcing
 *   UI VA:             Manual Sourcing
 *   UI DIC:            Manual Sourcing
 *   UI CS:             Manual Sourcing
 *   Table Status:      Manual Sourcing
 *   Auto Manual Reason: Auto Manual Vendor No Quote
 *   Next Step:         END
 *
 * Scenario: S3 — both VD and VA decline → no quote from either vendor →
 *   system advances directly to CS stage (skips DIC). CS takes no action →
 *   CS SLA expires → cron fires → "Auto Manual Vendor No Quote".
 */
describe('[CS30] CS30 — Auto manual sourcing (vendor no quote)', () => {
  let ctx;

  beforeAll(async () => {
    // S3: both VD and VA decline → skips DIC → CS stage reached
    // CS takes no action → expire CS token → cron sets Manual Sourcing
    ctx = await setupRFQAtCSStage({ vd: 'decline', va: 'decline' }, null, { 
      scenario: 's3',
      searchLibraryOverrides: { im_number: 'IM' + String(Math.floor(Math.random() * 9000000000) + 1000000000) }
    });

    await expireCSAndRunCron(ctx.rfqNumber, ctx.adminToken);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  // UAT: UI VD = Manual Sourcing
  test('VD UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.MANUAL_SOURCING, ctx.vendorAccountTokenVD, { pollTimeoutMs: 10000 });
  });

  // UAT: UI VA = Manual Sourcing
  test('VA UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.MANUAL_SOURCING, ctx.vendorAccountTokenVA, { pollTimeoutMs: 10000 });
  });

  // UAT: UI DIC = Manual Sourcing
  test('DIC UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.MANUAL_SOURCING, ctx.dicToken);
  });

  // UAT: UI CS = Manual Sourcing
  test('CS UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.MANUAL_SOURCING, ctx.csToken, { statusFilter: UI_STATUS.MANUAL_SOURCING });
  });

  // UAT: Table Status = Manual Sourcing → BID_MANUAL_SOURCING (6)
  test('table status is "Manual Sourcing"', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'BID_MANUAL_SOURCING');
  });
});
