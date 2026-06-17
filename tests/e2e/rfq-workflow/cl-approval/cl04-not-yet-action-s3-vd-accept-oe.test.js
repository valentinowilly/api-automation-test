import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupRFQAtCLStage } from "../helpers/pre-test.helper.js";
import {
  assertUIState,
  assertQCFPendingCL,
} from "../helpers/state-assertions.helper.js";

describe("[CL04] CL04 — CL not yet action S3 (VD, VA No Act)", () => {
  let ctx;

  beforeAll(async () => {
    ctx = await setupRFQAtCLStage(
      { vd: "accept", va: "no_action" },
      "accept_vd",
    );
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

  test('CS UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.rfqNumber, "cs", "Waiting CL", ctx.csToken);
  });

  test('CL UI shows "Need Action"', async () => {
    await assertUIState(ctx.qcfNumber, "cl", "Need Action", ctx.clToken);
  });

  test('MG UI shows "Waiting CL"', async () => {
    await assertUIState(ctx.qcfNumber, "mg", "Waiting CL", ctx.mgToken);
  });

  test("table status is QCF_PENDING_CL", async () => {
    await assertQCFPendingCL(ctx.rfqNumber);
  });
});
