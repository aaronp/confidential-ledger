import { describe, it, expect, beforeEach } from "vitest";
import {
  createAsset,
  getPublicSummary,
  getWalletView,
  verifyAssetState,
  getTotalSupply,
  getHolderCount,
  type AssetState,
} from "../core/stablecoin.api";
import {
  createTestIdentities,
  createHolderKeyMap,
  createSimpleAllocations,
  DEMO_RULES,
  PRODUCTION_RULES,
  cappedSupplyRules,
} from "./fixtures";
import type { KeyPair } from "../../ledger/core/ledger.api";

describe("Stablecoin / Fungible Asset", () => {
  let identities: {
    alice: KeyPair;
    bob: KeyPair;
    carol: KeyPair;
    dave: KeyPair;
    treasurer: KeyPair;
  };
  let holderKeys: Map<string, KeyPair>;

  beforeEach(() => {
    identities = createTestIdentities();
    holderKeys = createHolderKeyMap(identities);
  });

  describe("Asset Creation", () => {
    it("creates asset with single holder", async () => {
      const asset = await createAsset(
        "testcoin",
        "Test Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        DEMO_RULES,
        [{ recipient: identities.alice.id, amount: 100 }],
        holderKeys
      );

      expect(asset.version).toBe("1");
      expect(asset.assetId).toBe("testcoin");
      expect(asset.assetName).toBe("Test Coin");
      expect(asset.ledger.entries).toHaveLength(1);
      expect(asset.ledger.entries[0].holderId).toBe(identities.alice.id);
      expect(getTotalSupply(asset)).toBe(100n);
    });

    it("creates asset with multiple holders", async () => {
      const allocations = createSimpleAllocations(identities);
      const asset = await createAsset(
        "testcoin",
        "Test Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        DEMO_RULES,
        allocations,
        holderKeys
      );

      expect(asset.ledger.entries).toHaveLength(3);
      expect(getTotalSupply(asset)).toBe(600n);
      expect(getHolderCount(asset)).toBe(3);
    });

    it("creates asset with zero initial allocations", async () => {
      const asset = await createAsset(
        "testcoin",
        "Test Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        DEMO_RULES,
        [],
        holderKeys
      );

      expect(asset.ledger.entries).toHaveLength(0);
      expect(getTotalSupply(asset)).toBe(0n);
    });

    it("creates operation log entries for initial allocations", async () => {
      const allocations = createSimpleAllocations(identities);
      const asset = await createAsset(
        "testcoin",
        "Test Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        DEMO_RULES,
        allocations,
        holderKeys
      );

      expect(asset.operations).toHaveLength(3);
      expect(asset.operations[0].type).toBe("mint");
      expect(asset.operations[0].to).toBe(identities.alice.id);
      expect(asset.operations[0].amount).toBe("100");
      expect(asset.operations[0].status).toBe("confirmed");
    });

    it("throws error when recipient KeyPair is missing", async () => {
      const incompleteKeys = new Map<string, KeyPair>();
      incompleteKeys.set(identities.alice.id, identities.alice);
      // Missing bob and carol

      await expect(
        createAsset(
          "testcoin",
          "Test Coin",
          {
            mintAuthority: [identities.treasurer.id],
            burnAuthority: [identities.treasurer.id],
          },
          DEMO_RULES,
          createSimpleAllocations(identities),
          incompleteKeys
        )
      ).rejects.toThrow(/No KeyPair found for recipient/);
    });
  });

  describe("Public Summary", () => {
    let asset: AssetState;

    beforeEach(async () => {
      const allocations = createSimpleAllocations(identities);
      asset = await createAsset(
        "testcoin",
        "Test Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        DEMO_RULES,
        allocations,
        holderKeys
      );
    });

    it("provides correct public summary", () => {
      const summary = getPublicSummary(asset);

      expect(summary.version).toBe("1");
      expect(summary.assetId).toBe("testcoin");
      expect(summary.assetName).toBe("Test Coin");
      expect(summary.holderCount).toBe(3);
      expect(summary.totalSupply).toBe("600");
      expect(summary.operationCount).toBe(3);
      expect(summary.verified).toBe(true);
      expect(summary.transferable).toBe(true);
      expect(summary.cappedSupply).toBe(false);
    });

    it("shows capped supply in summary when enabled", async () => {
      const cappedAsset = await createAsset(
        "cappedcoin",
        "Capped Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        cappedSupplyRules(1000),
        [{ recipient: identities.alice.id, amount: 500 }],
        holderKeys
      );

      const summary = getPublicSummary(cappedAsset);

      expect(summary.cappedSupply).toBe(true);
      expect(summary.maxSupply).toBe("1000");
    });
  });

  describe("Wallet View", () => {
    let asset: AssetState;

    beforeEach(async () => {
      const allocations = createSimpleAllocations(identities);
      asset = await createAsset(
        "testcoin",
        "Test Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        DEMO_RULES,
        allocations,
        holderKeys
      );
    });

    it("shows user's own balance", async () => {
      const aliceWallet = await getWalletView(asset, identities.alice);

      expect(aliceWallet.assetId).toBe("testcoin");
      expect(aliceWallet.assetName).toBe("Test Coin");
      expect(aliceWallet.myBalance).toBe(100n);
      expect(aliceWallet.myBalanceValid).toBe(true);
      expect(aliceWallet.publicTotalSupply).toBe(600n);
    });

    it("shows null balance for non-holder", async () => {
      const daveWallet = await getWalletView(asset, identities.dave);

      expect(daveWallet.myBalance).toBe(null);
      expect(daveWallet.publicTotalSupply).toBe(600n);
    });

    it("shows correct permissions in demo mode", async () => {
      const aliceWallet = await getWalletView(asset, identities.alice);

      expect(aliceWallet.canMint).toBe(true); // allowSelfMint is true
      expect(aliceWallet.canBurn).toBe(true); // allowSelfBurn is true
    });

    it("shows correct permissions in production mode", async () => {
      const prodAsset = await createAsset(
        "prodcoin",
        "Production Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        PRODUCTION_RULES,
        [{ recipient: identities.alice.id, amount: 100 }],
        holderKeys
      );

      const aliceWallet = await getWalletView(prodAsset, identities.alice);
      const treasurerWallet = await getWalletView(prodAsset, identities.treasurer);

      expect(aliceWallet.canMint).toBe(false);
      expect(aliceWallet.canBurn).toBe(false);
      expect(treasurerWallet.canMint).toBe(true);
      expect(treasurerWallet.canBurn).toBe(true);
    });

    it("shows user's operations", async () => {
      const aliceWallet = await getWalletView(asset, identities.alice);

      expect(aliceWallet.myOperations).toHaveLength(1);
      expect(aliceWallet.myOperations[0].type).toBe("mint");
      expect(aliceWallet.myOperations[0].to).toBe(identities.alice.id);
    });
  });

  describe("Asset State Verification", () => {
    it("verifies valid asset state", async () => {
      const asset = await createAsset(
        "testcoin",
        "Test Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        DEMO_RULES,
        createSimpleAllocations(identities),
        holderKeys
      );

      const verification = verifyAssetState(asset);

      expect(verification.valid).toBe(true);
      expect(verification.errors).toHaveLength(0);
    });

    it("detects tampered ledger", async () => {
      const asset = await createAsset(
        "testcoin",
        "Test Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        DEMO_RULES,
        createSimpleAllocations(identities),
        holderKeys
      );

      // Tamper with ledger
      asset.ledger.total.T = "999999";

      const verification = verifyAssetState(asset);

      expect(verification.valid).toBe(false);
      expect(verification.errors.length).toBeGreaterThan(0);
      expect(verification.errors[0]).toContain("Ledger verification failed");
    });
  });

  describe("Supply Cap Enforcement", () => {
    it("enforces supply cap during creation", async () => {
      // This should fail because we're trying to create 600 tokens
      // but max supply is 500
      await expect(
        createAsset(
          "cappedcoin",
          "Capped Coin",
          {
            mintAuthority: [identities.treasurer.id],
            burnAuthority: [identities.treasurer.id],
          },
          cappedSupplyRules(500),
          createSimpleAllocations(identities), // Total: 600
          holderKeys
        )
      ).rejects.toThrow(/exceed max supply/);
    });

    it("allows creation within supply cap", async () => {
      const asset = await createAsset(
        "cappedcoin",
        "Capped Coin",
        {
          mintAuthority: [identities.treasurer.id],
          burnAuthority: [identities.treasurer.id],
        },
        cappedSupplyRules(1000),
        createSimpleAllocations(identities), // Total: 600
        holderKeys
      );

      expect(getTotalSupply(asset)).toBe(600n);

      const verification = verifyAssetState(asset);
      expect(verification.valid).toBe(true);
    });
  });
});
