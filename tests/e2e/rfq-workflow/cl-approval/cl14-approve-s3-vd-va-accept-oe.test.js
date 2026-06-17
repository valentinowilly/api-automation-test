import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupRFQAtCLStage } from "../helpers/pre-test.helper.js";
import { clApprove } from "../helpers/workflow-actions.helper.js";
import {
  assertUIState,
  assertQCFCLApproved,
} from "../helpers/state-assertions.helper.js";

describe("[CL14] CL14 — CL approve S3 (VA)", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCLStage({ vd: "accept", va: "accept" }, "accept_va");
    await clApprove(ctx.qcfNumber, ctx.clToken);
  }, 90000);

  afterAll(async () => {
    await ctx?.cleanup?.();
  }, 30000);

  test('VD UI shows "Waiting Procurement"', async () => {
    await assertUIState(
      ctx.rfqNumber,
      "vd",
      "Waiting Procurement",
      ctx.vendorAccountTokenVD || ctx.vdToken,
    );
  });

  test('VA UI shows "Waiting Procurement"', async () => {
    await assertUIState(
      ctx.rfqNumber,
      "va",
      "Waiting Procurement",
      ctx.vendorAccountTokenVA || ctx.vaToken,
    );
  });

  test('DIC UI shows "Waiting Procurement"', async () => {
    await assertUIState(
      ctx.rfqNumber,
      "dic",
      "Waiting Procurement",
      ctx.dicToken,
    );
  });

  test('CS UI shows "Waiting Management"', async () => {
    await assertUIState(ctx.rfqNumber, "cs", "Waiting Management", ctx.csToken);
  });

  test('CL UI shows "Waiting Management"', async () => {
    await assertUIState(ctx.qcfNumber, "cl", "Waiting Management", ctx.clToken);
  });

  test('MG UI shows "Need Action"', async () => {
    await assertUIState(ctx.qcfNumber, "mg", "Need Action", ctx.mgToken);
  });

  test("table status is QCF_CL_APPROVED", async () => {
    await assertQCFCLApproved(ctx.rfqNumber, "QCF_CL_APPROVED");
  });
});
