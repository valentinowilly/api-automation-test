import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import {
  assertVendorTypeStatus,
  assertVendorItemsUIStatus,
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[CS03] CS03 — Not yet action (S2 OE)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCSStage({ vd: 'decline', va: 'accept_oe' }, 'accept_va', { scenario: 's2' });
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

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken);
  });

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });
});