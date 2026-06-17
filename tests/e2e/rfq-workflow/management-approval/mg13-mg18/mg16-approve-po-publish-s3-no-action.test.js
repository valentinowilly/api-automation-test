import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { setupRFQAtVendorStage, setupRFQAtManagementStage } from '../../helpers/pre-test.helper.js';
import { assertRFQMilestone, assertUIState, assertQCFManagementApproved } from '../../helpers/state-assertions.helper.js';
import { managementApprove } from '../../helpers/workflow-actions.helper.js';
import { STATUS_MILESTONE } from '../../../../../utils/constants/milestone.constant.js';

describe('[MG16] MG16 — Management approve → PO Publish S3 (VD decline, VA accept)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtManagementStage({ vd: 'decline', va: 'accept' }, 'accept_va', {}, {}, { scenario: 's3' });
    await managementApprove(ctx.qcfNumber, ctx.mgToken);
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "No Quote"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', 'No Quote', ctx.vendorAccountTokenVD);
  });

  test('VA UI shows "PO Published"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', 'PO Published', ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "PO Published"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', 'PO Published', ctx.dicToken);
  });

  test('CS UI shows "PO Published"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', 'PO Published', ctx.csToken);
  });

  test('CL UI shows "PO Published"', async () => {
    await assertUIState(ctx.qcfNumber, 'cl', 'PO Published', ctx.clToken);
  });

  test('MG UI shows "PO Published"', async () => {
    await assertUIState(ctx.qcfNumber, 'mg', 'PO Published', ctx.mgToken);
  });

  test('table status is QCF_MANAGEMENT_APPROVED', async () => {
    await assertQCFManagementApproved(ctx.rfqNumber);
  });
});
