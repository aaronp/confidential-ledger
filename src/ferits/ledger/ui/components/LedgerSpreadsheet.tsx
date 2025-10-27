import { useState, useEffect } from "react";
import type {
  KeyPair,
  LedgerState,
  LedgerEntry,
  SerializedKeyPair,
} from "../../core/ledger.api";
import {
  mintPoC,
  verifyTotal,
  getUserView,
  deserializeKeyPair,
  updateOwnEntry,
} from "../../core/ledger.api";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "../../../../components/ui/table";
import { Badge } from "../../../../components/ui/badge";
import {
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Edit3,
  Save,
  X,
  RotateCcw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

const STORAGE_KEY = "confidential-ledger-identities";

interface LedgerSpreadsheetProps {
  currentIdentity: KeyPair | null;
}

interface AllocationInput {
  holderId: string;
  amount: string;
}

export function LedgerSpreadsheet({ currentIdentity }: LedgerSpreadsheetProps) {
  const [ledger, setLedger] = useState<LedgerState | null>(null);
  const [originalLedger, setOriginalLedger] = useState<LedgerState | null>(
    null
  );
  const [allocations, setAllocations] = useState<AllocationInput[]>([
    { holderId: "", amount: "" },
  ]);
  const [allowSelfUpdate, setAllowSelfUpdate] = useState(false);
  const [userView, setUserView] = useState<any>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editedCommit, setEditedCommit] = useState("");
  const [editedEncrypted, setEditedEncrypted] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [isEditingMyBalance, setIsEditingMyBalance] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState("");

  useEffect(() => {
    if (ledger && currentIdentity) {
      refreshUserView();
    }
  }, [ledger, currentIdentity]);

  useEffect(() => {
    if (ledger) {
      const verified = verifyTotal(ledger);
      setIsVerified(verified);
    }
  }, [ledger]);

  const refreshUserView = async () => {
    if (!ledger || !currentIdentity) return;
    const view = await getUserView(ledger, currentIdentity);
    setUserView(view);
  };

  const getAvailableIdentities = (): SerializedKeyPair[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  };

  const handleAddRow = () => {
    setAllocations([...allocations, { holderId: "", amount: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const handleAllocationChange = (
    index: number,
    field: keyof AllocationInput,
    value: string
  ) => {
    const updated = [...allocations];
    updated[index][field] = value;
    setAllocations(updated);
  };

  const handleMintLedger = async () => {
    // Validate inputs
    const validAllocations = allocations.filter(
      (a) =>
        a.holderId.trim() !== "" &&
        a.amount.trim() !== "" &&
        !isNaN(Number(a.amount))
    );

    if (validAllocations.length === 0) {
      alert("Please add at least one valid allocation");
      return;
    }

    const identities = getAvailableIdentities();
    const mintInputs = validAllocations.map((a) => {
      const identity = identities.find((id) => id.id === a.holderId);
      if (!identity) {
        throw new Error(
          `Identity "${a.holderId}" not found. Create it first.`
        );
      }
      return {
        holder: deserializeKeyPair(identity),
        amount: Number(a.amount),
      };
    });

    try {
      const newLedger = await mintPoC(mintInputs, allowSelfUpdate);
      setLedger(newLedger);
      setOriginalLedger(JSON.parse(JSON.stringify(newLedger))); // Deep clone
      // Clear allocations after successful mint
      setAllocations([{ holderId: "", amount: "" }]);
    } catch (error: any) {
      alert(error.message || "Failed to mint ledger");
    }
  };

  const handleStartEdit = (index: number, entry: LedgerEntry) => {
    setEditingEntry(index);
    setEditedCommit(entry.commit);
    setEditedEncrypted(entry.openingEncrypted);
  };

  const handleSaveEdit = () => {
    if (editingEntry === null || !ledger) return;

    const updatedLedger = {
      ...ledger,
      entries: ledger.entries.map((entry, idx) =>
        idx === editingEntry
          ? { ...entry, commit: editedCommit, openingEncrypted: editedEncrypted }
          : entry
      ),
    };

    setLedger(updatedLedger);
    setEditingEntry(null);
    setEditedCommit("");
    setEditedEncrypted("");
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setEditedCommit("");
    setEditedEncrypted("");
  };

  const handleResetLedger = () => {
    if (originalLedger) {
      setLedger(JSON.parse(JSON.stringify(originalLedger))); // Deep clone
      setEditingEntry(null);
      setEditedCommit("");
      setEditedEncrypted("");
    }
  };

  const hasAnyModifications = (): boolean => {
    if (!ledger || !originalLedger) return false;
    return ledger.entries.some((entry, idx) => {
      const original = originalLedger.entries[idx];
      return (
        entry.commit !== original.commit ||
        entry.openingEncrypted !== original.openingEncrypted
      );
    });
  };

  const handleStartBalanceEdit = () => {
    if (userView?.myBalance !== null && userView?.myBalance !== undefined) {
      setNewBalanceInput(userView.myBalance.toString());
      setIsEditingMyBalance(true);
    }
  };

  const handleSaveBalanceEdit = async () => {
    if (!ledger || !currentIdentity || !newBalanceInput.trim()) return;

    const newAmount = Number(newBalanceInput);
    if (isNaN(newAmount) || newAmount < 0) {
      alert("Please enter a valid positive number");
      return;
    }

    try {
      const updatedLedger = await updateOwnEntry(
        ledger,
        currentIdentity,
        newAmount
      );
      setLedger(updatedLedger);
      setIsEditingMyBalance(false);
      setNewBalanceInput("");
    } catch (error: any) {
      alert(error.message || "Failed to update balance");
    }
  };

  const handleCancelBalanceEdit = () => {
    setIsEditingMyBalance(false);
    setNewBalanceInput("");
  };

  const availableIds = getAvailableIdentities().map((id) => id.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Confidential Ledger
        </CardTitle>
        <CardDescription>
          Create a ledger with Pedersen commitments. Each entry's value is
          encrypted and only visible to the holder.
        </CardDescription>

        {/* Help Section */}
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            How do commitments work?
            {showHelp ? (
              <ChevronUp className="w-4 h-4 ml-2" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-2" />
            )}
          </Button>

          {showHelp && (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg text-sm space-y-3">
              <div>
                <h4 className="font-semibold mb-1">
                  Understanding the Ledger Components
                </h4>
                <p className="text-muted-foreground">
                  Each ledger entry has three interconnected pieces of data:
                </p>
              </div>

              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <div>
                  <span className="font-semibold text-primary">Value (v):</span>
                  <p className="text-muted-foreground">
                    The actual balance amount (e.g., 100 tokens)
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-primary">
                    Randomness (r):
                  </span>
                  <p className="text-muted-foreground">
                    A secret random number used to hide the value
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-primary">
                    Commitment (C):
                  </span>
                  <p className="text-muted-foreground">
                    A cryptographic hash:{" "}
                    <code className="bg-background px-1 py-0.5 rounded">
                      C = G×v + H×r
                    </code>
                    <br />
                    This is <strong>public</strong> but reveals nothing about v
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-primary">
                    Encrypted Opening:
                  </span>
                  <p className="text-muted-foreground">
                    The values {"{v, r}"} encrypted so{" "}
                    <strong>only the holder</strong> can read them
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50">
                <p className="font-semibold mb-1">🔒 Privacy Guarantee:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>
                    You can decrypt your own encrypted opening to see your
                    balance
                  </li>
                  <li>
                    You can verify the decrypted value matches the commitment
                  </li>
                  <li>
                    Others see only the commitment (which hides your balance)
                  </li>
                  <li>
                    Everyone can verify the total without seeing individual
                    balances
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-border/50">
                <p className="font-semibold mb-1">⚠️ Tampering Detection:</p>
                <p className="text-muted-foreground">
                  If someone edits the commitment or encrypted opening, the
                  verification fails and a
                  <AlertTriangle className="w-3 h-3 inline mx-1 text-red-600" />
                  warning appears. The value might still decrypt, but it won't
                  match the commitment!
                </p>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mint new ledger */}
        {!ledger ? (
          <div className="space-y-4">
            <h3 className="font-semibold">Mint New Ledger</h3>
            <div className="space-y-2">
              {allocations.map((alloc, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Identity (e.g., alice)"
                    value={alloc.holderId}
                    onChange={(e) =>
                      handleAllocationChange(index, "holderId", e.target.value)
                    }
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
                    onChange={(e) =>
                      handleAllocationChange(index, "amount", e.target.value)
                    }
                    className="w-32"
                  />
                  {allocations.length > 1 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveRow(index)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowSelfUpdate}
                  onChange={(e) => setAllowSelfUpdate(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-foreground">
                  Allow users to update their own balance
                </span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddRow} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Row
              </Button>
              <Button onClick={handleMintLedger} size="sm">
                Mint Ledger
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Ledger verification status */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Ledger Entries</h3>
              <div className="flex items-center gap-2">
                {isVerified !== null && (
                  <Badge variant={isVerified ? "default" : "destructive"}>
                    {isVerified ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Invalid
                      </>
                    )}
                  </Badge>
                )}
                <Button
                  onClick={() => setEditMode(!editMode)}
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  {editMode ? "Editing" : "Edit"}
                </Button>
                {editMode && hasAnyModifications() && (
                  <Button onClick={handleResetLedger} variant="outline" size="sm">
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}
                <Button onClick={() => setLedger(null)} variant="outline" size="sm">
                  New Ledger
                </Button>
              </div>
            </div>

            {/* Edit mode warning */}
            {editMode && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                <p className="font-semibold text-yellow-900 mb-1">
                  ⚠️ Edit Mode Active - Tamper with Data
                </p>
                <p className="text-yellow-800">
                  You can now edit commitments and encrypted openings to simulate
                  data corruption. Watch how verification fails and balances
                  become unreadable when data is tampered!
                </p>
              </div>
            )}

            {/* Ledger table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holder ID</TableHead>
                  <TableHead>Commitment</TableHead>
                  <TableHead>Encrypted Opening</TableHead>
                  <TableHead className="text-right">
                    {currentIdentity ? (
                      <span className="flex items-center justify-end gap-1">
                        <Eye className="w-3 h-3" />
                        My View
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-1">
                        <EyeOff className="w-3 h-3" />
                        Hidden
                      </span>
                    )}
                  </TableHead>
                  {editMode && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.entries.map((entry, index) => {
                  const isMyEntry = entry.holderId === currentIdentity?.id;
                  const myBalance = isMyEntry && userView ? userView.myBalance : null;
                  const isEditing = editingEntry === index;
                  const commitModified =
                    originalLedger &&
                    entry.commit !== originalLedger.entries[index].commit;
                  const encryptedModified =
                    originalLedger &&
                    entry.openingEncrypted !==
                      originalLedger.entries[index].openingEncrypted;

                  return (
                    <TableRow key={index} className={isMyEntry ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">
                        {entry.holderId}
                        {isMyEntry && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            You
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className={`font-mono text-xs ${commitModified ? "bg-orange-100 border-2 border-orange-400 dark:bg-orange-900/30 dark:border-orange-600" : ""}`}
                      >
                        {isEditing ? (
                          <Input
                            value={editedCommit}
                            onChange={(e) => setEditedCommit(e.target.value)}
                            className="font-mono text-xs"
                            placeholder="Commitment hex..."
                          />
                        ) : (
                          <span className="break-all">
                            {entry.commit.slice(0, 16)}...
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={`font-mono text-xs ${encryptedModified ? "bg-orange-100 border-2 border-orange-400 dark:bg-orange-900/30 dark:border-orange-600" : ""}`}
                      >
                        {isEditing ? (
                          <Input
                            value={editedEncrypted}
                            onChange={(e) => setEditedEncrypted(e.target.value)}
                            className="font-mono text-xs"
                            placeholder="Encrypted opening..."
                          />
                        ) : (
                          <span className="break-all">
                            {entry.openingEncrypted.slice(0, 16)}...
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {myBalance !== null ? (
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`font-semibold ${userView.myEntryValid ? "text-green-600" : "text-red-600"}`}
                            >
                              {myBalance.toString()}
                            </span>
                            {!userView.myEntryValid && (
                              <span title="Value doesn't match commitment!">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {editMode && (
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Button
                                onClick={handleSaveEdit}
                                size="icon"
                                variant="default"
                                className="h-7 w-7"
                              >
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleStartEdit(index, entry)}
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    Total (Public)
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {userView?.publicTotal !== null &&
                    userView?.publicTotal !== undefined
                      ? userView.publicTotal.toString()
                      : "—"}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>

            {/* Current user view details */}
            {currentIdentity && userView && (
              <div className="text-sm space-y-3 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold">
                  Your View as {currentIdentity.id}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Your Balance:</span>{" "}
                    {isEditingMyBalance ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={newBalanceInput}
                          onChange={(e) => setNewBalanceInput(e.target.value)}
                          className="w-24 h-7 text-sm"
                          autoFocus
                        />
                        <Button
                          onClick={handleSaveBalanceEdit}
                          size="sm"
                          className="h-7 px-2"
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={handleCancelBalanceEdit}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium">
                        {userView.myBalance !== null
                          ? userView.myBalance.toString()
                          : "Not in ledger"}
                        {ledger?.allowSelfUpdate && userView.myBalance !== null && (
                          <Button
                            onClick={handleStartBalanceEdit}
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-6 px-2"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                        )}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Public Total:</span>{" "}
                    <span className="font-medium">
                      {userView.publicTotal !== null
                        ? userView.publicTotal.toString()
                        : "Unverified"}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Other Entries:</span>{" "}
                  <span className="font-medium">{userView.others.length}</span>
                </div>
                {ledger?.allowSelfUpdate && (
                  <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
                    ℹ️ Self-updates are enabled. You can edit your balance above.
                  </div>
                )}
              </div>
            )}

            {!currentIdentity && (
              <div className="text-sm text-muted-foreground text-center p-4 bg-muted rounded-lg">
                Select an identity above to decrypt and view your balance
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
