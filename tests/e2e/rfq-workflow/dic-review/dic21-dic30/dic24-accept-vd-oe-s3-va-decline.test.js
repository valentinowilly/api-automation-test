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
 * [DIC24] S3 — DIC accept VD (OE S3 - VA Decline)
 *
 * Spreadsheet Reference (Row 75):
 * - Code         : DIC24
 * - Vendor input : VD accept_oe (above OE), VA decline
 * - DIC Action   : Accept VD (OE S3 - VA Decline)
 * - UI VD        : Waiting Procurement
 * - UI VA        : No Quote
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Need Action
 * - Table Status : WAITING_OE_REVISION (VD row, OE path)
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (DIRECT row)
 * - Rule 2: above-OE → WAITING_OE_REVISION (14)
 * - Rule 4: VA declined → status_vendor=REJECT → "No Quote"
 */
describe('[DIC24] S3 — DIC accept VD (OE S3 - VA Decline)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept_oe', va: 'decline' }, { scenario: 's3' });
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

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting CS" (UI label). DB value after DIC accepts above-OE = WAITING_OE_REVISION (14).
  test('table status is WAITING_OE_REVISION (VD row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'WAITING_OE_REVISION');
  });
});
