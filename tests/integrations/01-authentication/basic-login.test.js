import { describe, test, expect } from 'vitest';
import { authenticatedGet, post } from '../../../utils/helpers/api.helper.js';
import { getCSCredential } from '../../../utils/helpers/credentials.helper.js';
import { API_AIGEN_ENDPOINTS } from '../../../utils/constants/api-endpoint.constant.js';
import { HTTP_METHODS, HTTP_STATUS } from '../../../utils/constants/http.constant.js';
import {
  expectResponseToMatchSchema,
  expectStandardResponseStructure,
  expectErrorResponse,
} from '../../../utils/helpers/schema.helper.js';

describe('Authentication - Basic Login', () => {
  // Use existing CS user from credentials
  const testUser = getCSCredential('mrr');

  test('should login successfully with valid credentials', async () => {
    const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
      identifier: testUser.email,
      password: testUser.password,
    });

    expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, HTTP_METHODS.POST, HTTP_STATUS.OK);
    expectStandardResponseStructure(response.data);
  });

  test('should fail login with invalid email', async () => {
    const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
      identifier: 'nonexistent@example.com',
      password: 'TestPassword123!',
    });

    expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
    expectErrorResponse(response.data);
  });

  test('should fail login with invalid password', async () => {
    const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
      identifier: testUser.email,
      password: 'WrongPassword123!',
    });

    expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
    expectErrorResponse(response.data);
  });

  test('should fail login with missing email', async () => {
    const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
      password: 'TestPassword123!',
    });

    expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
    expectErrorResponse(response.data);
  });

  test('should fail login with missing password', async () => {
    const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
      identifier: testUser.email,
    });

    expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, HTTP_METHODS.POST, HTTP_STATUS.BAD_REQUEST);
    expectErrorResponse(response.data);
  });

  test('should access protected endpoint with valid token', async () => {
    const loginResponse = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
      identifier: testUser.email,
      password: testUser.password,
    });

    const token = loginResponse.data.data.access_token;

    const meResponse = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, token);

    expectResponseToMatchSchema(meResponse, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.OK);
    expectStandardResponseStructure(meResponse.data);
    expect(meResponse.data.data).toHaveProperty('current_user');
    expect(meResponse.data.data.current_user).toHaveProperty('email', testUser.email);
  });

  test('should fail to access protected endpoint without token', async () => {
    const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, '');

    expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.UNAUTHORIZED);
    expectErrorResponse(response.data);
  });

  test('should fail to access protected endpoint with invalid token', async () => {
    const invalidToken = 'invalid.jwt.token';

    const response = await authenticatedGet(API_AIGEN_ENDPOINTS.AUTH.ME, invalidToken);

    expectResponseToMatchSchema(response, API_AIGEN_ENDPOINTS.AUTH.ME, HTTP_METHODS.GET, HTTP_STATUS.UNAUTHORIZED);
    expectErrorResponse(response.data);
  });
});
