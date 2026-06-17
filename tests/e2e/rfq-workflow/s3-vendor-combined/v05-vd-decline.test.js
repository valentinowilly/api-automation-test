import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStageS3 } from '../helpers/pre-test.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { vendorDecline } from '../helpers/workflow-actions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[V5] V5 — S3: VD decline, VA not yet action', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStageS3();
    await vendorDecline(ctx.rfqNumber, ctx.vendorTokenVD, VENDOR_TYPE.DIRECT);
  }, 120000);

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
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken, { vendorCode: ctx.vendorCodeVA });
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken, { vendorCode: ctx.vendorCodeVA });
  });
});
