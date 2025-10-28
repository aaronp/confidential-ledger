/**
 * Public API surface for the fundraising capability.
 *
 * This module exposes the core fundraising operations following the Ferits
 * architecture pattern. All state transitions are pure and deterministic.
 */

export {
  createCampaign,
  activateCampaign,
  submitPledge,
  verifyCampaignTotal,
  checkFundingStatus,
  closeCampaign,
  settleCampaign,
  getCampaignSummary,
  decryptPledgeOpening,
} from "./fundraising.impl";

export type {
  CreateCampaignParams,
  SubmitPledgeParams,
} from "./fundraising.impl";

export * from "./fundraising.schema";
