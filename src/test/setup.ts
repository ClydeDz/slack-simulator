import { beforeAll, afterAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import "@testing-library/jest-dom";

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();

// Global test database path
const TEST_DB_PATH = ":memory:";

let globalDb: Database.Database | null = null;

beforeAll(() => {
  // Setup can be done here if needed
});

afterAll(() => {
  if (globalDb) {
    globalDb.close();
  }
});

afterEach(() => {
  // Clean up after each test if needed
});

export { TEST_DB_PATH, globalDb };
