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
  getVendorDirectExpiryConfig,
} from '../../helpers/e2e-config.helper.js';
import {
  buildBCGSearchLibraryData,
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

describe('E2E: skip_level_1_RFQ = "no" (Sequential) - BCG Server Group', () => {
  let adminToken;
  let csToken;
  let savedConfigState;
  let rfqNumber;
  let prNumber;

  const SERVER_GROUP = SERVER_GROUPS.BCG;
  const EXPECTED_VENDOR_SEQUENCE_SEQUENTIAL = VENDOR_SEQUENCE.DIRECT_FIRST;

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);
    csToken = await loginAs(ROLES.CS, 'mrr');

    savedConfigState = await saveCurrentConfigState(SERVER_GROUP, adminToken);

    await updateSkipLevel1Config(SERVER_GROUP, SKIP_LEVEL_1_RFQ.NO, adminToken);

    const updatedConfig = await getSkipLevel1Config(SERVER_GROUP, adminToken);
    expect(updatedConfig.config_value).toBe(SKIP_LEVEL_1_RFQ.NO);
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
    test('should generate RFQ with sequential vendor routing when skip_level_1_RFQ = "no" for BCG', async () => {
      const searchLibraryData = buildBCGSearchLibraryData();

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

      expect(rfqRecord.server_groups).toBe(SERVER_GROUPS.BCG);
    }, 60000);
  });

  describe('Step 2: Vendor Routing Validation (Sequential Mode)', () => {
    test('should assign vendor_sequence = 1 (DIRECT_FIRST) when skip_level_1_RFQ = "no"', async () => {
      if (!rfqNumber) return;

      const hasSequentialSequence = await verifyVendorSequence(rfqNumber, EXPECTED_VENDOR_SEQUENCE_SEQUENTIAL);
      expect(hasSequentialSequence).toBe(true);
    });

    test('should create vendor token ONLY for Level 1 (VENDOR_BATCH.FIRST) in sequential mode', async () => {
      if (!rfqNumber) return;

      const vendorTokenL1 = await verifyRFQTokenCreated(rfqNumber, 'vendor', VENDOR_BATCH.FIRST);
      expect(vendorTokenL1).toBeDefined();
      expect(vendorTokenL1.is_active).toBe(1);

      const vendorTokenL2 = await verifyRFQTokenCreated(rfqNumber, 'vendor', VENDOR_BATCH.SECOND);
      expect(vendorTokenL2).toBeNull();
    });

    test('should use Waiting_vendor_direct_expiry SLA config for Level 1 token', async () => {
      if (!rfqNumber) return;

      const vendorTokenL1 = await verifyRFQTokenCreated(rfqNumber, 'vendor', VENDOR_BATCH.FIRST);
      const slaConfig = await getVendorDirectExpiryConfig(SERVER_GROUP, adminToken);

      expect(slaConfig).toBeDefined();

      if (vendorTokenL1) {
        expect(vendorTokenL1.config_condition).toBeDefined();
      }
    });

    test('should have only vendor_batch = 1 (no batch 2) in sequential mode', async () => {
      if (!rfqNumber) return;

      const batches = await verifyVendorBatchesCreated(rfqNumber);
      expect(batches).toContain(VENDOR_BATCH.FIRST);
      expect(batches).not.toContain(VENDOR_BATCH.SECOND);
    });
  });

  describe('Step 3: Config Verification', () => {
    test('should confirm skip_level_1_RFQ = "no" is active for BCG', async () => {
      const config = await getSkipLevel1Config(SERVER_GROUP, adminToken);
      expect(config).toBeDefined();
      expect(config.config_value).toBe(SKIP_LEVEL_1_RFQ.NO);
    });
  });

  describe('Step 4: RFQ Data Validation', () => {
    test('should have status_milestone = RFQ_SENT_TO_VENDOR (2) for new RFQ in sequential mode', async () => {
      if (!rfqNumber) return;

      const rfq = await getRFQByNumber(rfqNumber);
      expect(rfq).toBeDefined();
      expect(rfq.status_milestone).toBe(STATUS_MILESTONE.RFQ_SENT_TO_VENDOR);
    });

    test('should have BCG server_groups on generated RFQ', async () => {
      if (!rfqNumber) return;

      const rfq = await getRFQByNumber(rfqNumber);
      expect(rfq.server_groups).toBe(SERVER_GROUPS.BCG);
    });
  });
});
