import { describe, it, expect, beforeEach } from "vitest";
import {
  generateKeyPair,
  mintPoC,
  verifyTotal,
  getUserView,
  serializeKeyPair,
  deserializeKeyPair,
  type KeyPair,
  type MintAllocation,
} from "./ledger";

describe("Confidential Ledger", () => {
  let alice: KeyPair;
  let bob: KeyPair;
  let carol: KeyPair;

  beforeEach(() => {
    alice = generateKeyPair("alice");
    bob = generateKeyPair("bob");
    carol = generateKeyPair("carol");
  });

  describe("Key Generation", () => {
    it("generates unique keypairs for different identities", () => {
      expect(alice.id).toBe("alice");
      expect(bob.id).toBe("bob");
      expect(alice.ed25519.publicKey).not.toEqual(bob.ed25519.publicKey);
      expect(alice.x25519.publicKey).not.toEqual(bob.x25519.publicKey);
    });

    it("serializes and deserializes keypairs correctly", () => {
      const serialized = serializeKeyPair(alice);
      const deserialized = deserializeKeyPair(serialized);

      expect(deserialized.id).toBe(alice.id);
      expect(deserialized.ed25519.publicKey).toEqual(alice.ed25519.publicKey);
      expect(deserialized.ed25519.secretKey).toEqual(alice.ed25519.secretKey);
      expect(deserialized.x25519.publicKey).toEqual(alice.x25519.publicKey);
      expect(deserialized.x25519.secretKey).toEqual(alice.x25519.secretKey);
    });
  });

  describe("Ledger Minting", () => {
    it("creates a valid ledger with single allocation", async () => {
      const allocations: MintAllocation[] = [{ holder: alice, amount: 100 }];
      const ledger = await mintPoC(allocations);

      expect(ledger.version).toBe("1");
      expect(ledger.entries).toHaveLength(1);
      expect(ledger.entries[0].holderId).toBe("alice");
      expect(ledger.total.T).toBe("100");
    });

    it("creates a valid ledger with multiple allocations", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 100 },
        { holder: bob, amount: 200 },
        { holder: carol, amount: 300 },
      ];
      const ledger = await mintPoC(allocations);

      expect(ledger.entries).toHaveLength(3);
      expect(ledger.total.T).toBe("600");
    });

    it("creates ledger with zero amounts", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 0 },
        { holder: bob, amount: 100 },
      ];
      const ledger = await mintPoC(allocations);

      expect(ledger.entries).toHaveLength(2);
      expect(ledger.total.T).toBe("100");
    });
  });

  describe("Ledger Verification", () => {
    it("verifies a freshly minted ledger", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 100 },
        { holder: bob, amount: 200 },
      ];
      const ledger = await mintPoC(allocations);

      expect(verifyTotal(ledger)).toBe(true);
    });

    it("verifies ledger with multiple entries", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 50 },
        { holder: bob, amount: 75 },
        { holder: carol, amount: 125 },
      ];
      const ledger = await mintPoC(allocations);

      expect(verifyTotal(ledger)).toBe(true);
    });

    it("fails verification with tampered commitment", async () => {
      const allocations: MintAllocation[] = [{ holder: alice, amount: 100 }];
      const ledger = await mintPoC(allocations);

      // Tamper with commitment
      ledger.entries[0].commit = ledger.entries[0].commit.replace("a", "b");

      expect(verifyTotal(ledger)).toBe(false);
    });

    it("fails verification with tampered total", async () => {
      const allocations: MintAllocation[] = [{ holder: alice, amount: 100 }];
      const ledger = await mintPoC(allocations);

      // Tamper with total
      ledger.total.T = "200";

      expect(verifyTotal(ledger)).toBe(false);
    });

    it("fails verification with tampered commitSum", async () => {
      const allocations: MintAllocation[] = [{ holder: alice, amount: 100 }];
      const ledger = await mintPoC(allocations);

      // Tamper with commitSum
      ledger.total.commitSum = ledger.total.commitSum.replace("a", "b");

      expect(verifyTotal(ledger)).toBe(false);
    });
  });

  describe("User View Privacy", () => {
    it("allows user to see their own balance", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 100 },
        { holder: bob, amount: 200 },
      ];
      const ledger = await mintPoC(allocations);

      const aliceView = await getUserView(ledger, alice);
      expect(aliceView.myBalance).toBe(100n);
      expect(aliceView.myEntryValid).toBe(true);
    });

    it("prevents user from seeing other balances", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 100 },
        { holder: bob, amount: 200 },
        { holder: carol, amount: 300 },
      ];
      const ledger = await mintPoC(allocations);

      const aliceView = await getUserView(ledger, alice);

      // Alice should see 2 other entries but not their values
      expect(aliceView.others).toHaveLength(2);
      expect(aliceView.others[0].holderId).toBeTruthy();
      expect(aliceView.others[0].commit).toBeTruthy();
      expect(aliceView.others[0].encrypted).toBeTruthy();
    });

    it("shows public total to all users when ledger is valid", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 100 },
        { holder: bob, amount: 200 },
        { holder: carol, amount: 300 },
      ];
      const ledger = await mintPoC(allocations);

      const aliceView = await getUserView(ledger, alice);
      const bobView = await getUserView(ledger, bob);
      const carolView = await getUserView(ledger, carol);

      // All users should see the same total
      expect(aliceView.publicTotal).toBe(600n);
      expect(bobView.publicTotal).toBe(600n);
      expect(carolView.publicTotal).toBe(600n);
    });

    it("hides public total when ledger is tampered", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 100 },
        { holder: bob, amount: 200 },
      ];
      const ledger = await mintPoC(allocations);

      // Tamper with a commitment
      ledger.entries[0].commit = ledger.entries[0].commit.replace("a", "b");

      const aliceView = await getUserView(ledger, alice);
      const bobView = await getUserView(ledger, bob);

      // No user should see the total when invalid
      expect(aliceView.publicTotal).toBe(null);
      expect(bobView.publicTotal).toBe(null);
    });

    it("returns null balance when encrypted opening is tampered", async () => {
      const allocations: MintAllocation[] = [{ holder: alice, amount: 100 }];
      const ledger = await mintPoC(allocations);

      // Tamper with encrypted opening
      ledger.entries[0].openingEncrypted = "invalid-encrypted-data";

      const aliceView = await getUserView(ledger, alice);

      // Alice can't decrypt her tampered entry
      expect(aliceView.myBalance).toBe(null);
    });

    it("returns null balance when user has no entry in ledger", async () => {
      const allocations: MintAllocation[] = [{ holder: alice, amount: 100 }];
      const ledger = await mintPoC(allocations);

      const bobView = await getUserView(ledger, bob);

      // Bob has no entry in the ledger
      expect(bobView.myBalance).toBe(null);
    });

    it("detects when decrypted value doesn't match commitment", async () => {
      const allocations: MintAllocation[] = [{ holder: alice, amount: 100 }];
      const ledger = await mintPoC(allocations);

      // Tamper with the commitment only (encrypted opening remains valid)
      ledger.entries[0].commit = ledger.entries[0].commit.replace(/a/g, "b");

      const aliceView = await getUserView(ledger, alice);

      // Alice can still decrypt the value (it's 100)
      expect(aliceView.myBalance).toBe(100n);
      // But the entry is marked as invalid because commitment doesn't match
      expect(aliceView.myEntryValid).toBe(false);
    });
  });

  describe("Privacy Guarantees", () => {
    it("each user can only decrypt their own balance", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 100 },
        { holder: bob, amount: 200 },
      ];
      const ledger = await mintPoC(allocations);

      const aliceView = await getUserView(ledger, alice);
      const bobView = await getUserView(ledger, bob);

      // Alice sees her balance, not Bob's
      expect(aliceView.myBalance).toBe(100n);

      // Bob sees his balance, not Alice's
      expect(bobView.myBalance).toBe(200n);
    });

    it("all parties can verify the public total without seeing individual balances", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 100 },
        { holder: bob, amount: 200 },
        { holder: carol, amount: 300 },
      ];
      const ledger = await mintPoC(allocations);

      // Alice can verify the total
      const aliceView = await getUserView(ledger, alice);
      expect(aliceView.publicTotal).toBe(600n);
      expect(aliceView.myBalance).toBe(100n);
      expect(aliceView.others).toHaveLength(2);

      // Bob can verify the total
      const bobView = await getUserView(ledger, bob);
      expect(bobView.publicTotal).toBe(600n);
      expect(bobView.myBalance).toBe(200n);
      expect(bobView.others).toHaveLength(2);

      // Carol can verify the total
      const carolView = await getUserView(ledger, carol);
      expect(carolView.publicTotal).toBe(600n);
      expect(carolView.myBalance).toBe(300n);
      expect(carolView.others).toHaveLength(2);

      // Note: None of them can see others' actual balances,
      // only encrypted commitments
    });
  });

  describe("Large Numbers", () => {
    it("handles large allocations correctly", async () => {
      const allocations: MintAllocation[] = [
        { holder: alice, amount: 1000000 },
        { holder: bob, amount: 2000000 },
      ];
      const ledger = await mintPoC(allocations);

      expect(verifyTotal(ledger)).toBe(true);
      expect(ledger.total.T).toBe("3000000");

      const aliceView = await getUserView(ledger, alice);
      expect(aliceView.myBalance).toBe(1000000n);
      expect(aliceView.publicTotal).toBe(3000000n);
    });
  });
});
