import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import {
  assertVendorItemsUIStatus,
  assertVendorTypeNotExists,
  assertUIState,
  assertRFQMilestone,
  assertCSTokenItemIdsFormat,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[CS27] CS27 — Revisi OE', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCSStage({ vd: 'accept_oe' }, 'accept_vd');
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting Procurement"', async () => {
    await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.WAITING_PROCUREMENT);
  });

  test('VA should not exist in S1', async () => {
    await assertVendorTypeNotExists(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken, { pollTimeoutMs: 15000 });
  });

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });

  test('table status is WAITING_OE_REVISION', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'WAITING_OE_REVISION');
  });

  test('CS email token contains clean integer item IDs', async () => {
    await assertCSTokenItemIdsFormat(ctx.rfqNumber);
  });
});
