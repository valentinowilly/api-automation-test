import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupRFQAtCSStage } from "../helpers/pre-test.helper.js";
import {
  assertVendorItemsUIStatus,
  assertUIState,
  assertQCFPendingCL,
  UI_STATUS,
} from "../helpers/state-assertions.helper.js";
import { VENDOR_TYPE } from "../../../../utils/constants/milestone.constant.js";

describe("[CS29] CS29 — Approve OE Revision", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCSStage({ vd: "accept" }, "accept_vd");
  }, 60000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting Procurement"', async () => {
    await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.DIRECT, UI_STATUS.WAITING_PROCUREMENT);
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertVendorItemsUIStatus(ctx.rfqNumber, VENDOR_TYPE.AGGREGATOR, UI_STATUS.WAITING_PROCUREMENT);
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(ctx.rfqNumber, "dic", UI_STATUS.WAITING_PROCUREMENT, ctx.dicToken);
  });

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, "cs", UI_STATUS.WAITING_CL, ctx.csToken);
  });

  test('CL UI shows "Need Action"', async () => {
    expect(ctx.qcfNumber).toBeDefined();
    await assertUIState(ctx.qcfNumber, "cl", UI_STATUS.NEED_ACTION, ctx.clToken);
  });
});
