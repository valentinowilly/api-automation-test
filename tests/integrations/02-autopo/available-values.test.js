import { describe, test, expect, beforeAll } from 'vitest';
import { authenticatedGet } from '../../../utils/helpers/api.helper.js';
import { loginAs } from '../../../utils/helpers/auth.helper.js';
import { getAdminCredential } from '../../../utils/helpers/credentials.helper.js';
import { API_AIGEN_ENDPOINTS } from '../../../utils/constants/api-endpoint.constant.js';
import { HTTP_STATUS, HTTP_METHODS } from '../../../utils/constants/http.constant.js';
import { ROLES } from '../../../utils/constants/role.constant.js';
import {
  expectResponseToMatchSchema,
  expectStandardResponseStructure,
  expectErrorResponse,
} from '../../../utils/helpers/schema.helper.js';

describe('Auto PO Configuration - Available Values', () => {
  let adminToken;
  const adminUser = getAdminCredential();

  let VALID_CONFIG_ID;
  const INVALID_CONFIG_ID = '99999';
  const MULTIPLE_DROPDOWN_CONDITIONS = ['plant_code', 'qcf_approval_level', 'qcf_approval_level', 'pr_type']

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);

    const listSettingParamEndpoint = API_AIGEN_ENDPOINTS.AUTOPO.LIST_SETTING_PARAMS;
    const listSettingParamResponse = await authenticatedGet(listSettingParamEndpoint, adminToken);

    if (
      listSettingParamResponse.status === HTTP_STATUS.OK &&
      listSettingParamResponse.data &&
      listSettingParamResponse.data.data &&
      Array.isArray(listSettingParamResponse.data.data)
    ) {
      const configWithDropdown = listSettingParamResponse.data.data.find((config) =>
        MULTIPLE_DROPDOWN_CONDITIONS.includes(config.config_condition)
      );

      if (configWithDropdown) {
        VALID_CONFIG_ID = configWithDropdown.id;
      } else {
        throw new Error(
          `No config found with config_condition in ${MULTIPLE_DROPDOWN_CONDITIONS.join(', ')}`
        );
      }
    } else {
      throw new Error('Failed to retrieve setting params or unexpected response structure');
    }
  });

  describe('GET /autopo/{config_id}/available-values', () => {
    test('should retrieve available values successfully with valid config_id', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, adminToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/{config_id}/available-values`,
        HTTP_METHODS.GET,
        HTTP_STATUS.OK
      );
      expectStandardResponseStructure(response.data);
      expect(response.data.data).toBeDefined();
    });

    test('should have valid response message', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, adminToken);

      expect(response.data.message).toBe('Get Config Value');
    });

    test('should fail without authentication', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, '');

      expectResponseToMatchSchema(
        response,
        `/autopo/{config_id}/available-values`,
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with invalid token', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, 'invalid.jwt.token');

      expectResponseToMatchSchema(
        response,
        `/autopo/{config_id}/available-values`,
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with malformed token', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, 'malformed-token-without-proper-structure');

      expectResponseToMatchSchema(
        response,
        `/autopo/{config_id}/available-values`,
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with expired token', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0vCBKb6jO8M2gzYzXkr2fXmrCbB1FbqtJLJDgY';
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;

      const response = await authenticatedGet(endpoint, expiredToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/{config_id}/available-values`,
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should handle non-existent config_id', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${INVALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, adminToken);

      expect([HTTP_STATUS.OK, HTTP_STATUS.NOT_FOUND]).toContain(response.status);
    });

    test('should handle invalid config_id format', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/invalid-id/available-values`;
      const response = await authenticatedGet(endpoint, adminToken);

      expect([HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.NOT_FOUND]).toContain(response.status);
    });
  });

  describe('Available Values Data Validation', () => {
    test('should have expected data structure', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, adminToken);

      if (response.status === HTTP_STATUS.OK && response.data.data) {
        expect(response.data.data).toHaveProperty('id');
        expect(response.data.data).toHaveProperty('server_group');
        expect(response.data.data).toHaveProperty('config_condition');
        expect(response.data.data).toHaveProperty('available_values');
      }
    });

    test('should have available_values as array', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, adminToken);

      if (response.status === HTTP_STATUS.OK && response.data.data) {
        expect(Array.isArray(response.data.data.available_values)).toBe(true);
      }
    });

    test('should have valid timestamps', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, adminToken);

      if (response.status === HTTP_STATUS.OK && response.data.data) {
        expect(response.data.data).toHaveProperty('created_at');
        expect(response.data.data).toHaveProperty('updated_at');

        const createdAt = new Date(response.data.data.created_at);
        expect(createdAt instanceof Date && !isNaN(createdAt)).toBe(true);
      }
    });

    test('should have non-empty server_group', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.AVAILABLE_VALUES}/${VALID_CONFIG_ID}/available-values`;
      const response = await authenticatedGet(endpoint, adminToken);

      if (response.status === HTTP_STATUS.OK && response.data.data) {
        expect(response.data.data.server_group).toBeTruthy();
        expect(typeof response.data.data.server_group).toBe('string');
        expect(response.data.data.server_group.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
