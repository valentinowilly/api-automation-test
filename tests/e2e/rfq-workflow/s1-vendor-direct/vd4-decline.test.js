import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStage, getVendorAccountToken } from '../helpers/pre-test.helper.js';
import { vendorDecline } from '../helpers/workflow-actions.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[VD4] S1 — Vendor Direct: decline', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStage({ scenario: 's1' });
    await vendorDecline(ctx.rfqNumber, ctx.vendorTokenVD);
    ctx.vendorAccountTokenVA = await getVendorAccountToken(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, ctx.adminToken);
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVD);
  });

  test('VA UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken);
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });
});