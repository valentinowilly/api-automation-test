import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupRFQAtCSStage } from "../helpers/pre-test.helper.js";
import {
  assertVendorItemsUIStatus,
  assertUIState,
  assertRFQMilestone,
  assertVendorTypeMilestone,
  UI_STATUS,
} from "../helpers/state-assertions.helper.js";
import { VENDOR_TYPE } from "../../../../utils/constants/milestone.constant.js";

describe("[CS28] CS28 — Not yet action (from DIC)", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCSStage({ vd: "decline", va: "accept_oe" }, "accept_va", { scenario: "s2" });
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

  test('CS UI shows "Need Action"', async () => {
    await assertUIState(ctx.rfqNumber, "cs", UI_STATUS.NEED_ACTION, ctx.csToken);
  });
});
