import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStage } from '../helpers/pre-test.helper.js';
import { vendorNeedConfirm } from '../helpers/workflow-actions.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';

describe('[VD3] S1 — Vendor Direct: needs confirmation', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStage({ scenario: 's1' });
    await vendorNeedConfirm(ctx.rfqNumber, ctx.vendorTokenVD);
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVD);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
  });
});
