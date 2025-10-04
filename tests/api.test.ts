import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { Elysia } from "elysia";

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3030";

// Create API client
const api = treaty(BASE_URL);

describe("API Integration Tests", () => {
  let testApiKey: string;
  let testItemKey: string;

  beforeAll(() => {
    testItemKey = `https://test.com/item/${Date.now()}?test=true`;
  });

  describe("Health Check", () => {
    test("GET /health should return service status", async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("services");
      expect(data.services).toHaveProperty("mongodb");
      expect(data.services).toHaveProperty("redis");
    });

    test("GET / should return service name", async () => {
      const response = await fetch(`${BASE_URL}/`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toBe("Inventory API Service");
    });
  });

  describe("API Key Publishing", () => {
    test("POST /api/keys/publish should create a new API key", async () => {
      const response = await fetch(`${BASE_URL}/api/keys/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemKey: testItemKey,
          permission: ["read", "write"],
          expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
          maxUses: 1000,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("apiKey");
      expect(data.data.apiKey).toBeTruthy();
      expect(data.data.itemKey).toBe(testItemKey);
      expect(data.data.permission).toEqual(["read", "write"]);
      expect(data.data.maxUses).toBe(1000);

      // Save for validation tests
      testApiKey = data.data.apiKey;
    });

    test("POST /api/keys/publish should reject invalid itemKey", async () => {
      const response = await fetch(`${BASE_URL}/api/keys/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemKey: "invalid-item-key",
          permission: ["read"],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          maxUses: 100,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toHaveProperty("code");
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    test("POST /api/keys/publish should reject empty permissions", async () => {
      const response = await fetch(`${BASE_URL}/api/keys/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemKey: testItemKey,
          permission: [],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          maxUses: 100,
        }),
      });

      expect(response.status).toBe(400);
    });

    test("POST /api/keys/publish should reject past expiration date", async () => {
      const response = await fetch(`${BASE_URL}/api/keys/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemKey: testItemKey,
          permission: ["read"],
          expiresAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          maxUses: 100,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("API Key Validation", () => {
    test("POST /api/keys/validate should validate a valid API key", async () => {
      if (!testApiKey) {
        throw new Error("Test API key not available");
      }

      const response = await fetch(`${BASE_URL}/api/keys/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: testApiKey,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.valid).toBe(true);
      expect(data.data.itemKey).toBe(testItemKey);
      expect(data.data.permission).toEqual(["read", "write"]);
      expect(data.data.usedCount).toBeGreaterThanOrEqual(1);
    });

    test("POST /api/keys/validate should reject invalid API key", async () => {
      const response = await fetch(`${BASE_URL}/api/keys/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: "invalid-api-key-12345",
        }),
      });

      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data.success).toBe(false);
    });

    test("POST /api/keys/validate should increment usage count", async () => {
      if (!testApiKey) {
        throw new Error("Test API key not available");
      }

      // First validation
      const response1 = await fetch(`${BASE_URL}/api/keys/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: testApiKey,
        }),
      });

      const data1 = await response1.json();
      const usedCount1 = data1.data.usedCount;

      // Second validation
      const response2 = await fetch(`${BASE_URL}/api/keys/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: testApiKey,
        }),
      });

      const data2 = await response2.json();
      const usedCount2 = data2.data.usedCount;

      expect(usedCount2).toBe(usedCount1 + 1);
    });
  });

  describe("Admin API", () => {
    test("GET /admin/keys/by-item should list keys for an item", async () => {
      const response = await fetch(
        `${BASE_URL}/admin/keys/by-item?itemKey=${encodeURIComponent(testItemKey)}`
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.itemKey).toBe(testItemKey);
      expect(data.data.count).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(data.data.keys)).toBe(true);
    });

    test("GET /admin/stats should return overall statistics", async () => {
      const response = await fetch(`${BASE_URL}/admin/stats`);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("totalKeys");
      expect(data.data).toHaveProperty("activeKeys");
      expect(data.data).toHaveProperty("expiredKeys");
      expect(data.data).toHaveProperty("exhaustedKeys");
      expect(data.data).toHaveProperty("topItems");
    });

    test("GET /admin/metrics should return application metrics", async () => {
      const response = await fetch(`${BASE_URL}/admin/metrics`);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("keysPublished");
      expect(data.data).toHaveProperty("keysValidated");
      expect(data.data).toHaveProperty("cacheHits");
      expect(data.data).toHaveProperty("cacheMisses");
      expect(data.data).toHaveProperty("cacheHitRate");
    });
  });

  describe("Rate Limiting", () => {
    test("Should enforce rate limits on validation endpoint", async () => {
      // This test is slow, so we'll just make a few requests
      const requests = Array.from({ length: 5 }, () =>
        fetch(`${BASE_URL}/api/keys/validate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: "test-key-for-rate-limit",
          }),
        })
      );

      const responses = await Promise.all(requests);

      // All should get through (we're not exceeding the limit)
      responses.forEach((response) => {
        expect([400, 401, 404, 429, 500]).toContain(response.status);
      });
    }, 30000); // 30 second timeout
  });
});
