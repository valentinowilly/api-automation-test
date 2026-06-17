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

describe('Auto PO Configuration - Get Config', () => {
  let adminToken;
  const adminUser = getAdminCredential();

  const VALID_CONFIG_TYPE = 'setting_parameter';
  const VALID_SERVER_GROUP = 'BCG';
  const VALID_CONFIG_CONDITION = 'skip_level_1_RFQ';

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);
  });

  describe('GET /autopo/config/{configType}/{serverGroup}/{configCondition}', () => {
    test('should retrieve config successfully with valid parameters', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/${VALID_SERVER_GROUP}/${VALID_CONFIG_CONDITION}`;
      const response = await authenticatedGet(endpoint, adminToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/config/{configType}/{serverGroup}/{configCondition}`,
        HTTP_METHODS.GET,
        HTTP_STATUS.OK
      );
      expectStandardResponseStructure(response.data);
      expect(response.data.data).toBeDefined();
    });

    test('should have valid response message', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/${VALID_SERVER_GROUP}/${VALID_CONFIG_CONDITION}`;
      const response = await authenticatedGet(endpoint, adminToken);

      expect(response.data.message).toBeDefined();
      expect(typeof response.data.message).toBe('string');
    });

    test('should fail without authentication', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/${VALID_SERVER_GROUP}/${VALID_CONFIG_CONDITION}`;
      const response = await authenticatedGet(endpoint, '');

      expectResponseToMatchSchema(
        response,
        `/autopo/config/{configType}/{serverGroup}/{configCondition}`,
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with invalid token', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/${VALID_SERVER_GROUP}/${VALID_CONFIG_CONDITION}`;
      const response = await authenticatedGet(endpoint, 'invalid.jwt.token');

      expectResponseToMatchSchema(
        response,
        `/autopo/config/{configType}/{serverGroup}/{configCondition}`,
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with malformed token', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/${VALID_SERVER_GROUP}/${VALID_CONFIG_CONDITION}`;
      const response = await authenticatedGet(endpoint, 'malformed-token-without-proper-structure');

      expectResponseToMatchSchema(
        response,
        `/autopo/config/{configType}/{serverGroup}/{configCondition}`,
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with expired token', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0vCBKb6jO8M2gzYzXkr2fXmrCbB1FbqtJLJDgY';
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/${VALID_SERVER_GROUP}/${VALID_CONFIG_CONDITION}`;

      const response = await authenticatedGet(endpoint, expiredToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/config/{configType}/{serverGroup}/{configCondition}`,
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should handle invalid config type', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/invalid_type/${VALID_SERVER_GROUP}/${VALID_CONFIG_CONDITION}`;
      const response = await authenticatedGet(endpoint, adminToken);

      expect([HTTP_STATUS.OK, HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.NOT_FOUND]).toContain(
        response.status
      );
    });

    test('should handle invalid server group', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/INVALID/${VALID_CONFIG_CONDITION}`;
      const response = await authenticatedGet(endpoint, adminToken);

      expect([HTTP_STATUS.OK, HTTP_STATUS.NOT_FOUND]).toContain(response.status);
    });

    test('should handle invalid config condition', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/${VALID_SERVER_GROUP}/invalid_condition`;
      const response = await authenticatedGet(endpoint, adminToken);

      expect([HTTP_STATUS.OK, HTTP_STATUS.NOT_FOUND]).toContain(response.status);
    });
  });

  describe('Config Data Validation', () => {
    test('should return valid config properties', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.GET_CONFIG}/${VALID_CONFIG_TYPE}/${VALID_SERVER_GROUP}/${VALID_CONFIG_CONDITION}`;
      const response = await authenticatedGet(endpoint, adminToken);

      if (response.status === HTTP_STATUS.OK && response.data.data) {
        expect(typeof response.data.data).toBe('object');
        expect(Object.keys(response.data.data).length).toBeGreaterThan(0);
      }
    });
  });
});
