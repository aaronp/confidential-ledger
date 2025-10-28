/**
 * TypeBox schemas for fundraising campaigns and pledges.
 *
 * Follows guidance.md patterns:
 * - Descriptions, examples, visibility notes on all fields
 * - $id for each schema
 * - Private pledge amounts, public commitment verification
 */

import { Type, type Static } from "@sinclair/typebox";

/**
 * A pledge commitment using Pedersen-style cryptography.
 *
 * Individual amounts are encrypted; the sum is publicly verifiable.
 */
export const PledgeEntry = Type.Object(
  {
    pledgerId: Type.String({
      description: "AID of the pledger",
      examples: ["did:keri:user_alice"],
    }),
    commit: Type.String({
      description: "Pedersen commitment to pledge amount: C = G×amount + H×r",
      examples: ["rist255:AaB..."],
    }),
    openingEncrypted: Type.String({
      description: "Encrypted {amount, r} using pledger's X25519 public key",
      examples: ["x25519-hkdf-aes256gcm:..."],
    }),
    signedAt: Type.Number({
      description: "Timestamp when pledge was signed",
    }),
    signature: Type.Optional(
      Type.String({
        description: "Signature over canonicalized pledge commitment",
      })
    ),
  },
  {
    $id: "ferits/fundraising/PledgeEntry",
    description:
      "Private pledge with public commitment. Only pledger can decrypt amount.",
  }
);

/**
 * Beneficiary receiving campaign funds.
 */
export const Beneficiary = Type.Object(
  {
    type: Type.Union([
      Type.Literal("budget"),
      Type.Literal("treasury"),
      Type.Literal("project"),
    ]),
    id: Type.String({
      description: "Budget ID, asset ID, or project ID",
      examples: ["budget_trip_2025"],
    }),
  },
  {
    $id: "ferits/fundraising/Beneficiary",
  }
);

/**
 * Fundraising campaign state.
 *
 * Campaigns progress: draft → active → funded|failed → settled
 */
export const Campaign = Type.Object(
  {
    version: Type.String({
      description: "Schema version",
      examples: ["1"],
    }),
    campaignId: Type.String({
      description: "Unique campaign identifier",
      examples: ["campaign_trip_2025"],
    }),
    name: Type.String({
      description: "Human-readable campaign name",
      examples: ["Edinburgh School Trip 2025"],
    }),
    description: Type.String({
      description: "Campaign purpose and details",
      examples: ["Fundraising for annual school trip to Edinburgh"],
    }),
    targetAmount: Type.String({
      description: "Goal amount as bigint string",
      examples: ["5000"],
    }),
    deadline: Type.Number({
      description: "Timestamp when campaign closes",
    }),
    beneficiary: Beneficiary,
    pledges: Type.Array(PledgeEntry, {
      description: "List of pledge commitments",
    }),
    totalCommit: Type.String({
      description: "Sum of all pledge commitments (for verification)",
    }),
    status: Type.Union([
      Type.Literal("draft"),
      Type.Literal("active"),
      Type.Literal("funded"),
      Type.Literal("failed"),
      Type.Literal("settled"),
    ]),
    createdAt: Type.Number(),
    createdBy: Type.String({
      description: "AID of campaign creator",
      examples: ["did:keri:ptfa_chair"],
    }),
    settledAt: Type.Optional(
      Type.Number({
        description: "Timestamp when settlement completed",
      })
    ),
    assetId: Type.Optional(
      Type.String({
        description: "Asset ID for token transfers (EyamCoin)",
        examples: ["eyamcoin_main"],
      })
    ),
  },
  {
    $id: "ferits/fundraising/Campaign",
    description:
      "Fundraising campaign with private pledges and public total verification",
  }
);

/**
 * Public summary of campaign progress.
 *
 * Safe to share without revealing individual pledge amounts.
 */
export const CampaignSummary = Type.Object(
  {
    campaignId: Type.String(),
    name: Type.String(),
    description: Type.String(),
    targetAmount: Type.String(),
    pledgedAmount: Type.String({
      description: "Verified sum of all pledges (if valid)",
    }),
    percentFunded: Type.Number({
      description: "Percentage toward goal: (pledged / target) * 100",
      examples: [75.5],
    }),
    pledgeCount: Type.Number({
      description: "Number of pledgers",
    }),
    status: Type.String(),
    deadline: Type.Number(),
    daysRemaining: Type.Number({
      description: "Days until deadline",
      examples: [14],
    }),
    isVerified: Type.Boolean({
      description: "True if commitment sum verification passes",
    }),
  },
  {
    $id: "ferits/fundraising/CampaignSummary",
    description: "Public view of campaign progress without individual amounts",
  }
);

// Type exports
export type PledgeEntry = Static<typeof PledgeEntry>;
export type Beneficiary = Static<typeof Beneficiary>;
export type Campaign = Static<typeof Campaign>;
export type CampaignSummary = Static<typeof CampaignSummary>;
