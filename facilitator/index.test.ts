import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Set environment variables BEFORE any imports
process.env.SVM_PRIVATE_KEY = "test-private-key";
process.env.SVM_DEVNET_RPC_URL = "https://api.devnet.solana.com";
process.env.FACILITATOR_AMIKO_AUTH_KEY = "test-auth-key";
process.env.AMIKO_PLATFORM_API_URL = "http://localhost:4114";

// Mock all x402 dependencies
vi.mock("x402/facilitator", () => ({
  verify: vi.fn().mockResolvedValue({ isValid: true }),
  settle: vi.fn().mockResolvedValue({
    success: true,
    transaction: "mock-tx-hash",
    network: "solana-devnet",
  }),
}));

vi.mock("x402/client", () => ({
  createUnsignedTransaction: vi.fn().mockResolvedValue("mock-unsigned-tx"),
}));

vi.mock("x402/types", () => ({
  PaymentRequirementsSchema: {
    parse: vi.fn((data: unknown) => data),
  },
  PaymentPayloadSchema: {
    parse: vi.fn((data: unknown) => data),
  },
  createConnectedClient: vi.fn(),
  createSigner: vi.fn().mockResolvedValue({
    address: "mock-signer-address",
    signTransaction: vi.fn(),
  }),
  SupportedEVMNetworks: ["base", "base-sepolia"],
  SupportedSVMNetworks: ["solana", "solana-devnet"],
  isSvmSignerWallet: vi.fn().mockReturnValue(true),
}));

// Mock fetch for isWalletCrossmint
vi.stubGlobal("fetch", vi.fn());

// Import app after mocks are set up
const { app } = await import("./index.js");

// Re-import settle mock so we can reset it properly
const { settle } = await import("x402/facilitator");

describe("Crossmint wallet authentication in /settle", () => {
  const basePaymentRequirements = {
    scheme: "exact",
    network: "solana-devnet",
    maxAmountRequired: "1000000",
    resource: "https://example.com/api",
    description: "Test payment",
    mimeType: "application/json",
    payTo: "TestPayToAddress",
    maxTimeoutSeconds: 300,
    asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  };

  const basePaymentPayload = {
    scheme: "exact",
    x402Version: 1,
    network: "solana-devnet",
    payload: {
      transaction: "base64-encoded-transaction",
    },
  };

  beforeEach(() => {
    // Reset the settle mock with the expected return value
    vi.mocked(settle).mockResolvedValue({
      success: true,
      transaction: "mock-tx-hash",
      network: "solana-devnet",
    });
  });

  describe("when wallet is NOT a Crossmint wallet", () => {
    it("should proceed without requiring X-Amiko-Auth header", async () => {
      const response = await request(app)
        .post("/settle")
        .send({
          paymentRequirements: {
            ...basePaymentRequirements,
            extra: {}, // No isCrossmintWallet flag
          },
          paymentPayload: basePaymentPayload,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should proceed with isCrossmintWallet explicitly set to false", async () => {
      const response = await request(app)
        .post("/settle")
        .send({
          paymentRequirements: {
            ...basePaymentRequirements,
            extra: { isCrossmintWallet: false },
          },
          paymentPayload: basePaymentPayload,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should proceed without extra field at all", async () => {
      const response = await request(app)
        .post("/settle")
        .send({
          paymentRequirements: basePaymentRequirements, // No extra field
          paymentPayload: basePaymentPayload,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("when wallet IS a Crossmint wallet", () => {
    it("should return 401 when X-Amiko-Auth header is missing", async () => {
      const response = await request(app)
        .post("/settle")
        .send({
          paymentRequirements: {
            ...basePaymentRequirements,
            extra: { isCrossmintWallet: true },
          },
          paymentPayload: basePaymentPayload,
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
      expect(response.body.message).toContain("X-Amiko-Auth");
    });

    it("should return 401 when X-Amiko-Auth header has wrong value", async () => {
      const response = await request(app)
        .post("/settle")
        .set("X-Amiko-Auth", "wrong-key")
        .send({
          paymentRequirements: {
            ...basePaymentRequirements,
            extra: { isCrossmintWallet: true },
          },
          paymentPayload: basePaymentPayload,
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should return 401 when X-Amiko-Auth header is empty", async () => {
      const response = await request(app)
        .post("/settle")
        .set("X-Amiko-Auth", "")
        .send({
          paymentRequirements: {
            ...basePaymentRequirements,
            extra: { isCrossmintWallet: true },
          },
          paymentPayload: basePaymentPayload,
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    it("should succeed when X-Amiko-Auth header matches FACILITATOR_AMIKO_AUTH_KEY", async () => {
      const response = await request(app)
        .post("/settle")
        .set("X-Amiko-Auth", "test-auth-key") // Matches process.env.FACILITATOR_AMIKO_AUTH_KEY
        .send({
          paymentRequirements: {
            ...basePaymentRequirements,
            extra: { isCrossmintWallet: true },
          },
          paymentPayload: basePaymentPayload,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("CORS configuration", () => {
    it("should include X-Amiko-Auth in Access-Control-Allow-Headers", async () => {
      const response = await request(app)
        .options("/settle")
        .set("Origin", "https://example.com")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "X-Amiko-Auth");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-headers"]).toContain("X-Amiko-Auth");
    });

    it("should allow X-Amiko-Auth header in preflight requests", async () => {
      const response = await request(app).options("/settle");

      expect(response.headers["access-control-allow-headers"]).toContain("Content-Type");
      expect(response.headers["access-control-allow-headers"]).toContain("X-Amiko-Auth");
    });
  });
});

describe("FACILITATOR_AMIKO_AUTH_KEY not configured", () => {
  it("should return 500 when env var is missing for Crossmint wallet", async () => {
    // Save and clear the auth key
    const originalKey = process.env.FACILITATOR_AMIKO_AUTH_KEY;
    delete process.env.FACILITATOR_AMIKO_AUTH_KEY;

    // Reset modules to get fresh app with no auth key
    vi.resetModules();

    // Re-apply mocks for fresh import
    vi.doMock("x402/facilitator", () => ({
      verify: vi.fn().mockResolvedValue({ isValid: true }),
      settle: vi.fn().mockResolvedValue({ success: true, transaction: "tx", network: "solana-devnet" }),
    }));
    vi.doMock("x402/client", () => ({
      createUnsignedTransaction: vi.fn(),
    }));
    vi.doMock("x402/types", () => ({
      PaymentRequirementsSchema: { parse: vi.fn((d: unknown) => d) },
      PaymentPayloadSchema: { parse: vi.fn((d: unknown) => d) },
      createConnectedClient: vi.fn(),
      createSigner: vi.fn().mockResolvedValue({ address: "mock" }),
      SupportedEVMNetworks: ["base", "base-sepolia"],
      SupportedSVMNetworks: ["solana", "solana-devnet"],
      isSvmSignerWallet: vi.fn().mockReturnValue(true),
    }));

    const { app: freshApp } = await import("./index.js");

    const response = await request(freshApp)
      .post("/settle")
      .set("X-Amiko-Auth", "some-key")
      .send({
        paymentRequirements: {
          scheme: "exact",
          network: "solana-devnet",
          maxAmountRequired: "1000",
          extra: { isCrossmintWallet: true },
        },
        paymentPayload: {
          scheme: "exact",
          x402Version: 1,
          network: "solana-devnet",
          payload: { transaction: "tx" },
        },
      });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Server configuration error");
    expect(response.body.message).toContain("not properly configured");

    // Restore the auth key
    process.env.FACILITATOR_AMIKO_AUTH_KEY = originalKey;
  });
});
