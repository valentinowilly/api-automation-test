import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import { dicAccept } from '../../helpers/workflow-actions.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC23] S3 — DIC accept VD (S3 - VA Decline)
 *
 * Spreadsheet Reference (Row 74):
 * - Code         : DIC23
 * - Vendor input : VD accept (below OE), VA decline
 * - DIC Action   : Accept VD (S3 - VA Decline)
 * - UI VD        : Waiting Procurement
 * - UI VA        : No Quote
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Need Action
 * - Table Status : DIC_ACCEPTED (VD row, standard path)
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (DIRECT row)
 * - Rule 2: below-OE → DIC_ACCEPTED (10)
 * - Rule 4: VA declined → status_vendor=REJECT → "No Quote"
 */
describe('[DIC23] S3 — DIC accept VD (S3 - VA Decline)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'decline' }, { scenario: 's3' });
    await dicAccept(ctx.rfqNumber, ctx.dicToken, VENDOR_TYPE.DIRECT);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD);
  });

  test('VA items show "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken);
  });

  test('CS UI shows "Waiting CL"', async () => {
    // VD accepted below-OE → backend auto-creates QCF → CS sees "Waiting CL"
    await assertUIState(ctx.rfqNumber, 'cs', 'Waiting CL', ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting CS" (UI label). DB value after DIC accepts below-OE = DIC_ACCEPTED (10).
  test('table status is DIC_ACCEPTED (VD row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'DIC_ACCEPTED');
  });
});
