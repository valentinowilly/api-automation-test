import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../helpers/pre-test.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { expireVendorAndRunCron } from '../helpers/workflow-actions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[V18] V18 — S3: VD accept, VA no action', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'no_action' }, { scenario: 's3' });
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVD);
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
  });
});
