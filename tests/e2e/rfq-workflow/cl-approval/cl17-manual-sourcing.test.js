import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupRFQAtCLStage } from "../helpers/pre-test.helper.js";
import { clSendISourcing } from "../helpers/workflow-actions.helper.js";
import {
  assertUIState,
  assertRFQMilestone,
} from "../helpers/state-assertions.helper.js";

describe("[CL17] CL17 — CL manual sourcing", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCLStage({ vd: "accept" }, "accept_vd");
    await clSendISourcing(ctx.rfqNumber, ctx.clToken);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Manual Sourcing"', async () => {
    await assertUIState(
      ctx.rfqNumber,
      "vd",
      "Manual Sourcing",
      ctx.vendorAccountTokenVD || ctx.vdToken,
    );
  });

  test('DIC UI shows "Manual Sourcing"', async () => {
    await assertUIState(
      ctx.rfqNumber,
      "dic",
      "Manual Sourcing",
      ctx.dicToken,
    );
  });

  test('CS UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.rfqNumber, "cs", "Manual Sourcing", ctx.csToken);
  });

  test('CL UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.qcfNumber, "cl", "Manual Sourcing", ctx.clToken);
  });

  test('MG UI shows "Manual Sourcing"', async () => {
    await assertUIState(ctx.qcfNumber, "mg", "Manual Sourcing", ctx.mgToken);
  });

  test("table status is MANUAL_SOURCING", async () => {
    await assertRFQMilestone(ctx.rfqNumber, "MANUAL_SOURCING");
  });
});
