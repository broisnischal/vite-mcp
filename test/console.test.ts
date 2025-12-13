import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  consoleAdapter,
  consoleAdapterInputSchema,
  consoleAdapterOutputSchema,
} from "../src/adapter/console.js";

describe("Console Adapter", () => {
  describe("Input Schema Validation", () => {
    it("should accept valid input with limit", () => {
      const input = { limit: 50 };
      const result = consoleAdapterInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it("should accept valid input with type filter", () => {
      const input = { type: "error" as const };
      const result = consoleAdapterInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("error");
      }
    });

    it("should accept valid input with both limit and type", () => {
      const input = { limit: 25, type: "warn" as const };
      const result = consoleAdapterInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.type).toBe("warn");
      }
    });

    it("should use default limit when not provided", () => {
      const input = {};
      const result = consoleAdapterInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    it("should reject invalid limit (negative number)", () => {
      const input = { limit: -5 };
      const result = consoleAdapterInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid limit (zero)", () => {
      const input = { limit: 0 };
      const result = consoleAdapterInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid limit (non-integer)", () => {
      const input = { limit: 50.5 };
      const result = consoleAdapterInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid type", () => {
      const input = { type: "invalid" };
      const result = consoleAdapterInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept all valid console types", () => {
      const validTypes = ["log", "info", "warn", "error", "debug"] as const;
      validTypes.forEach((type) => {
        const input = { type };
        const result = consoleAdapterInputSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe(type);
        }
      });
    });
  });

  describe("Output Schema Validation", () => {
    it("should accept valid output with messages array", () => {
      const output = {
        messages: [
          {
            type: "log",
            message: "Test message",
            timestamp: Date.now(),
          },
        ],
      };
      const result = consoleAdapterOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("should accept valid output without timestamp", () => {
      const output = {
        messages: [
          {
            type: "error",
            message: "Error message",
          },
        ],
      };
      const result = consoleAdapterOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("should accept empty messages array", () => {
      const output = {
        messages: [],
      };
      const result = consoleAdapterOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("should accept multiple messages", () => {
      const output = {
        messages: [
          { type: "log", message: "Message 1" },
          { type: "warn", message: "Message 2", timestamp: 1234567890 },
          { type: "error", message: "Message 3" },
        ],
      };
      const result = consoleAdapterOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messages).toHaveLength(3);
      }
    });

    it("should reject output without messages property", () => {
      const output = {};
      const result = consoleAdapterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it("should reject output with invalid message structure", () => {
      const output = {
        messages: [
          {
            type: "log",
          },
        ],
      };
      const result = consoleAdapterOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });

  describe("Adapter Definition", () => {
    it("should have correct name", () => {
      expect(consoleAdapter.name).toBe("read_console");
    });

    it("should have description", () => {
      expect(consoleAdapter.description).toBe(
        "Read console messages from the browser"
      );
    });

    it("should have inputSchema", () => {
      expect(consoleAdapter.inputSchema).toBeDefined();
      expect(consoleAdapter.inputSchema).toBe(consoleAdapterInputSchema);
    });

    it("should have outputSchema", () => {
      expect(consoleAdapter.outputSchema).toBeDefined();
      expect(consoleAdapter.outputSchema).toBe(consoleAdapterOutputSchema);
    });
  });

  describe("Integration Tests", () => {
    it("should validate complete input and output flow", () => {
      const input = { limit: 10, type: "error" as const };
      const inputResult = consoleAdapterInputSchema.safeParse(input);
      expect(inputResult.success).toBe(true);

      const output = {
        messages: [
          {
            type: "error",
            message: "Test error",
            timestamp: Date.now(),
          },
        ],
      };
      const outputResult = consoleAdapterOutputSchema.safeParse(output);
      expect(outputResult.success).toBe(true);
    });

    it("should handle real-world console message structure", () => {
      const realWorldOutput = {
        messages: [
          {
            type: "log",
            message: "Application started",
            timestamp: 1704067200000,
          },
          {
            type: "info",
            message: "User logged in",
            timestamp: 1704067201000,
          },
          {
            type: "warn",
            message: "Deprecated API used",
            timestamp: 1704067202000,
          },
          {
            type: "error",
            message: "Failed to load resource",
            timestamp: 1704067203000,
          },
          {
            type: "debug",
            message: "Debug information",
            timestamp: 1704067204000,
          },
        ],
      };

      const result = consoleAdapterOutputSchema.safeParse(realWorldOutput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messages).toHaveLength(5);
        expect(result.data.messages[0].type).toBe("log");
        expect(result.data.messages[3].type).toBe("error");
      }
    });
  });
});

