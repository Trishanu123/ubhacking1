import { describe, expect, it } from "vitest";
import {
  annualRoiPercent,
  cappedIncentive,
  computeMeasureFinancials,
  lifetimeNetSavings,
  netCost,
  simplePayback,
} from "./financial";

describe("financial engine", () => {
  it("computes normal values", () => {
    const r = computeMeasureFinancials({
      projectCost: 10000,
      incentives: 2500,
      annualSavings: 2500,
      lifetimeYears: 12,
    });
    expect(r.netCost).toBe(7500);
    expect(r.paybackYears).toBe(3);
    expect(r.roiPercent).toBeCloseTo(33.333, 2);
    expect(r.lifetimeSavings).toBe(2500 * 12 - 7500);
  });

  it("handles zero savings", () => {
    expect(simplePayback(8000, 0)).toBeNull();
    expect(annualRoiPercent(8000, 0)).toBeNull();
    expect(lifetimeNetSavings(0, 10, 8000)).toBe(-8000);
  });

  it("handles zero incentive", () => {
    const r = computeMeasureFinancials({
      projectCost: 5000,
      incentives: 0,
      annualSavings: 1000,
      lifetimeYears: 10,
    });
    expect(r.netCost).toBe(5000);
    expect(r.incentives).toBe(0);
    expect(r.paybackYears).toBe(5);
  });

  it("never allows negative project cost when incentives exceed cost", () => {
    expect(netCost(10000, 18000)).toBe(0);
    expect(cappedIncentive(10000, 18000)).toBe(10000);
    const r = computeMeasureFinancials({
      projectCost: 10000,
      incentives: 18000,
      annualSavings: 2000,
      lifetimeYears: 10,
    });
    expect(r.netCost).toBe(0);
    expect(r.incentives).toBe(10000);
    expect(r.paybackYears).toBe(0);
    expect(r.roiPercent).toBeNull();
  });

  it("treats missing values as zero", () => {
    const r = computeMeasureFinancials({
      projectCost: null,
      incentives: undefined,
      annualSavings: undefined,
      lifetimeYears: null,
    });
    expect(r.projectCost).toBe(0);
    expect(r.netCost).toBe(0);
    expect(r.annualSavings).toBe(0);
    expect(r.paybackYears).toBeNull();
  });
});
