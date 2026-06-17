import { describe, test, expect } from 'vitest';
import { post } from '../../../utils/helpers/api.helper.js';
import { getCSCredential } from '../../../utils/helpers/credentials.helper.js';
import { API_AIGEN_ENDPOINTS } from '../../../utils/constants/api-endpoint.constant.js';
import { HTTP_METHODS, HTTP_STATUS } from '../../../utils/constants/http.constant.js';
import {
  expectStandardResponseStructure,
  expectErrorResponse,
  expectResponseToMatchSchema,
} from '../../../utils/helpers/schema.helper.js';

describe('Authentication - Password Reset', () => {
  const testUser = getCSCredential('mrr');

  describe('POST /auth/basic/forgot-password', () => {
    test('should initiate password reset with valid email', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: testUser.email,
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.OK);
      expectStandardResponseStructure(response.data);
    });

    test('should fail forgot password with non-existent email', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: `nonexistent${Date.now()}@example.com`,
      });

      // API returns 404 for non-existent emails (not documented in OpenAPI spec)
      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expectErrorResponse(response.data);
    });

    test('should fail forgot password with missing email', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, {});

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail forgot password with invalid email format', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: 'invalid-email-format',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail forgot password with empty email', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: '',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });
  });

  describe('POST /auth/basic/reset-password', () => {
    test('should fail reset password with missing token', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, {
        password: 'NewPassword123!',
        confirm_password: 'NewPassword123!',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail reset password with invalid token', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: 'invalid.reset.token',
        password: 'NewPassword123!',
        confirm_password: 'NewPassword123!',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail reset password with mismatched passwords', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: 'some.valid.token',
        password: 'NewPassword123!',
        confirm_password: 'DifferentPassword123!',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail reset password with weak password', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: 'some.valid.token',
        password: '123',
        confirm_password: '123',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail reset password with missing password', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: 'some.valid.token',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail reset password with expired token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.test';

      const response = await post(API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: expiredToken,
        password: 'NewPassword123!',
        confirm_password: 'NewPassword123!',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });
  });

  describe('Password Reset Flow Validation', () => {
    test('should return proper response structure for forgot password', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: testUser.email,
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.FORGOT_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.OK);
      expectStandardResponseStructure(response.data);
    });

    test('should validate password complexity requirements', async () => {
      const weakPasswords = [
        'short',
        'alllowercase',
        'ALLUPPERCASE',
        '12345678',
        'NoSpecialChar123',
      ];

      for (const password of weakPasswords) {
        const response = await post(API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, {
          token: 'some.valid.token',
          password: password,
          confirm_password: password,
        });

        expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.RESET_PASSWORD, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
        expectErrorResponse(response.data);
      }
    });
  });
});
