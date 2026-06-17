import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStage } from '../helpers/pre-test.helper.js';
import { vendorAcceptOE } from '../helpers/workflow-actions.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';

describe('[VD6] S1 — Vendor Direct: accept with OE-exceeding price', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStage({ scenario: 's1' });
    await vendorAcceptOE(ctx.rfqNumber, ctx.vendorTokenVD);
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVD);
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
  });
});
