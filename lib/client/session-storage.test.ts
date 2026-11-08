import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readAppSession } from "./session-storage";
let rows: Map<string, string>;
beforeEach(() => {
  rows = new Map();
  vi.stubGlobal("window", { sessionStorage: {
    get length() { return rows.size; }, key: (i: number) => [...rows.keys()][i] ?? null,
    getItem: (key: string) => rows.get(key) ?? null,
    setItem: (key: string, value: string) => rows.set(key, value), removeItem: (key: string) => rows.delete(key),
  } });
});
afterEach(() => vi.unstubAllGlobals());
it("moves a validated previous namespace value without losing its payload", () => {
  rows.set("previous-brand:intake", '{"form":{"address":"123 Main"}}');
  expect(readAppSession("intake", value => !!JSON.parse(value).form)).toBe('{"form":{"address":"123 Main"}}');
  expect(rows.has("previous-brand:intake")).toBe(false);
  expect(rows.has("retropilot:intake")).toBe(true);
});
it("preserves newer values and ignores unrelated or malformed data", () => {
  rows.set("other-app:analysis:123", "malformed");
  expect(readAppSession("analysis:123", value => JSON.parse(value).id === "123")).toBeNull();
  expect(rows.has("other-app:analysis:123")).toBe(true);
  rows.set("retropilot:intake", "new"); rows.set("previous-brand:intake", "old");
  expect(readAppSession("intake", () => true)).toBe("new");
});
