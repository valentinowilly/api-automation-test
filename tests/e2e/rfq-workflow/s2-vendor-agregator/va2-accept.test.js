import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStageS2 } from '../helpers/pre-test.helper.js';
import { vendorAccept } from '../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[VA2] S2 — Vendor Aggregator: accept', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStageS2();
    await vendorAccept(ctx.rfqNumber, ctx.vendorTokenVA, VENDOR_TYPE.AGGREGATOR);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVD);
  });

  test('VA UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
  });
});
