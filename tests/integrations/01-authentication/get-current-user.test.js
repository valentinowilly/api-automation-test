import { describe, test, expect, beforeAll } from 'vitest';
import { authenticatedGet } from '../../../utils/helpers/api.helper.js';
import { loginAs } from '../../../utils/helpers/auth.helper.js';
import { getCSCredential, getCLCredential, getAdminCredential } from '../../../utils/helpers/credentials.helper.js';
import { API_AIGEN_ENDPOINTS } from '../../../utils/constants/api-endpoint.constant.js';
import { HTTP_STATUS, HTTP_METHODS } from '../../../utils/constants/http.constant.js';
import { ROLES, ROLE_SLUGS } from '../../../utils/constants/role.constant.js';
import {
  expectResponseToMatchSchema,
  expectStandardResponseStructure,
  expectErrorResponse,
} from '../../../utils/helpers/schema.helper.js';
import { isValidEmail } from '../../../utils/helpers/regex.helper.js';

describe('Authentication - Get Current User', () => {
  let csToken;
  let clToken;
  let adminToken;

  const csUser = getCSCredential('mrr');
  const clUser = getCLCredential('mrr');
  const adminUser = getAdminCredential();

  beforeAll(async () => {
    csToken = await loginAs(ROLES.CS, 'mrr');
    clToken = await loginAs(ROLES.CL, 'mrr');
    adminToken = await loginAs(ROLES.ADMIN);
  });

  describe('GET /auth/me', () => {
    test('should get current user as CS successfully', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.OK);
      expectStandardResponseStructure(response.data);
    });

    test('should get current user as CL successfully', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, clToken);

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.OK);
      expectStandardResponseStructure(response.data);
    });

    test('should get current user as Admin successfully', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, adminToken);

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.OK);
      expectStandardResponseStructure(response.data);
    });

    test('should fail to get current user without authentication', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, '');

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.UNAUTHORIZED);
      expectErrorResponse(response.data);
    });

    test('should fail to get current user with invalid token', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, 'invalid.jwt.token');

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.UNAUTHORIZED);
      expectErrorResponse(response.data);
    });

    test('should fail to get current user with malformed token', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, 'malformed-token');

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.UNAUTHORIZED);
      expectErrorResponse(response.data);
    });

    test('should fail to get current user with expired token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.test';

      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, expiredToken);

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.UNAUTHORIZED);
      expectErrorResponse(response.data);
    });
  });

  describe('Current User Data Structure', () => {
    test('should return correct user data structure for CS', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.OK);
      expectStandardResponseStructure(response.data);
    });

    test('should return correct email for CS user', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      expect(response.data.data.current_user.email).toBe(csUser.email);
    });

    test('should return correct role for CS user', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      expect(response.data.data.available_roles).toContain(ROLE_SLUGS.CS);
    });

    test('should return correct email for CL user', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, clToken);

      expect(response.data.data.current_user.email).toBe(clUser.email);
    });

    test('should return correct role for CL user', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, clToken);

      expect(response.data.data.available_roles).toContain(ROLE_SLUGS.CL);
    });

    test('should return correct email for Admin user', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, adminToken);

      expect(response.data.data.current_user.email).toBe(adminUser.email);
    });

    test('should return correct role for Admin user', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, adminToken);

      expect(response.data.data.available_roles).toContain(ROLE_SLUGS.ADMIN);
    });
  });

  describe('Current User Data Validation', () => {
    test('should have valid user ID', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      expect(response.data.data.current_user.id).toBeTruthy();
      expect(typeof response.data.data.current_user.id).toBe('number');
    });

    test('should have valid email format', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      expect(isValidEmail(response.data.data.current_user.email)).toBe(true);
    });

    test('should have non-empty name', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      expect(response.data.data.current_user.name).toBeTruthy();
      expect(typeof response.data.data.current_user.name).toBe('string');
    });

    test('should have valid role from enum', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      const validRoleSlugs = Object.values(ROLE_SLUGS);
      const availableRoles = response.data.data.available_roles;

      expect(Array.isArray(availableRoles)).toBe(true);
      expect(availableRoles.length).toBeGreaterThan(0);

      availableRoles.forEach(role => {
        expect(validRoleSlugs).toContain(role);
      });
    });

    test('should not expose sensitive information', async () => {
      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, csToken);

      expect(response.data.data.current_user).not.toHaveProperty('password');
      expect(response.data.data.current_user).not.toHaveProperty('password_hash');
    });
  });

  describe('Token Validation', () => {
    test('should reject token with tampered payload', async () => {
      const tamperedToken = csToken.split('.').map((part, index) => {
        if (index === 1) {
          return btoa('{"id":999,"email":"hacker@example.com"}');
        }
        return part;
      }).join('.');

      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, tamperedToken);

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expectErrorResponse(response.data);
    });

    test('should reject token with invalid signature', async () => {
      const parts = csToken.split('.');
      const invalidToken = `${parts[0]}.${parts[1]}.invalidsignature`;

      const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, invalidToken);

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expectErrorResponse(response.data);
    });
  });
});
