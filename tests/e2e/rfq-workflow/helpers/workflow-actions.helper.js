import { authenticatedPut, authenticatedPost } from "../../../../utils/helpers/api.helper.js";
import { executeQuery } from "../../../../utils/helpers/db.helper.js";
import { STATUS_VENDOR, STATUS_DIC, RFQ_TYPES, VENDOR_TYPE } from "../../../../utils/constants/milestone.constant.js";
import { API_AIGEN_ENDPOINTS } from "../../../../utils/constants/api-endpoint.constant.js";
import {
  vendorSubmitQuotation,
  dicConfirmQuotation,
  csSendToQCF as csSendToQCFBase,
  clApproveQCF as clApproveQCFBase,
  managementApproveQCF as managementApproveQCFBase,
  csSendSurrogate as csSendSurrogateBase,
  csResendRFQ as csResendRFQBase,
  getRFQItems,
  getRFQItemsByVendorType,
  getQCFItems,
} from "../../config-autopo/helpers/e2e-workflow.helper.js";
import { expect } from "vitest";

// The DIC endpoint uses authenticateTokenEmail — requires the email-link token from
// rfq_token_email table, NOT the dashboard JWT from loginAs(ROLES.DIC).
export async function getDICEmailToken(rfqNumber) {
  const rows = await executeQuery(
    `SELECT rfq_token FROM rfq_token_email
     WHERE rfq_number = ? AND user_type = 'dic' AND is_active = 1
     ORDER BY created_at DESC LIMIT 1`,
    [rfqNumber],
  );
  if (!rows.length) throw new Error(`No active DIC email token found for RFQ ${rfqNumber}`);
  return rows[0].rfq_token;
}

function buildVendorPayload(items, statusVendor) {
  return {
    items: items.map((item) => ({
      id: item.id,
      status_vendor: statusVendor,
      vendor_price: item.value ?? 10000,
      quotation_number: `QE${Date.now().toString(36).toUpperCase()}`,
      vendor_description: `E2E Test quotation for ${item.item_text || "test item"}`,
      vendor_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      vendor_brand: statusVendor === STATUS_VENDOR.REJECT ? "-" : "Test Brand",
      vendor_warranty: statusVendor === STATUS_VENDOR.REJECT ? 0 : 12,
      vendor_address_details: statusVendor === STATUS_VENDOR.REJECT ? "-" : "Test Address",
      vendor_sloc: "2001",
    })),
    is_submit: 1,
  };
}

// ─── Vendor actions ───────────────────────────────────────────────────────────

export async function vendorAccept(rfqNumber, vendorToken, vendorType = VENDOR_TYPE.DIRECT) {
  const items = await getRFQItemsByVendorType(rfqNumber, vendorType);
  return vendorSubmitQuotation(items, vendorToken);
}

export async function vendorAcceptOE(
  rfqNumber,
  vendorToken,
  vendorType = VENDOR_TYPE.DIRECT,
  oePriceMultiplierInPercentage = 105,
) {
  const items = await getRFQItemsByVendorType(rfqNumber, vendorType);
  const oeItems = items.map((item) => {
    const vendorPrice = Math.round((item.item_value ?? 10000) * (oePriceMultiplierInPercentage / 100));

    return {
      ...item,
      vendor_price: vendorPrice,
    };
  });
  return vendorSubmitQuotation(oeItems, vendorToken);
}

export async function vendorNeedConfirm(rfqNumber, vendorToken, vendorType = VENDOR_TYPE.DIRECT) {
  const items = await getRFQItemsByVendorType(rfqNumber, vendorType);
  const payload = buildVendorPayload(items, STATUS_VENDOR.NEED_CONFIRMATION);
  return authenticatedPut(API_AIGEN_ENDPOINTS.PR.VENDOR_SUBMIT_PENAWARAN, payload, vendorToken);
}

export async function vendorDecline(rfqNumber, vendorToken, vendorType = VENDOR_TYPE.DIRECT) {
  const items = await getRFQItemsByVendorType(rfqNumber, vendorType);
  let payload = buildVendorPayload(items, STATUS_VENDOR.REJECT);
  payload = {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      vendor_reject_reason: "E2E Test: Vendor declined this item",
    })),
  };
  const response = await authenticatedPut(API_AIGEN_ENDPOINTS.PR.VENDOR_SUBMIT_PENAWARAN, payload, vendorToken);


  console.log("Vendor Decline Response:", {
    status: response.status,
    data: response.data,
  });
  expect(response.status).toBe(200);

  return response;
}

/**
 * Submit vendor items with a different action per line item.
 * Useful for multi-line PRs where items have mixed statuses.
 *
 * @param {string} rfqNumber
 * @param {string} vendorToken
 * @param {Array<'accept'|'accept_oe'|'need_confirm'|'decline'>} actions - one per item (in DB order)
 * @param {string} [vendorType=VENDOR_TYPE.DIRECT]
 */
export async function vendorSubmitMixed(
  rfqNumber,
  vendorToken,
  actions = ["accept", "accept_oe", "need_confirm"],
  vendorType = VENDOR_TYPE.DIRECT,
) {
  const items = await getRFQItemsByVendorType(rfqNumber, vendorType);
  const payload = {
    items: items.map((item, index) => buildItemPayloadByAction(item, actions[index] ?? "accept")),
    is_submit: 1,
  };
  const response = await authenticatedPut(API_AIGEN_ENDPOINTS.PR.VENDOR_SUBMIT_PENAWARAN, payload, vendorToken);
  expect(response.status).toBe(200);
  return response;
}

function buildItemPayloadByAction(item, action) {
  const base = {
    id: item.id,
    quotation_number: `QE${Date.now().toString(36).toUpperCase()}`,
    vendor_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    vendor_sloc: "2001",
  };
  switch (action) {
    case "accept_oe":
      return {
        ...base,
        status_vendor: STATUS_VENDOR.APPROVE,
        vendor_price: Math.round((item.item_value ?? 10000) * 1.05),
        vendor_brand: "Test Brand",
        vendor_warranty: 12,
        vendor_address_details: "Test Address",
        vendor_description: "E2E Test: accept above OE",
      };
    case "need_confirm":
      return {
        ...base,
        status_vendor: STATUS_VENDOR.NEED_CONFIRMATION,
        vendor_price: item.item_value ?? 10000,
        vendor_brand: "Test Brand",
        vendor_warranty: 12,
        vendor_address_details: "Test Address",
        vendor_description: "E2E Test: need confirmation",
      };
    case "decline":
      return {
        ...base,
        status_vendor: STATUS_VENDOR.REJECT,
        vendor_price: item.item_value ?? 10000,
        vendor_brand: "-",
        vendor_warranty: 0,
        vendor_address_details: "-",
        vendor_description: "E2E Test: declined",
        vendor_reject_reason: "E2E Test: declined",
      };
    case "accept":
    default:
      return {
        ...base,
        status_vendor: STATUS_VENDOR.APPROVE,
        vendor_price: item.item_value ?? 10000,
        vendor_brand: "Test Brand",
        vendor_warranty: 12,
        vendor_address_details: "Test Address",
        vendor_description: "E2E Test: accept below OE",
      };
  }
}

// ─── DIC actions ─────────────────────────────────────────────────────────────

// Pass vendorType to filter items, or null/undefined to act on all submitted items.
// Note: dicToken (dashboard JWT) is kept for signature compatibility but the DIC
// endpoint requires the email-link token — fetched internally from rfq_token_email.
export async function dicAccept(rfqNumber, dicToken, vendorType = null) {
  const items = vendorType ? await getRFQItemsByVendorType(rfqNumber, vendorType) : await getRFQItems(rfqNumber);
  const decisions = items.map(() => ({ status_dic: STATUS_DIC.APPROVE }));
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(items, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

export async function dicRequestRevise(rfqNumber, dicToken, reason = "E2E Test: revision required", vendorType = null) {
  const items = vendorType ? await getRFQItemsByVendorType(rfqNumber, vendorType) : await getRFQItems(rfqNumber);
  const decisions = items.map(() => ({
    status_dic: STATUS_DIC.NEED_REVIEW,
    reject_reason: reason,
  }));
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(items, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

export async function dicDecline(rfqNumber, dicToken, reason = "E2E Test: declined", vendorType = null) {
  const items = vendorType ? await getRFQItemsByVendorType(rfqNumber, vendorType) : await getRFQItems(rfqNumber);
  const decisions = items.map(() => ({
    status_dic: STATUS_DIC.DECLINE,
    reject_reason: reason,
  }));
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(items, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

// Single DIC call that accepts VA items and requests revision for VD items.
// Used in S3 VD-revise scenarios where both vendors submitted and VA was accepted by DIC.
export async function dicAcceptVARequestReviseVD(rfqNumber, dicToken, reason = "E2E Test: revision required") {
  const [vdItems, vaItems] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const allItems = [...vaItems, ...vdItems];
  const decisions = [
    ...vaItems.map(() => ({ status_dic: STATUS_DIC.APPROVE })),
    ...vdItems.map(() => ({
      status_dic: STATUS_DIC.NEED_REVIEW,
      reject_reason: reason,
    })),
  ];
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(allItems, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

// Single DIC call that accepts VD items and declines VA items.
// Used in S3 scenarios where both vendors submitted and DIC chooses VD only.
export async function dicAcceptVDDeclineVA(rfqNumber, dicToken, reason = "E2E Test: VA declined by DIC") {
  const [vdItems, vaItems] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const allItems = [...vdItems, ...vaItems];
  const decisions = [
    ...vdItems.map(() => ({ status_dic: STATUS_DIC.APPROVE })),
    ...vaItems.map(() => ({
      status_dic: STATUS_DIC.DECLINE,
      reject_reason: reason,
    })),
  ];
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(allItems, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

// Single DIC call that accepts VA items and declines VD items.
// Used in S3 scenarios where both vendors submitted and DIC chooses VA only.
export async function dicAcceptVADeclineVD(rfqNumber, dicToken, reason = "E2E Test: VD declined by DIC") {
  const [vdItems, vaItems] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const allItems = [...vaItems, ...vdItems];
  const decisions = [
    ...vaItems.map(() => ({ status_dic: STATUS_DIC.APPROVE })),
    ...vdItems.map(() => ({
      status_dic: STATUS_DIC.DECLINE,
      reject_reason: reason,
    })),
  ];
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(allItems, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

// Single DIC call that requests revision for VD items and declines VA items.
// Used in S3 VD-revise scenarios where both vendors submitted (VD=accept, VA=accept).
export async function dicRequestReviseVDDeclineVA(rfqNumber, dicToken, reason = "E2E Test: revision required") {
  const [vdItems, vaItems] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const allItems = [...vdItems, ...vaItems];
  const decisions = [
    ...vdItems.map(() => ({
      status_dic: STATUS_DIC.NEED_REVIEW,
      reject_reason: reason,
    })),
    ...vaItems.map(() => ({
      status_dic: STATUS_DIC.DECLINE,
      reject_reason: reason,
    })),
  ];
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(allItems, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

// Single DIC call that requests revision for VA items and declines VD items.
// Used in S3 VA-revise scenarios where both vendors submitted (VD=accept, VA=accept).
export async function dicRequestReviseVADeclineVD(rfqNumber, dicToken, reason = "E2E Test: revision required") {
  const [vdItems, vaItems] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const allItems = [...vaItems, ...vdItems];
  const decisions = [
    ...vaItems.map(() => ({
      status_dic: STATUS_DIC.NEED_REVIEW,
      reject_reason: reason,
    })),
    ...vdItems.map(() => ({
      status_dic: STATUS_DIC.DECLINE,
      reject_reason: reason,
    })),
  ];
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(allItems, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

// Single DIC call that accepts VD items and requests revision for VA items.
// Used in S3 VA-revise scenarios where both vendors submitted and VD was accepted by DIC.
export async function dicAcceptVDRequestReviseVA(rfqNumber, dicToken, reason = "E2E Test: revision required") {
  const [vdItems, vaItems] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const allItems = [...vdItems, ...vaItems];
  const decisions = [
    ...vdItems.map(() => ({ status_dic: STATUS_DIC.APPROVE })),
    ...vaItems.map(() => ({
      status_dic: STATUS_DIC.NEED_REVIEW,
      reject_reason: reason,
    })),
  ];
  const token = await getDICEmailToken(rfqNumber);
  const response = await dicConfirmQuotation(allItems, decisions, token);
  expect(response.status).toBe(200);
  return response;
}

// Expire a vendor's token (set date_expired to yesterday) then trigger the vendor
// cron so the backend processes the expiry and sends the DIC review email.
// Used for S3 "no_action" scenarios where the vendor token expired before submission.
// vendorType determines which config_condition and cron stage to use:
//   VENDOR_TYPE.DIRECT      → config_condition='Waiting_vendor_direct_expiry', stage='vendor_direct'
//   VENDOR_TYPE.AGGREGATOR  → config_condition='Waiting_vendor_expiry', stage='vendor'
// skipDICTokenPoll: set true when the cron advances directly to CS (e.g. VD already declined),
// so no DIC email token is created and polling would time out.
export async function expireVendorAndRunCron(
  rfqNumber,
  vendorCode,
  vendorType,
  authToken,
  { skipDICTokenPoll = false } = {},
) {
  const configCondition = vendorType === VENDOR_TYPE.DIRECT ? "Waiting_vendor_direct_expiry" : "Waiting_vendor_expiry";
  const stage = vendorType === VENDOR_TYPE.DIRECT ? "vendor_direct" : "vendor";

  await executeQuery(
    `UPDATE rfq_token_email
     SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
     WHERE rfq_number = ? AND user_type = 'vendor' AND vendor_code = ? AND config_condition = ?`,
    [rfqNumber, vendorCode, configCondition],
  );
  const url = `${API_AIGEN_ENDPOINTS.PR.RUN_CRON}?stage=${stage}&rfq_number=${rfqNumber}`;
  const response = await authenticatedPost(url, {}, authToken);
  expect(response.status).toBe(200);
  if (!skipDICTokenPoll) {
    await pollForDICEmailToken(rfqNumber);
  }
}

async function pollForDICEmailToken(rfqNumber, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await getDICEmailToken(rfqNumber);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`DIC email token not created for RFQ ${rfqNumber} within ${timeoutMs}ms`);
}

// ─── CS actions ───────────────────────────────────────────────────────────────

export async function csSendToQCF(rfqNumber, csToken, vendorType = VENDOR_TYPE.DIRECT) {
  const items = await getRFQItemsByVendorType(rfqNumber, vendorType);
  const vendorBatch = items[0]?.vendor_batch;
  if (!vendorBatch) throw new Error(`No items found for vendor_type=${vendorType} in RFQ ${rfqNumber}`);
  return csSendToQCFBase(rfqNumber, vendorBatch, items, RFQ_TYPES.STANDARD, csToken);
}

export async function csSendSurrogate(rfqNumber, vendorBatch, items, csToken) {
  const itemIds = Array.isArray(items) ? items.map((item) => item.id) : [items];
  return csSendSurrogateBase(rfqNumber, vendorBatch, itemIds, csToken);
}

export async function csResendRFQ(rfqNumber, vendorBatch, vendorCode, itemCodes, csToken) {
  return csResendRFQBase(rfqNumber, vendorBatch, vendorCode, itemCodes, csToken);
}


export async function csSendRevisiOE(rfqNumber, vendorBatch, items, csToken) {
  const endpoint = `${API_AIGEN_ENDPOINTS.PR.CS_SEND_REVISI_OE}/${rfqNumber}/${vendorBatch}`;
  const payload = {
    items: items.map((item) => ({
      id: item.id,
      item_value: item.item_value,
    })),
    rfq_tipe: "revisi_oe",
  };
  const response = await authenticatedPost(endpoint, payload, csToken);
  if (response.status !== 200) {
    console.error("CS Send OE Revision error response:", response.data);
  }
  expect(response.status).toBe(200);
  return response;
}
/**
 * CS triggers Manual Sourcing for an RFQ batch by clicking the "Manual Sourcing" button.
 * Calls POST /pr/cs/send_isourcing/:rfq_number/:vendor_batch (src_type = isourcing).
 *
 * Used by CS32: CS manually escalates to iSourcing (Manual Sourcing) from the CS dashboard.
 *
 * @param {string} rfqNumber
 * @param {string} vendorBatch
 * @param {Array} items
 */
export async function csManualSourcing(rfqNumber, vendorBatch, items, csToken) {
  const url = `/pr/cs/send_isourcing/${rfqNumber}/${vendorBatch}`;

  const response = await authenticatedPost(
    url,
    {
      items,
      rfq_tipe: "isourcing",
      reason: "E2E Test: Manual Sourcing",
    },
    csToken,
  );
  return response;
}

// ─── CL actions ───────────────────────────────────────────────────────────────

export async function clApprove(qcfNumber, clToken, comments = "E2E Test: Approved by CL") {
  return clApproveQCFBase(qcfNumber, clToken, comments);
}

/**
 * Category Lead manually converts RFQ items to manual sourcing (iSourcing).
 *
 * @param {string} rfqNumber
 * @param {string} clToken
 * @param {string} [vendorType=VENDOR_TYPE.DIRECT]
 */
export async function clSendISourcing(rfqNumber, clToken, vendorType = VENDOR_TYPE.DIRECT) {
  const items = await getRFQItemsByVendorType(rfqNumber, vendorType);
  const vendorBatch = items[0]?.vendor_batch;
  if (!vendorBatch) throw new Error(`No items found for vendor_type=${vendorType} in RFQ ${rfqNumber}`);
  const endpoint = `/pr/cs/send_isourcing/${rfqNumber}/${vendorBatch}`;
  const payload = {
    items: items.map((item) => ({ id: item.id })),
    rfq_tipe: "isourcing",
    reason: "Unable to meet requirements via standard RFQ",
    notes: "Manual sourcing required",
  };
  const response = await authenticatedPost(endpoint, payload, clToken);
  expect(response.status).toBe(200);
  return response;
}

// ─── Management actions ───────────────────────────────────────────────────────

export async function managementApprove(qcfNumber, mgToken, comments = "E2E Test: Approved by Management") {
  return managementApproveQCFBase(qcfNumber, mgToken, comments);
}

/**
 * Management triggers Manual Sourcing.
 * Calls POST /pr/cs/send_isourcing/:rfq_number/:vendor_batch (src_type = isourcing).
 */
export async function managementManualSourcing(rfqNumber, vendorBatch, items, mgToken) {
  const url = `/pr/cs/send_isourcing/${rfqNumber}/${vendorBatch}`;
  const response = await authenticatedPost(url, {
    items,
    rfq_tipe: 'isourcing',
    reason: 'E2E Test: Manual Sourcing by Management',
  }, mgToken);
  expect(response.status).toBe(200);
  return response;
}

// ─── Expiry + cron helpers ────────────────────────────────────────────────────

// Expire both VD and VA vendor tokens simultaneously then run vendor cron once.
// Used by DIC39 (S3 both-no_action). The single cron run processes both expired tokens;
// the second token's processing detects the sibling already expired → creates DIC email.
export async function expireBothVendorsAndRunCron(rfqNumber, vendorCodeVD, vendorCodeVA, authToken) {
  const configCondition = "Waiting_vendor_expiry";
  await Promise.all([
    executeQuery(
      `UPDATE rfq_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE rfq_number = ? AND user_type = 'vendor' AND vendor_code = ? AND config_condition = ?`,
      [rfqNumber, vendorCodeVD, configCondition],
    ),
    executeQuery(
      `UPDATE rfq_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE rfq_number = ? AND user_type = 'vendor' AND vendor_code = ? AND config_condition = ?`,
      [rfqNumber, vendorCodeVA, configCondition],
    ),
  ]);
  const url = `${API_AIGEN_ENDPOINTS.PR.RUN_CRON}?stage=vendor&rfq_number=${rfqNumber}`;
  const response = await authenticatedPost(url, {}, authToken);
  expect(response.status).toBe(200);
  await pollForDICEmailToken(rfqNumber);
}

// Expire the DIC email token then run DIC cron → backend converts RFQ to Manual Sourcing.
// Used by DIC39 after both vendors have accepted.
export async function expireDICAndRunCron(rfqNumber, authToken) {
  await executeQuery(
    `UPDATE rfq_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE rfq_number = ? AND user_type = 'dic' AND config_condition = ? AND is_active = 1`,
    [rfqNumber, "Waiting_DIC_review_expiry"],
  );
  const url = `${API_AIGEN_ENDPOINTS.PR.RUN_CRON}?stage=dic&rfq_number=${rfqNumber}`;
  const response = await authenticatedPost(url, {}, authToken);
  expect(response.status).toBe(200);
  await pollForManualSourcing(rfqNumber);
}

// Expire the CS email token then run CS cron → backend converts RFQ to Manual Sourcing.
// Used for CS30: both vendors declined (No Quote) → CS times out → Auto Manual Vendor No Quote.
export async function expireCSAndRunCron(rfqNumber, authToken) {
  await executeQuery(
    `UPDATE rfq_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE rfq_number = ? AND user_type = 'cs' AND config_condition = ? AND is_active = 1`,

    [rfqNumber, "Waiting_CS_expiry"]
  );
  const url = `${API_AIGEN_ENDPOINTS.PR.RUN_CRON}?stage=cs&rfq_number=${rfqNumber}`;
  const response = await authenticatedPost(url, {}, authToken);
  expect(response.status).toBe(200);
  await pollForManualSourcing(rfqNumber);
}

// Expire the OE revision token then run OE cron → backend converts RFQ to Manual Sourcing.
// Used for CS31: vendor price above OE → DIC accepts → OE revision pending → CS times out.
// The OE path uses a DIFFERENT config_condition and cron stage from the standard CS expiry.
// config_condition = 'Waiting_OE_revision_expiry', stage = 'oe'
export async function expireOEAndRunCron(rfqNumber, authToken) {
  await executeQuery(
    `UPDATE rfq_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE rfq_number = ? AND user_type = 'cs' AND config_condition = ? AND is_active = 1`,

    [rfqNumber, "Waiting_OE_revision_expiry"]
  );
  const url = `${API_AIGEN_ENDPOINTS.PR.RUN_CRON}?stage=oe&rfq_number=${rfqNumber}`;
  const response = await authenticatedPost(url, {}, authToken);
  expect(response.status).toBe(200);
  await pollForManualSourcing(rfqNumber);
}


// Expire the CL email token then run CL cron → backend converts RFQ to Manual Sourcing.
export async function expireCLAndRunCron(rfqNumber, authToken) {
  const qcfRows = await getQCFItems(rfqNumber);
  const qcfNumber = qcfRows[0]?.qcf_number;
  if (!qcfNumber) throw new Error(`No QCF found for RFQ ${rfqNumber}`);

  await executeQuery(
    `UPDATE qcf_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE qcf_number = ? AND user_type = 'cl' AND config_condition = ? AND is_active = 1`,
    [qcfNumber, "Waiting_CL_review_expiry"],
  );
  const url = `${API_AIGEN_ENDPOINTS.PR.RUN_CRON}?stage=cl&rfq_number=${rfqNumber}`;
  const response = await authenticatedPost(url, {}, authToken);
  expect(response.status).toBe(200);
  await pollForManualSourcing(rfqNumber);
}

// Polls until the RFQ reaches Manual Sourcing status (milestone 12).
// Also accepts milestone 6 as a valid terminal state (used by some CS expiry flows).
async function pollForManualSourcing(rfqNumber, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await executeQuery(

      "SELECT status_milestone FROM rfq_library WHERE rfq_number = ? ORDER BY id DESC LIMIT 1",
      [rfqNumber],
    );
    if (rows[0]?.status_milestone === 12 || rows[0]?.status_milestone === 6) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`RFQ ${rfqNumber} did not reach Manual Sourcing (milestone 12) within ${timeoutMs}ms`);
}


// Expire the Management review token then run Management cron → backend converts RFQ to Manual Sourcing.
// Used for MG18.
export async function expireManagementAndRunCron(rfqNumber, authToken) {
  await executeQuery(
    `UPDATE qcf_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE rfq_number = ? AND user_type = 'management' AND config_condition = ? AND is_active = 1`,
    [rfqNumber, 'Waiting_Management_review_expiry']
  );
  const url = `${API_AIGEN_ENDPOINTS.PR.RUN_CRON}?stage=management&rfq_number=${rfqNumber}`;
  const response = await authenticatedPost(url, {}, authToken);
  expect(response.status).toBe(200);
  await pollForManualSourcing(rfqNumber);
}

export { getRFQItemsByVendorType };
