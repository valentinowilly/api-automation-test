import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import {
  assertVendorTypeMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC17] S3 — DIC not yet action (S3 - VD Decline)
 *
 * Spreadsheet Reference (Row 68):
 * - Code         : DIC17
 * - DIC Action   : Not yet action (S3 - VD Decline)
 * - UI VD        : No Quote
 * - UI VA        : Waiting User
 * - UI DIC       : Need Action
 * - UI CS        : Waiting User
 * - Table Status : Waiting User
 */
describe('[DIC17] S3 — DIC not yet action (S3 - VD Decline)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'decline', va: 'accept' }, { scenario: 's3' });
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NO_QUOTE, ctx.vendorAccountTokenVD);
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
