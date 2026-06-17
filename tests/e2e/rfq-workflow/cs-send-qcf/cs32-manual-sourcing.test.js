import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtCSStage } from '../helpers/pre-test.helper.js';
import { csManualSourcing } from '../helpers/workflow-actions.helper.js';
import { getRFQItemsByVendorType } from '../../config-autopo/helpers/e2e-workflow.helper.js';
import {
  assertUIState,
  assertRFQMilestone,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

/**
 * CS32 — CS Manual Sourcing (button click)
 *
 * UAT row (line 532):
 *   Config:         CS_expiry
 *   DIC Action:     button manual sourcing  (CS explicitly clicks the button)
 *   CS Action:      Manual Sourcing
 *   UI VD:          Manual Sourcing
 *   UI VA:          Manual Sourcing
 *   UI DIC:         Manual Sourcing
 *   UI CS:          Manual Sourcing
 *   Table Status:   Manual Sourcing
 *   Sample Data:    S1: RFQ0004073 | S3: RFQ0004066
 *   Next Step:      END
 *   UAT Notes:      "UI CS: declined item tidak perlu ditampilkan"
 *
 * Scenario: S1 — VD accepts → DIC accepts VD → CS stage reached →
 *   CS clicks "Manual Sourcing" button (POST /pr/cs/send_isourcing/:rfq_number/:vendor_batch).
 *   This is a manual intentional action, NOT auto-expiry.
 *
 * The UAT was tested on both S1 and S3. We cover S1 here as the baseline.
 * All four roles (VD, VA not present in S1, DIC, CS) show "Manual Sourcing".
 *
 * UAT Notes observed issue: "Issue: Manual Sourcing" — popup error was visible but
 *   status still changed correctly. This test validates the final state, not the UI popup.
 *
 * NOTE on VD assertion: After csManualSourcing(), milestone drops to BID_MANUAL_SOURCING (6).
 *   assertVendorItemsUIStatus maps APPROVE + milestone < DIC_ACCEPTED(10) → 'Waiting User'.
 *   Must use assertUIState (real vendor dashboard API) to get the correct label.
 */
describe('[CS32] CS32 — CS manual sourcing (button click)', () => {
  let ctx;

  beforeAll(async () => {
    // S1: VD accepts below OE → DIC accepts VD → CS stage reached
    ctx = await setupRFQAtCSStage({ vd: 'accept' }, 'accept_vd', { 
      scenario: 's1',
      searchLibraryOverrides: { im_number: 'IM' + String(Math.floor(Math.random() * 9000000000) + 1000000000) }
    });

    // CS clicks the "Manual Sourcing" button for the VD vendor batch
    const vdItems = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT);
    if (!vdItems.length) throw new Error(`No VD items found for RFQ ${ctx.rfqNumber}`);
    const vendorBatch = vdItems[0].vendor_batch;
    const items = vdItems.map(i => ({ id: i.id }));

    await csManualSourcing(ctx.rfqNumber, vendorBatch, items, ctx.csToken);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  // UAT: UI VD = Manual Sourcing
  test('VD UI shows "Manual Sourcing"', async () => {
    // Must use assertUIState: DB mapping cannot derive "Manual Sourcing" from
    // status_vendor=APPROVE + milestone=BID_MANUAL_SOURCING(6) < DIC_ACCEPTED(10)
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.MANUAL_SOURCING, ctx.vendorAccountTokenVD, { pollTimeoutMs: 10000 });
  });

  // UAT: UI DIC = Manual Sourcing
  test('DIC UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.MANUAL_SOURCING, ctx.dicToken);
  });

  // UAT: UI CS = Manual Sourcing
  test('CS UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.MANUAL_SOURCING, ctx.csToken, { statusFilter: UI_STATUS.MANUAL_SOURCING });
  });

  // UAT: Table Status = Manual Sourcing → MANUAL_SOURCING (12)
  test('table status is "Manual Sourcing"', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'MANUAL_SOURCING');
  });
});
