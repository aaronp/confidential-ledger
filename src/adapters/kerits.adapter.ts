/**
 * Kerits Adapter Interface
 *
 * Provides identity, signing, credential, and authorization services.
 * Ferits modules MUST NOT import Kerits directly; they use this adapter.
 *
 * In development: Use mock implementations (see below).
 * In production: Swap in real Kerits integration.
 */

export type AID = string; // Autonomic Identifier (e.g., "did:keri:EaBc123...")

export interface Signature {
  signer: AID;
  signature: Uint8Array;
  timestamp?: number;
}

export interface Credential {
  type: string; // e.g., "age_over_18", "resident_of_uk", "treasurer_role"
  issuer: AID;
  subject: AID;
  issuedAt: number;
  expiresAt?: number;
  claims: Record<string, any>;
}

export type CredentialSet = Credential[];

/**
 * KeritsAdapter provides identity and credential services
 */
export interface KeritsAdapter {
  /**
   * Get the current user's AID
   */
  whoAmI(): AID;

  /**
   * Sign arbitrary payload with the current identity
   */
  sign(payload: Uint8Array): Promise<Signature>;

  /**
   * Verify a signature against a payload and claimed AID
   */
  verify(sig: Signature, payload: Uint8Array, aid: AID): Promise<boolean>;

  /**
   * Get all credentials for a given AID
   */
  getCredentials(aid: AID): Promise<CredentialSet>;

  /**
   * Check if an AID holds a specific credential type
   */
  hasCredential(aid: AID, credentialType: string): Promise<boolean>;
}

/**
 * Mock implementation for development and testing
 */
export class MockKeritsAdapter implements KeritsAdapter {
  private currentAid: AID = "did:mock:alice";
  private credentials: Map<AID, CredentialSet> = new Map();

  constructor(defaultAid?: AID) {
    if (defaultAid) {
      this.currentAid = defaultAid;
    }

    // Pre-populate some test credentials
    this.credentials.set("did:mock:alice", [
      {
        type: "treasurer_role",
        issuer: "did:mock:governance",
        subject: "did:mock:alice",
        issuedAt: Date.now(),
        claims: { role: "treasurer", organization: "test_org" },
      },
    ]);

    this.credentials.set("did:mock:bob", [
      {
        type: "age_over_18",
        issuer: "did:mock:government",
        subject: "did:mock:bob",
        issuedAt: Date.now(),
        claims: { verified: true },
      },
    ]);
  }

  whoAmI(): AID {
    return this.currentAid;
  }

  setIdentity(aid: AID): void {
    this.currentAid = aid;
  }

  async sign(payload: Uint8Array): Promise<Signature> {
    // Mock signing: just hash the payload for demo purposes
    const mockSig = new Uint8Array(64);
    mockSig.set(payload.slice(0, Math.min(64, payload.length)));
    return {
      signer: this.currentAid,
      signature: mockSig,
      timestamp: Date.now(),
    };
  }

  async verify(
    sig: Signature,
    _payload: Uint8Array,
    aid: AID
  ): Promise<boolean> {
    // Mock verification: just check signer matches
    return sig.signer === aid;
  }

  async getCredentials(aid: AID): Promise<CredentialSet> {
    return this.credentials.get(aid) || [];
  }

  async hasCredential(aid: AID, credentialType: string): Promise<boolean> {
    const creds = await this.getCredentials(aid);
    return creds.some((c) => c.type === credentialType);
  }

  // Test helpers
  addCredential(aid: AID, credential: Credential): void {
    const existing = this.credentials.get(aid) || [];
    this.credentials.set(aid, [...existing, credential]);
  }
}

/**
 * Global mock instance for development
 * In production, replace with real Kerits adapter factory
 */
export const keritsAdapter: KeritsAdapter = new MockKeritsAdapter();
