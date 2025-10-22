import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { LedgerPage } from "./pages/LedgerPage";
import { GraphPage } from "./pages/GraphPage";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import { FileSpreadsheet, Network, Home } from "lucide-react";

function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/ledger", label: "Ledger", icon: FileSpreadsheet },
    { path: "/graph", label: "Graph", icon: Network },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 text-xl font-bold text-foreground hover:text-foreground/70 transition-colors">
            <img 
              src="/ledger.png" 
              alt="Ledger" 
              className="w-8 h-8 object-contain flex-shrink-0" 
              style={{ imageRendering: 'auto' }}
              onLoad={() => console.log('Ledger logo loaded successfully')}
              onError={(e) => {
                console.error('Failed to load ledger.png:', e);
                console.log('Trying fallback approach...');
                // Don't hide the image, just log the error
              }}
            />
            Confidential Ledger Suite
          </Link>
          <div className="flex items-center gap-2">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  return (
    <div className="pt-16">
      <Navigation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/graph" element={<GraphPage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="ledger-ui-theme">
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
