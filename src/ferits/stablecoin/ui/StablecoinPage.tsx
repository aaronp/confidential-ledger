import { useState, useEffect } from "react";
import type { KeyPair } from "../../ledger/core/ledger.api";
import { generateKeyPair, serializeKeyPair, deserializeKeyPair, type SerializedKeyPair } from "../../ledger/core/ledger.api";
import {
  createAsset,
  getWalletView,
  getPublicSummary,
  type AssetState,
  type WalletView,
  type MintAllocation,
} from "../core/stablecoin.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { User, Coins, TrendingUp, Plus, Info } from "lucide-react";

const STORAGE_KEY = "stablecoin-demo-asset";
const IDENTITIES_KEY = "confidential-ledger-identities";

export function StablecoinPage() {
  const [asset, setAsset] = useState<AssetState | null>(null);
  const [currentIdentity, setCurrentIdentity] = useState<KeyPair | null>(null);
  const [walletView, setWalletView] = useState<WalletView | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Asset creation form
  const [assetName, setAssetName] = useState("Community Token");
  const [allocations, setAllocations] = useState<Array<{ id: string; amount: string }>>([
    { id: "", amount: "" },
  ]);

  useEffect(() => {
    // Load asset from storage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setAsset(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load asset:", e);
      }
    }

    // Load first identity as current
    const identitiesStored = localStorage.getItem(IDENTITIES_KEY);
    if (identitiesStored) {
      try {
        const identities: SerializedKeyPair[] = JSON.parse(identitiesStored);
        if (identities.length > 0) {
          setCurrentIdentity(deserializeKeyPair(identities[0]));
        }
      } catch (e) {
        console.error("Failed to load identities:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (asset && currentIdentity) {
      refreshWalletView();
    }
  }, [asset, currentIdentity]);

  const refreshWalletView = async () => {
    if (!asset || !currentIdentity) return;
    try {
      const view = await getWalletView(asset, currentIdentity);
      setWalletView(view);
    } catch (error) {
      console.error("Failed to get wallet view:", error);
    }
  };

  const getAvailableIdentities = (): SerializedKeyPair[] => {
    const stored = localStorage.getItem(IDENTITIES_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  };

  const handleCreateAsset = async () => {
    setIsCreating(true);
    try {
      const identities = getAvailableIdentities();
      const holderKeys = new Map<string, KeyPair>();

      // Validate and prepare allocations
      const validAllocations: MintAllocation[] = [];
      for (const alloc of allocations) {
        if (alloc.id.trim() && alloc.amount.trim()) {
          const identity = identities.find((i) => i.id === alloc.id);
          if (!identity) {
            alert(`Identity "${alloc.id}" not found. Create it in the Ledger page first.`);
            setIsCreating(false);
            return;
          }
          const keypair = deserializeKeyPair(identity);
          holderKeys.set(keypair.id, keypair);
          validAllocations.push({
            recipient: keypair.id,
            amount: Number(alloc.amount),
          });
        }
      }

      if (validAllocations.length === 0) {
        alert("Add at least one allocation");
        setIsCreating(false);
        return;
      }

      const newAsset = await createAsset(
        "democoin",
        assetName,
        {
          mintAuthority: [],
          burnAuthority: [],
        },
        {
          allowSelfMint: true,
          allowSelfBurn: true,
          transferable: true,
          cappedSupply: false,
        },
        validAllocations,
        holderKeys
      );

      setAsset(newAsset);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAsset));
      setAllocations([{ id: "", amount: "" }]);
    } catch (error: any) {
      alert(error.message || "Failed to create asset");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddAllocation = () => {
    setAllocations([...allocations, { id: "", amount: "" }]);
  };

  const handleRemoveAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const handleAllocationChange = (index: number, field: "id" | "amount", value: string) => {
    const updated = [...allocations];
    updated[index][field] = value;
    setAllocations(updated);
  };

  const availableIds = getAvailableIdentities().map((i) => i.id);

  if (!asset) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Community Token Wallet
            </h1>
            <p className="text-muted-foreground">
              Create and manage fungible assets with private balances and public supply verification
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Create New Asset
              </CardTitle>
              <CardDescription>
                Set up a fungible token with initial allocations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Asset Name</label>
                <Input
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g., EyamCoin, Volunteer Hours"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Initial Allocations</label>
                <div className="space-y-2 mt-2">
                  {allocations.map((alloc, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Identity (e.g., alice)"
                        value={alloc.id}
                        onChange={(e) => handleAllocationChange(index, "id", e.target.value)}
                        list={`identities-${index}`}
                        className="flex-1"
                      />
                      <datalist id={`identities-${index}`}>
                        {availableIds.map((id) => (
                          <option key={id} value={id} />
                        ))}
                      </datalist>
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={alloc.amount}
                        onChange={(e) => handleAllocationChange(index, "amount", e.target.value)}
                        className="w-32"
                      />
                      {allocations.length > 1 && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveAllocation(index)}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleAddAllocation}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Allocation
                </Button>
              </div>

              <Button onClick={handleCreateAsset} disabled={isCreating} className="w-full">
                {isCreating ? "Creating..." : "Create Asset"}
              </Button>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm dark:bg-blue-900/20 dark:border-blue-800">
                <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Note
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  Create identities in the <a href="#/ledger" className="underline">Ledger page</a> first, then use them here.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const summary = getPublicSummary(asset);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {asset.assetName} Wallet
          </h1>
          <p className="text-muted-foreground">
            Private balances, public total supply, cryptographic auditability
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Public Total */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Total Supply
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalSupply}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.verified ? (
                  <Badge variant="default" className="text-xs">Verified ✓</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">Unverified ✗</Badge>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Holder Count */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Holders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.holderCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Participants</p>
            </CardContent>
          </Card>

          {/* Operations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Coins className="w-4 h-4" />
                Operations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.operationCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Total transactions</p>
            </CardContent>
          </Card>
        </div>

        {/* My Wallet */}
        {walletView && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                My Wallet
                {currentIdentity && (
                  <Badge variant="secondary" className="ml-2">{currentIdentity.id}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Your private balance and permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">My Balance</p>
                  <p className="text-3xl font-bold">
                    {walletView.myBalance !== null ? walletView.myBalance.toString() : "—"}
                  </p>
                  {walletView.myBalance !== null && !walletView.myBalanceValid && (
                    <Badge variant="destructive" className="mt-1">Invalid</Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Permissions</p>
                  <div className="flex gap-2 mt-2">
                    {walletView.canMint && <Badge>Can Mint</Badge>}
                    {walletView.canBurn && <Badge>Can Burn</Badge>}
                    {!walletView.canMint && !walletView.canBurn && (
                      <Badge variant="secondary">Holder Only</Badge>
                    )}
                  </div>
                </div>
              </div>

              {walletView.myOperations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">My Operations</h4>
                  <div className="space-y-1">
                    {walletView.myOperations.map((op) => (
                      <div key={op.id} className="text-sm p-2 bg-muted rounded">
                        <Badge variant="outline" className="text-xs mr-2">{op.type}</Badge>
                        {op.type === "mint" && `Received ${op.amount}`}
                        {op.type === "burn" && `Burned ${op.amount}`}
                        {op.type === "transfer" && (
                          <>
                            {op.from === currentIdentity?.id
                              ? `Sent ${op.amount} to ${op.to}`
                              : `Received ${op.amount} from ${op.from}`}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button
            onClick={() => {
              setAsset(null);
              localStorage.removeItem(STORAGE_KEY);
            }}
            variant="outline"
          >
            Reset & Create New Asset
          </Button>
        </div>
      </div>
    </div>
  );
}
