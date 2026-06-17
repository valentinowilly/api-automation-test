import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStage } from '../helpers/pre-test.helper.js';
import {
  assertRFQMilestone,
  assertUIState,
  assertVendorTokenExists,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';

describe('[VD1] S1 — Vendor Direct: no action yet', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStage({ scenario: 's1' });
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVD);
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken);
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });
});
