import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import {
  assertVendorTypeStatus,
  assertVendorItemsUIStatus,
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[CS02] CS02 — Not yet action (S2)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCSStage({ vd: 'decline', va: 'accept' }, 'accept_va', { scenario: 's2' });
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "No Quote"', async () => {
    await assertVendorTypeStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.NO_QUOTE);
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, UI_STATUS.WAITING_PROCUREMENT);
  });

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_CL, ctx.csToken);
  });

  test('CL UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cl', UI_STATUS.NEED_ACTION, ctx.clToken);
  });
});
