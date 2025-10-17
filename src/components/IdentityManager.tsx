import { useState, useEffect } from "react";
import type { KeyPair, SerializedKeyPair } from "../lib/ledger";
import { generateKeyPair, serializeKeyPair, deserializeKeyPair } from "../lib/ledger";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { User, Plus, Trash2 } from "lucide-react";

const STORAGE_KEY = "confidential-ledger-identities";

interface IdentityManagerProps {
  currentIdentity: KeyPair | null;
  onIdentityChange: (identity: KeyPair) => void;
}

export function IdentityManager({ currentIdentity, onIdentityChange }: IdentityManagerProps) {
  const [identities, setIdentities] = useState<SerializedKeyPair[]>([]);
  const [newAlias, setNewAlias] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setIdentities(parsed);
        // Auto-select first identity if none selected
        if (!currentIdentity && parsed.length > 0) {
          onIdentityChange(deserializeKeyPair(parsed[0]));
        }
      } catch (e) {
        console.error("Failed to load identities:", e);
      }
    }
  }, []);

  const saveIdentities = (ids: SerializedKeyPair[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    setIdentities(ids);
  };

  const handleCreateIdentity = () => {
    const alias = newAlias.trim();
    if (!alias) return;

    // Check if alias already exists
    if (identities.some(id => id.id === alias)) {
      alert("An identity with this alias already exists");
      return;
    }

    const newKeyPair = generateKeyPair(alias);
    const serialized = serializeKeyPair(newKeyPair);
    const updated = [...identities, serialized];
    saveIdentities(updated);
    onIdentityChange(newKeyPair);
    setNewAlias("");
  };

  const handleSelectIdentity = (id: SerializedKeyPair) => {
    onIdentityChange(deserializeKeyPair(id));
  };

  const handleDeleteIdentity = (alias: string) => {
    if (!confirm(`Are you sure you want to delete identity "${alias}"?`)) return;

    const updated = identities.filter(id => id.id !== alias);
    saveIdentities(updated);

    // If we deleted the current identity, select another or clear
    if (currentIdentity?.id === alias) {
      if (updated.length > 0) {
        onIdentityChange(deserializeKeyPair(updated[0]));
      } else {
        onIdentityChange(null as any);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Identity Manager
        </CardTitle>
        <CardDescription>
          Create and manage keypair identities. Each identity has encrypted viewing access to their ledger entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new identity */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter alias (e.g., alice, bob)"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateIdentity()}
          />
          <Button onClick={handleCreateIdentity} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
        </div>

        {/* Identity list */}
        <div className="space-y-2">
          {identities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No identities yet. Create one to get started.
            </p>
          ) : (
            identities.map((id) => (
              <div
                key={id.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  currentIdentity?.id === id.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted cursor-pointer"
                }`}
                onClick={() => handleSelectIdentity(id)}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{id.id}</span>
                  {currentIdentity?.id === id.id && (
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteIdentity(id.id);
                  }}
                  className="h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {currentIdentity && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <p className="font-medium mb-1">Current Identity: {currentIdentity.id}</p>
            <p className="font-mono break-all">
              x25519 pub: {currentIdentity.x25519.publicKey.slice(0, 8).toString()}...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
