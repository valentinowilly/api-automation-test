import axios from 'axios';
import env from '../../config/env.js';

const api = axios.create({
  baseURL: env.api.importPrGatewayBaseURL,
  timeout: env.api.timeout,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': env.importPrGatewayAuth.aigenApiKey,
  },
  validateStatus: () => true,
});

api.interceptors.request.use(
  (config) => {
    if (env.logging.logRequests) {
      // console.log('\n📤 API Request:');
      // console.log(`  ${config.method.toUpperCase()} ${config.url}`);
      if (config.headers.Authorization) {
        const token = config.headers.Authorization.replace('Bearer ', '');
        // console.log(`  Auth: Bearer ${token.substring(0, 20)}...`);
      }
      if (config.params) {
        // console.log('  Query Params:', JSON.stringify(config.params, null, 2));
      }
      if (config.data && config.headers['Content-Type'] === 'application/json') {
        // console.log('  Body:', JSON.stringify(config.data, null, 2));
      }
    }

    return config;
  },
  (error) => {
    // console.error('❌ Request Error:', error.message);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (env.logging.logResponses) {
      // console.log('\n📥 API Response:');
      // console.log(`  Status: ${response.status} ${response.statusText}`);
      // console.log(`  URL: ${response.config.method.toUpperCase()} ${response.config.url}`);
      if (response.data) {
        const dataPreview = JSON.stringify(response.data, null, 2);
        const preview = dataPreview.length > 500
          ? dataPreview.substring(0, 500) + '...'
          : dataPreview;
        // console.log('  Data:', preview);
      }
    }
    return response;
  },
  (error) => {
    // console.error('\n❌ Response Error:');
    if (error.response) {
      // console.error(`  Status: ${error.response.status} ${error.response.statusText}`);
      // console.error('  Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // console.error('  No response received');
      // console.error('  Request:', error.request);
    } else {
      // console.error('  Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export const createAuthHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});

export const get = async (url, options = {}) => {
  return api.get(url, options);
};

export const post = async (url, data, options = {}) => {
  return api.post(url, data, options);
};

export const put = async (url, data, options = {}) => {
  return api.put(url, data, options);
};

export const patch = async (url, data, options = {}) => {
  return api.patch(url, data, options);
};

export const del = async (url, options = {}) => {
  return api.delete(url, options);
};

export const authenticatedGet = async (url, token, options = {}) => {
  return api.get(url, {
    ...options,
    headers: {
      ...options.headers,
      ...createAuthHeader(token),
    },
  });
};

export const authenticatedPost = async (url, data, token, options = {}) => {
  return api.post(url, data, {
    ...options,
    headers: {
      ...options.headers,
      ...createAuthHeader(token),
    },
  });
};

export default {
  api,
  get,
  post,
  put,
  patch,
  del,
  createAuthHeader,
  authenticatedGet,
  authenticatedPost,
};
