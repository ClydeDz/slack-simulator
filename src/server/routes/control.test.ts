import { describe, it, expect } from "vitest";
import { registerControl } from "./control";

describe("Control Routes Tests", () => {
  describe("registerControl", () => {
    it("should export registerControl function", () => {
      expect(typeof registerControl).toBe("function");
    });

    it("should be an async function", () => {
      expect(registerControl.constructor.name).toBe("AsyncFunction");
    });
  });
});
