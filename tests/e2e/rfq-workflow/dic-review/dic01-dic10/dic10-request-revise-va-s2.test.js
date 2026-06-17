import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicRequestRevise } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC10] S2 — DIC request revise VA (S2)
 *
 * Spreadsheet Reference (Row 61):
 * - Code         : DIC10
 * - DIC Action   : Request Revise VA (S2)
 * - UI VD        : -
 * - UI VA        : Need Action
 * - UI DIC       : Waiting Vendor
 * - UI CS        : Waiting Vendor
 * - Table Status : DIC_REQUEST_REVISE (Waiting Vendor)
 */
describe('[DIC10] S2 — DIC request revise VA (S2)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'decline', va: 'accept' }, { scenario: 's2' });
    await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, 'E2E Test: Request Revise VA', VENDOR_TYPE.AGGREGATOR);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VA items show "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken);
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });

  test('table status is DIC_REQUEST_REVISE', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'DIC_REQUEST_REVISE');
  });
});
