import { describe, test, beforeAll, afterAll } from 'vitest';
import { setupRFQAtManagementStage } from '../../helpers/pre-test.helper.js';
import { assertUIState, assertRFQMilestone } from '../../helpers/state-assertions.helper.js';
import { managementManualSourcing } from '../../helpers/workflow-actions.helper.js';
import { executeQuery } from '../../../../../utils/helpers/db.helper.js';

describe('[MG17] MG17 — Management Manual Sourcing', () => {
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
    
    // Fetch the correct items and vendorBatch for the RFQ
    const dbItems = await executeQuery('SELECT id, vendor_batch FROM rfq_library WHERE rfq_number = ? LIMIT 1', [ctx.rfqNumber]);
    const vendorBatch = dbItems[0].vendor_batch;

    // Management clicks Manual Sourcing
    await managementManualSourcing(ctx.rfqNumber, vendorBatch, [{ id: dbItems[0].id }], ctx.mgToken);
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
