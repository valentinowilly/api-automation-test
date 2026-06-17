import { loginAs, loginAsVendorByCode } from "../../../../utils/helpers/auth.helper.js";
import { ROLES } from "../../../../utils/constants/role.constant.js";
import { post as gatewayPost } from "../../../../utils/helpers/api-import-pr-aigen-gateway.helper.js";
import { post as apiPost, authenticatedPut } from "../../../../utils/helpers/api.helper.js";
import {
  API_IMPORT_PR_GATEWAY_ENDPOINTS,
  API_AIGEN_ENDPOINTS,
} from "../../../../utils/constants/api-endpoint.constant.js";
import { executeQuery } from "../../../../utils/helpers/db.helper.js";
import { HTTP_STATUS } from "../../../../utils/constants/http.constant.js";
import { STATUS_VENDOR, STATUS_DIC, RFQ_TYPES, VENDOR_TYPE } from "../../../../utils/constants/milestone.constant.js";
import {
  buildBCGSearchLibraryData,
  createMockSearchLibrary,
  createMockSearchLibraryBatch,
  buildBCGSearchLibraryMultiItemData,
  cleanupAllTestData,
} from "../../config-autopo/helpers/e2e-test-data.helper.js";
import {
  vendorSubmitQuotation,
  dicConfirmQuotation,
  csSendSurrogate,
  csSendToQCF,
  clApproveQCF,
  getRFQItemsByVendorType,
  getVendorTokenByVendorType,
  getQCFItems,
} from "../../config-autopo/helpers/e2e-workflow.helper.js";
import {
  vendorSubmitMixed,
  dicRequestRevise,
  dicAcceptVDRequestReviseVA,
  dicAcceptVARequestReviseVD,
  dicAcceptVDDeclineVA,
  dicAcceptVADeclineVD,
  getDICEmailToken,
  expireVendorAndRunCron,
  expireCLAndRunCron,
} from "./workflow-actions.helper.js";
import { assertQCFPendingCL } from "./state-assertions.helper.js";
import {
  saveCurrentConfigState,
  updateSkipLevel1Config,
  restoreConfigState,
} from "../../config-autopo/helpers/e2e-config.helper.js";
import { expect } from "vitest";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30000;

// ─── Internal utilities ───────────────────────────────────────────────────────

async function pollForRFQ(prNumber, expectedItemCount = 1) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const rows = await executeQuery("SELECT * FROM rfq_library WHERE pr_number = ?", [prNumber]);
    if (rows?.length >= expectedItemCount) return rows[0];
  }
  throw new Error(
    `RFQ not created within ${POLL_TIMEOUT_MS}ms for PR ${prNumber} (expected ${expectedItemCount} items)`,
  );
}

async function pollForVendorToken(rfqNumber, vendorType, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const token = await getActiveVendorToken(rfqNumber, vendorType);
    if (token) return token;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Vendor token for ${vendorType} not found within ${timeoutMs}ms for RFQ ${rfqNumber}`);
}

/**
 * Get the most recently created active vendor token for a given vendor_type.
 * Uses vendor_type from rfq_library (joined via vendor_code) to identify the vendor.
 *
 * In S1 (direct only), after VD declines, calling this with 'direct' returns the newly
 * activated alternate vendor's token (most recent active token of that type).
 */
export async function getActiveVendorToken(rfqNumber, vendorType) {
  const row = await getVendorTokenByVendorType(rfqNumber, vendorType);
  return row?.rfq_token || null;
}

async function loginManagement() {
  const { getUserManagementCredential } = await import("../../../../utils/helpers/credentials.helper.js");
  const cred = getUserManagementCredential(0);
  const response = await apiPost(API_AIGEN_ENDPOINTS.AUTH.LOGIN_BASIC, {
    identifier: cred.email,
    password: cred.password,
  });
  const token = response.data?.data?.access_token;
  if (!token) throw new Error("Management login failed: no access_token");
  return token;
}

async function createRFQBase(adminToken, options = {}) {
  let prNumber;
  const itemCount = options.itemCount || 1;
  const overrides = options.searchLibraryOverrides || {};

  if (itemCount > 1) {
    const items = buildBCGSearchLibraryMultiItemData(itemCount, overrides);
    prNumber = items[0].pr_number;
    await createMockSearchLibraryBatch(items, adminToken);
  } else {
    const searchLibraryData = buildBCGSearchLibraryData(overrides);
    prNumber = searchLibraryData.pr_number;
    await createMockSearchLibrary(searchLibraryData, adminToken);
  }

  let gatewayResponse;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      gatewayResponse = await gatewayPost(
        API_IMPORT_PR_GATEWAY_ENDPOINTS.START_CRON_GENERATE_PR_AIGEN,
        {},
        { params: { lastPeriodDays: "1" } },
      );
      if (gatewayResponse.status === HTTP_STATUS.ACCEPTED) break;
    } catch (e) {
      console.warn(`[Gateway Retry] Attempt ${attempt}/3 failed: ${e.message}`);
    }
    if (attempt === 3) throw new Error(`Import gateway failed after 3 attempts. Last status: ${gatewayResponse?.status}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  expect(gatewayResponse.status).toBe(HTTP_STATUS.ACCEPTED);

  const rfqRecord = await pollForRFQ(prNumber, itemCount);

  return { rfqRecord, prNumber };
}

// ─── Stage-entry functions ────────────────────────────────────────────────────

/**
 * Stage 1 — Creates a fresh RFQ in "Waiting Vendor" state.
 *
 * vendorTokenVD is the active token for vendor_type='direct'.
 * vendorTokenVA is the active token for vendor_type='aggregator' (only for s2/s3).
 *
 * Scenario mapping:
 *   s1 = vendor_sequence 1 (direct only)
 *   s2 = vendor_sequence 2 (aggregator only)
 *   s3 = vendor_sequence 3 (parallel: direct + aggregator)
 *
 * @param {object} [options]
 * @param {'s1'|'s2'|'s3'} [options.scenario='s1']
 * @param {number} [options.itemCount=1] - Number of line items to create in the PR
 * @param {string} [options.serverGroup='BCG']
 */
export async function setupRFQAtVendorStage({ scenario = "s1", itemCount = 1, serverGroup = "BCG", searchLibraryOverrides = {} } = {}) {
  const [adminToken, csToken, clToken, dicToken, mgToken] = await Promise.all([
    loginAs(ROLES.ADMIN),
    loginAs(ROLES.CS, "mrr"),
    loginAs(ROLES.CL, "mrr"),
    loginAs(ROLES.DIC),
    loginManagement(),
  ]);

  const savedConfig = await saveCurrentConfigState(serverGroup, adminToken);

  if (scenario === "s3" && savedConfig.skipLevel1?.config_value !== "yes") {
    await updateSkipLevel1Config(serverGroup, "yes", adminToken);
  } else if (scenario !== "s3" && savedConfig.skipLevel1?.config_value !== "no") {
    await updateSkipLevel1Config(serverGroup, "no", adminToken);
  }

  if (searchLibraryOverrides.im_number === undefined) {
    searchLibraryOverrides.im_number = 'IM' + String(Math.floor(Math.random() * 9000000000) + 1000000000);
  }

  const { rfqRecord, prNumber } = await createRFQBase(adminToken, { itemCount, searchLibraryOverrides });
  const rfqNumber = rfqRecord.rfq_number;

  const vendorTokenVD = await pollForVendorToken(rfqNumber, VENDOR_TYPE.DIRECT);
  const vendorTokenVA = scenario === "s3" ? await pollForVendorToken(rfqNumber, VENDOR_TYPE.AGGREGATOR) : null; // s2: VA token not yet active — VD must decline first

  const [rfqItemsVD, rfqItemsVA] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const vendorCodeVD = rfqItemsVD[0]?.vendor_code ?? null;
  const vendorCodeVA = rfqItemsVA[0]?.vendor_code ?? null;

  const [vendorAccountTokenVD, vendorAccountTokenVA] = await Promise.all([
    vendorCodeVD ? loginAsVendorByCode(vendorCodeVD, adminToken) : null,
    vendorCodeVA ? loginAsVendorByCode(vendorCodeVA, adminToken) : null,
  ]);

  const cleanup = async (qcfNumber = null) => {
    await restoreConfigState(savedConfig, adminToken);
    await cleanupAllTestData(rfqNumber, qcfNumber, prNumber);
  };

  return {
    rfqNumber,
    prNumber,
    rfqRecord,
    vendorTokenVD,
    vendorTokenVA,
    vendorCodeVD,
    vendorCodeVA,
    vendorAccountTokenVD,
    vendorAccountTokenVA,
    adminToken,
    csToken,
    clToken,
    dicToken,
    mgToken,
    cleanup,
  };
}

/**
 * Looks up the vendor_code for a given vendor_type from rfq_library,
 * then performs a basic login to return a proper account token.
 * Use this in test beforeAll blocks when the vendor becomes active after setup
 * (e.g., S1 VA token after VD declines).
 */
export async function getVendorAccountToken(rfqNumber, vendorType, adminToken) {
  const items = await getRFQItemsByVendorType(rfqNumber, vendorType);
  const vendorCode = items[0]?.vendor_code ?? null;
  if (!vendorCode) return null;
  return loginAsVendorByCode(vendorCode, adminToken);
}

/**
 * S2 Stage 1 — Creates an RFQ where Vendor Aggregator (VA) is active.
 *
 * Pre-condition flow:
 *   1. Ensures skip_level_1_RFQ = "no" (sequential: VD first, then VA as fallback)
 *   2. Creates a PR with itemCount line items via createRFQBase(adminToken, itemCount)
 *   3. Vendor Direct (VD) declines → backend activates Vendor Aggregator (VA)
 *   4. Polls until VA token is available
 *
 * @param {object} [options]
 * @param {string} [options.serverGroup='BCG']
 * @param {number} [options.itemCount=1]
 */
export async function setupRFQAtVendorStageS2({ serverGroup = "BCG", itemCount = 1, searchLibraryOverrides = {} } = {}) {
  const [adminToken, csToken, clToken, dicToken, mgToken] = await Promise.all([
    loginAs(ROLES.ADMIN),
    loginAs(ROLES.CS, "mrr"),
    loginAs(ROLES.CL, "mrr"),
    loginAs(ROLES.DIC),
    loginManagement(),
  ]);

  const savedConfig = await saveCurrentConfigState(serverGroup, adminToken);
  if (savedConfig.skipLevel1?.config_value !== "no") {
    await updateSkipLevel1Config(serverGroup, "no", adminToken);
  }

  if (searchLibraryOverrides.im_number === undefined) {
    searchLibraryOverrides.im_number = 'IM' + String(Math.floor(Math.random() * 9000000000) + 1000000000);
  }

  const { rfqRecord, prNumber } = await createRFQBase(adminToken, { itemCount, searchLibraryOverrides });
  const rfqNumber = rfqRecord.rfq_number;

  const vendorTokenVD = await pollForVendorToken(rfqNumber, VENDOR_TYPE.DIRECT);

  const rfqItemsVD = await getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT);
  await applyVendorAction(rfqItemsVD, "decline", vendorTokenVD);

  const vendorTokenVA = await pollForVendorToken(rfqNumber, VENDOR_TYPE.AGGREGATOR);

  const rfqItemsVA = await getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR);
  const vendorCodeVD = rfqItemsVD[0]?.vendor_code ?? null;
  const vendorCodeVA = rfqItemsVA[0]?.vendor_code ?? null;

  const [vendorAccountTokenVD, vendorAccountTokenVA] = await Promise.all([
    loginAsVendorByCode(vendorCodeVD, adminToken),
    loginAsVendorByCode(vendorCodeVA, adminToken),
  ]);

  const cleanup = async (qcfNumber = null) => {
    await restoreConfigState(savedConfig, adminToken);
    await cleanupAllTestData(rfqNumber, qcfNumber, prNumber);
  };

  return {
    rfqNumber,
    prNumber,
    rfqRecord,
    vendorTokenVD,
    vendorTokenVA,
    vendorCodeVD,
    vendorCodeVA,
    vendorAccountTokenVD,
    vendorAccountTokenVA,
    adminToken,
    csToken,
    clToken,
    dicToken,
    mgToken,
    cleanup,
  };
}

/**
 * S3 Stage 1 — Creates an RFQ where both VD and VA are active in parallel.
 *
 * Pre-condition flow:
 *   1. Ensures skip_level_1_RFQ = "yes" (parallel: both vendors get RFQ simultaneously)
 *   2. Creates a PR with itemCount line items via createRFQBase(adminToken, itemCount)
 *   3. Polls for both VD and VA tokens
 *
 * @param {object} [options]
 * @param {string} [options.serverGroup='BCG']
 * @param {number} [options.itemCount=3]
 */
export async function setupRFQAtVendorStageS3({ serverGroup = "BCG", itemCount = 3, searchLibraryOverrides = {} } = {}) {
  const [adminToken, csToken, clToken, dicToken, mgToken] = await Promise.all([
    loginAs(ROLES.ADMIN),
    loginAs(ROLES.CS, "mrr"),
    loginAs(ROLES.CL, "mrr"),
    loginAs(ROLES.DIC),
    loginManagement(),
  ]);

  const savedConfig = await saveCurrentConfigState(serverGroup, adminToken);
  if (savedConfig.skipLevel1?.config_value !== "yes") {
    await updateSkipLevel1Config(serverGroup, "yes", adminToken);
  }

  if (searchLibraryOverrides.im_number === undefined) {
    searchLibraryOverrides.im_number = 'IM' + String(Math.floor(Math.random() * 9000000000) + 1000000000);
  }

  const { rfqRecord, prNumber } = await createRFQBase(adminToken, { itemCount, searchLibraryOverrides });
  const rfqNumber = rfqRecord.rfq_number;

  const vendorTokenVD = await pollForVendorToken(rfqNumber, VENDOR_TYPE.DIRECT);
  const vendorTokenVA = await pollForVendorToken(rfqNumber, VENDOR_TYPE.AGGREGATOR);

  const [rfqItemsVD, rfqItemsVA] = await Promise.all([
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.DIRECT),
    getRFQItemsByVendorType(rfqNumber, VENDOR_TYPE.AGGREGATOR),
  ]);
  const vendorCodeVD = rfqItemsVD[0]?.vendor_code ?? null;
  const vendorCodeVA = rfqItemsVA[0]?.vendor_code ?? null;

  const [vendorAccountTokenVD, vendorAccountTokenVA] = await Promise.all([
    loginAsVendorByCode(vendorCodeVD, adminToken),
    loginAsVendorByCode(vendorCodeVA, adminToken),
  ]);

  const cleanup = async (qcfNumber = null) => {
    await restoreConfigState(savedConfig, adminToken);
    await cleanupAllTestData(rfqNumber, qcfNumber, prNumber);
  };

  return {
    rfqNumber,
    prNumber,
    rfqRecord,
    vendorTokenVD,
    vendorTokenVA,
    vendorCodeVD,
    vendorCodeVA,
    vendorAccountTokenVD,
    vendorAccountTokenVA,
    adminToken,
    csToken,
    clToken,
    dicToken,
    mgToken,
    cleanup,
  };
}

/**
 * S3 Stage 1 (VA Revise) — Creates an RFQ where DIC has requested revision for VA.
 *
 * Flow:
 *   1. setupRFQAtVendorStageS3() — both VD and VA tokens active
 *   2. VA submits accept (original round)
 *   3. VD takes vdAction ('no_action' = skip, or 'decline')
 *   4. DIC requests revision for VA → VA returns to "Need Action" state
 *
 * @param {object} [options]
 * @param {'no_action'|'decline'} [options.vdAction='no_action']
 * @param {string} [options.serverGroup='BCG']
 * @param {number} [options.itemCount=3]
 */
export async function setupRFQAtVendorStageS3WithVARevise({
  vdAction = "accept",
  serverGroup = "BCG",
  itemCount = 3,
} = {}) {
  const ctx = await setupRFQAtVendorStageS3({ serverGroup, itemCount });

  // Both VD and VA must submit for the DIC email token to be created in S3 parallel mode
  const rfqItemsVA = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR);
  await applyVendorAction(rfqItemsVA, "accept", ctx.vendorTokenVA);

  const rfqItemsVD = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT);
  await applyVendorAction(rfqItemsVD, vdAction, ctx.vendorTokenVD);

  if (vdAction === "accept") {
    // VD accepted: DIC accepts VD and requests revision for VA in one combined call
    await dicAcceptVDRequestReviseVA(ctx.rfqNumber, ctx.dicToken, "E2E Test: revision required");
  } else {
    // VD declined: DIC only needs to request revision for VA
    await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, "E2E Test: revision required", VENDOR_TYPE.AGGREGATOR);
  }

  return ctx;
}

/**
 * S3 Stage 1 (VD Revise) — Creates an RFQ where DIC has requested revision for VD.
 *
 * Flow:
 *   1. setupRFQAtVendorStageS3() — both VD and VA tokens active
 *   2. VD submits accept (original round)
 *   3. VA takes vaAction ('accept' or 'decline')
 *   4. DIC requests revision for VD → VD returns to "Need Action" state
 *
 * @param {object} [options]
 * @param {'accept'|'decline'} [options.vaAction='accept']
 * @param {string} [options.serverGroup='BCG']
 * @param {number} [options.itemCount=3]
 */
export async function setupRFQAtVendorStageS3WithVDRevise({
  vaAction = "accept",
  serverGroup = "BCG",
  itemCount = 3,
} = {}) {
  const ctx = await setupRFQAtVendorStageS3({ serverGroup, itemCount });

  // Both VD and VA must submit for the DIC email token to be created in S3 parallel mode
  const rfqItemsVD = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT);
  await applyVendorAction(rfqItemsVD, "accept", ctx.vendorTokenVD);

  const rfqItemsVA = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR);
  await applyVendorAction(rfqItemsVA, vaAction, ctx.vendorTokenVA);

  if (vaAction === "accept") {
    // VA accepted: DIC accepts VA and requests revision for VD in one combined call
    await dicAcceptVARequestReviseVD(ctx.rfqNumber, ctx.dicToken, "E2E Test: revision required");
  } else {
    // VA declined: DIC only needs to request revision for VD
    await dicRequestRevise(ctx.rfqNumber, ctx.dicToken, "E2E Test: revision required", VENDOR_TYPE.DIRECT);
  }

  return ctx;
}

/**
 * Stage 2 (mixed) — S1 RFQ in DIC review state with per-item vendor actions.
 *
 * Creates a multi-line PR and submits each line item with a distinct action,
 * enabling tests where the same RFQ contains items below OE, above OE, and need-confirm.
 *
 * @param {object} [options]
 * @param {Array<'accept'|'accept_oe'|'need_confirm'|'decline'>} [options.itemActions=['accept','accept_oe','need_confirm']]
 * @param {'s1'|'s2'|'s3'} [options.scenario='s1']
 */
export async function setupRFQAtDICStageMixed({
  itemActions = ["accept", "accept_oe", "need_confirm"],
  scenario = "s1",
} = {}) {
  const ctx = await setupRFQAtVendorStage({
    scenario,
    itemCount: itemActions.length,
  });

  if (ctx.vendorTokenVD) {
    await vendorSubmitMixed(ctx.rfqNumber, ctx.vendorTokenVD, itemActions);
  }

  return ctx;
}

/**
 * Stage 2 — RFQ in DIC review state (vendors have acted).
 *
 * @param {object} vendorActions
 * @param {'accept'|'accept_oe'|'need_confirm'|'decline'|'no_action'} vendorActions.vd - direct vendor action
 * @param {'accept'|'accept_oe'|'need_confirm'|'decline'|'no_action'|null} [vendorActions.va] - aggregator action
 * @param {object} [options]
 * @param {'s1'|'s2'|'s3'} [options.scenario]
 */
export async function setupRFQAtDICStage(vendorActions, options = {}) {
  const scenario = options.scenario ?? (vendorActions.va != null ? "s3" : "s1");

  let ctx;
  if (scenario === "s2") {
    // S2 needs skip_level_1_RFQ='no' so VD decline activates VA as fallback.
    // setupRFQAtVendorStageS2 handles config + VD decline + VA token polling.
    ctx = await setupRFQAtVendorStageS2({ itemCount: 1, ...options });
  } else if (scenario === "s3") {
    // S3 needs skip_level_1_RFQ='yes' so both VD and VA receive the RFQ in parallel.
    // setupRFQAtVendorStageS3 handles config + polling both VD and VA tokens.
    ctx = await setupRFQAtVendorStageS3({ itemCount: 1, ...options });
    if (vendorActions.vd !== "no_action" && ctx.vendorTokenVD) {
      const rfqItemsVD = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT);
      await applyVendorAction(rfqItemsVD, vendorActions.vd, ctx.vendorTokenVD);
    }
  } else {
    ctx = await setupRFQAtVendorStage({ scenario, ...options });
    if (vendorActions.vd !== "no_action" && ctx.vendorTokenVD) {
      const rfqItemsVD = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT);
      await applyVendorAction(rfqItemsVD, vendorActions.vd, ctx.vendorTokenVD);
    }
  }

  if (vendorActions.va != null && vendorActions.va !== "no_action" && ctx.vendorTokenVA) {
    const rfqItemsVA = await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR);
    await applyVendorAction(rfqItemsVA, vendorActions.va, ctx.vendorTokenVA);
  }

  return ctx;
}

/**
 * Stage 3 — RFQ in CS action state (DIC accepted).
 *
 * @param {object} vendorActions
 * @param {'accept_vd'|'accept_va'|'accept_both'} dicAction
 * @param {object} [options]
 */
export async function setupRFQAtCSStage(vendorActions, dicAction, options = { skipDICTokenPoll: false }) {
  const ctx = await setupRFQAtDICStage(vendorActions, options);

  // S3 with both vendors accepted: DIC must explicitly approve one and decline the other

  const scenario = options.scenario ?? (vendorActions.va != null ? 's3' : 's1');
  const acceptStatus = ['accept', 'accept_oe'];
  const respondedStatus = ['accept', 'accept_oe', 'need_confirm'];
  const s3BothAccepted = scenario === 's3' && acceptStatus.includes(vendorActions.vd) && acceptStatus.includes(vendorActions.va);
  const s3BothResponded = scenario === 's3' && respondedStatus.includes(vendorActions.vd) && respondedStatus.includes(vendorActions.va);
  // S3 + VD doing no action + VA no_action: VA never submitted, so expire VA token → cron creates DIC email token
  if (scenario === "s3" && vendorActions.vd !== "no_action" && vendorActions.va === "no_action" && ctx.vendorCodeVA) {
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.adminToken, {
      skipDICTokenPoll: options.skipDICTokenPoll,
    });
  }

  // S3 + VD no_action + VA action (decline/accept/etc): VD never submitted, expire VD token → cron advances directly to CS (skips DIC)
  if (
    scenario === "s3" &&
    vendorActions.vd === "no_action" &&
    vendorActions.va != null &&
    vendorActions.va !== "no_action" &&
    ctx.vendorCodeVD
  ) {
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVD, VENDOR_TYPE.AGGREGATOR, ctx.adminToken, {
      skipDICTokenPoll: options.skipDICTokenPoll,
    });
  }

  // S3 + VD + VA no_action: Both never submitted, so expire both tokens → cron creates DIC email token
  if (scenario === "s3" && vendorActions.vd === "no_action" && vendorActions.va === "no_action") {
    // expiry vd
    await executeQuery(
      `UPDATE rfq_token_email SET date_expired = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
       WHERE rfq_number = ? AND user_type = 'vendor' AND vendor_code in (?) AND config_condition = 'Waiting_vendor_expiry'`,
      [ctx.rfqNumber, ctx.vendorCodeVD],
    );

    // expiry va and run cron
    await expireVendorAndRunCron(ctx.rfqNumber, ctx.vendorCodeVA, VENDOR_TYPE.AGGREGATOR, ctx.adminToken, {
      skipDICTokenPoll: options.skipDICTokenPoll,
    });
  }


  if (s3BothResponded && dicAction === 'accept_vd') {
    await dicAcceptVDDeclineVA(ctx.rfqNumber, ctx.dicToken);
  } else if (s3BothResponded && dicAction === 'accept_va') {
    await dicAcceptVADeclineVD(ctx.rfqNumber, ctx.dicToken);
  } else if (dicAction) {
    const allItems = [
      ...(dicAction !== "accept_va" ? await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.DIRECT) : []),
      ...(dicAction !== "accept_vd" ? await getRFQItemsByVendorType(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR) : []),
    ];
    const dicDecisions = allItems.map(() => ({
      status_dic: STATUS_DIC.APPROVE,
    }));
    const dicEmailToken = await getDICEmailToken(ctx.rfqNumber);
    await dicConfirmQuotation(allItems, dicDecisions, dicEmailToken);
  }

  const qcfRows = await getQCFItems(ctx.rfqNumber);
  if (qcfRows.length > 0) {
    ctx.qcfNumber = qcfRows[0].qcf_number;
    ctx.qcfRecord = qcfRows[0];
  }

  return ctx;
}

/**
 * Stage 4 — QCF in CL approval state (CS sent to QCF).
 *
 * @param {object} vendorActions
 * @param {'accept_vd'|'accept_va'|'accept_both'} dicAction
 * @param {object} [csAction]
 * @param {string} [csAction.vendorType='direct'] - which vendor type's items to send to QCF
 * @param {object} [options]
 */
export async function setupRFQAtCLStage(
  vendorActions,
  dicAction,
  csAction = {
    vendorType: VENDOR_TYPE.DIRECT,
    steps: ["send_to_qcf"],
  },
  options = {},
) {
  // If the 3rd argument is actually the options object (scenario/skipDICTokenPoll),
  // shift it to options and use default csAction.
  if (csAction && (csAction.scenario !== undefined || csAction.skipDICTokenPoll !== undefined)) {
    options = csAction;
    csAction = {
      vendorType: VENDOR_TYPE.DIRECT,
      steps: ["send_to_qcf"],
    };
  }

  // Ensure csAction is properly formed even if passed as an empty object
  if (!csAction || !csAction.steps) {
    csAction = {
      vendorType: csAction?.vendorType ?? VENDOR_TYPE.DIRECT,
      steps: ["send_to_qcf"],
    };
  }

  const ctx = await setupRFQAtCSStage(vendorActions, dicAction, options);

  const vendorTypeForQCF = csAction.vendorType ?? VENDOR_TYPE.DIRECT;
  let qcfItems = await getRFQItemsByVendorType(ctx.rfqNumber, vendorTypeForQCF);
  const vendorBatch = qcfItems[0]?.vendor_batch;
  if (!vendorBatch) throw new Error(`No items found for vendor_type=${vendorTypeForQCF} in RFQ ${ctx.rfqNumber}`);

  for (const step of csAction.steps) {
    // Get latest data
    qcfItems = await getRFQItemsByVendorType(ctx.rfqNumber, vendorTypeForQCF);
    switch (step) {

      case 'send_to_qcf':
        // Temporary Fix: Inject missing category and cl_id because the Kafka worker
        // cannot find the test users in the isourcing database on the VPS.
        await injectMockCategories(ctx.rfqNumber);

        // Refresh qcfItems after update
        qcfItems = await getRFQItemsByVendorType(ctx.rfqNumber, vendorTypeForQCF);
        break;
      case "send_surrogate":
        await csSendSurrogate(
          ctx.rfqNumber,
          vendorBatch,
          qcfItems.map((item) => item.id),
          ctx.csToken,
        );
        break;
      default:
        throw new Error(`Unknown CS action step: ${step}`);
    }
  }

  
  // QCF creation is async — poll until the record appears after csSendToQCF
  let qcfNumber = null;
  const qcfPollStart = Date.now();
  while (!qcfNumber && Date.now() - qcfPollStart < 15000) {
    const qcfRows = await getQCFItems(ctx.rfqNumber);
    qcfNumber = qcfRows[0]?.qcf_number ?? null;
    if (!qcfNumber) await new Promise(r => setTimeout(r, 500));
  }
  const baseCleanup = ctx.cleanup;
  ctx.cleanup = async () => baseCleanup(qcfNumber);
  ctx.qcfNumber = qcfNumber;

  return ctx;
}

/**
 * Stage 5 — QCF in Management approval state (CL approved).
 *
 * @param {object} vendorActions
 * @param {'accept_vd'|'accept_va'|'accept_both'} dicAction
 * @param {object} [csAction]
 * @param {object} [clAction]
 * @param {string} [clAction.comments]
 * @param {object} [options]
 */
async function pollForQCFNumber(rfqNumber, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await executeQuery("SELECT qcf_number FROM qcf_library WHERE rfq_number = ? LIMIT 1", [rfqNumber]);
    if (rows[0]?.qcf_number) return rows[0].qcf_number;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`QCF not created for RFQ ${rfqNumber} within ${timeoutMs}ms`);
}

export async function setupRFQAtManagementStage(vendorActions, dicAction, csAction = {}, clAction = {}, options = {}) {
  let ctx;
  const hasOE = Object.values(vendorActions).includes('accept_oe');
  
  if (hasOE || (csAction.steps && csAction.steps.length > 0)) {
    // If it exceeds OE, we MUST go through the CS send_to_qcf flow
    const defaultVendorType = dicAction === 'accept_va' ? VENDOR_TYPE.AGGREGATOR : VENDOR_TYPE.DIRECT;
    const defaultCsAction = { vendorType: defaultVendorType, steps: ['send_to_qcf'] };
    ctx = await setupRFQAtCLStage(vendorActions, dicAction, Object.keys(csAction).length > 0 ? csAction : defaultCsAction, options);
  } else {
    // Normal price: QCF auto-created after DIC approval
    ctx = await setupRFQAtCSStage(vendorActions, dicAction, options);
  }

  // QCF creation is async — poll until it appears in qcf_library if not already set
  if (!ctx.qcfNumber) {
    ctx.qcfNumber = await pollForQCFNumber(ctx.rfqNumber);
  }

  // Inject mock categories so CL and Management dashboards can view the QCF
  await injectMockCategories(ctx.rfqNumber);

  if (ctx.qcfNumber) {
    await clApproveQCF(ctx.qcfNumber, ctx.clToken, clAction.comments ?? "E2E Test: Approved by CL");
    console.log(`[MG Setup] CL approved QCF ${ctx.qcfNumber} for RFQ ${ctx.rfqNumber}`);
  }

  return ctx;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function injectMockCategories(rfqNumber) {
  await executeQuery(
    "UPDATE rfq_library SET category = 'mrr', cl_id = (SELECT id FROM users WHERE email = 'nicky.laksmana@sinarmasmining.com') WHERE rfq_number = ?",
    [rfqNumber]
  );
  await executeQuery(
    "UPDATE qcf_library SET category = 'mrr', cl_id = (SELECT id FROM users WHERE email = 'nicky.laksmana@sinarmasmining.com') WHERE rfq_number = ?",
    [rfqNumber]
  );
  
  // Ensure CL user has 'mrr' category in their matrix
  await executeQuery("INSERT IGNORE INTO categories (name, level) VALUES ('mrr', 1)");
  await executeQuery("INSERT IGNORE INTO user_matrices (user_id, role_id, is_active) SELECT u.id, r.id, 1 FROM users u JOIN roles r ON r.slug = 'category-leader' WHERE u.email = 'nicky.laksmana@sinarmasmining.com'");
  await executeQuery("INSERT IGNORE INTO user_matrix_categories (user_matrix_id, category_id) SELECT um.id, c.id FROM user_matrices um JOIN users u ON u.id = um.user_id JOIN categories c ON c.name = 'mrr' WHERE u.email = 'nicky.laksmana@sinarmasmining.com'");
  
  // Ensure MG user has 'mrr' in category_group
  const mgUser = await executeQuery("SELECT id FROM users WHERE email = 'pan.barlian@sinarmasmining.com'");
  if (mgUser.length > 0) {
    await executeQuery("INSERT IGNORE INTO category_group (cat_grp_code, cat_group_leader) VALUES ('mrr', ?)", [mgUser[0].id], 'isourcing');
    await executeQuery("INSERT IGNORE INTO user_matrices (user_id, role_id, is_active) SELECT u.id, r.id, 1 FROM users u JOIN roles r ON r.slug = 'manajemen' WHERE u.email = 'pan.barlian@sinarmasmining.com'");
    await executeQuery("INSERT IGNORE INTO user_matrix_categories (user_matrix_id, category_id) SELECT um.id, c.id FROM user_matrices um JOIN users u ON u.id = um.user_id JOIN categories c ON c.name = 'mrr' WHERE u.email = 'pan.barlian@sinarmasmining.com' AND um.role_id = (SELECT id FROM roles WHERE slug = 'manajemen')");
  }
}

async function applyVendorAction(rfqItems, action, vendorToken) {
  switch (action) {
    case "accept": {
      // Use item.item_value (per-unit) to stay below OE threshold
      const payload = buildVendorPayload(rfqItems, STATUS_VENDOR.APPROVE);
      const response = await authenticatedPut(API_AIGEN_ENDPOINTS.PR.VENDOR_SUBMIT_PENAWARAN, payload, vendorToken);
      expect(response.status).toBe(200);
      break;
    }
    case "accept_oe":
      // Use item.item_value * 1.2 to exceed OE threshold (consistent with vendorSubmitMixed)
      await vendorSubmitQuotation(
        rfqItems.map((item) => ({
          ...item,
          vendor_price: Math.round((item.item_value ?? 10000) * 1.2),
        })),
        vendorToken,
      );
      break;
    case "need_confirm": {
      const payload = buildVendorPayload(rfqItems, STATUS_VENDOR.NEED_CONFIRMATION);
      const response = await authenticatedPut(API_AIGEN_ENDPOINTS.PR.VENDOR_SUBMIT_PENAWARAN, payload, vendorToken);
      expect(response.status).toBe(200);
      break;
    }
    case "decline": {
      const payload = buildVendorPayload(rfqItems, STATUS_VENDOR.REJECT);
      const response = await authenticatedPut(API_AIGEN_ENDPOINTS.PR.VENDOR_SUBMIT_PENAWARAN, payload, vendorToken);
      expect(response.status).toBe(200);
      break;
    }
    case "no_action":
    default:
      break;
  }
}

function buildVendorPayload(items, statusVendor) {
  const isReject = statusVendor === STATUS_VENDOR.REJECT;
  return {
    items: items.map((item) => ({
      id: item.id,
      status_vendor: statusVendor,
      vendor_price: item.item_value ?? 10000,
      quotation_number: `QE${Date.now().toString(36).toUpperCase()}`,
      vendor_description: `E2E Test: ${isReject ? "Vendor declined" : "needs confirmation"}`,
      vendor_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      vendor_brand: isReject ? "-" : "Test Brand",
      vendor_warranty: isReject ? 0 : 12,
      vendor_address_details: isReject ? "-" : "Test Address",
      vendor_sloc: "2001",
      ...(isReject && {
        vendor_reject_reason: "E2E Test: Vendor declined this item",
      }),
    })),
    is_submit: 1,
  };
}
