import { useState } from "react";
import type { KeyPair } from "../lib/ledger";
import { IdentityManager } from "../components/IdentityManager";
import { LedgerSpreadsheet } from "../components/LedgerSpreadsheet";

export function LedgerPage() {
  const [currentIdentity, setCurrentIdentity] = useState<KeyPair | null>(null);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Confidential Ledger
          </h1>
          <p className="text-muted-foreground">
            Privacy-preserving ledger with Pedersen commitments and encrypted balances
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <IdentityManager
              currentIdentity={currentIdentity}
              onIdentityChange={setCurrentIdentity}
            />
          </div>
          <div className="lg:col-span-2">
            <LedgerSpreadsheet currentIdentity={currentIdentity} />
          </div>
        </div>
      </div>
    </div>
  );
}
