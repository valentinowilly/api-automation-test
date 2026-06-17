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
 * [DIC26] S3 — DIC accept VD (OE S3 - VA No Action)
 *
 * Spreadsheet Reference (Row 77):
 * - Code         : DIC26
 * - Vendor input : VD accept_oe (above OE), VA no_action
 * - DIC Action   : Accept VD (OE S3 - VA No Action)
 * - UI VD        : Waiting Procurement (DIC accepted VD, OE path → milestone ≥ 10)
 * - UI VA        : Need Action (no_action → status_vendor=0; Issue 9 in reference doc)
 * - UI DIC       : Waiting Procurement
 * - UI CS        : Need Action
 * - Table Status : WAITING_OE_REVISION (VD row, above-OE path)
 *
 * Rules applied from dic-review-test-reference.md:
 * - Rule 1: S3 → assertVendorTypeMilestone (DIRECT row)
 * - Rule 2: above-OE → WAITING_OE_REVISION (14)
 * - Issue 9: no_action vendor → "Need Action" (spreadsheet says "Waiting Procurement" — incorrect)
 */
describe('[DIC26] S3 — DIC accept VD (OE S3 - VA No Action)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept_oe', va: 'no_action' }, { scenario: 's3' });
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

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });

  // Spreadsheet col Q = "Waiting CS" (UI label). DB value after DIC accepts above-OE = WAITING_OE_REVISION (14).
  test('table status is WAITING_OE_REVISION (VD row)', async () => {
    await assertVendorTypeMilestone(ctx.rfqNumber, VENDOR_TYPE.DIRECT, 'WAITING_OE_REVISION');
  });
});
