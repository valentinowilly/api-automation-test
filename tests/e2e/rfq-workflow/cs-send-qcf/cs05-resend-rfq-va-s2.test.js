import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import { csResendRFQ } from '../helpers/workflow-actions.helper.js';
import { getRFQItemsByVendorType } from '../../config-autopo/helpers/e2e-workflow.helper.js';
import {
  assertVendorTypeStatus,
  assertUIState,
  assertRFQMilestone,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[CS05] CS05 — Resend RFQ VA (S2)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCSStage({ vd: 'decline', va: 'decline' }, null, { scenario: 's2' });

    const vaItems = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR);
    const itemCodes = vaItems.map(item => ({ item_code: item.item_code }));

    await csResendRFQ(
      ctx.rfqNumber,
      vaItems[0].vendor_batch,
      vaItems[0].vendor_code,
      itemCodes,
      ctx.csToken
    );
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "No Quote"', async () => {
    await assertVendorTypeStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.NO_QUOTE);
  });

  test('VA UI shows "Need Action"', async () => {
    await assertVendorTypeStatus(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, UI_STATUS.NEED_ACTION);
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken);
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });
});