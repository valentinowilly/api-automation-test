import { authenticatedPost, authenticatedDelete, authenticatedGet } from '../../../../utils/helpers/api.helper.js';
import { API_MOCK_ENDPOINTS } from '../../../../utils/constants/api-endpoint.constant.js';
import { executeQuery } from '../../../../utils/helpers/db.helper.js';
import jwt from 'jsonwebtoken';
import env from '../../../../config/env.js';
import { HTTP_STATUS } from '../../../../utils/constants/http.constant.js';
import { SERVER_GROUPS } from '../../../../utils/constants/server-group.constant.js';
import { expect } from 'vitest';

function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function generatePRNumber(serverGroup) {
  // Generate a unique PR number using a prefix and a unique ID maximum 15 characters to fit typical PR number formats
  
  const uniqueTimestamp = Date.now().toString(36).toUpperCase();
  const prefix = serverGroup === SERVER_GROUPS.BCG ? `${SERVER_GROUPS.BCG}_TEST` : `${SERVER_GROUPS.GEMS}_TEST`;
  const prNumber = `${prefix}${uniqueTimestamp}`;

  // Ensure the PR number does not exceed 15 characters (common limit for PR numbers)
  return prNumber.length > 15 ? prNumber.substring(0, 15) : prNumber;
}

export async function createMockSearchLibrary(searchLibraryData, adminToken) {
  console.log(`=== Creating Mock Search Library with PR Number: ${searchLibraryData.pr_number} ===`);

  const response = await authenticatedPost(
    API_MOCK_ENDPOINTS.SEARCH_LIBRARY,
    [searchLibraryData],
    adminToken
  );

  const successStatuses = [
    HTTP_STATUS.OK,
    HTTP_STATUS.CREATED,
    HTTP_STATUS.ACCEPTED,
  ];

  if (!successStatuses.includes(response.status)) {
    console.error('Failed to create mock search library:', response.data);
    throw new Error(`Failed to create mock search library: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

/**
 * Create multiple search library items sharing the same pr_number (multi-line PR).
 * @param {object[]} items - Array of search library data objects (same pr_number)
 * @param {string} adminToken
 */
export async function createMockSearchLibraryBatch(items, adminToken) {
  console.log(`=== Creating Mock Search Library Batch: ${items.length} items for PR ${items[0]?.pr_number} ===`);

  const response = await authenticatedPost(
    API_MOCK_ENDPOINTS.SEARCH_LIBRARY,
    items,
    adminToken
  );

  const successStatuses = [HTTP_STATUS.OK, HTTP_STATUS.CREATED, HTTP_STATUS.ACCEPTED];

  if (!successStatuses.includes(response.status)) {
    console.error('Failed to create mock search library batch:', response.data);
    throw new Error(`Failed to create mock search library batch: ${JSON.stringify(response.data)}`);
  }

  expect(successStatuses).toContain(response.status)

  return response.data;
}

/**
 * Build an array of BCG search library items sharing the same pr_number.
 * Each item has a distinct material_number (1, 2, 3...) and unique nomor_material_sap.
 * @param {number} count - Number of line items to generate (default 3)
 * @param {object} baseOverrides - Overrides applied to every item (pr_number will be auto-shared)
 */
export function buildBCGSearchLibraryMultiItemData(count = 3, baseOverrides = {}) {
  const sharedPrNumber = baseOverrides.pr_number || generatePRNumber('BCG');
  return Array.from({ length: count }, (_, i) =>
    buildBCGSearchLibraryData({
      ...baseOverrides,
      pr_number: sharedPrNumber,
      material_number: String(i + 1),
      nomor_material_sap: String(Math.floor(Math.random() * 9000000000) + 1000000000),
    })
  );
}

export function buildBCGSearchLibraryData(overrides = {}) {
  const uniqueId = generateUniqueId();
  const prNumber = generatePRNumber('BCG');

  return {
    tipe_data: 'DETAIL',
    pr_number: prNumber,
    im_number: null,
    pi_number: null,
    jumlah_po: 0,
    po_number: null,
    material_identification: 'M',
    material_number: '1',
    pr_type: 'ZST',
    pr_material_number: null,
    pr_material_group: 'BOLT, NUT AND WASHER',
    pr_service_group: null,
    pr_material_group_number: '5300',
    pr_service_group_number: null,
    pr_requestor_user: 'Agus SB',
    pr_requestor_email: 'agus.setiabudi@ckb.co.id;agus.setiabudi@mtl.co.id',
    pr_creator_user: 'Agus Setia Budi',
    pr_creator_email: 'agus.setiabudi@mtl.co.id',
    text: `Test Material E2E Skip Level 1 ${uniqueId}`,
    tipe: 'PR',
    qty_item: 5,
    unit_item: 'PC',
    value: 4500,
    currency: 'USD',
    src_value: 63750000,
    src_currency: 'IDR',
    groups: SERVER_GROUPS.BCG,
    company: '2100',
    create_date: new Date().toISOString(),
    pr_release_date: new Date().toISOString(),
    po_create_date: null,
    po_release_date: null,
    status: 'Full Release',
    outline: null,
    spend_channel: null,
    pr_close: null,
    division: 'All',
    purchase_group: 'Logistic BC (MTL)',
    approval_leadtime: 1,
    qcf_leadtime: null,
    pr_risk: null,
    pr_permit1: null,
    pr_permit2: null,
    pr_permit3: null,
    region: null,
    price_item_idr: 85000,
    acc_assign: null,
    purchase_group_code: 'C53',
    oa_number: null,
    oa_valid_end: null,
    oa_category: null,
    oa_requester: null,
    text_repeatorder: null,
    interim: null,
    c1_pic: 'Test L1',
    c1_leadtime: 1,
    c1_division: 'Test Division',
    is_delete: 0,
    is_oa: 0,
    is_da: false,
    oem: null,
    plant_code: 'C100',
    plant_name: 'Test Plant',
    delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    external_material_group: '5340',
    external_material_group_name: 'HARDWARE, COMMERCIAL',
    nomor_material_sap: String(Math.floor(Math.random() * 9000000000) + 1000000000),
    ...overrides,
  };
}

export function buildGEMSSearchLibraryData(overrides = {}) {
  const uniqueId = generateUniqueId();
  const prNumber = generatePRNumber('GEMS');

  return {
    tipe_data: 'DETAIL',
    pr_number: prNumber,
    im_number: null,
    pi_number: null,
    jumlah_po: 0,
    po_number: null,
    material_identification: 'M',
    material_number: '1',
    pr_type: 'ZST',
    pr_material_number: null,
    pr_material_group: 'BOLT, NUT AND WASHER',
    pr_service_group: null,
    pr_material_group_number: '5300',
    pr_service_group_number: null,
    pr_requestor_user: 'Agus SB',
    pr_requestor_email: 'agus.setiabudi@ckb.co.id;agus.setiabudi@mtl.co.id',
    pr_creator_user: 'Agus Setia Budi',
    pr_creator_email: 'agus.setiabudi@mtl.co.id',
    text: `Test Material E2E Skip Level 1 ${uniqueId}`,
    tipe: 'PR',
    qty_item: 3,
    unit_item: 'PC',
    value: 4500,
    currency: 'USD',
    src_value: 4900,
    src_currency: 'IDR',
    groups: SERVER_GROUPS.GEMS,
    company: '3000',
    create_date: new Date().toISOString(),
    pr_release_date: new Date().toISOString(),
    po_create_date: null,
    po_release_date: null,
    status: 'Full Release',
    outline: null,
    spend_channel: null,
    pr_close: null,
    division: 'All',
    purchase_group: 'IT Inf & Proj Dev',
    approval_leadtime: 1,
    qcf_leadtime: null,
    pr_risk: null,
    pr_permit1: null,
    pr_permit2: null,
    pr_permit3: null,
    region: null,
    price_item_idr: 85000,
    acc_assign: null,
    purchase_group_code: 'C53',
    oa_number: null,
    oa_valid_end: null,
    oa_category: null,
    oa_requester: null,
    text_repeatorder: null,
    interim: null,
    c1_pic: 'Test L1',
    c1_leadtime: 1,
    c1_division: 'Test Division',
    is_delete: 0,
    is_oa: 0,
    is_da: false,
    oem: null,
    plant_code: 'C100',
    plant_name: 'Test Plant',
    delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    external_material_group: '5340',
    external_material_group_name: 'HARDWARE, COMMERCIAL',
    nomor_material_sap: String(Math.floor(Math.random() * 9000000000) + 1000000000),
    ...overrides,
  };
}

export async function createMockRFQ(rfqData, adminToken) {
  const response = await authenticatedPost(
    API_MOCK_ENDPOINTS.RFQ_CREATE,
    rfqData,
    adminToken
  );

  console.log('Create Mock RFQ Response:', response.status, response.data);

  const successStatuses = [
    HTTP_STATUS.OK,
    HTTP_STATUS.CREATED,
    HTTP_STATUS.ACCEPTED,
  ];

  if (!successStatuses.includes(response.status)) {
    console.error('Failed to create mock RFQ:', response.data);
    throw new Error(`Failed to create mock RFQ: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

export async function deleteMockRFQ(rfqNumber, adminToken) {
  const response = await authenticatedDelete(
    `${API_MOCK_ENDPOINTS.RFQ_DELETE}/${rfqNumber}`,
    adminToken
  );

  return response;
}

export async function cleanupRFQData(rfqNumber) {
  try {
    await executeQuery('DELETE FROM rfq_library WHERE rfq_number = ?', [rfqNumber]);
    await executeQuery('DELETE FROM rfq_token_email WHERE rfq_number = ?', [rfqNumber]);
    await executeQuery('DELETE FROM pr_library WHERE rfq_number = ?', [rfqNumber]);
    await executeQuery('DELETE FROM log_sla WHERE rfq_number = ?', [rfqNumber]);
  } catch (error) {
    console.error(`Cleanup warning for RFQ ${rfqNumber}:`, error.message);
  }
}

export async function cleanupQCFData(qcfNumber) {
  try {
    await executeQuery('DELETE FROM qcf_library WHERE qcf_number = ?', [qcfNumber]);
    await executeQuery('DELETE FROM qcf_token_email WHERE qcf_number = ?', [qcfNumber]);
  } catch (error) {
    console.error(`Cleanup warning for QCF ${qcfNumber}:`, error.message);
  }
}

export async function cleanupSearchLibraryData(prNumber) {
  try {
    await executeQuery('DELETE FROM search_library WHERE pr_number = ?', [prNumber], 'isearch');
  } catch (error) {
    console.error(`Cleanup warning for PR ${prNumber}:`, error.message);
  }
}

export async function cleanupAllTestData(rfqNumber, qcfNumber = null, prNumber = null) {
  // Delete QCF data first to avoid foreign key constraint on rfq_library
  if (qcfNumber) {
    await cleanupQCFData(qcfNumber);
  } else {
    try {
      await executeQuery('DELETE FROM qcf_library WHERE rfq_number = ?', [rfqNumber]);
      await executeQuery('DELETE FROM qcf_token_email WHERE rfq_number = ?', [rfqNumber]);
    } catch (error) {
      console.error(`Cleanup warning for QCF via RFQ ${rfqNumber}:`, error.message);
    }
  }

  await cleanupRFQData(rfqNumber);

  if (prNumber) {
    await cleanupSearchLibraryData(prNumber);
  }
}

export function generateVendorToken(payload, expiryDays = 3) {
  return jwt.sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60),
    },
    env.jwt.secret
  );
}

export async function getRFQByNumber(rfqNumber) {
  const rows = await executeQuery(
    'SELECT * FROM rfq_library WHERE rfq_number = ?',
    [rfqNumber]
  );
  return rows[0] || null;
}

export async function getRFQTokenByEmail(rfqNumber, userType, vendorBatch = null) {
  let query = 'SELECT * FROM rfq_token_email WHERE rfq_number = ? AND user_type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1';
  const params = [rfqNumber, userType];

  const rows = await executeQuery(query, params);
  return rows[0] || null;
}

export async function getQCFByNumber(qcfNumber) {
  const rows = await executeQuery(
    'SELECT * FROM qcf_library WHERE qcf_number = ?',
    [qcfNumber]
  );
  return rows[0] || null;
}

export async function getQCFToken(qcfNumber, userType) {
  const rows = await executeQuery(
    'SELECT * FROM qcf_token_email WHERE qcf_number = ? AND user_type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
    [qcfNumber, userType]
  );
  return rows[0] || null;
}