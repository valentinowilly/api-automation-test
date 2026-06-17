import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtDICStage } from '../../helpers/pre-test.helper.js';
import {
  assertRFQMilestone,
  assertUIState,
  UI_STATUS,
} from '../../helpers/state-assertions.helper.js';
import { VENDOR_TYPE } from '../../../../../utils/constants/milestone.constant.js';

/**
 * [DIC11] S3 — DIC not yet action (S3)
 *
 * Spreadsheet Reference (Row 62):
 * - Code         : DIC11
 * - DIC Action   : Not yet action (S3)
 * - UI VD        : Waiting User
 * - UI VA        : Waiting User
 * - UI DIC       : Need Action
 * - UI CS        : Waiting User
 * - Table Status : Waiting User
 */
describe('[DIC11] S3 — DIC not yet action (S3)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtDICStage({ vd: 'accept', va: 'accept' }, { scenario: 's3' });
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD items show "Waiting User"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_USER, ctx.vendorAccountTokenVD);
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

  test('table status is WAITING_DIC_APPROVAL', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'WAITING_DIC_APPROVAL');
  });
});
