import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStageS2 } from '../helpers/pre-test.helper.js';
import { assertUIState, UI_STATUS } from '../helpers/state-assertions.helper.js';
import { expireVendorAndRunCron } from '../helpers/workflow-actions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[VA5] S2 — Vendor Aggregator: no action (token expired)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStageS2();
    // VD already declined (No Quote). VA expired without submitting → no DIC email token.
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken, {
      skipDICTokenPoll: true,
    });
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVD);
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA, {
      pollTimeoutMs: 15000,
    });
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken, {
      pollTimeoutMs: 15000,
    });
  });

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });
});
