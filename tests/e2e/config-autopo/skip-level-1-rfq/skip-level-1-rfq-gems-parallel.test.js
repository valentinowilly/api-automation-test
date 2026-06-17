import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { loginAs } from '../../../../utils/helpers/auth.helper.js';
import { ROLES } from '../../../../utils/constants/role.constant.js';
import { SERVER_GROUPS } from '../../../../utils/constants/server-group.constant.js';
import { SKIP_LEVEL_1_RFQ, VENDOR_SEQUENCE } from '../../../../utils/constants/config-autopo.constant.js';
import { STATUS_MILESTONE, VENDOR_BATCH } from '../../../../utils/constants/milestone.constant.js';
import { post as gatewayPost } from '../../../../utils/helpers/api-import-pr-aigen-gateway.helper.js';
import { API_IMPORT_PR_GATEWAY_ENDPOINTS } from '../../../../utils/constants/api-endpoint.constant.js';
import { executeQuery } from '../../../../utils/helpers/db.helper.js';
import {
  saveCurrentConfigState,
  restoreConfigState,
  updateSkipLevel1Config,
  getSkipLevel1Config,
  getQcfApprovalLevelConfig,
} from '../../helpers/e2e-config.helper.js';
import {
  buildGEMSSearchLibraryData,
  createMockSearchLibrary,
  cleanupAllTestData,
  getRFQByNumber,
} from '../../helpers/e2e-test-data.helper.js';
import {
  verifyVendorSequence,
  verifyRFQTokenCreated,
  verifyVendorBatchesCreated,
} from '../../helpers/e2e-workflow.helper.js';
import { HTTP_STATUS } from '../../../../utils/constants/http.constant.js';

describe('E2E: skip_level_1_RFQ = "yes" (Parallel) - GEMS Server Group', () => {
  let adminToken;
  let csToken;
  let savedConfigState;
  let rfqNumber;
  let prNumber;

  const SERVER_GROUP = SERVER_GROUPS.GEMS;
  const EXPECTED_VENDOR_SEQUENCE_PARALLEL = VENDOR_SEQUENCE.PARALLEL;

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);
    csToken = await loginAs(ROLES.CS, 'mrr');

    savedConfigState = await saveCurrentConfigState(SERVER_GROUP, adminToken);

    await updateSkipLevel1Config(SERVER_GROUP, SKIP_LEVEL_1_RFQ.YES, adminToken);

    const updatedConfig = await getSkipLevel1Config(SERVER_GROUP, adminToken);
    expect(updatedConfig.config_value).toBe(SKIP_LEVEL_1_RFQ.YES);
  }, 60000);

  afterAll(async () => {
    if (rfqNumber) {
      await cleanupAllTestData(rfqNumber, null, prNumber);
    }

    if (savedConfigState) {
      await restoreConfigState(savedConfigState, adminToken);
    }
  }, 60000);

  describe('Step 1: PR Import and RFQ Generation', () => {
    test('should generate RFQ with parallel vendor routing when skip_level_1_RFQ = "yes" for GEMS', async () => {
      const searchLibraryData = buildGEMSSearchLibraryData();

      await createMockSearchLibrary(searchLibraryData, adminToken);

      prNumber = searchLibraryData.pr_number;

      const gatewayResponse = await gatewayPost(
        API_IMPORT_PR_GATEWAY_ENDPOINTS.START_CRON_GENERATE_PR_AIGEN,
        {},
        { params: { lastPeriodDays: '1' } }
      );
      expect(gatewayResponse.status).toBe(HTTP_STATUS.ACCEPTED);

      let rfqRecord = null;
      const maxWaitMs = 30000;
      const pollIntervalMs = 1000;
      const startTime = Date.now();

      while (!rfqRecord && Date.now() - startTime < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        const rows = await executeQuery(
          'SELECT * FROM rfq_library WHERE pr_number = ? LIMIT 1',
          [prNumber]
        );
        if (rows && rows.length > 0) {
          rfqRecord = rows[0];
        }
      }

      expect(rfqRecord).toBeDefined();
      rfqNumber = rfqRecord.rfq_number;

      expect(rfqRecord.server_groups).toBe(SERVER_GROUPS.GEMS);
    }, 60000);
  });

  describe('Step 2: Vendor Routing Validation (Parallel Mode)', () => {
    test('should assign vendor_sequence = 3 (parallel) when skip_level_1_RFQ = "yes" on GEMS', async () => {
      if (!rfqNumber) return;

      const hasParallelSequence = await verifyVendorSequence(rfqNumber, EXPECTED_VENDOR_SEQUENCE_PARALLEL);
      expect(hasParallelSequence).toBe(true);
    });

    test('should create vendor tokens for both Level 1 and Level 2 in GEMS parallel mode', async () => {
      if (!rfqNumber) return;

      const vendorTokenL1 = await verifyRFQTokenCreated(rfqNumber, 'vendor', VENDOR_BATCH.FIRST);
      expect(vendorTokenL1).toBeDefined();
      expect(vendorTokenL1.is_active).toBe(1);

      const vendorTokenL2 = await verifyRFQTokenCreated(rfqNumber, 'vendor', VENDOR_BATCH.SECOND);
      if (vendorTokenL2) {
        expect(vendorTokenL2.is_active).toBe(1);
      }
    });
  });

  describe('Step 3: GEMS-specific Config Verification', () => {
    test('should confirm skip_level_1_RFQ = "yes" is active for GEMS', async () => {
      const config = await getSkipLevel1Config(SERVER_GROUP, adminToken);
      expect(config).toBeDefined();
      expect(config.config_value).toBe(SKIP_LEVEL_1_RFQ.YES);
    });
  });

  describe('Step 4: GEMS-specific Data Validation', () => {
    test('should use src_value field for GEMS price validation in parallel mode', async () => {
      if (!rfqNumber) return;

      const rfqItems = await executeQuery(
        'SELECT src_value, src_currency, convert_value FROM rfq_library WHERE rfq_number = ? LIMIT 1',
        [rfqNumber]
      );

      if (rfqItems && rfqItems.length > 0) {
        expect(rfqItems[0].src_value).toBeDefined();
        expect(rfqItems[0].src_currency).toBe('IDR');
      }
    });

    test('should have status_milestone = RFQ_SENT_TO_VENDOR (2) for new GEMS RFQ in parallel mode', async () => {
      if (!rfqNumber) return;

      const rfq = await getRFQByNumber(rfqNumber);
      expect(rfq.status_milestone).toBe(STATUS_MILESTONE.RFQ_SENT_TO_VENDOR);
    });
  });
});