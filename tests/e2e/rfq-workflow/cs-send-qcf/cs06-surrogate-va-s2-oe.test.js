import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCLStage } from '../helpers/pre-test.helper.js';
import {
  assertVendorItemsUIStatus,
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[CS06] CS06 — Surrogate VA (S2 OE)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCLStage(
      { vd: 'decline', va: 'accept_oe' },
      'accept_va',
      { steps: ['send_surrogate', 'send_to_qcf'], vendorType: VENDOR_TYPE.AGGREGATOR },
      { scenario: 's2' }
    );
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  // TODO: need to confirm, because current status is no quote
  test('VD UI shows "Waiting Procurement"', async () => {
    await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.WAITING_PROCUREMENT);
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, UI_STATUS.WAITING_PROCUREMENT);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken);
  });

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_CL, ctx.csToken);
  });
});