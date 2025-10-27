import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { FileSpreadsheet, Lock, TrendingUp, ArrowRight, Wallet } from "lucide-react";

interface CapabilityCard {
  title: string;
  description: string;
  route: string;
  icon: React.ReactNode;
  status: "ready" | "preview" | "planned";
  phase: string;
}

const capabilities: CapabilityCard[] = [
  {
    title: "Confidential Ledger",
    description:
      "Private balances, public total verification. Cryptographic auditability with Pedersen commitments.",
    route: "/ledger",
    icon: <FileSpreadsheet className="w-6 h-6" />,
    status: "ready",
    phase: "Phase 1",
  },
  {
    title: "Stablecoin / Community Token",
    description:
      "Fungible asset balances with mint, burn, and transfer operations. Build community currencies with privacy.",
    route: "/stablecoin",
    icon: <TrendingUp className="w-6 h-6" />,
    status: "ready",
    phase: "Phase 2",
  },
  {
    title: "Budgets & Expense Governance",
    description:
      "Multi-party approval workflows for expenses, reimbursements, and authorized spending with delegate bot automation.",
    route: "/budgeting",
    icon: <Wallet className="w-6 h-6" />,
    status: "ready",
    phase: "Phase 3",
  },
  {
    title: "Advanced Governance",
    description:
      "Quadratic voting, weighted decisions, mandate assignment, and participatory priority setting.",
    route: "#",
    icon: <Lock className="w-6 h-6" />,
    status: "planned",
    phase: "Phase 4+",
  },
];

export function DashboardPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-foreground">
            Ferits Capability Dashboard
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Application substrate for confidential ledgers, programmable assets,
            accountable budgeting, participatory governance, and trust-routed
            marketplaces.
          </p>
        </header>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((capability) => (
            <Link
              key={capability.route}
              to={capability.route}
              className={`group ${capability.status !== "ready" ? "pointer-events-none" : ""}`}
            >
              <Card
                className={`h-full transition-all hover:shadow-lg hover:border-primary ${
                  capability.status === "ready"
                    ? "hover:scale-[1.02] cursor-pointer"
                    : "opacity-60"
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {capability.icon}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge
                        variant={
                          capability.status === "ready" ? "default" : "secondary"
                        }
                      >
                        {capability.status === "ready"
                          ? "Ready"
                          : capability.status === "preview"
                            ? "Preview"
                            : "Planned"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {capability.phase}
                      </span>
                    </div>
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {capability.title}
                  </CardTitle>
                  <CardDescription className="min-h-[3rem]">
                    {capability.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {capability.status === "ready" && (
                    <div className="flex items-center gap-2 text-primary text-sm font-medium">
                      <span>Launch capability</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                  {capability.status === "planned" && (
                    <div className="text-muted-foreground text-sm">
                      Coming soon
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* About Section */}
        <Card className="mt-12">
          <CardHeader>
            <CardTitle>About Ferits</CardTitle>
            <CardDescription>
              Building blocks for privacy-preserving economic coordination
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Ferits is not "the app" — it's an <strong>application substrate</strong> that
              provides foundational capabilities for building privacy-preserving
              economic systems:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>
                <strong>Confidential Ledgers:</strong> Private balances with public
                total verification using Pedersen commitments
              </li>
              <li>
                <strong>Programmable Assets:</strong> Fungible and non-fungible tokens
                with privacy guarantees
              </li>
              <li>
                <strong>Accountable Budgeting:</strong> Committee-managed funds with
                transparent authorization
              </li>
              <li>
                <strong>Participatory Governance:</strong> Weighted and quadratic
                voting with credential-based permissions
              </li>
              <li>
                <strong>Scarce Resource Rights:</strong> Permits for rentals, quotas,
                and caps
              </li>
              <li>
                <strong>Trust-Routed Marketplace:</strong> Skills, needs, and capital
                matching via reputation graphs
              </li>
            </ul>
            <p className="text-muted-foreground">
              Each capability stands alone and composes cleanly with others.
              Together, they enable new forms of community coordination while
              preserving individual privacy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
