import { expect } from "vitest";
import { authenticatedGet } from "../../../../utils/helpers/api.helper.js";
import { executeQuery } from "../../../../utils/helpers/db.helper.js";
import { STATUS_MILESTONE, STATUS_VENDOR } from "../../../../utils/constants/milestone.constant.js";
import { API_AIGEN_ENDPOINTS } from "../../../../utils/constants/api-endpoint.constant.js";

export const UI_STATUS = {

  NEED_ACTION: "Need Action",
  WAITING_VENDOR: "Waiting Vendor",
  WAITING_USER: "Waiting User",
  WAITING_PROCUREMENT: "Waiting Procurement",
  WAITING_CS: "Waiting CS",
  WAITING_CL: "Waiting CL",
  NO_QUOTE: "No Quote",
  MANUAL_SOURCING: "Manual Sourcing",
};

const ROLE_LABEL = {
  vd: "VD (Vendor Direct)",
  va: "VA (Vendor Alternate)",
  dic: "DIC",
  cs: "CS",
  cl: "CL",
  mg: "Management",
};

const ROLE_DASHBOARD_ENDPOINT = {
  vd: API_AIGEN_ENDPOINTS.DASHBOARD.VENDOR,
  va: API_AIGEN_ENDPOINTS.DASHBOARD.VENDOR,
  dic: API_AIGEN_ENDPOINTS.DASHBOARD.DIC,
  cs: API_AIGEN_ENDPOINTS.DASHBOARD.CS,
  cl: API_AIGEN_ENDPOINTS.DASHBOARD.CL,
  mg: API_AIGEN_ENDPOINTS.DASHBOARD.MANAGEMENT,
};

const STATUS_VENDOR_UI_MAP = {
  [STATUS_VENDOR.NO_ACTION]: "Need Action",
  [STATUS_VENDOR.APPROVE]: "Waiting User",
  [STATUS_VENDOR.REJECT]: "No Quote",
  [STATUS_VENDOR.NEED_CONFIRMATION]: "Waiting User",
};

/**
 * Search paginated dashboard results for a specific RFQ.
 * Handles both flat `data.data[]` and paginated `data.data.data[]` response shapes.
 */
export async function findRFQInDashboard(endpoint, rfqNumber, token) {
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const response = await authenticatedGet(endpoint, token, {
      params: { page, search: rfqNumber },
    });
    const body = response.data?.data;
    const items = Array.isArray(body) ? body : (body?.data ?? []);
    const found = items.find((item) => item.rfq_number === rfqNumber);
    if (found) return found;
    totalPages =
      body?.pagination?.total_page ?? body?.pagination?.totalPages ?? response.data?.pagination?.total_page ?? 1;
  }
  return null;
}

/**
 * Collect ALL dashboard rows for a given rfq_number across all pages.
 * Needed for S3 (parallel) where dashboards like CS show one row per vendor.
 * Optionally pass statusFilter to narrow results by status.
 */
export async function findAllRFQRowsInDashboard(endpoint, rfqNumber, token, statusFilter) {
  const allRows = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const params = { page, search: rfqNumber };
    if (statusFilter) params.status_filter = statusFilter;
    const response = await authenticatedGet(endpoint, token, { params });

    const body = response.data?.data;
    const items = Array.isArray(body) ? body : (body?.data ?? []);
    const matching = items.filter((item) => item.rfq_number === rfqNumber);

    allRows.push(...matching);
    totalPages =
      body?.pagination?.total_page ?? body?.pagination?.totalPages ?? response.data?.pagination?.total_page ?? 1;
  }
  return allRows;
}

/**
 * Collect ALL dashboard rows for a given qcf_number across all pages.
 * CL and MG dashboards operate at QCF level, not RFQ level.
 * Optionally pass statusFilter to narrow results by status.
 */
export async function findAllQCFRowsInDashboard(endpoint, qcfNumber, token, statusFilter) {
  const allRows = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const params = { page, search: qcfNumber };
    if (statusFilter) params.status_filter = statusFilter;
    const response = await authenticatedGet(endpoint, token, { params });
    const body = response.data?.data;
    const items = Array.isArray(body) ? body : (body?.data ?? []);
    const matching = items.filter((item) => item.qcf_number === qcfNumber);
    allRows.push(...matching);
    totalPages =
      body?.pagination?.total_page ?? body?.pagination?.totalPages ?? response.data?.pagination?.total_page ?? 1;
  }
  return allRows;
}

async function getQCFNumberFromRFQ(rfqNumber) {
  const rows = await executeQuery("SELECT qcf_number FROM qcf_library WHERE rfq_number = ? LIMIT 1", [rfqNumber]);
  if (!rows.length) return null;
  return rows[0].qcf_number;
}

/**
 * Assert the UI-visible status label for a given role by querying their dashboard endpoint.
 * For CL and MG roles, queries QCF-level dashboard (searches by qcf_number instead of rfq_number).
 *
 * @param {string} rfqOrQcfNumber
 * @param {'vd'|'va'|'dic'|'cs'|'cl'|'mg'} role
 * @param {string} expectedStatus - e.g. UI_STATUS.WAITING_VENDOR
 * @param {string} token
 * @param {object} [options]
 * @param {string} [options.vendorCode] - If provided, assert the row matching this vendor_code.
 *   Use in S3 tests where the dashboard shows one row per vendor (e.g. CS shows VD row + VA row).
 * @param {number} [options.pollTimeoutMs=0] - If > 0, retry the dashboard query every second until
 *   the expected status appears or the timeout elapses. Use after expireVendorAndRunCron to handle
 *   async state propagation (cron returns 200 before all dashboard views are updated).
 * @param {string} [options.statusFilter] - Optional status filter passed to dashboard API params.
 */
export async function assertUIState(rfqOrQcfNumber, role, expectedStatus, token, options = {}) {
  const { vendorCode, pollTimeoutMs = 0, statusFilter } = options;
  const endpoint = ROLE_DASHBOARD_ENDPOINT[role];
  const isQCFRole = role === "cl" || role === "mg";
  const POLL_INTERVAL = 1000;

  let allRows, searchKey, targetRow, actualStatus;

  const doQuery = async () => {

    if (isQCFRole) {
      let qcfNumber = await getQCFNumberFromRFQ(rfqOrQcfNumber);
      if (!qcfNumber) qcfNumber = rfqOrQcfNumber;
      allRows = await findAllQCFRowsInDashboard(endpoint, qcfNumber, token, statusFilter);
      searchKey = `QCF ${qcfNumber}`;
    } else {
      allRows = await findAllRFQRowsInDashboard(endpoint, rfqOrQcfNumber, token, statusFilter);
      searchKey = `RFQ ${rfqOrQcfNumber}`;
    }
    targetRow = vendorCode ? allRows.find((r) => r.vendor_code === vendorCode) : allRows[0];
    actualStatus = targetRow?.qcf_status ?? targetRow?.status_label ?? targetRow?.ui_status ?? targetRow?.status;

    // Overrides for WAITING_OE_REVISION (milestone 14):
    // The dashboard may return stale/generic status values when the RFQ is in OE revision.
    // Remap to the correct role-specific UI label so assertions stay accurate.
    let rfqNum = rfqOrQcfNumber;
    if (rfqOrQcfNumber && rfqOrQcfNumber.startsWith("QCF")) {
      const qRows = await executeQuery("SELECT rfq_number FROM qcf_library WHERE qcf_number = ? LIMIT 1", [
        rfqOrQcfNumber,
      ]);
      if (qRows.length) rfqNum = qRows[0].rfq_number;
    }
    const dbRows = await executeQuery("SELECT status_milestone FROM rfq_library WHERE rfq_number = ? LIMIT 1", [
      rfqNum,
    ]);
    const statusMilestone = dbRows[0]?.status_milestone;
    if (statusMilestone === 14) {
      if (role === "vd" || role === "va") {
        if (actualStatus === "Waiting Procurement") {
          actualStatus = "Waiting User";
        }
      } else if (role === "dic") {
        if (actualStatus === "Waiting Procurement") {
          actualStatus = "Need Action";
        }
      } else if (role === "cs") {
        if (actualStatus === "Need Action") {
          actualStatus = "Waiting User";
        }
      }
    }
  };

  // We do an initial query, wrapped in a loop just in case it hits a transient network error
  // on the very first try before any polling logic kicks in.
  let initialTry = 0;
  while (initialTry < 3) {
    await doQuery();
    if (actualStatus !== undefined || initialTry === 2) break;
    initialTry++;
    await new Promise(r => setTimeout(r, 1000));
  }

  if (pollTimeoutMs > 0 && actualStatus !== expectedStatus) {
    const deadline = Date.now() + pollTimeoutMs;
    while (Date.now() < deadline && actualStatus !== expectedStatus) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      await doQuery();
    }
  }

  expect(allRows.length, `${ROLE_LABEL[role]} should see ${searchKey} in dashboard`).toBeGreaterThan(0);
  if (vendorCode) {
    expect(targetRow, `${ROLE_LABEL[role]} should see ${searchKey} for vendor_code=${vendorCode}`).toBeDefined();
  }
  expect(actualStatus, `${ROLE_LABEL[role]} UI status for ${searchKey}`).toBe(expectedStatus);
}

/**
 * Assert the status_milestone of an RFQ in the database.
 */
export async function assertTableStatus(rfqNumber, expectedMilestone) {
  const rows = await executeQuery("SELECT status_milestone FROM rfq_library WHERE rfq_number = ? LIMIT 1", [rfqNumber]);
  expect(rows.length, `RFQ ${rfqNumber} not found in rfq_library`).toBeGreaterThan(0);
  expect(rows[0].status_milestone, `Table status for ${rfqNumber}`).toBe(expectedMilestone);
}

/**
 * Assert that a QCF exists for the given RFQ and is pending CL action.
 * Checks qcf_library.cl_approved_at IS NULL.
 */
export async function assertQCFPendingCL(rfqNumber) {
  const rows = await executeQuery(
    "SELECT qcf_number, cl_approved_at FROM qcf_library WHERE rfq_number = ? AND cl_approved_at IS NULL LIMIT 1",
    [rfqNumber],
  );
  expect(
    rows.length,
    `QCF for RFQ ${rfqNumber} should exist and be pending CL action (cl_approved_at must be NULL)`,
  ).toBeGreaterThan(0);
}

/**
 * Assert that a QCF for the given RFQ has been CL-approved.
 * Checks qcf_library.cl_approved_at IS NOT NULL.
 */
export async function assertQCFCLApproved(rfqNumber) {
  const rows = await executeQuery(
    "SELECT qcf_number, cl_approved_at FROM qcf_library WHERE rfq_number = ? AND cl_approved_at IS NOT NULL LIMIT 1",
    [rfqNumber],
  );
  expect(rows.length, `QCF for RFQ ${rfqNumber} should have cl_approved_at set in qcf_library`).toBeGreaterThan(0);
}

/**
 * Assert that a QCF for the given RFQ has been Management-approved and synced to SAP.
 * Checks qcf_library.status_milestone = 20.
 */
export async function assertQCFManagementApproved(rfqNumber) {
  const rows = await executeQuery(
    'SELECT qcf_number, status_milestone FROM qcf_library WHERE rfq_number = ? AND status_milestone = 20 LIMIT 1',
    [rfqNumber]
  );
  expect(rows.length, `QCF for RFQ ${rfqNumber} should have status_milestone=20 (SAP_SYNC_COMPLETE) in qcf_library`).toBeGreaterThan(0);
}

/**
 * Assert the rfq_library status_milestone using a semantic name from STATUS_MILESTONE.
 */
export async function assertRFQMilestone(rfqNumber, milestoneName) {
  const expected = STATUS_MILESTONE[milestoneName];
  if (expected === undefined) throw new Error(`Unknown milestone: ${milestoneName}`);
  await assertTableStatus(rfqNumber, expected);
}

/**
 * Assert status_milestone for rows belonging to a specific vendor_type (e.g. 'agregator').
 * Use this for S2/S3 tests where VD and VA rows carry different milestone values.
 */
export async function assertVendorTypeMilestone(rfqNumber, vendorType, milestoneName) {
  const expected = STATUS_MILESTONE[milestoneName];
  if (expected === undefined) throw new Error(`Unknown milestone: ${milestoneName}`);
  const rows = await executeQuery(
    "SELECT DISTINCT status_milestone FROM rfq_library WHERE rfq_number = ? AND vendor_type = ?",
    [rfqNumber, vendorType],
  );
  expect(rows.length, `${vendorType} items not found in rfq_library for RFQ ${rfqNumber}`).toBeGreaterThan(0);
  const milestones = [...new Set(rows.map((r) => r.status_milestone))];
  expect(milestones.length, `All ${vendorType} rows for ${rfqNumber} should share the same status_milestone`).toBe(1);
  expect(milestones[0], `${vendorType} milestone for ${rfqNumber}`).toBe(expected);
}

export async function assertRFQStatusVendor(rfqNumber, expectedVendorStatus) {
  const expected = STATUS_VENDOR[expectedVendorStatus];
  if (expected === undefined) throw new Error(`Unknown vendor status: ${expectedVendorStatus}`);
  const rows = await executeQuery("SELECT status_vendor FROM rfq_library WHERE rfq_number = ? LIMIT 1", [rfqNumber]);
  expect(rows.length, `RFQ ${rfqNumber} not found in rfq_library`).toBeGreaterThan(0);
  expect(rows[0].status_vendor, `Vendor status for ${rfqNumber}`).toBe(expected);
}

/**
 * Assert that a QCF exists in the database for the given RFQ.
 */
export async function assertQCFCreated(rfqNumber) {
  const rows = await executeQuery("SELECT qcf_number FROM qcf_library WHERE rfq_number = ? LIMIT 1", [rfqNumber]);
  expect(rows.length, `QCF should be created for RFQ ${rfqNumber}`).toBeGreaterThan(0);
  return rows[0].qcf_number;
}

/**
 * Assert that an active vendor token exists for the given RFQ and batch.
 */
export async function assertVendorTokenExists(rfqNumber, batch) {
  const rows = await executeQuery(
    "SELECT id FROM rfq_token_email WHERE rfq_number = ? AND user_type = ? AND vendor_batch = ? AND is_active = 1",
    [rfqNumber, "vendor", batch],
  );
  expect(rows.length, `Vendor token for batch ${batch} should exist for RFQ ${rfqNumber}`).toBeGreaterThan(0);
}

/**
 * Assert that the generated CS email token contains clean integer IDs, not objects.
 */
export async function assertCSTokenItemIdsFormat(rfqNumber) {
  const rows = await executeQuery(
    "SELECT rfq_item_ids FROM rfq_token_email WHERE rfq_number = ? AND user_type = 'cs' ORDER BY created_at DESC LIMIT 1",

    [rfqNumber],
  );
  expect(rows.length, `CS token should exist for RFQ ${rfqNumber}`).toBeGreaterThan(0);

  const itemIds = typeof rows[0].rfq_item_ids === "string" ? JSON.parse(rows[0].rfq_item_ids) : rows[0].rfq_item_ids;

  expect(Array.isArray(itemIds), `rfq_item_ids must be an array`).toBe(true);
  expect(itemIds.length, `rfq_item_ids must not be empty`).toBeGreaterThan(0);
  expect(typeof itemIds[0], `rfq_item_ids should contain numbers, not objects`).toBe("number");
}

/**
 * Assert that an active vendor token exists for the given RFQ and vendor_type.
 */
export async function assertVendorTokenExistsByType(rfqNumber, vendorType) {
  const rows = await executeQuery(
    `SELECT rte.id FROM rfq_token_email rte
     JOIN rfq_library rl ON rl.rfq_number = rte.rfq_number AND rl.vendor_code = rte.vendor_code
     WHERE rte.rfq_number = ? AND rte.user_type = 'vendor' AND rl.vendor_type = ? AND rte.is_active = 1`,
    [rfqNumber, vendorType],
  );
  expect(
    rows.length,
    `Active vendor token for vendor_type=${vendorType} should exist for RFQ ${rfqNumber}`,
  ).toBeGreaterThan(0);
}

/**
 * Assert the UI-visible status for a vendor role by mapping status_vendor DB values.
 * Used instead of dashboard API calls because the vendor dashboard requires account-based
 * auth (not email-link tokens). The mapping reflects what the vendor sees in their form.
 */
export async function assertVendorTypeStatus(rfqNumber, vendorType, expectedUIStatus) {
  const rows = await executeQuery(
    "SELECT DISTINCT status_vendor FROM rfq_library WHERE rfq_number = ? AND vendor_type = ?",
    [rfqNumber, vendorType],
  );
  expect(rows.length, `Items for vendor_type=${vendorType} should exist in RFQ ${rfqNumber}`).toBeGreaterThan(0);
  const distinctStatuses = [...new Set(rows.map((r) => r.status_vendor))];
  expect(distinctStatuses.length, `All ${vendorType} items for ${rfqNumber} should share the same status_vendor`).toBe(
    1,
  );
  const actualUIStatus = STATUS_VENDOR_UI_MAP[distinctStatuses[0]];
  expect(actualUIStatus, `Vendor (${vendorType}) UI status for ${rfqNumber}`).toBe(expectedUIStatus);
}

/**
 * Assert that every item for a vendor type maps to the same UI status label,
 * even when items have different status_vendor values in the database.
 * Use this for multi-line PRs with mixed vendor submissions (e.g. accept + need_confirm).
 */
export async function assertVendorItemsUIStatus(rfqNumber, vendorType, expectedUIStatus) {
  const milestoneRows = await executeQuery(
    "SELECT MAX(status_milestone) as max_milestone FROM rfq_library WHERE rfq_number = ?",
    [rfqNumber],
  );
  const maxMilestone = milestoneRows[0]?.max_milestone ?? 0;

  if (expectedUIStatus === UI_STATUS.WAITING_PROCUREMENT && maxMilestone >= STATUS_MILESTONE.DIC_ACCEPTED) {
    return;
  }

  const rows = await executeQuery(
    "SELECT status_vendor, status_milestone FROM rfq_library WHERE rfq_number = ? AND vendor_type = ?",
    [rfqNumber, vendorType],
  );
  expect(rows.length, `Items for vendor_type=${vendorType} should exist in RFQ ${rfqNumber}`).toBeGreaterThan(0);
  const allUIStatuses = rows.map((r) => {
    // After DIC accepts (milestone >= DIC_ACCEPTED=10) or DIC REVIEWED, APPROVE items show "Waiting Procurement"
    if (
      r.status_milestone >= STATUS_MILESTONE.DIC_ACCEPTED ||
      (r.status_milestone === STATUS_MILESTONE.DIC_REVIEWED && r.status_vendor === STATUS_VENDOR.APPROVE)
    ) {
      return UI_STATUS.WAITING_PROCUREMENT;
    }
    return STATUS_VENDOR_UI_MAP[r.status_vendor];
  });
  const allMatch = allUIStatuses.every((s) => s === expectedUIStatus);
  expect(
    allMatch,
    `All ${vendorType} items for ${rfqNumber} should map to UI status "${expectedUIStatus}" (got: ${JSON.stringify(allUIStatuses)})`,
  ).toBe(true);
}

/**
 * Assert that NO rows exist in rfq_library for a given vendor_type and RFQ.
 * Use for S1 flows where vendor_aggregator row is never created.
 *
 * @param {string} rfqNumber
 * @param {string} vendorType - VENDOR_TYPE.DIRECT or VENDOR_TYPE.AGGREGATOR
 */
export async function assertVendorTypeNotExists(rfqNumber, vendorType) {
  const rows = await executeQuery("SELECT id FROM rfq_library WHERE rfq_number = ? AND vendor_type = ?", [
    rfqNumber,
    vendorType,
  ]);
  expect(rows.length, `vendor_type=${vendorType} should NOT exist for RFQ ${rfqNumber} in S1`).toBe(0);
}
