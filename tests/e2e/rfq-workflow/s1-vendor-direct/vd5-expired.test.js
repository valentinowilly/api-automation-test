import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStage, getVendorAccountToken, getActiveVendorToken } from '../helpers/pre-test.helper.js';
import { assertUIState, UI_STATUS } from '../helpers/state-assertions.helper.js';
import { expireVendorAndRunCron } from '../helpers/workflow-actions.helper.js';
import { VENDOR_TYPE } from '../../../../utils/constants/milestone.constant.js';

describe('[VD5] S1 — Vendor Direct: no action (token expired)', () => {
  let ctx;
  let vendorAccountTokenVA;

  beforeAll(async () => {
    ctx = await setupRFQAtVendorStage({ scenario: 's1' });
    // VD expires in S1 → backend cron (stage=vendor_direct) upgrades to S3 parallel mode:
    // sets vendor_sequence=3, creates new VA token, sends invitations to both VD and VA.
    // No DIC email token is created (new vendor round, not DIC stage).
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.DIRECT, ctx.csToken, {
      skipDICTokenPoll: true,
    });
    // Poll for VA token created by the S3 upgrade (async backend processing)
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const vaToken = await getActiveVendorToken(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR);
      if (vaToken) break;
      await new Promise(r => setTimeout(r, 500));
    }
    vendorAccountTokenVA = await getVendorAccountToken(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, ctx.adminToken);
  }, 120000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', UI_STATUS.NEED_ACTION, ctx.vendorAccountTokenVD, {
      pollTimeoutMs: 15000,
    });
  });

  test('VA UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', UI_STATUS.NEED_ACTION, vendorAccountTokenVA, {
      pollTimeoutMs: 15000,
    });
  });

  test('DIC UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', UI_STATUS.WAITING_VENDOR, ctx.dicToken, {
      pollTimeoutMs: 15000,
    });
  });

  test('CS UI shows "Waiting Vendor"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', UI_STATUS.WAITING_VENDOR, ctx.csToken);
  });
});
