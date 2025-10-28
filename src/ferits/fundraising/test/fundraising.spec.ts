import { describe, it, expect } from "vitest";
import {
  createCampaign,
  activateCampaign,
  submitPledge,
  verifyCampaignTotal,
  checkFundingStatus,
  closeCampaign,
  settleCampaign,
  getCampaignSummary,
  type CreateCampaignParams,
  type SubmitPledgeParams,
} from "../core/fundraising.api";
import { randomScalar } from "../../shared/crypto";

describe("Fundraising Module", () => {
  const futureDeadline = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now

  const defaultCampaignParams: CreateCampaignParams = {
    campaignId: "campaign_test_001",
    name: "Test Campaign",
    description: "Testing fundraising functionality",
    targetAmount: "1000",
    deadline: futureDeadline,
    beneficiary: { type: "budget", id: "budget_test_001" },
    createdBy: "creator_alice",
  };

  describe("Campaign Creation", () => {
    it("creates a valid campaign with required fields", () => {
      const campaign = createCampaign(defaultCampaignParams);

      expect(campaign.version).toBe("1");
      expect(campaign.campaignId).toBe("campaign_test_001");
      expect(campaign.name).toBe("Test Campaign");
      expect(campaign.targetAmount).toBe("1000");
      expect(campaign.status).toBe("draft");
      expect(campaign.pledges).toHaveLength(0);
      expect(campaign.totalCommit).toBe("0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("rejects zero or negative target amount", () => {
      const params = { ...defaultCampaignParams, targetAmount: "0" };
      expect(() => createCampaign(params)).toThrow("Target amount must be positive");
    });

    it("rejects deadline in the past", () => {
      const params = { ...defaultCampaignParams, deadline: Date.now() - 1000 };
      expect(() => createCampaign(params)).toThrow("Deadline must be in the future");
    });

    it("accepts optional assetId", () => {
      const params = { ...defaultCampaignParams, assetId: "gbp_stable" };
      const campaign = createCampaign(params);
      expect(campaign.assetId).toBe("gbp_stable");
    });
  });

  describe("Campaign Activation", () => {
    it("activates a draft campaign", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const activated = activateCampaign(campaign);

      expect(activated.status).toBe("active");
    });

    it("rejects activation of non-draft campaign", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const activated = activateCampaign(campaign);

      expect(() => activateCampaign(activated)).toThrow(
        "Cannot activate campaign with status: active"
      );
    });

    it("rejects activation past deadline", () => {
      const params = { ...defaultCampaignParams, deadline: Date.now() + 100 };
      const campaign = createCampaign(params);

      // Wait for deadline to pass
      setTimeout(() => {
        expect(() => activateCampaign(campaign)).toThrow(
          "Cannot activate campaign past deadline"
        );
      }, 200);
    });
  });

  describe("Pledge Submission", () => {
    it("submits a valid pledge to active campaign", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const pledgeParams: SubmitPledgeParams = {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      };

      const updated = submitPledge(active, pledgeParams);

      expect(updated.pledges).toHaveLength(1);
      expect(updated.pledges[0].pledgerId).toBe("user_alice");
      expect(updated.pledges[0].commit).toBeTruthy();
      expect(updated.pledges[0].openingEncrypted).toBeTruthy();
    });

    it("rejects pledge to non-active campaign", () => {
      const campaign = createCampaign(defaultCampaignParams);

      const pledgeParams: SubmitPledgeParams = {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      };

      expect(() => submitPledge(campaign, pledgeParams)).toThrow(
        "Cannot submit pledge to draft campaign"
      );
    });

    it("rejects zero or negative pledge amount", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const pledgeParams: SubmitPledgeParams = {
        pledgerId: "user_alice",
        amount: "0",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      };

      expect(() => submitPledge(active, pledgeParams)).toThrow(
        "Pledge amount must be positive"
      );
    });

    it("prevents duplicate pledges from same user", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const pledgeParams: SubmitPledgeParams = {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      };

      const updated = submitPledge(active, pledgeParams);
      expect(() => submitPledge(updated, pledgeParams)).toThrow(
        "user_alice has already pledged to this campaign"
      );
    });

    it("updates total commitment after pledge", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const initialCommit = active.totalCommit;

      const pledgeParams: SubmitPledgeParams = {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      };

      const updated = submitPledge(active, pledgeParams);

      expect(updated.totalCommit).not.toBe(initialCommit);
    });
  });

  describe("Campaign Verification", () => {
    it("verifies empty campaign has identity commitment", () => {
      const campaign = createCampaign(defaultCampaignParams);
      expect(verifyCampaignTotal(campaign)).toBe(true);
    });

    it("verifies campaign with single pledge", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const updated = submitPledge(active, {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      expect(verifyCampaignTotal(updated)).toBe(true);
    });

    it("verifies campaign with multiple pledges", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      let state = active;
      state = submitPledge(state, {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });
      state = submitPledge(state, {
        pledgerId: "user_bob",
        amount: "200",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });
      state = submitPledge(state, {
        pledgerId: "user_carol",
        amount: "150",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      expect(verifyCampaignTotal(state)).toBe(true);
    });
  });

  describe("Funding Status", () => {
    it("reports unfunded status when pledges below target", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const updated = submitPledge(active, {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      const status = checkFundingStatus(updated);
      expect(status.isFunded).toBe(false);
      expect(status.totalPledged).toBe(100n);
      expect(status.isVerified).toBe(true);
    });

    it("reports funded status when pledges meet target", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      let state = active;
      state = submitPledge(state, {
        pledgerId: "user_alice",
        amount: "600",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });
      state = submitPledge(state, {
        pledgerId: "user_bob",
        amount: "400",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      const status = checkFundingStatus(state);
      expect(status.isFunded).toBe(true);
      expect(status.totalPledged).toBe(1000n);
      expect(status.isVerified).toBe(true);
    });

    it("reports funded status when pledges exceed target", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const updated = submitPledge(active, {
        pledgerId: "user_alice",
        amount: "1500",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      const status = checkFundingStatus(updated);
      expect(status.isFunded).toBe(true);
      expect(status.totalPledged).toBe(1500n);
    });
  });

  describe("Campaign Closure", () => {
    it("closes funded campaign as 'funded'", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const updated = submitPledge(active, {
        pledgerId: "user_alice",
        amount: "1000",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      const closed = closeCampaign(updated);
      expect(closed.status).toBe("funded");
    });

    it("closes unfunded campaign after deadline as 'failed'", () => {
      const params = {
        ...defaultCampaignParams,
        deadline: Date.now() + 100,
      };
      const campaign = createCampaign(params);
      const active = activateCampaign(campaign);

      const updated = submitPledge(active, {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      // Wait for deadline
      setTimeout(() => {
        const closed = closeCampaign(updated);
        expect(closed.status).toBe("failed");
      }, 200);
    });

    it("prevents closing unfunded campaign before deadline", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const updated = submitPledge(active, {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      expect(() => closeCampaign(updated)).toThrow(
        "Cannot close campaign before deadline unless funded"
      );
    });

    it("prevents closing non-active campaign", () => {
      const campaign = createCampaign(defaultCampaignParams);

      expect(() => closeCampaign(campaign)).toThrow(
        "Cannot close campaign with status: draft"
      );
    });
  });

  describe("Campaign Settlement", () => {
    it("settles funded campaign", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      const updated = submitPledge(active, {
        pledgerId: "user_alice",
        amount: "1000",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      const closed = closeCampaign(updated);
      const settled = settleCampaign(closed);

      expect(settled.status).toBe("settled");
      expect(settled.settledAt).toBeTruthy();
    });

    it("settles failed campaign", () => {
      const params = {
        ...defaultCampaignParams,
        deadline: Date.now() + 100,
      };
      const campaign = createCampaign(params);
      const active = activateCampaign(campaign);

      const updated = submitPledge(active, {
        pledgerId: "user_alice",
        amount: "100",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      setTimeout(() => {
        const closed = closeCampaign(updated);
        const settled = settleCampaign(closed);

        expect(settled.status).toBe("settled");
      }, 200);
    });

    it("prevents settlement of active campaign", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      expect(() => settleCampaign(active)).toThrow(
        "Cannot settle campaign with status: active"
      );
    });
  });

  describe("Campaign Summary", () => {
    it("generates correct summary for campaign with pledges", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      let state = active;
      state = submitPledge(state, {
        pledgerId: "user_alice",
        amount: "300",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });
      state = submitPledge(state, {
        pledgerId: "user_bob",
        amount: "200",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      const summary = getCampaignSummary(state);

      expect(summary.campaignId).toBe("campaign_test_001");
      expect(summary.targetAmount).toBe("1000");
      expect(summary.pledgedAmount).toBe("500");
      expect(summary.percentFunded).toBe(50);
      expect(summary.pledgeCount).toBe(2);
      expect(summary.isVerified).toBe(true);
      expect(summary.daysRemaining).toBeGreaterThan(0);
    });

    it("handles empty campaign summary", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const summary = getCampaignSummary(campaign);

      expect(summary.pledgedAmount).toBe("0");
      expect(summary.percentFunded).toBe(0);
      expect(summary.pledgeCount).toBe(0);
      expect(summary.isVerified).toBe(true);
    });
  });

  describe("Complex Workflows", () => {
    it("handles full lifecycle: create → activate → pledge → close → settle", () => {
      const campaign = createCampaign(defaultCampaignParams);
      expect(campaign.status).toBe("draft");

      const active = activateCampaign(campaign);
      expect(active.status).toBe("active");

      let state = active;
      state = submitPledge(state, {
        pledgerId: "user_alice",
        amount: "600",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });
      state = submitPledge(state, {
        pledgerId: "user_bob",
        amount: "400",
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      const status = checkFundingStatus(state);
      expect(status.isFunded).toBe(true);
      expect(status.totalPledged).toBe(1000n);

      const closed = closeCampaign(state);
      expect(closed.status).toBe("funded");

      const settled = settleCampaign(closed);
      expect(settled.status).toBe("settled");
    });

    it("handles multiple pledges approaching target", () => {
      const campaign = createCampaign(defaultCampaignParams);
      const active = activateCampaign(campaign);

      let state = active;
      const pledges = [100, 150, 200, 250, 300];

      for (let i = 0; i < pledges.length; i++) {
        state = submitPledge(state, {
          pledgerId: `user_${i}`,
          amount: pledges[i].toString(),
          blinding: randomScalar(),
          recipientPublicKey: new Uint8Array(32),
        });

        expect(verifyCampaignTotal(state)).toBe(true);
      }

      const status = checkFundingStatus(state);
      expect(status.totalPledged).toBe(1000n);
      expect(status.isFunded).toBe(true);
    });
  });
});
