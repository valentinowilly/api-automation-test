import { describe, test, expect, beforeAll } from 'vitest';
import { authenticatedPost } from '../../../utils/helpers/api.helper.js';
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

describe('Auto PO Configuration - Update Config', () => {
  let adminToken;
  const adminUser = getAdminCredential();

  const VALID_CONFIG_ID = '1';
  const INVALID_CONFIG_ID = '99999';

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);
  });

  describe('POST /autopo/updateconfig/{id}', () => {
    test('should update config successfully with valid data', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '1500000',
      };

      const response = await authenticatedPost(endpoint, requestBody, adminToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/updateconfig/{id}`,
        HTTP_METHODS.POST,
        HTTP_STATUS.OK
      );
      expectStandardResponseStructure(response.data);
      expect(response.data.data).toBeDefined();
    });

    test('should have valid response message', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '2000000',
      };

      const response = await authenticatedPost(endpoint, requestBody, adminToken);

      expect(response.data.message).toBeDefined();
      expect(typeof response.data.message).toBe('string');
    });

    test('should fail without authentication', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '1000000',
      };

      const response = await authenticatedPost(endpoint, requestBody, '');

      expectResponseToMatchSchema(
        response,
        `/autopo/updateconfig/{id}`,
        HTTP_METHODS.POST,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with invalid token', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '1000000',
      };

      const response = await authenticatedPost(endpoint, requestBody, 'invalid.jwt.token');

      expectResponseToMatchSchema(
        response,
        `/autopo/updateconfig/{id}`,
        HTTP_METHODS.POST,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with malformed token', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '1000000',
      };

      const response = await authenticatedPost(
        endpoint,
        requestBody,
        'malformed-token-without-proper-structure'
      );

      expectResponseToMatchSchema(
        response,
        `/autopo/updateconfig/{id}`,
        HTTP_METHODS.POST,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with expired token', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0vCBKb6jO8M2gzYzXkr2fXmrCbB1FbqtJLJDgY';
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '1000000',
      };

      const response = await authenticatedPost(endpoint, requestBody, expiredToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/updateconfig/{id}`,
        HTTP_METHODS.POST,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should handle non-existent config ID', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${INVALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '1000000',
      };

      const response = await authenticatedPost(endpoint, requestBody, adminToken);

      expect([HTTP_STATUS.NOT_FOUND, HTTP_STATUS.BAD_REQUEST]).toContain(response.status);
    });

    test('should fail with missing config_value', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {};

      const response = await authenticatedPost(endpoint, requestBody, adminToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/updateconfig/{id}`,
        HTTP_METHODS.POST,
        HTTP_STATUS.BAD_REQUEST
      );
    });

    test('should fail with empty config_value', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '',
      };

      const response = await authenticatedPost(endpoint, requestBody, adminToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/updateconfig/{id}`,
        HTTP_METHODS.POST,
        HTTP_STATUS.BAD_REQUEST
      );
    });
  });

  describe('Config Update Data Validation', () => {
    test('should return updated config data', async () => {
      const endpoint = `${API_AIGEN_ENDPOINTS.AUTOPO.UPDATE_CONFIG}/${VALID_CONFIG_ID}`;
      const requestBody = {
        config_value: '3000000',
      };

      const response = await authenticatedPost(endpoint, requestBody, adminToken);

      expectResponseToMatchSchema(
        response,
        `/autopo/updateconfig/{id}`,
        HTTP_METHODS.POST,
        HTTP_STATUS.OK
      );
    });
  });
});
