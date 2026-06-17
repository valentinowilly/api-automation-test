import { authenticatedPut, authenticatedPost } from "../../../../utils/helpers/api.helper.js";
import { API_AIGEN_ENDPOINTS } from "../../../../utils/constants/api-endpoint.constant.js";
import { executeQuery } from "../../../../utils/helpers/db.helper.js";
import { STATUS_MILESTONE, STATUS_VENDOR, STATUS_DIC } from "../../../../utils/constants/milestone.constant.js";
import { expect } from "vitest";

export async function vendorSubmitQuotation(rfqItems, token) {
  const payload = {
    items: rfqItems.map((item) => {
      return {
        id: item.id,
        status_vendor: STATUS_VENDOR.APPROVE,
        vendor_price: item.vendor_price ?? item.item_value * item.quantity ?? 10000,
        quotation_number: `QE${Date.now().toString(36).toUpperCase()}`,
        vendor_description: `E2E Test quotation for ${item.item_text || "test item"}`,
        vendor_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        vendor_brand: "Test Brand",
        vendor_warranty: 12,
        vendor_address_details: "Test Address",
        vendor_sloc: "2001",
      };
    }),
    is_submit: 1,
  };

  // console.log('Vendor Submit Quotation Payload:', payload);


  const response = await authenticatedPut(API_AIGEN_ENDPOINTS.PR.VENDOR_SUBMIT_PENAWARAN, payload, token, {
    "Content-Type": "application/json",
  });


  return response;
}

export async function dicConfirmQuotation(rfqItems, dicDecisions, token) {
  const payload = {
    items: rfqItems.map((item, index) => ({
      id: item.id,
      status_dic: dicDecisions[index]?.status_dic || STATUS_DIC.APPROVE,
      ...(dicDecisions[index]?.reject_reason ? { reject_reason: dicDecisions[index].reject_reason } : {}),
    })),
    is_submit: 1,
  };

  const response = await authenticatedPut(API_AIGEN_ENDPOINTS.PR.DIC_KONFIRMASI_PENAWARAN, payload, token);

  return response;
}

export async function csSendToQCF(rfqNumber, vendorBatch, qcfItems, rfqTipe, csToken) {
  const endpoint = `${API_AIGEN_ENDPOINTS.PR.CS_SEND_TO_QCF}/${rfqNumber}/${vendorBatch}`;

  const payload = {

    items: qcfItems.map((item) => ({ id: item.id })),
    rfq_tipe: rfqTipe || "standard",
  };
  const response = await authenticatedPost(endpoint, payload, csToken);
  expect(response.status, `csSendToQCF failed: ${JSON.stringify(response.data)}`).toBe(200);
  return response;
}

export async function csSendSurrogate(rfqNumber, vendorBatch, itemIds, csToken) {
  const endpoint = `${API_AIGEN_ENDPOINTS.PR.CS_SEND_SURROGATE}/${rfqNumber}/${vendorBatch}`;

  const payload = {
    items: itemIds.map((id) => ({ id })),
    rfq_tipe: "surrogate",
  };

  const response = await authenticatedPost(endpoint, payload, csToken);

  return response;
}

export async function csResendRFQ(rfqNumber, vendorBatch, vendorCode, itemCodes, csToken) {
  const endpoint = `${API_AIGEN_ENDPOINTS.EMAIL.RESEND_RFQ_BY_VENDOR}/${rfqNumber}/${vendorBatch}/${vendorCode}`;

  const payload = {
    item_codes: itemCodes,
  };

  console.log("Resend RFQ payload:", payload);

  const response = await authenticatedPost(endpoint, payload, csToken);

  console.log("Resend RFQ response:", response.data);
  return response;
}

export async function clApproveQCF(qcfNumber, clToken, clComment = "E2E Test: Approved by CL") {
  const endpoint = `${API_AIGEN_ENDPOINTS.PR.CL_APPROVE_QCF}/${qcfNumber}`;

  const payload = {
    cl_comment: clComment,
  };

  const response = await authenticatedPut(endpoint, payload, clToken);

  try {
    expect(response.status).toBe(200);
  } catch (err) {
    err.message = `clApproveQCF failed: ${JSON.stringify(response.data)}: ${err.message}`;
    throw err;
  }

  return response;
}

export async function managementApproveQCF(
  qcfNumber,
  managementToken,
  managementComment = "E2E Test: Approved by Management",
) {
  const endpoint = `${API_AIGEN_ENDPOINTS.PR.MANAGEMENT_APPROVE_QCF}/${qcfNumber}`;

  const payload = {
    management_comment: managementComment,
  };

  const response = await authenticatedPut(endpoint, payload, managementToken);

  try {
    expect(response.status).toBe(200);
  } catch (err) {
    err.message = `managementApproveQCF failed: ${JSON.stringify(response.data)}: ${err.message}`;
    throw err;
  }

  return response;
}

export async function verifyRFQMilestone(rfqNumber, expectedMilestone) {
  const rfq = await executeQuery("SELECT status_milestone FROM rfq_library WHERE rfq_number = ?", [rfqNumber]);

  if (!rfq || rfq.length === 0) {
    throw new Error(`RFQ ${rfqNumber} not found in database`);
  }

  return rfq[0].status_milestone === expectedMilestone;
}

export async function getRFQItems(rfqNumber, vendorBatch = null) {
  let query = "SELECT * FROM rfq_library WHERE rfq_number = ?";
  const params = [rfqNumber];

  if (vendorBatch !== null) {
    query += " AND vendor_batch = ?";
    params.push(vendorBatch);
  }

  return executeQuery(query, params);
}

export async function getQCFItems(rfqNumber) {
  return executeQuery("SELECT * FROM qcf_library WHERE rfq_number = ?", [rfqNumber]);
}

export async function verifyVendorSequence(rfqNumber, expectedVendorSequence) {
  const rfqItems = await executeQuery("SELECT DISTINCT vendor_sequence FROM rfq_library WHERE rfq_number = ?", [
    rfqNumber,
  ]);

  const sequences = rfqItems.map((item) => item.vendor_sequence);
  return sequences.includes(expectedVendorSequence);
}

export async function verifyRFQTokenCreated(rfqNumber, userType, vendorBatch = null) {
  let query = "SELECT * FROM rfq_token_email WHERE rfq_number = ? AND user_type = ? AND is_active = 1";
  const params = [rfqNumber, userType];

  if (vendorBatch !== null) {
    query += " AND vendor_batch = ?";
    params.push(vendorBatch);
  }

  query += " ORDER BY created_at DESC LIMIT 1";

  const tokens = await executeQuery(query, params);
  return tokens.length > 0 ? tokens[0] : null;
}

export async function verifyQCFTokenCreated(qcfNumber, userType) {
  const tokens = await executeQuery(
    "SELECT * FROM qcf_token_email WHERE qcf_number = ? AND user_type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1",
    [qcfNumber, userType],
  );
  return tokens.length > 0 ? tokens[0] : null;
}

export async function verifyVendorBatchesCreated(rfqNumber) {
  const batches = await executeQuery(
    "SELECT DISTINCT vendor_batch FROM rfq_library WHERE rfq_number = ? ORDER BY vendor_batch",
    [rfqNumber],
  );
  return batches.map((b) => b.vendor_batch);
}

export async function getVendorTokenByVendorType(rfqNumber, vendorType, activeOnly = true) {
  let query = `
    SELECT rte.* FROM rfq_token_email rte
    JOIN rfq_library rl ON rl.rfq_number = rte.rfq_number AND rl.vendor_code = rte.vendor_code
    WHERE rte.rfq_number = ? AND rte.user_type = 'vendor' AND rl.vendor_type = ?
  `;
  const params = [rfqNumber, vendorType];

  if (activeOnly) {
    query += " AND rte.is_active = 1";
  }

  query += " ORDER BY rte.created_at DESC LIMIT 1";

  const rows = await executeQuery(query, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function getVendorTypesList(rfqNumber) {
  const rows = await executeQuery("SELECT DISTINCT vendor_type FROM rfq_library WHERE rfq_number = ?", [rfqNumber]);
  return rows.map((r) => r.vendor_type);
}

export async function getRFQItemsByVendorType(rfqNumber, vendorType) {
  return executeQuery("SELECT * FROM rfq_library WHERE rfq_number = ? AND vendor_type = ?", [rfqNumber, vendorType]);
}
