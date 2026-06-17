import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { loginAs } from '../../../../utils/helpers/auth.helper.js';
import { ROLES } from '../../../../utils/constants/role.constant.js';
import { SERVER_GROUPS } from '../../../../utils/constants/server-group.constant.js';
import { SKIP_LEVEL_1_RFQ, CONFIG_CONDITIONS, VENDOR_TYPES } from '../../../../utils/constants/config-autopo.constant.js';
import { STATUS_MILESTONE } from '../../../../utils/constants/milestone.constant.js';
import { post as gatewayPost } from '../../../../utils/helpers/api-import-pr-aigen-gateway.helper.js';
import { API_IMPORT_PR_GATEWAY_ENDPOINTS } from '../../../../utils/constants/api-endpoint.constant.js';
import { executeQuery } from '../../../../utils/helpers/db.helper.js';
import { HTTP_STATUS } from '../../../../utils/constants/http.constant.js';
import { addBusinessDays, formatDateSQL } from '../../../../utils/helpers/date.helper.js';
import {
  saveCurrentConfigState,
  restoreConfigState,
  updateSkipLevel1Config,
  getSkipLevel1Config,
  getVendorExpiryConfig,
  getCsExpiryConfig,
} from '../../helpers/e2e-config.helper.js';
import {
  buildGEMSSearchLibraryData,
  createMockSearchLibrary,
  cleanupAllTestData,
  getRFQByNumber,
} from '../../helpers/e2e-test-data.helper.js';
import {
  getVendorTokenByVendorType,
  getVendorTypesList,
} from '../../helpers/e2e-workflow.helper.js';

describe('E2E: Waiting_vendor_expiry - GEMS - Vendor Does NOT Submit (Expiry)', () => {
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
    test('should generate RFQ with parallel vendor routing for GEMS', async () => {
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

  describe('Step 2: Agregator Vendor Token Validation', () => {
    test('should create vendor token for agregator (Level 2) with config_condition = Waiting_vendor_expiry', async () => {
      if (!rfqNumber) return;

      const agregatorToken = await getVendorTokenByVendorType(rfqNumber, VENDOR_TYPES.AGGREGATOR);

      expect(agregatorToken).toBeDefined();
      expect(agregatorToken.is_active).toBe(1);
      expect(agregatorToken.config_condition).toBe(CONFIG_CONDITIONS.WAITING_VENDOR_EXPIRY);
    });

    test('should set token date_expired based on Waiting_vendor_expiry config value', async () => {
      if (!rfqNumber) return;

      const vendorExpiryConfig = await getVendorExpiryConfig(SERVER_GROUP, adminToken);
      expect(vendorExpiryConfig).toBeDefined();

      const configDays = parseInt(vendorExpiryConfig.config_value);
      expect(configDays).toBeGreaterThan(0);

      const agregatorToken = await getVendorTokenByVendorType(rfqNumber, VENDOR_TYPES.AGGREGATOR);
      expect(agregatorToken).toBeDefined();

      const expectedExpiry = addBusinessDays(new Date(agregatorToken.created_at), configDays);
      const tokenExpiry = new Date(agregatorToken.date_expired);

      const diffMs = Math.abs(tokenExpiry.getTime() - expectedExpiry.getTime());
      expect(diffMs).toBeLessThan(2 * 24 * 60 * 60 * 1000);
    });

    test('should have both direct and agregator vendor types in parallel mode', async () => {
      if (!rfqNumber) return;

      const vendorTypes = await getVendorTypesList(rfqNumber);
      expect(vendorTypes).toContain(VENDOR_TYPES.DIRECT);
      expect(vendorTypes).toContain(VENDOR_TYPES.AGGREGATOR);
    });
  });

  describe('Step 3: Expiry Simulation', () => {
    test('should have Waiting_vendor_expiry config active with correct SLA value', async () => {
      const config = await getVendorExpiryConfig(SERVER_GROUP, adminToken);
      expect(config).toBeDefined();
      expect(config.is_active).toBe(1);
      expect(config.config_condition).toBe(CONFIG_CONDITIONS.WAITING_VENDOR_EXPIRY);

      const slaValue = parseInt(config.config_value);
      expect(slaValue).toBeGreaterThan(0);
    });

    test('should verify token would be detected by expiry cron when date_expired passes', async () => {
      if (!rfqNumber) return;

      const pastDate = formatDateSQL(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

      const agregatorToken = await getVendorTokenByVendorType(rfqNumber, VENDOR_TYPES.AGGREGATOR);
      expect(agregatorToken).toBeDefined();

      await executeQuery(
        'UPDATE rfq_token_email SET date_expired = ? WHERE id = ?',
        [pastDate, agregatorToken.id]
      );

      const directToken = await getVendorTokenByVendorType(rfqNumber, VENDOR_TYPES.DIRECT);
      if (directToken) {
        await executeQuery(
          'UPDATE rfq_token_email SET date_expired = ?, is_active = 0 WHERE id = ?',
          [pastDate, directToken.id]
        );
      }

      const expiredTokens = await executeQuery(
        `SELECT rte.* FROM rfq_token_email rte
         JOIN rfq_library rl ON rl.rfq_number = rte.rfq_number AND rl.vendor_code = rte.vendor_code
         WHERE rte.rfq_number = ? AND rte.config_condition = ? AND rte.is_active = 1 AND rte.date_expired <= NOW()
           AND rl.vendor_type = ?`,
        [rfqNumber, CONFIG_CONDITIONS.WAITING_VENDOR_EXPIRY, VENDOR_TYPES.AGGREGATOR]
      );
      expect(expiredTokens.length).toBeGreaterThan(0);
    });

    test('should have RFQ still at RFQ_SENT_TO_VENDOR milestone (no cron triggered)', async () => {
      if (!rfqNumber) return;

      const rfq = await getRFQByNumber(rfqNumber);
      expect(rfq).toBeDefined();
      expect(rfq.status_milestone).toBe(STATUS_MILESTONE.RFQ_SENT_TO_VENDOR);
    });
  });

  describe('Step 4: Escalation Readiness', () => {
    test('should have Waiting_CS_expiry config available for escalation after vendor expiry', async () => {
      const csConfig = await getCsExpiryConfig(SERVER_GROUP, adminToken);
      expect(csConfig).toBeDefined();
      expect(parseInt(csConfig.config_value)).toBeGreaterThan(0);
    });
  });
});
