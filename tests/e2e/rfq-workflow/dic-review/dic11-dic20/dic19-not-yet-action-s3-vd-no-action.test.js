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
 * [DIC19] S3 — DIC not yet action (S3 - VD No Action)
 *
 * Spreadsheet Reference (Row 70):
 * - Code         : DIC19
 * - DIC Action   : Not yet action (S3  - VD No Action)
 * - UI VD        : Need Action    (VD no_action → status_vendor=PENDING(0))
 * - UI VA        : Waiting User   (VA submitted → status_vendor=APPROVE, milestone=WAITING_DIC_APPROVAL)
 * - UI DIC       : Waiting Vendor (VD hasn't submitted → DIC sees incomplete)
 * - UI CS        : Waiting User
 * - Table Status : Waiting DIC Approval (VA row, milestone=3)
 *
 * Note: Spreadsheet shows "Waiting Procurement"/"Need Action" for VD/DIC UI but actual
 * backend behavior: no_action vendor → "Need Action"; DIC UI → "Waiting Vendor".
 */
describe('[DIC19] S3 — DIC not yet action (S3 - VD No Action)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'no_action', va: 'accept' }, { scenario: 's3' });
    // In S3, both VD and VA use config_condition='Waiting_vendor_expiry' (parallel flow).
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD);
  });

  test('VA items show "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.NEED_ACTION, ctx.dicToken);
  });

  test('CS UI shows "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_USER, ctx.csToken);
  });

  test('table status is WAITING_DIC_APPROVAL (VA row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, 'WAITING_DIC_APPROVAL');
  });
});
