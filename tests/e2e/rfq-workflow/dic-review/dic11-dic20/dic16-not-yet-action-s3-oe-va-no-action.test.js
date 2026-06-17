import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { expireVendorAndRunCron } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC16] S3 — DIC not yet action (S3 OE - VA No Action)
 *
 * Spreadsheet Reference (Row 67):
 * - Code         : DIC16
 * - DIC Action   : Not yet action (S3 OE - VA No Action)
 * - UI VD        : Waiting User   (VD submitted OE → status_vendor=APPROVE, milestone=WAITING_DIC_APPROVAL)
 * - UI VA        : Need Action    (VA no_action → status_vendor=PENDING(0))
 * - UI DIC       : Waiting Vendor (VA hasn't submitted → DIC sees incomplete)
 * - UI CS        : Waiting User
 * - Table Status : Waiting DIC Approval (VD row, milestone=3)
 *
 * Note: Spreadsheet shows "Waiting Procurement"/"Need Action" for VA/DIC UI but actual
 * backend behavior: no_action vendor → "Need Action"; DIC UI → "Waiting Vendor".
 */
describe('[DIC16] S3 — DIC not yet action (S3 OE - VA No Action)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept_oe', va: 'no_action' }, { scenario: 's3' });
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVD);
  });

  test('VA items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
  });

  test('table status is WAITING_DIC_APPROVAL (VD row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'WAITING_DIC_APPROVAL');
  });
});
