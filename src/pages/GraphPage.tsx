import GraphExplorerNew from "../components/graph/GraphExplorerNew";

export function GraphPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-full mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Graph Explorer
          </h1>
          <p className="text-muted-foreground">
            Visualize and explore network relationships
          </p>
        </header>

        <GraphExplorerNew />
      </div>
    </div>
  );
}
