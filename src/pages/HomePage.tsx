import { Link } from "react-router-dom";
import { FileSpreadsheet, Network } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

export function HomePage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-4">
            Confidential Ledger Suite
          </h1>
          <p className="text-xl text-muted-foreground">
            Privacy-preserving financial tools and network visualization
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FileSpreadsheet className="w-6 h-6" />
                Confidential Ledger
              </CardTitle>
              <CardDescription>
                Create and manage ledgers with Pedersen commitments. Each entry's value is
                encrypted and only visible to the holder, while everyone can verify the total.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 mb-4">
                <li>Generate cryptographic keypair identities</li>
                <li>Create ledgers with encrypted balances</li>
                <li>Verify commitments and detect tampering</li>
                <li>Privacy-preserving sum verification</li>
              </ul>
              <Link to="/ledger">
                <Button className="w-full">
                  Open Ledger
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Network className="w-6 h-6" />
                Graph Explorer
              </CardTitle>
              <CardDescription>
                Visualize and explore complex network relationships with an interactive
                force-directed graph. Perfect for understanding connections and patterns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 mb-4">
                <li>Interactive force-directed visualization</li>
                <li>Explore node connections and relationships</li>
                <li>Adjust physics parameters in real-time</li>
                <li>Expand neighborhoods dynamically</li>
              </ul>
              <Link to="/graph">
                <Button className="w-full" variant="outline">
                  Open Graph Explorer
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <footer className="mt-12 text-center text-muted-foreground text-sm">
          <p>Built with cryptographic primitives from @noble/curves</p>
        </footer>
      </div>
    </div>
  );
}
