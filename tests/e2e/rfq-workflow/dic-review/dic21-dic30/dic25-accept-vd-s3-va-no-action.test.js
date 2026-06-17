import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicAccept, expireVendorAndRunCron } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC25] S3 — DIC accept VD (S3 - VA No Action)
 *
 * Spreadsheet Reference (Row 76):
 * - Code         : DIC25
 * - Vendor input : VD accept (below OE), VA no_action
 * - DIC Action   : Accept VD (S3 - VA No Action)
 * - UI VD        : Waiting Procurement
 * - UI VA        : Need Action  ← Spreadsheet says "Waiting Procurement" but actual
 *                                 backend: no_action → status_vendor=0 → "Need Action"
 *                                 (Issue 9 in dic-review-test-reference.md)
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Waiting CL
 * - Table Status : DIC_ACCEPTED (VD row, standard path)
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (DIRECT row)
 * - Rule 2: below-OE → DIC_ACCEPTED (10)
 * - Issue 9: no_action vendor → status_vendor=PENDING(0) → UI shows "Need Action"
 */
describe('[DIC25] S3 — DIC accept VD (S3 - VA No Action)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'no_action' }, { scenario: 's3' });
    // no_action = VA token expired; expire it in DB then run cron to trigger DIC email
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken);
    await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.DIRECT);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD);
  });

  test('VA items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken);
  });

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', 'Waiting CL', ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting CS" (UI label). DB value after DIC accepts below-OE = DIC_ACCEPTED (10).
  test('table status is DIC_ACCEPTED (VD row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'DIC_ACCEPTED');
  });
});
