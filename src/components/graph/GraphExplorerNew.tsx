import { useState, useRef, useCallback, useEffect } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide } from "d3-force";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Save } from "lucide-react";

export type Node = {
  id: string;
  label?: string;
  type?: "Person" | "Company" | "Asset" | "Default";
  customSize?: number;
  customColor?: string;
};

export type Link = {
  source: string;
  target: string;
  type?: "OWNS" | "WORKS_AT" | "DEFAULT";
  weight?: number;
  directed?: boolean;
};

export type GraphData = { nodes: Node[]; links: Link[] };

type GraphSettings = {
  chargeStrength: number;
  linkDistance: number;
  collideRadius: number;
  cooldownTime: number;
  velocityDecay: number;
  nodeSize: number;
  showLabels: boolean;
  labelSize: number;
  arrowSize: number;
  showArrows: boolean;
};

const DEFAULT_SETTINGS: GraphSettings = {
  chargeStrength: -100,
  linkDistance: 60,
  collideRadius: 20,
  cooldownTime: 2000,
  velocityDecay: 0.3,
  nodeSize: 6,
  showLabels: true,
  labelSize: 12,
  arrowSize: 10,
  showArrows: true,
};

function generateDemoGraph(n = 80, m = 160): GraphData {
  const types: Node["type"][] = ["Person", "Company", "Asset"];
  const nodes: Node[] = Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    label: `N${i + 1}`,
    type: types[i % types.length],
  }));
  const links: Link[] = [];
  for (let i = 0; i < m; i++) {
    const a = 1 + Math.floor(Math.random() * n);
    const b = 1 + Math.floor(Math.random() * n);
    if (a === b) continue;
    links.push({
      source: String(a),
      target: String(b),
      type: i % 3 === 0 ? "OWNS" : i % 3 === 1 ? "WORKS_AT" : "DEFAULT",
      weight: 1 + (i % 3),
      directed: i % 2 === 0,
    });
  }
  return { nodes, links };
}

const nodeColor: Record<string, string> = {
  Person: "#4F46E5",
  Company: "#059669",
  Asset: "#DB2777",
  Default: "#64748B",
};

const edgeColor: Record<string, string> = {
  OWNS: "#DB2777",
  WORKS_AT: "#06B6D4",
  DEFAULT: "#94A3B8",
};

function GraphExplorerNew() {
  const [activeTab, setActiveTab] = useState<"data" | "graph">("graph");
  const [graphData, setGraphData] = useState<GraphData>(() => generateDemoGraph());
  const [hoverNode, setHoverNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Record<string, GraphSettings>>(() => {
    const stored = localStorage.getItem("graph-settings-presets");
    return stored ? JSON.parse(stored) : { Default: DEFAULT_SETTINGS };
  });
  const [newPresetName, setNewPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("Default");
  const [detailsPanelWidth, setDetailsPanelWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);

  const fgRef = useRef<ForceGraphMethods<any, any>>(null!);

  // Update physics when settings change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fgRef.current) return;
      const fg = fgRef.current;

      // Update charge force
      const chargeForce = fg.d3Force("charge");
      if (chargeForce) {
        chargeForce.strength(settings.chargeStrength);
      }

      // Update link force
      const linkForce: any = fg.d3Force("link");
      if (linkForce && typeof linkForce.distance === "function") {
        linkForce.distance(settings.linkDistance);
      }

      // Update/create collide force
      fg.d3Force("collide", forceCollide(settings.collideRadius));

      // Reheat the simulation to apply changes
      fg.d3ReheatSimulation();
    }, 100);

    return () => clearTimeout(timer);
  }, [settings]);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const updated = { ...savedSettings, [newPresetName]: settings };
    setSavedSettings(updated);
    localStorage.setItem("graph-settings-presets", JSON.stringify(updated));
    setNewPresetName("");
    setSelectedPreset(newPresetName);
  };

  const handleLoadPreset = (presetName: string) => {
    const preset = savedSettings[presetName];
    if (preset) {
      setSettings(preset);
      setSelectedPreset(presetName);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setDetailsPanelWidth(Math.max(250, Math.min(600, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const updateNodeProperty = (nodeId: string, property: keyof Node, value: any) => {
    setGraphData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId ? { ...n, [property]: value } : n
      ),
    }));
  };

  const nodePaint = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label || node.id;
      const fontSize = (node.customSize || settings.labelSize) / globalScale;
      const nodeRadius = node.customSize || settings.nodeSize;
      const color = node.customColor || nodeColor[node.type as keyof typeof nodeColor] || nodeColor.Default;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Highlight if selected or hovered
      if (node === selectedNode || node === hoverNode) {
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 3 / globalScale;
        ctx.stroke();
      }

      // Draw label if enabled
      if (settings.showLabels) {
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#333";
        ctx.fillText(label, node.x, node.y + nodeRadius + fontSize);
      }
    },
    [selectedNode, hoverNode, settings.nodeSize, settings.showLabels, settings.labelSize]
  );

  const linkPaint = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const start = link.source;
      const end = link.target;
      if (!start?.x || !end?.x) return;

      const color = edgeColor[link.type as keyof typeof edgeColor] || edgeColor.DEFAULT;
      ctx.strokeStyle = color;
      ctx.lineWidth = (link.weight || 1) / globalScale;

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw arrow if directed and arrows are enabled
      if (link.directed && settings.showArrows) {
        const arrowLength = settings.arrowSize / globalScale;
        const arrowWidth = (settings.arrowSize * 0.6) / globalScale;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;
        const ux = dx / len;
        const uy = dy / len;
        const nodeRadius = settings.nodeSize;
        const arrowX = end.x - ux * nodeRadius;
        const arrowY = end.y - uy * nodeRadius;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowLength, arrowWidth / 2);
        ctx.lineTo(-arrowLength, -arrowWidth / 2);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }
    },
    [settings.showArrows, settings.arrowSize, settings.nodeSize]
  );

  const displayedNode = selectedNode || hoverNode;

  return (
    <div className="w-full">
      <Tabs value={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger active={activeTab === "data"} onClick={() => setActiveTab("data")}>
            Data
          </TabsTrigger>
          <TabsTrigger active={activeTab === "graph"} onClick={() => setActiveTab("graph")}>
            Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data" className={activeTab === "data" ? "block" : "hidden"}>
          <Card>
            <CardHeader>
              <CardTitle>Graph Data (JSON)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-sm">
                {JSON.stringify(graphData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph" className={activeTab === "graph" ? "block" : "hidden"}>
          <div className="flex gap-0 relative" style={{ height: "calc(100vh - 280px)" }}>
            {/* Graph Panel */}
            <div
              className="flex-1 bg-card rounded-lg border border-border overflow-hidden"
              style={{ width: `calc(100% - ${detailsPanelWidth}px)` }}
            >
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                nodeRelSize={6}
                cooldownTime={settings.cooldownTime}
                d3VelocityDecay={settings.velocityDecay}
                d3AlphaDecay={0.02}
                enableNodeDrag
                onNodeHover={(node) => setHoverNode((node as Node) ?? null)}
                onNodeClick={(node) => {
                  setSelectedNode(node as Node);
                  // Keep simulation running after selection
                  if (fgRef.current) {
                    fgRef.current.d3ReheatSimulation();
                  }
                }}
                onBackgroundClick={() => setSelectedNode(null)}
                nodeCanvasObject={nodePaint}
                linkCanvasObjectMode={() => "after"}
                linkCanvasObject={linkPaint}
                warmupTicks={100}
              />
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDown}
              className="w-1 bg-border hover:bg-primary cursor-col-resize transition-colors"
            />

            {/* Details Panel */}
            <div
              className="bg-background border-l border-border flex flex-col overflow-hidden"
              style={{ width: detailsPanelWidth }}
            >
              {/* Node Details (Top Half) */}
              <div className="flex-1 overflow-auto border-b border-border p-4">
                <h3 className="text-lg font-semibold mb-3 text-foreground">Node Details</h3>
                {displayedNode ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">ID</div>
                      <div className="font-mono text-sm text-foreground">{displayedNode.id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Label</div>
                      <div className="font-mono text-sm text-foreground">
                        {displayedNode.label || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Type</div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              nodeColor[displayedNode.type as keyof typeof nodeColor] ||
                              nodeColor.Default,
                          }}
                        />
                        <span className="text-sm text-foreground">{displayedNode.type || "Default"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Raw Data</div>
                      <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto max-h-40">
                        {JSON.stringify(displayedNode, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Hover or click a node to see details</p>
                )}
              </div>

              {/* Settings (Bottom Half) */}
              <div className="flex-1 overflow-auto p-4 bg-muted/30">
                <h3 className="text-lg font-semibold mb-3 text-foreground">Graph Settings</h3>

                <div className="space-y-4">
                  {/* Charge Strength */}
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">
                      Charge Strength: {settings.chargeStrength}
                    </label>
                    <input
                      type="range"
                      min="-300"
                      max="-10"
                      value={settings.chargeStrength}
                      onChange={(e) =>
                        setSettings({ ...settings, chargeStrength: Number(e.target.value) })
                      }
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  {/* Link Distance */}
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">
                      Link Distance: {settings.linkDistance}
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="200"
                      value={settings.linkDistance}
                      onChange={(e) =>
                        setSettings({ ...settings, linkDistance: Number(e.target.value) })
                      }
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  {/* Collision Radius */}
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">
                      Collision Radius: {settings.collideRadius}
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={settings.collideRadius}
                      onChange={(e) =>
                        setSettings({ ...settings, collideRadius: Number(e.target.value) })
                      }
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  {/* Visual Settings */}
                  <div className="pt-3 border-t border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Visual Settings</h4>

                    {/* Node Size */}
                    <div className="mb-3">
                      <label className="text-sm text-muted-foreground block mb-1">
                        Node Size: {settings.nodeSize}
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="20"
                        value={settings.nodeSize}
                        onChange={(e) =>
                          setSettings({ ...settings, nodeSize: Number(e.target.value) })
                        }
                        className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Label Size */}
                    <div className="mb-3">
                      <label className="text-sm text-muted-foreground block mb-1">
                        Label Size: {settings.labelSize}
                      </label>
                      <input
                        type="range"
                        min="8"
                        max="24"
                        value={settings.labelSize}
                        onChange={(e) =>
                          setSettings({ ...settings, labelSize: Number(e.target.value) })
                        }
                        className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Arrow Size */}
                    <div className="mb-3">
                      <label className="text-sm text-muted-foreground block mb-1">
                        Arrow Size: {settings.arrowSize}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="20"
                        value={settings.arrowSize}
                        onChange={(e) =>
                          setSettings({ ...settings, arrowSize: Number(e.target.value) })
                        }
                        className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Toggle Switches */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Show Labels</span>
                      <button
                        onClick={() => setSettings({ ...settings, showLabels: !settings.showLabels })}
                        className={`w-11 h-6 rounded-full transition-colors ${
                          settings.showLabels ? "bg-primary" : "bg-border"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-background transition-transform ${
                            settings.showLabels ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Show Arrows</span>
                      <button
                        onClick={() => setSettings({ ...settings, showArrows: !settings.showArrows })}
                        className={`w-11 h-6 rounded-full transition-colors ${
                          settings.showArrows ? "bg-primary" : "bg-border"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-background transition-transform ${
                            settings.showArrows ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Per-Node Customization */}
                  {selectedNode && (
                    <div className="pt-3 border-t border-border">
                      <h4 className="text-sm font-semibold text-foreground mb-2">
                        Customize Node: {selectedNode.label || selectedNode.id}
                      </h4>

                      <div className="mb-3">
                        <label className="text-sm text-muted-foreground block mb-1">
                          Custom Size
                        </label>
                        <input
                          type="range"
                          min="3"
                          max="30"
                          value={selectedNode.customSize || settings.nodeSize}
                          onChange={(e) =>
                            updateNodeProperty(selectedNode.id, "customSize", Number(e.target.value))
                          }
                          className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="text-sm text-muted-foreground block mb-1">
                          Custom Color
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={selectedNode.customColor || nodeColor[selectedNode.type as keyof typeof nodeColor] || nodeColor.Default}
                            onChange={(e) =>
                              updateNodeProperty(selectedNode.id, "customColor", e.target.value)
                            }
                            className="w-12 h-8 rounded border border-border cursor-pointer"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateNodeProperty(selectedNode.id, "customColor", undefined)}
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Presets */}
                  <div className="pt-4 border-t border-border">
                    <label className="text-sm font-medium text-foreground block mb-2">Presets</label>
                    <div className="flex gap-2 mb-2">
                      <select
                        value={selectedPreset}
                        onChange={(e) => handleLoadPreset(e.target.value)}
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      >
                        {Object.keys(savedSettings).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="New preset name"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleSavePreset} size="sm" disabled={!newPresetName.trim()}>
                        <Save className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GraphExplorerNew;
