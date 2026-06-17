import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtManagementStage } from '../../helpers/pre-test.helper.js';
import { assertUIState, assertRFQMilestone } from '../../helpers/state-assertions.helper.js';
import { expireManagementAndRunCron } from '../../helpers/workflow-actions.helper.js';

describe('[MG18] MG18 — Management Auto Manual Sourcing (No Action)', () => {
  let ctx;

  beforeAll(async () => {
    // Stage up to Management
    ctx = await setupRFQAtManagementStage(
      { vd: 'need_confirm', va: 'accept' },
      'accept_va',
      {},
      {},
      { scenario: 's3', searchLibraryOverrides: { im_number: 'IM' + String(Math.floor(Math.random() * 9000000000) + 1000000000) } }
    );
    
    // Management does nothing, token expires
    await expireManagementAndRunCron(ctx.rfqNumber, ctx.adminToken);
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'vd', 'Manual Sourcing', ctx.vendorAccountTokenVD);
  });

  test('VA UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'va', 'Manual Sourcing', ctx.vendorAccountTokenVA);
  });

  test('DIC UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'dic', 'Manual Sourcing', ctx.dicToken);
  });

  test('CS UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, 'cs', 'Manual Sourcing', ctx.csToken);
  });

  test('CL UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.qcfNumber, 'cl', 'Manual Sourcing', ctx.clToken);
  });

  test('MG UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.qcfNumber, 'mg', 'Manual Sourcing', ctx.mgToken);
  });

  test('table status is MANUAL_SOURCING', async () => {
    await assertRFQMilestone(ctx.rfqNumber, 'BID_MANUAL_SOURCING');
  });
});
