import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import { query } from '../../config/database.js';
import { addBusinessDays } from './date.helper.js';
import { ROLES } from '../constants/role.constant.js';
import { API_AIGEN_ENDPOINTS } from '../constants/api-endpoint.constant.js';
import {
  getAdminCredential,
  getDicCredential,
  getCLCredential,
  getCSCredential,
} from './credentials.helper.js';
import { post, authenticatedGet } from './api.helper.js';

/**
 * Login as a specific role using credentials from credentials.json
 * Uses the /auth/login/basic endpoint to authenticate
 *
 * @param {string} role - User role (CS, CL, DIC, ADMIN)
 * @param {string} category - Category for CL/CS roles (mrr, it, gsl) - defaults to 'mrr'
 * @returns {Promise<string>} - JWT access token
 */
export const loginAs = async (role = ROLES.CS, category = 'mrr') => {
  let credential;

  switch (role) {
    case ROLES.ADMIN:
      credential = getAdminCredential();
      break;
    case ROLES.DIC:
      credential = getDicCredential();
      break;
    case ROLES.CL:
      credential = getCLCredential(category);
      break;
    case ROLES.CS:
      credential = getCSCredential(category);
      break;
    default:
      throw new Error(`Unsupported role: ${role}. Use CS, CL, DIC, or ADMIN.`);
  }

  try {
    // Call the actual login endpoint
    const response = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
      identifier: credential.email,
      password: credential.password,
    });

    // Extract and return the access token
    const token = response.data?.data?.access_token;

    if (!token) {
      throw new Error('Login response did not contain access_token');
    }

    return token;
  } catch (error) {
    console.error(`Login failed for ${credential.email}:`, error);
    throw new Error(
      `Login failed for ${credential.email}: ${error.response?.data?.message || error.message}`
    );
  }
};

/**
 * Login as a vendor by vendor_code.
 * 1. Looks up vendor email from GET /master/vendors?search=<vendorCode>
 * 2. Logs in via POST /auth/login/basic with the standard test password
 * Returns a proper vendor account JWT (payload has data.vendor_code set by backend).
 *
 * @param {string} vendorCode - Vendor code to look up (vendor_number in master data)
 * @param {string} adminToken - A valid admin/CS JWT to authenticate the /master/vendors call
 * @returns {Promise<string>} - Vendor account access token
 */
export const loginAsVendorByCode = async (vendorCode, adminToken) => {
  const response = await authenticatedGet(API_AIGEN_ENDPOINTS.MASTER.VENDORS, adminToken, {
    params: { search: vendorCode },
  });
  const items = response.data?.data?.data ?? response.data?.data ?? [];
  const vendor = items.find(v => v.vendor_number === vendorCode);
  if (!vendor) throw new Error(`Vendor with code ${vendorCode} not found in /master/vendors`);

  const password = getAdminCredential().password;
  const loginResponse = await post(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
    identifier: vendor.vendor_email,
    password,
  });
  const token = loginResponse.data?.data?.access_token;
  if (!token) throw new Error(`Vendor login failed for ${vendor.vendor_email}`);
  return token;
};

export default {
  loginAs,
  loginAsVendorByCode,
};
