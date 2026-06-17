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

describe('Auto PO Configuration - List Setting Parameters', () => {
  let adminToken;
  const adminUser = getAdminCredential();

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);
  });

  describe('GET /autopo/listsettingparam', () => {
    test('should retrieve setting parameters successfully', async () => {
      const response = await authenticatedGet(
        API_AIGEN_ENDPOINTS.AUTOPO.LIST_SETTING_PARAMS,
        adminToken
      );

      expectResponseToMatchSchema(
        response,
        '/autopo/listsettingparam',
        HTTP_METHODS.GET,
        HTTP_STATUS.OK
      );
      expectStandardResponseStructure(response.data);
      expect(response.data.data).toBeDefined();
    });

    test('should have valid response message', async () => {
      const response = await authenticatedGet(
        API_AIGEN_ENDPOINTS.AUTOPO.LIST_SETTING_PARAMS,
        adminToken
      );

      expect(response.data.message).toBeDefined();
      expect(typeof response.data.message).toBe('string');
    });

    test('should fail without authentication', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.LIST_SETTING_PARAMS, '');

      expectResponseToMatchSchema(
        response,
        '/autopo/listsettingparam',
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with invalid token', async () => {
      const response = await authenticatedGet(
        API_AIGEN_ENDPOINTS.AUTOPO.LIST_SETTING_PARAMS,
        'invalid.jwt.token'
      );

      expectResponseToMatchSchema(
        response,
        '/autopo/listsettingparam',
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with malformed token', async () => {
      const response = await authenticatedGet(
        API_AIGEN_ENDPOINTS.AUTOPO.LIST_SETTING_PARAMS,
        'malformed-token-without-proper-structure'
      );

      expectResponseToMatchSchema(
        response,
        '/autopo/listsettingparam',
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with expired token', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0vCBKb6jO8M2gzYzXkr2fXmrCbB1FbqtJLJDgY';

      const response = await authenticatedGet(
        API_AIGEN_ENDPOINTS.AUTOPO.LIST_SETTING_PARAMS,
        expiredToken
      );

      expectResponseToMatchSchema(
        response,
        '/autopo/listsettingparam',
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });
  });

  describe('Setting Parameters Data Validation', () => {
    test('should have consistent data structure', async () => {
      const response = await authenticatedGet(
        API_AIGEN_ENDPOINTS.AUTOPO.LIST_SETTING_PARAMS,
        adminToken
      );

      expect(response.data.data).toBeDefined();

      if (Array.isArray(response.data.data) && response.data.data.length > 0) {
        const firstParam = response.data.data[0];
        expect(typeof firstParam).toBe('object');
        expect(Object.keys(firstParam).length).toBeGreaterThan(0);
      }
    });
  });
});
