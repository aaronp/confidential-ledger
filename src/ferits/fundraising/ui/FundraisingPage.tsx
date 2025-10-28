import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { Target, TrendingUp, Users, Calendar, Plus } from "lucide-react";
import {
  createCampaign,
  activateCampaign,
  submitPledge,
  getCampaignSummary,
  type Campaign,
  type CampaignSummary,
} from "../core/fundraising.api";
import { randomScalar } from "../../shared/crypto";
import type { Static } from "@sinclair/typebox";

const STORAGE_KEY = "confidential-ledger-campaigns";
const CURRENT_USER_KEY = "confidential-ledger-current-user";

// Initialize with sample campaigns
const initializeCampaigns = (): Array<Static<typeof Campaign>> => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load campaigns:", e);
    }
  }

  // Create sample campaigns
  const campaign1 = createCampaign({
    campaignId: "campaign_trip_2025",
    name: "Edinburgh School Trip 2025",
    description: "Annual school trip for Year 6 students to explore Scottish history and culture",
    targetAmount: "5000",
    deadline: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    beneficiary: { type: "budget", id: "budget_trip_2025" },
    createdBy: "ptfa_chair",
    assetId: "gbp_stable",
  });

  let state1 = activateCampaign(campaign1);

  // Add some sample pledges
  state1 = submitPledge(state1, {
    pledgerId: "parent_alice",
    amount: "200",
    blinding: randomScalar(),
    recipientPublicKey: new Uint8Array(32),
  });
  state1 = submitPledge(state1, {
    pledgerId: "parent_bob",
    amount: "150",
    blinding: randomScalar(),
    recipientPublicKey: new Uint8Array(32),
  });
  state1 = submitPledge(state1, {
    pledgerId: "teacher_carol",
    amount: "100",
    blinding: randomScalar(),
    recipientPublicKey: new Uint8Array(32),
  });

  const campaign2 = createCampaign({
    campaignId: "campaign_pantry_jan",
    name: "Community Pantry January",
    description: "Monthly food pantry operations and supplies",
    targetAmount: "500",
    deadline: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days
    beneficiary: { type: "treasury", id: "pantry_treasury" },
    createdBy: "organizer_alice",
  });

  let state2 = activateCampaign(campaign2);
  state2 = submitPledge(state2, {
    pledgerId: "volunteer_dan",
    amount: "180",
    blinding: randomScalar(),
    recipientPublicKey: new Uint8Array(32),
  });
  state2 = submitPledge(state2, {
    pledgerId: "volunteer_eve",
    amount: "140",
    blinding: randomScalar(),
    recipientPublicKey: new Uint8Array(32),
  });

  return [state1, state2];
};

export function FundraisingPage() {
  const [campaigns, setCampaigns] = useState<Array<Static<typeof Campaign>>>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Static<typeof Campaign> | null>(null);
  const [showPledgeForm, setShowPledgeForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("parent_alice");

  // Pledge form state
  const [pledgeAmount, setPledgeAmount] = useState("");

  useEffect(() => {
    const loaded = initializeCampaigns();
    setCampaigns(loaded);
    if (loaded.length > 0) {
      setSelectedCampaign(loaded[0]);
    }

    const storedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (storedUser) {
      setCurrentUser(storedUser);
    }
  }, []);

  const saveCampaigns = (newCampaigns: Array<Static<typeof Campaign>>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCampaigns));
    setCampaigns(newCampaigns);

    if (selectedCampaign) {
      const updated = newCampaigns.find(c => c.campaignId === selectedCampaign.campaignId);
      if (updated) {
        setSelectedCampaign(updated);
      }
    }
  };

  const handleSubmitPledge = () => {
    if (!selectedCampaign || !pledgeAmount) return;

    try {
      const updated = submitPledge(selectedCampaign, {
        pledgerId: currentUser,
        amount: pledgeAmount,
        blinding: randomScalar(),
        recipientPublicKey: new Uint8Array(32),
      });

      const newCampaigns = campaigns.map(c =>
        c.campaignId === selectedCampaign.campaignId ? updated : c
      );
      saveCampaigns(newCampaigns);

      setPledgeAmount("");
      setShowPledgeForm(false);
      alert("Pledge submitted successfully!");
    } catch (error) {
      alert(`Failed to submit pledge: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const getProgressPercentage = (summary: Static<typeof CampaignSummary>) => {
    return Math.min(100, summary.percentFunded);
  };

  const formatCurrency = (amount: string) => {
    return `£${Number(amount).toLocaleString()}`;
  };

  if (campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Community Fundraising
          </h1>
          <p className="text-muted-foreground">
            Crowdfunding with private pledges and public totals
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Acting as:</span>
            <select
              value={currentUser}
              onChange={(e) => {
                setCurrentUser(e.target.value);
                localStorage.setItem(CURRENT_USER_KEY, e.target.value);
              }}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="parent_alice">parent_alice</option>
              <option value="parent_bob">parent_bob</option>
              <option value="teacher_carol">teacher_carol</option>
              <option value="volunteer_dan">volunteer_dan</option>
              <option value="volunteer_eve">volunteer_eve</option>
              <option value="ptfa_chair">ptfa_chair</option>
            </select>
          </div>
        </header>

        {/* Campaign Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((campaign) => {
            const summary = getCampaignSummary(campaign);
            const progress = getProgressPercentage(summary);

            return (
              <Card
                key={campaign.campaignId}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedCampaign?.campaignId === campaign.campaignId
                    ? "border-primary ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => setSelectedCampaign(campaign)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{campaign.name}</CardTitle>
                    <Badge
                      variant={
                        campaign.status === "active" ? "default" :
                        campaign.status === "funded" ? "default" :
                        "secondary"
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2">
                    {campaign.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Raised:</span>
                        <span className="font-semibold">
                          {formatCurrency(summary.pledgedAmount)} / {formatCurrency(campaign.targetAmount)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground text-right">
                        {summary.percentFunded.toFixed(1)}% funded
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{summary.pledgeCount} pledgers</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{summary.daysRemaining} days left</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Campaign Detail View */}
        {selectedCampaign && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{selectedCampaign.name}</CardTitle>
                {selectedCampaign.status === "active" && (
                  <Button onClick={() => setShowPledgeForm(!showPledgeForm)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Make a Pledge
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {showPledgeForm && (
                <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-3">Pledge to {selectedCampaign.name}</h4>
                  <div className="space-y-3">
                    <Input
                      placeholder="Amount (£)"
                      type="number"
                      value={pledgeAmount}
                      onChange={(e) => setPledgeAmount(e.target.value)}
                    />
                    <div className="text-sm text-muted-foreground">
                      Your pledge amount will be encrypted. Only the total will be publicly visible.
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSubmitPledge}>
                        Submit Pledge
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowPledgeForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Campaign Info */}
                <div>
                  <h4 className="font-semibold mb-2">Campaign Details</h4>
                  <p className="text-muted-foreground">{selectedCampaign.description}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Target:</span>
                      <span className="ml-2 font-semibold">
                        {formatCurrency(selectedCampaign.targetAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Beneficiary:</span>
                      <span className="ml-2 font-semibold">
                        {selectedCampaign.beneficiary.id}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pledge List */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Pledgers ({selectedCampaign.pledges.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedCampaign.pledges.map((pledge, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm font-mono">{pledge.pledgerId}</span>
                        <Badge variant="secondary">Amount encrypted</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification Status */}
                <div className="flex items-center gap-2 text-sm">
                  {getCampaignSummary(selectedCampaign).isVerified ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-muted-foreground">
                        Cryptographically verified — total is correct
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-muted-foreground">Verification failed</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
