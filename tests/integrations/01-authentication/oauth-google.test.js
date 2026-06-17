import { describe, test, expect } from 'vitest';
import { post } from '../../../utils/helpers/api.helper.js';
import { API_AIGEN_ENDPOINTS } from '../../../utils/constants/api-endpoint.constant.js';
import { HTTP_METHODS, HTTP_STATUS } from '../../../utils/constants/http.constant.js';
import { expectErrorResponse, expectResponseToMatchSchema } from '../../../utils/helpers/schema.helper.js';

describe('Authentication - OAuth Google', () => {
  describe('POST /auth/login/oauth/google', () => {
    test('should fail login with missing Google token', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, {});

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail login with invalid Google token', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, {
        id_token: 'invalid.google.token',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail login with empty token', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, {
        id_token: '',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail login with malformed token', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, {
        id_token: 'malformed-token-without-dots',
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should fail login with expired Google token', async () => {
      const expiredToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiJ0ZXN0IiwiYXVkIjoidGVzdCIsInN1YiI6IjEyMzQ1Njc4OTAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJleHAiOjE1MTYyMzkwMjJ9.test';

      const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, {
        id_token: expiredToken,
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });
  });

  describe('OAuth Google Response Validation', () => {
    test('should return proper error structure for missing token', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, {});

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });

    test('should handle network errors gracefully', async () => {
      const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, {
        id_token: null,
      });

      expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_OAUTH_GOOGLE, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
      expectErrorResponse(response.data);
    });
  });
});
