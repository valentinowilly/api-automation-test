import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStageS3 } from '../helpers/pre-test.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { vendorNeedConfirm, expireVendorAndRunCron } from '../helpers/workflow-actions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[V36] V36 — S3: VD no action, VA need confirm', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStageS3();
    await vendorNeedConfirm(ctx.rfqNumber, ctx.vendorTokenVA, VENDOR_TYPE.AGGREGATOR);
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.csToken, { skipDICTokenPoll: true });
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD, { pollTimeoutMs: 15000 });
  });

  test('VA UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken, { pollTimeoutMs: 15000 });
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken, { pollTimeoutMs: 15000 });
  });
});
