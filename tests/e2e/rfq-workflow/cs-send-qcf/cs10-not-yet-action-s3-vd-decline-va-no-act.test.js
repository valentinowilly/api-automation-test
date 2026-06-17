import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';

describe('[CS10] CS10 — Not yet action (S3 - VD Decline, VA NO Act)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCSStage({ vd: 'decline', va: 'no_action' }, null, { scenario: 's3', skipDICTokenPoll: true });
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVD);
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA, { pollTimeoutMs: 15000 });
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken, { pollTimeoutMs: 15000 });
  });

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });
});