import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCLStage } from '../helpers/pre-test.helper.js';
import {
  assertVendorItemsUIStatus,
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[CS22] CS22 — Surrogate VD (VA Decline)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCLStage(
      { vd: 'accept_oe', va: 'decline' },
      'accept_vd',
      { steps: ['send_surrogate', 'send_to_qcf'], vendorType: VENDOR_TYPE.DIRECT },
      { scenario: 's3' }
    );
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting Procurement"', async () => {
    await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.WAITING_PROCUREMENT);
  });

  test('VA UI shows "No Quote"', async () => {
    await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, UI_STATUS.NO_QUOTE);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken, { pollTimeoutMs: 15000 });
  });

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_CL, ctx.csToken);
  });

  test('CL UI shows "Need Action"', async () => {
    expect(ctx.qcfNumber).toBeDefined();
    await assertUIState(ctx.qcfNumber, 'cl', UI_STATUS.NEED_ACTION, ctx.clToken);
  });
});