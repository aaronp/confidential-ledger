/**
 * Verification and public summary helpers for the confidential ledger.
 *
 * These functions provide read-only views and verification logic
 * that can be used by external observers without authentication.
 */

import type { LedgerState, LedgerPublicSummary } from "./ledger.schema";
import { verifyTotal } from "./ledger.impl";

/**
 * Get a public summary of the ledger that anyone can see and verify.
 * No authentication required.
 */
export function getPublicSummary(ledger: LedgerState): LedgerPublicSummary {
  return {
    version: ledger.version,
    participantCount: ledger.entries.length,
    total: ledger.total,
    verified: verifyTotal(ledger),
  };
}

/**
 * Check if a ledger passes all verification checks.
 * Returns detailed information about what passed/failed.
 */
export function getVerificationStatus(ledger: LedgerState): {
  verified: boolean;
  checks: {
    name: string;
    passed: boolean;
    description: string;
  }[];
} {
  const checks = [
    {
      name: "schema_version",
      passed: ledger.version === "1",
      description: "Ledger uses expected schema version",
    },
    {
      name: "total_verification",
      passed: verifyTotal(ledger),
      description: "Sum of commitments matches total commitment (G×T + H×R)",
    },
    {
      name: "has_entries",
      passed: ledger.entries.length > 0,
      description: "Ledger contains at least one entry",
    },
  ];

  return {
    verified: checks.every((c) => c.passed),
    checks,
  };
}
