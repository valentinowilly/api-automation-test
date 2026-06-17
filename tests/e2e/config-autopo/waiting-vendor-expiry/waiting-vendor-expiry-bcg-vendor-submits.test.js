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
import { addBusinessDays } from '../../../../utils/helpers/date.helper.js';
import {
  saveCurrentConfigState,
  restoreConfigState,
  updateSkipLevel1Config,
  getSkipLevel1Config,
  getVendorExpiryConfig,
} from '../../helpers/e2e-config.helper.js';
import {
  buildBCGSearchLibraryData,
  createMockSearchLibrary,
  cleanupAllTestData,
  getRFQByNumber,
} from '../../helpers/e2e-test-data.helper.js';
import {
  vendorSubmitQuotation,
  getVendorTokenByVendorType,
  getVendorTypesList,
  getRFQItemsByVendorType,
} from '../../helpers/e2e-workflow.helper.js';

describe('E2E: Waiting_vendor_expiry - BCG - Vendor Submits Within SLA', () => {
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
    test('should generate RFQ with parallel vendor routing for BCG', async () => {
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

  describe('Step 3: Agregator Vendor Submits Quotation', () => {
    test('should allow agregator vendor to submit quotation within SLA', async () => {
      if (!rfqNumber) return;

      const rfqItems = await getRFQItemsByVendorType(rfqNumber, VENDOR_TYPES.AGGREGATOR);
      expect(rfqItems.length).toBeGreaterThan(0);

      const agregatorToken = await getVendorTokenByVendorType(rfqNumber, VENDOR_TYPES.AGGREGATOR);
      expect(agregatorToken).toBeDefined();

      rfqItems.forEach(item => {
        item.vendor_price = item.item_value || 1000;
      });

      const response = await vendorSubmitQuotation(rfqItems, agregatorToken.rfq_token);
      expect(response.status).toBe(HTTP_STATUS.OK);
    }, 30000);

    test('should advance status_milestone to WAITING_DIC_APPROVAL after agregator submission', async () => {
      if (!rfqNumber) return;

      const agregatorItems = await getRFQItemsByVendorType(rfqNumber, VENDOR_TYPES.AGGREGATOR);
      expect(agregatorItems.length).toBeGreaterThan(0);
      expect(agregatorItems[0].status_milestone).toBe(STATUS_MILESTONE.WAITING_DIC_APPROVAL);
    });

    test('should deactivate agregator vendor token after submission', async () => {
      if (!rfqNumber) return;

      const deactivatedToken = await getVendorTokenByVendorType(rfqNumber, VENDOR_TYPES.AGGREGATOR, false);
      expect(deactivatedToken).toBeDefined();
      expect(deactivatedToken.is_active).toBe(0);
    });
  });

  describe('Step 4: Config Verification', () => {
    test('should confirm Waiting_vendor_expiry config is active for BCG', async () => {
      const config = await getVendorExpiryConfig(SERVER_GROUP, adminToken);
      expect(config).toBeDefined();
      expect(config.config_condition).toBe(CONFIG_CONDITIONS.WAITING_VENDOR_EXPIRY);
      expect(parseInt(config.config_value)).toBeGreaterThan(0);
    });
  });
});
