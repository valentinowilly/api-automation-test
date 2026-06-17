import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import { csResendRFQ } from '../helpers/workflow-actions.helper.js';
import { getRFQItemsByVendorType } from '../../config-autopo/helpers/e2e-workflow.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[CS12] CS12 — Resend RFQ VD (S3 - VA Decline)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCSStage({ vd: 'decline', va: 'decline' }, null, { scenario: 's3' });

    const vdItems = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT);
    const itemCodes = vdItems.map(item => ({ item_code: item.item_code }));

    await csResendRFQ(
      ctx.rfqNumber,
      vdItems[0].vendor_batch,
      vdItems[0].vendor_code,
      itemCodes,
      ctx.csToken
    );
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVD, { pollTimeoutMs: 15000 });
  });

  test('VA UI shows "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken, { pollTimeoutMs: 15000 });
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });
});