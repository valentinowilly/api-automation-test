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

describe('Auto PO Configuration - Servers', () => {
  let adminToken;
  const adminUser = getAdminCredential();

  beforeAll(async () => {
    adminToken = await loginAs(ROLES.ADMIN);
  });

  describe('GET /autopo/servers', () => {
    test('should retrieve server groups successfully', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.SERVERS, adminToken);

      expectResponseToMatchSchema(response, '/autopo/servers', HTTP_METHODS.GET, HTTP_STATUS.OK);
      expectStandardResponseStructure(response.data);
      expect(response.data.data).toBeDefined();
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    test('should have valid response message', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.SERVERS, adminToken);

      expect(response.data.message).toBe('Get Data Server Groups');
    });

    test('should fail without authentication', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.SERVERS, '');

      expectResponseToMatchSchema(
        response,
        '/autopo/servers',
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with invalid token', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.SERVERS, 'invalid.jwt.token');

      expectResponseToMatchSchema(
        response,
        '/autopo/servers',
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with malformed token', async () => {
      const response = await authenticatedGet(
        API_AIGEN_ENDPOINTS.AUTOPO.SERVERS,
        'malformed-token-without-proper-structure'
      );

      expectResponseToMatchSchema(
        response,
        '/autopo/servers',
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });

    test('should fail with expired token', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0vCBKb6jO8M2gzYzXkr2fXmrCbB1FbqtJLJDgY';

      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.SERVERS, expiredToken);

      expectResponseToMatchSchema(
        response,
        '/autopo/servers',
        HTTP_METHODS.GET,
        HTTP_STATUS.UNAUTHORIZED
      );
      expectErrorResponse(response.data);
    });
  });

  describe('Server Groups Data Validation', () => {
    test('should return array with server_groups property', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.SERVERS, adminToken);

      if (response.data.data.length > 0) {
        const serverGroup = response.data.data[0];
        expect(serverGroup).toHaveProperty('server_groups');
        expect(typeof serverGroup.server_groups).toBe('string');
      }
    });

    test('should have non-empty server group names', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.SERVERS, adminToken);

      if (response.data.data.length > 0) {
        response.data.data.forEach((serverGroup) => {
          expect(serverGroup.server_groups).toBeTruthy();
          expect(serverGroup.server_groups.trim().length).toBeGreaterThan(0);
        });
      }
    });

    test('should not have duplicate server groups', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTOPO.SERVERS, adminToken);

      if (response.data.data.length > 0) {
        const serverGroupNames = response.data.data.map((sg) => sg.server_groups);
        const uniqueNames = new Set(serverGroupNames);

        expect(uniqueNames.size).toBe(serverGroupNames.length);
      }
    });
  });
});
