import { describe, test, expect, beforeAll } from 'vitest';
import { authenticatedGet, authenticatedPost, authenticatedPut, post } from '../../../utils/helpers/api.helper.js';
import { loginAs } from '../../../utils/helpers/auth.helper.js';
import { getCSCredential } from '../../../utils/helpers/credentials.helper.js';
import { API_AIGEN_ENDPOINTS } from '../../../utils/constants/api-endpoint.constant.js';
import { HTTP_METHODS, HTTP_STATUS } from '../../../utils/constants/http.constant.js';
import { ROLES } from '../../../utils/constants/role.constant.js';
import {
  expectStandardResponseStructure,
  expectErrorResponse,
  expectResponseToMatchSchema,
} from '../../../utils/helpers/schema.helper.js';

describe('Authentication - Role Switching', () => {
  let csToken;
  const testUser = getCSCredential('mrr');

  beforeAll(async () => {
    csToken = await loginAs(ROLES.CS, 'mrr');
  });

  describe('PUT /auth/switch-role', () => {
    test('should switch role successfully with valid role', async () => {
      const loginResponse = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
        identifier: testUser.email,
        password: testUser.password,
      });

      const token = loginResponse.data.data.access_token;

      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        {
          role_id: 1
        },
        token
      );

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE, HTTP_METHODS.PUT, HTTP_STATUS.OK);
      expectStandardResponseStructure(response.data);
    });

    test('should fail to switch to unauthorized role', async () => {
      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        { role: 'UNAUTHORIZED_ROLE' },
        csToken
      );

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE, HTTP_METHODS.PUT, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail to switch role with missing role parameter', async () => {
      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        {},
        csToken
      );

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE, HTTP_METHODS.PUT, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail to switch role without authentication', async () => {
      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        { role: ROLES.CS },
        ''
      );

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE, HTTP_METHODS.PUT, HTTP_STATUS.UNAUTHORIZED);
      expectErrorResponse(response.data);
    });

    test('should fail to switch role with invalid token', async () => {
      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        { role: ROLES.CS },
        'invalid.token.here'
      );

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE, HTTP_METHODS.PUT, HTTP_STATUS.UNAUTHORIZED);
      expectErrorResponse(response.data);
    });

    test('should fail to switch role with empty role', async () => {
      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        { role: '' },
        csToken
      );

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE, HTTP_METHODS.PUT, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail to switch role with null role', async () => {
      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        { role: null },
        csToken
      );

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE, HTTP_METHODS.PUT, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });
  });

  describe('Role Switching Validation', () => {
    test('should return new token after successful role switch', async () => {
      const loginResponse = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
        identifier: testUser.email,
        password: testUser.password,
      });

      const token = loginResponse.data.data.access_token;

      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        { role: ROLES.CS },
        token
      );

      if (response.status === HTTP_STATUS.OK) {
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expectStandardResponseStructure(response.data);
        expect(response.data.data.access_token).toBeTruthy();
        expect(typeof response.data.data.access_token).toBe('string');
        expect(response.data.data.access_token).not.toBe(token);
      }
    });

    test('should validate role exists in system', async () => {
      const invalidRoles = ['SUPER_ADMIN', 'ROOT', 'GUEST', 'UNKNOWN'];

      for (const role of invalidRoles) {
        const response = await authenticatedPut(
          API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
          { role: role },
          csToken
        );

        expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE, HTTP_METHODS.PUT, HTTP_STATUS.BAD_REQUEST);
        expectErrorResponse(response.data);
      }
    });
  });

  describe('Role Switching Edge Cases', () => {
    test('should handle switching to same role', async () => {
      const response = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        { role: ROLES.CS },
        csToken
      );

      expect([HTTP_STATUS.OK, HTTP_STATUS.BAD_REQUEST]).toContain(response.status);
    });

    test('should handle rapid role switching', async () => {
      const loginResponse = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
        identifier: testUser.email,
        password: testUser.password,
      });

      const token = loginResponse.data.data.access_token;

      const response1 = await authenticatedPut(
        API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
        { role: ROLES.CS },
        token
      );

      if (response1.status === HTTP_STATUS.OK) {
        const newToken = response1.data.data.access_token;

        const response2 = await authenticatedPut(
          API_AIGEN_ENDPOINTS.AUTH.SWITCH_ROLE,
          { role: ROLES.CS },
          newToken
        );

        expect([HTTP_STATUS.OK, HTTP_STATUS.BAD_REQUEST]).toContain(response2.status);
      }
    });
  });
});
