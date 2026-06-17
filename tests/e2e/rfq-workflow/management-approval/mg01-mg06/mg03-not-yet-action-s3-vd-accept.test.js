import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtManagementStage } from '../../helpers/pre-test.helper.js';
import { assertQCFCLApproved, assertUIState } from '../../helpers/state-assertions.helper.js';

describe('[MG03] MG03 — Management not yet action S3 (VD accept, VA accept, DIC chose VD)', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtManagementStage({ vd: 'accept', va: 'accept' }, 'accept_vd', {}, {}, { scenario: 's3' });
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', 'Waiting Procurement', ctx.vendorAccountTokenVD);
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', 'Waiting Procurement', ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', 'Waiting Procurement', ctx.dicToken);
  });

  test('CS UI shows "Waiting Management"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', 'Waiting Management', ctx.csToken);
  });

  test('CL UI shows "Waiting Management"', async () => {
    await assertUIState(ctx.qcfNumber, 'cl', 'Waiting Management', ctx.clToken);
  });

  test('MG UI shows "Need Action"', async () => {
    await assertUIState(ctx.qcfNumber, 'mg', 'Need Action', ctx.mgToken);
  });

  test('QCF is CL approved', async () => {
    await assertQCFCLApproved(ctx.rfqNumber);
  });
});
