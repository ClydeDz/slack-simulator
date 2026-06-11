import { describe, it, expect } from "vitest";
import {
  dispatchSlashCommand,
  registerResponseUrlRoute,
} from "./slashCommands";

describe("Slash Commands Tests", () => {
  describe("dispatchSlashCommand", () => {
    it("should export dispatchSlashCommand function", () => {
      expect(typeof dispatchSlashCommand).toBe("function");
    });

    it("should be an async function", () => {
      expect(dispatchSlashCommand.constructor.name).toBe("AsyncFunction");
    });
  });

  describe("registerResponseUrlRoute", () => {
    it("should export registerResponseUrlRoute function", () => {
      expect(typeof registerResponseUrlRoute).toBe("function");
    });
  });
});
