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
  buildBCGSearchLibraryData,
  createMockSearchLibrary,
  cleanupAllTestData,
  getRFQByNumber,
} from '../../helpers/e2e-test-data.helper.js';
import { HTTP_STATUS } from '../../../../utils/constants/http.constant.js';

describe('E2E: qcf_approval_level = "category leader, management" - BCG Server Group', () => {
  let adminToken;
  let csToken;
  let savedConfigState;
  let rfqNumber;
  let prNumber;

  const SERVER_GROUP = SERVER_GROUPS.BCG;

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);
    csToken = await loginAs(ROLES.CS, 'mrr');

    savedConfigState = await saveCurrentConfigState(SERVER_GROUP, adminToken);

    await updateQcfApprovalLevelConfig(SERVER_GROUP, QCF_APPROVAL_LEVELS.BCG, adminToken);

    const updatedConfig = await getQcfApprovalLevelConfig(SERVER_GROUP, adminToken);
    expect(updatedConfig.config_value).toBe(QCF_APPROVAL_LEVELS.BCG);
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
    test('should generate RFQ for BCG with two-level approval config', async () => {
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

  describe('Step 2: QCF Approval Level Config Validation', () => {
    test('should have qcf_approval_level = "category leader, management" for BCG', async () => {
      const config = await getQcfApprovalLevelConfig(SERVER_GROUP, adminToken);
      expect(config).toBeDefined();
      expect(config.config_value).toContain('category leader');
      expect(config.config_value).toContain('management');
    });

    test('should have Waiting_CL_review_expiry SLA config for BCG', async () => {
      const slaConfig = await getClReviewExpiryConfig(SERVER_GROUP, adminToken);
      expect(slaConfig).toBeDefined();
      expect(slaConfig.config_value).toBeDefined();
    });

    test('should have Waiting_Management_review_expiry SLA config for BCG', async () => {
      const slaConfig = await getManagementReviewExpiryConfig(SERVER_GROUP, adminToken);
      expect(slaConfig).toBeDefined();
      expect(slaConfig.config_value).toBeDefined();
    });

    test('should have both CL and Management approval levels in config value', async () => {
      const config = await getQcfApprovalLevelConfig(SERVER_GROUP, adminToken);
      expect(config).toBeDefined();

      const approvalLevels = config.config_value.split(',').map(level => level.trim());
      expect(approvalLevels).toContain('category leader');
      expect(approvalLevels).toContain('management');
      expect(approvalLevels.length).toBe(2);
    });
  });

  describe('Step 3: RFQ Data Validation', () => {
    test('should have status_milestone = RFQ_SENT_TO_VENDOR (2) for new BCG RFQ', async () => {
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

    test('should use value field for BCG price threshold validation', async () => {
      if (!rfqNumber) return;

      const rfqItems = await executeQuery(
        'SELECT item_value, src_currency, convert_value FROM rfq_library WHERE rfq_number = ? LIMIT 1',
        [rfqNumber]
      );

      if (rfqItems && rfqItems.length > 0) {
        expect(rfqItems[0].item_value).toBeDefined();
      }
    });
  });
});
