import type { Static } from "@sinclair/typebox";
import type { Campaign, PledgeEntry, Beneficiary, CampaignSummary } from "./fundraising.schema";
import { pedersen, ristrettoAdd, hex } from "../../shared/crypto";

export interface CreateCampaignParams {
  campaignId: string;
  name: string;
  description: string;
  targetAmount: string; // bigint as string
  deadline: number; // timestamp
  beneficiary: Static<typeof Beneficiary>;
  createdBy: string; // AID
  assetId?: string; // optional asset for token campaigns
}

/**
 * Creates a new fundraising campaign.
 *
 * @param params - Campaign creation parameters
 * @returns A new Campaign with status "draft"
 */
export function createCampaign(params: CreateCampaignParams): Static<typeof Campaign> {
  const { campaignId, name, description, targetAmount, deadline, beneficiary, createdBy, assetId } = params;

  // Validate target amount
  const target = BigInt(targetAmount);
  if (target <= 0n) {
    throw new Error("Target amount must be positive");
  }

  // Validate deadline
  if (deadline <= Date.now()) {
    throw new Error("Deadline must be in the future");
  }

  return {
    version: "1",
    campaignId,
    name,
    description,
    targetAmount,
    deadline,
    beneficiary,
    pledges: [],
    totalCommit: "0000000000000000000000000000000000000000000000000000000000000000", // identity point (64 hex chars = 32 bytes)
    status: "draft",
    createdAt: Date.now(),
    createdBy,
    assetId,
  };
}

/**
 * Activates a campaign, opening it for pledges.
 *
 * @param campaign - Current campaign state
 * @returns Updated Campaign with status "active"
 */
export function activateCampaign(campaign: Static<typeof Campaign>): Static<typeof Campaign> {
  if (campaign.status !== "draft") {
    throw new Error(`Cannot activate campaign with status: ${campaign.status}`);
  }

  if (campaign.deadline <= Date.now()) {
    throw new Error("Cannot activate campaign past deadline");
  }

  return {
    ...campaign,
    status: "active",
  };
}

export interface SubmitPledgeParams {
  pledgerId: string; // AID
  amount: string; // bigint as string
  blinding: Uint8Array; // r (32 bytes)
  recipientPublicKey: Uint8Array; // X25519 public key for encryption
}

/**
 * Submits a pledge to an active campaign.
 *
 * @param campaign - Current campaign state
 * @param params - Pledge submission parameters
 * @returns Updated Campaign with new pledge
 */
export function submitPledge(
  campaign: Static<typeof Campaign>,
  params: SubmitPledgeParams
): Static<typeof Campaign> {
  const { pledgerId, amount, blinding, recipientPublicKey } = params;

  // Validate campaign status
  if (campaign.status !== "active") {
    throw new Error(`Cannot submit pledge to ${campaign.status} campaign`);
  }

  // Validate deadline
  if (campaign.deadline <= Date.now()) {
    throw new Error("Campaign deadline has passed");
  }

  // Validate amount
  const pledgeAmount = BigInt(amount);
  if (pledgeAmount <= 0n) {
    throw new Error("Pledge amount must be positive");
  }

  // Check for duplicate pledger (optional rule)
  if (campaign.pledges.some(p => p.pledgerId === pledgerId)) {
    throw new Error(`${pledgerId} has already pledged to this campaign`);
  }

  // Create Pedersen commitment: C = G×amount + H×r
  const commit = pedersen(pledgeAmount, blinding);

  // Encrypt opening {amount, r} using recipient's public key
  // For now, we'll use a simple base64 encoding (in production, use X25519+HKDF+AES-GCM)
  const opening = JSON.stringify({ amount, r: Array.from(blinding) });
  const openingEncrypted = Buffer.from(opening).toString("base64");

  const pledge: Static<typeof PledgeEntry> = {
    pledgerId,
    commit,
    openingEncrypted,
    signedAt: Date.now(),
  };

  // Update total commitment
  const newTotalCommit = ristrettoAdd(campaign.totalCommit, commit);

  return {
    ...campaign,
    pledges: [...campaign.pledges, pledge],
    totalCommit: newTotalCommit,
  };
}

/**
 * Verifies that the campaign's total commitment matches the sum of pledge commitments.
 *
 * @param campaign - Campaign to verify
 * @returns True if total matches, false otherwise
 */
export function verifyCampaignTotal(campaign: Static<typeof Campaign>): boolean {
  if (campaign.pledges.length === 0) {
    // Empty campaign should have identity commitment
    return campaign.totalCommit === "0000000000000000000000000000000000000000000000000000000000000000";
  }

  // Sum all pledge commitments
  let sum = "0000000000000000000000000000000000000000000000000000000000000000";
  for (const pledge of campaign.pledges) {
    sum = ristrettoAdd(sum, pledge.commit);
  }

  return sum === campaign.totalCommit;
}

/**
 * Decrypts a pledge opening to get amount and blinding factor.
 *
 * @param openingEncrypted - Encrypted opening string
 * @returns Decrypted {amount, r}
 */
export function decryptPledgeOpening(openingEncrypted: string): { amount: string; r: Uint8Array } {
  // For demo, we use simple base64 (in production, use X25519+HKDF+AES-GCM)
  const opening = JSON.parse(Buffer.from(openingEncrypted, "base64").toString());
  return {
    amount: opening.amount,
    r: new Uint8Array(opening.r),
  };
}

/**
 * Checks if campaign has reached funding target.
 *
 * Requires decrypted pledge amounts (in production, use threshold decryption).
 *
 * @param campaign - Campaign to check
 * @returns Funding status and total pledged amount
 */
export function checkFundingStatus(campaign: Static<typeof Campaign>): {
  isFunded: boolean;
  totalPledged: bigint;
  isVerified: boolean;
} {
  // Verify commitments first
  const isVerified = verifyCampaignTotal(campaign);

  // Decrypt all pledge openings
  let totalPledged = 0n;
  for (const pledge of campaign.pledges) {
    try {
      const { amount } = decryptPledgeOpening(pledge.openingEncrypted);
      totalPledged += BigInt(amount);
    } catch (error) {
      // If we can't decrypt, we can't verify funding
      return { isFunded: false, totalPledged: 0n, isVerified: false };
    }
  }

  const target = BigInt(campaign.targetAmount);
  const isFunded = totalPledged >= target;

  return { isFunded, totalPledged, isVerified };
}

/**
 * Closes a campaign when deadline passes or target is reached.
 *
 * @param campaign - Campaign to close
 * @returns Updated Campaign with status "funded" or "failed"
 */
export function closeCampaign(campaign: Static<typeof Campaign>): Static<typeof Campaign> {
  if (campaign.status !== "active") {
    throw new Error(`Cannot close campaign with status: ${campaign.status}`);
  }

  // Check if deadline passed
  const deadlinePassed = campaign.deadline <= Date.now();

  // Check funding status
  const { isFunded, isVerified } = checkFundingStatus(campaign);

  if (!isVerified) {
    throw new Error("Cannot close campaign with unverified commitments");
  }

  // Determine new status
  let newStatus: "funded" | "failed";
  if (deadlinePassed) {
    // Deadline passed: funded if target met, failed otherwise
    newStatus = isFunded ? "funded" : "failed";
  } else {
    // Deadline not passed: can only close if funded
    if (isFunded) {
      newStatus = "funded";
    } else {
      throw new Error("Cannot close campaign before deadline unless funded");
    }
  }

  return {
    ...campaign,
    status: newStatus,
  };
}

/**
 * Settles a campaign by marking it complete.
 *
 * In a full implementation, this would integrate with F2 to create token transfers.
 * For now, we just mark the campaign as settled.
 *
 * @param campaign - Campaign to settle
 * @returns Updated Campaign with status "settled"
 */
export function settleCampaign(campaign: Static<typeof Campaign>): Static<typeof Campaign> {
  if (campaign.status !== "funded" && campaign.status !== "failed") {
    throw new Error(`Cannot settle campaign with status: ${campaign.status}`);
  }

  return {
    ...campaign,
    status: "settled",
    settledAt: Date.now(),
  };
}

/**
 * Gets a public summary of campaign progress.
 *
 * @param campaign - Campaign to summarize
 * @returns CampaignSummary safe for public display
 */
export function getCampaignSummary(campaign: Static<typeof Campaign>): Static<typeof CampaignSummary> {
  const { isFunded, totalPledged, isVerified } = checkFundingStatus(campaign);

  const target = BigInt(campaign.targetAmount);
  const percentFunded = target > 0n ? Number((totalPledged * 100n) / target) : 0;

  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((campaign.deadline - now) / (1000 * 60 * 60 * 24)));

  return {
    campaignId: campaign.campaignId,
    name: campaign.name,
    description: campaign.description,
    targetAmount: campaign.targetAmount,
    pledgedAmount: totalPledged.toString(),
    percentFunded,
    pledgeCount: campaign.pledges.length,
    status: campaign.status,
    deadline: campaign.deadline,
    daysRemaining,
    isVerified,
  };
}
