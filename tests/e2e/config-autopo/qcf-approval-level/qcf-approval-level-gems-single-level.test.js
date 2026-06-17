import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { loginAs } from '../../../../utils/helpers/auth.helper.js';
import { ROLES } from '../../../../utils/constants/role.constant.js';
import { SERVER_GROUPS } from '../../../../utils/constants/server-group.constant.js';
import { QCF_APPROVAL_LEVELS } from '../../../../utils/constants/config-autopo.constant.js';
import { STATUS_MILESTONE } from '../../../../utils/constants/milestone.constant.js';
import { post as gatewayPost } from '../../../../utils/helpers/api-import-pr-aigen-gateway.helper.js';
import { API_IMPORT_PR_GATEWAY_ENDPOINTS } from '../../../../utils/constants/api-endpoint.constant.js';
import { executeQuery } from '../../../../utils/helpers/db.helper.js';
import {
  saveCurrentConfigState,
  restoreConfigState,
  updateQcfApprovalLevelConfig,
  getQcfApprovalLevelConfig,
  getClReviewExpiryConfig,
  getManagementReviewExpiryConfig,
} from '../../helpers/e2e-config.helper.js';
import {
  buildGEMSSearchLibraryData,
  createMockSearchLibrary,
  cleanupAllTestData,
  getRFQByNumber,
} from '../../helpers/e2e-test-data.helper.js';
import { HTTP_STATUS } from '../../../../utils/constants/http.constant.js';

describe('E2E: qcf_approval_level = "category leader" - GEMS Server Group', () => {
  let adminToken;
  let csToken;
  let savedConfigState;
  let rfqNumber;
  let prNumber;

  const SERVER_GROUP = SERVER_GROUPS.GEMS;

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);
    csToken = await loginAs(ROLES.CS, 'mrr');

    savedConfigState = await saveCurrentConfigState(SERVER_GROUP, adminToken);

    await updateQcfApprovalLevelConfig(SERVER_GROUP, QCF_APPROVAL_LEVELS.GEMS, adminToken);

    const updatedConfig = await getQcfApprovalLevelConfig(SERVER_GROUP, adminToken);
    expect(updatedConfig.config_value).toBe(QCF_APPROVAL_LEVELS.GEMS);
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
    test('should generate RFQ for GEMS with single-level approval config', async () => {
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

  describe('Step 2: QCF Approval Level Config Validation', () => {
    test('should have qcf_approval_level = "category leader" only for GEMS (no management)', async () => {
      const config = await getQcfApprovalLevelConfig(SERVER_GROUP, adminToken);
      expect(config).toBeDefined();
      expect(config.config_value).toContain('category leader');
      expect(config.config_value).not.toContain('management');
    });

    test('should have Waiting_CL_review_expiry SLA config for GEMS', async () => {
      const slaConfig = await getClReviewExpiryConfig(SERVER_GROUP, adminToken);
      expect(slaConfig).toBeDefined();
      expect(slaConfig.config_value).toBeDefined();
    });

    test('should have single approval level in config value for GEMS', async () => {
      const config = await getQcfApprovalLevelConfig(SERVER_GROUP, adminToken);
      expect(config).toBeDefined();

      const approvalLevels = config.config_value.split(',').map(level => level.trim());
      expect(approvalLevels).toContain('category leader');
      expect(approvalLevels).not.toContain('management');
      expect(approvalLevels.length).toBe(1);
    });
  });

  describe('Step 3: GEMS-specific Data Validation', () => {
    test('should have status_milestone = RFQ_SENT_TO_VENDOR (2) for new GEMS RFQ', async () => {
      if (!rfqNumber) return;

      const rfq = await getRFQByNumber(rfqNumber);
      expect(rfq).toBeDefined();
      expect(rfq.status_milestone).toBe(STATUS_MILESTONE.RFQ_SENT_TO_VENDOR);
    });

    test('should have GEMS server_groups on generated RFQ', async () => {
      if (!rfqNumber) return;

      const rfq = await getRFQByNumber(rfqNumber);
      expect(rfq.server_groups).toBe(SERVER_GROUPS.GEMS);
    });

    test('should use src_value field for GEMS price validation', async () => {
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
  });
});
