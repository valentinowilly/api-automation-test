import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStageS3 } from '../helpers/pre-test.helper.js';
import {
  assertUIState,
  UI_STATUS,
} from '../helpers/state-assertions.helper.js';
import { expireVendorAndRunCron } from '../helpers/workflow-actions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';
import { executeQuery } from '../../../../utils/helpers/db.helper.js';

describe('[V38] V38 — S3: VD no action, VA no action', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStageS3();
    // In S3, both VD and VA use 'Waiting_vendor_expiry'. Expire VD's token in DB first
    // so both tokens are expired before a single cron run, matching production nightly cron behaviour.
    await executeQuery(
      `UPDATE rfq_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
       WHERE rfq_number = ? AND user_type = 'vendor' AND vendor_code = ? AND config_condition = 'Waiting_vendor_expiry'`,
      [ctx.rfqNumber, ctx.vendorCodeVD]
    );
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.csToken, { skipDICTokenPoll: true });
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVD, { pollTimeoutMs: 15000 });
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.WAITING_PROCUREMENT, ctx.vendorAccountTokenVA, { pollTimeoutMs: 15000 });
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken, { pollTimeoutMs: 15000 });
  });

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.NEED_ACTION, ctx.csToken);
  });
});
