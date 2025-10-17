import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide } from "d3-force";

export type Node = {
    id: string;
    label?: string;
    type?: "Person" | "Company" | "Asset" | "Default";
};

export type Link = {
    source: string;
    target: string;
    type?: "OWNS" | "WORKS_AT" | "DEFAULT";
    weight?: number;
    directed?: boolean;
};

export type GraphData = { nodes: Node[]; links: Link[] };

function generateDemoGraph(n = 80, m = 160): GraphData {
    const types: Node["type"][] = ["Person", "Company", "Asset"];
    const nodes: Node[] = Array.from({ length: n }, (_, i) => ({ id: String(i + 1), label: `N${i + 1}`, type: types[i % types.length] }));
    const links: Link[] = [];
    for (let i = 0; i < m; i++) {
        const a = 1 + Math.floor(Math.random() * n);
        const b = 1 + Math.floor(Math.random() * n);
        if (a === b) continue;
        links.push({ source: String(a), target: String(b), type: i % 3 === 0 ? "OWNS" : i % 3 === 1 ? "WORKS_AT" : "DEFAULT", weight: 1 + (i % 3), directed: i % 2 === 0 });
    }
    return { nodes, links };
}

const nodeColor: Record<string, string> = { Person: "#4F46E5", Company: "#059669", Asset: "#DB2777", Default: "#64748B" };
const edgeColor: Record<string, string> = { OWNS: "#DB2777", WORKS_AT: "#06B6D4", DEFAULT: "#94A3B8" };

function GraphExplorer({ data, onExpandNeighbors }: { data: GraphData; onExpandNeighbors?: (nodeId: string) => void }) {
    const fgRef = useRef<ForceGraphMethods | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hoverNode, setHoverNode] = useState<Node | null>(null);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [showArrows, setShowArrows] = useState(true);
    const [panelWidth, setPanelWidth] = useState<number>(() => {
        if (typeof window !== "undefined" && typeof window.innerWidth === "number") return Math.max(300, Math.floor(window.innerWidth / 2));
        return 360;
    });
    const [chargeStrength, setChargeStrength] = useState(-100);
    const [linkDistance, setLinkDistance] = useState(60);
    const [collideRadius, setCollideRadius] = useState(20);

    useEffect(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const half = Math.max(300, Math.floor(rect.width / 2));
        setPanelWidth(half);
    }, []);

    const nodesById = useMemo(() => {
        const m = new Map<string, Node>();
        data.nodes.forEach((n) => m.set(n.id, n));
        return m;
    }, [data.nodes]);

    const neighborMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        data.nodes.forEach((n) => map.set(n.id, new Set()));
        data.links.forEach((l) => {
            map.get(String(l.source))?.add(String(l.target));
            map.get(String(l.target))?.add(String(l.source));
        });
        return map;
    }, [data]);

    const isNeighbor = useCallback((a?: string, b?: string) => (a && b ? neighborMap.get(a)?.has(b) : false), [neighborMap]);

    const activeNode = hoverNode ?? selectedNode;

    const activeEdges = useMemo(() => {
        if (!activeNode) return [] as Array<{ dir: "out" | "in"; type: string; other: Node; link: Link }>;
        const id = activeNode.id;
        const list: Array<{ dir: "out" | "in"; type: string; other: Node; link: Link }> = [];
        for (const l of data.links) {
            const s = String(l.source);
            const t = String(l.target);
            if (s === id) {
                const other = nodesById.get(t);
                if (other) list.push({ dir: "out", type: l.type ?? "DEFAULT", other, link: l });
            } else if (t === id) {
                const other = nodesById.get(s);
                if (other) list.push({ dir: "in", type: l.type ?? "DEFAULT", other, link: l });
            }
        }
        return list;
    }, [activeNode, data.links, nodesById]);

    const nodePaint = useCallback((node: any, ctx: CanvasRenderingContext2D, scale: number) => {
        const n = node as Node & { x: number; y: number };
        const r = 6 * Math.max(0.6, 1 / Math.sqrt(scale));
        const color = nodeColor[n.type ?? "Default"];
        const isHover = hoverNode?.id === n.id;
        const isSelected = selectedNode?.id === n.id;
        let globalAlpha = 1;
        if (hoverNode && hoverNode.id !== n.id && !isNeighbor(hoverNode.id, n.id)) globalAlpha = 0.15;
        ctx.globalAlpha = globalAlpha;
        if (isHover || isSelected) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 6, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(0,0,0,0.08)";
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        const label = n.label ?? n.id;
        ctx.font = `${Math.max(10, 12 / Math.sqrt(scale))}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#111827";
        ctx.fillText(label, n.x, n.y + r + 2);
        ctx.globalAlpha = 1;
    }, [hoverNode, selectedNode, isNeighbor]);

    const linkPaint = useCallback((link: any, ctx: CanvasRenderingContext2D, scale: number) => {
        const l = link as Link & { source: any; target: any };
        const color = edgeColor[l.type ?? "DEFAULT"];
        let globalAlpha = 1;
        if (hoverNode && !(hoverNode.id === String(l.source.id ?? l.source) || hoverNode.id === String(l.target.id ?? l.target) || isNeighbor(hoverNode.id, String(l.source.id ?? l.source)) || isNeighbor(hoverNode.id, String(l.target.id ?? l.target)))) globalAlpha = 0.08;
        ctx.globalAlpha = globalAlpha;
        ctx.lineWidth = Math.max(1, (l.weight ?? 1) / Math.sqrt(scale));
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
        if (showArrows && l.directed) {
            const headlen = 6;
            const angle = Math.atan2(l.target.y - l.source.y, l.target.x - l.source.x);
            const tox = l.target.x;
            const toy = l.target.y;
            ctx.beginPath();
            ctx.moveTo(tox, toy);
            ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }, [hoverNode, isNeighbor, showArrows]);

    const nodePointerPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        const n = node as { x: number; y: number };
        const r = 10;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }, []);

    useEffect(() => {
        const fg = fgRef.current;
        if (!fg) return;
        const charge: any = fg.d3Force("charge");
        if (charge && typeof charge.strength === "function") charge.strength(chargeStrength);
        const link: any = fg.d3Force("link");
        if (link && typeof link.distance === "function") link.distance(linkDistance);
        fg.d3Force("collide", forceCollide(collideRadius));
        fg.d3ReheatSimulation();
    }, [chargeStrength, linkDistance, collideRadius]);

    const onResizerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const min = 240;
        const max = 800;
        const move = (ev: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const w = Math.min(max, Math.max(min, rect.right - ev.clientX));
            setPanelWidth(w);
        };
        const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
    };

    return (
        <div ref={containerRef} style={{ display: "flex", gap: 12, height: "80vh" }}>
            <div style={{ flex: 1, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", background: "#fff" }}>
                <ForceGraph2D
                    ref={fgRef as any}
                    graphData={data}
                    nodeRelSize={6}
                    cooldownTime={15000}
                    d3VelocityDecay={0.25}
                    d3AlphaDecay={0.02}
                    enableNodeDrag
                    onNodeHover={(n) => setHoverNode((n as Node) ?? null)}
                    onNodeClick={(n) => setSelectedNode(n as Node)}
                    nodeCanvasObject={nodePaint}
                    nodePointerAreaPaint={nodePointerPaint}
                    linkCanvasObjectMode={() => "after"}
                    linkCanvasObject={linkPaint}
                />
            </div>
            <div onMouseDown={onResizerMouseDown} style={{ width: 6, cursor: "col-resize", background: "#E5E7EB", borderRadius: 3 }} />
            <aside style={{ width: panelWidth, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", background: "#fff", padding: 12, overflow: "auto" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <button onClick={() => fgRef.current?.zoomToFit(600, 60)} style={btn} title="Zoom to fit">Zoom to fit</button>
                    <button onClick={() => setShowArrows((v) => !v)} style={btn} title="Toggle edge arrows">{showArrows ? "Hide arrows" : "Show arrows"}</button>
                    {selectedNode && (
                        <button onClick={() => onExpandNeighbors?.(selectedNode.id)} style={btn} title="Expand neighbors of selected">Expand neighbors</button>
                    )}
                </div>
                {activeNode ? (
                    <PanelSection title="Node">
                        <KeyVal label="Id" value={activeNode.id} />
                        <KeyVal label="Label" value={activeNode.label ?? activeNode.id} />
                        <KeyVal label="Type" value={activeNode.type ?? "—"} />
                        <KeyVal label="Degree" value={neighborMap.get(activeNode.id)?.size ?? 0} />
                    </PanelSection>
                ) : (
                    <div style={{ color: "#6B7280", fontSize: 14 }}>Hover a node to preview; click to select.</div>
                )}
                <PanelSection title="Edges" collapsed>
                    {activeNode && activeEdges.length > 0 ? (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {activeEdges.map((e, idx) => (
                                <li key={idx} style={{ padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                                    <div style={{ fontSize: 13, color: "#111827" }}>{e.dir === "out" ? "→" : "←"} {e.other.label ?? e.other.id}</div>
                                    <div style={{ fontSize: 12, color: "#6B7280" }}>{e.type}</div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div style={{ color: "#6B7280", fontSize: 13 }}>No edges.</div>
                    )}
                </PanelSection>
                <PanelSection title="Physics">
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px", alignItems: "center", gap: 8 }}>
                        <div style={{ color: "#6B7280", fontSize: 12 }}>Charge</div>
                        <input type="range" min={-300} max={0} step={5} value={chargeStrength} onChange={(e) => setChargeStrength(parseInt(e.target.value, 10))} />
                        <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{chargeStrength}</div>

                        <div style={{ color: "#6B7280", fontSize: 12 }}>Link dist</div>
                        <input type="range" min={10} max={200} step={5} value={linkDistance} onChange={(e) => setLinkDistance(parseInt(e.target.value, 10))} />
                        <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{linkDistance}</div>

                        <div style={{ color: "#6B7280", fontSize: 12 }}>Collide R</div>
                        <input type="range" min={0} max={80} step={1} value={collideRadius} onChange={(e) => setCollideRadius(parseInt(e.target.value, 10))} />
                        <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{collideRadius}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={btn} onClick={() => { setChargeStrength(-100); setLinkDistance(60); setCollideRadius(20); }}>Reset</button>
                    </div>
                </PanelSection>
                <PanelSection title="Tips" collapsed>
                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                        <li>Drag nodes to pin their position.</li>
                        <li>Use the Zoom to fit button if you lose the graph.</li>
                        <li>Resize this panel by dragging the handle.</li>
                    </ul>
                </PanelSection>

                {/* --- Basic runtime tests (console output) --- */}
                <PanelSection title="Diagnostics" collapsed>
                    <Diagnostics data={data} neighborMap={neighborMap} panelWidth={panelWidth} />
                </PanelSection>
            </aside>
        </div>
    );
}

const btn: React.CSSProperties = { padding: "6px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 13 };

function PanelSection({ title, children, collapsed = false }: { title: string; children?: React.ReactNode; collapsed?: boolean }) {
    const [open, setOpen] = useState(!collapsed);
    return (
        <section style={{ margin: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
                <button style={btn} onClick={() => setOpen((v) => !v)}>{open ? "Collapse" : "Expand"}</button>
            </div>
            {open && <div>{children}</div>}
        </section>
    );
}

function KeyVal({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 8, fontSize: 14, margin: "6px 0" }}>
            <div style={{ color: "#6B7280" }}>{label}</div>
            <div style={{ color: "#111827", wordBreak: "break-word" }}>{value}</div>
        </div>
    );
}

function Diagnostics({ data, neighborMap, panelWidth }: { data: GraphData; neighborMap: Map<string, Set<string>>; panelWidth: number }) {
    useEffect(() => {
        const tests: Array<[string, boolean, string?]> = [];
        tests.push(["nodes array exists", Array.isArray(data.nodes)]);
        tests.push(["links array exists", Array.isArray(data.links)]);
        tests.push(["panelWidth is number", typeof panelWidth === "number" && panelWidth > 0]);
        const degreeOk = data.nodes.every((n) => neighborMap.has(n.id));
        tests.push(["neighborMap has all nodes", degreeOk]);
        const linkEndsOk = data.links.every((l) => neighborMap.has(String(l.source)) && neighborMap.has(String(l.target)));
        tests.push(["links reference existing nodes", linkEndsOk]);
        const passed = tests.filter((t) => t[1]).length;
        // eslint-disable-next-line no-console
        console.groupCollapsed("Graph Explorer Diagnostics");
        for (const [name, ok] of tests) {
            // eslint-disable-next-line no-console
            console[ok ? "log" : "error"](`${ok ? "PASS" : "FAIL"}: ${name}`);
        }
        // eslint-disable-next-line no-console
        console.log(`Passed ${passed}/${tests.length} checks`);
        // eslint-disable-next-line no-console
        console.groupEnd();
    }, [data, neighborMap, panelWidth]);
    return null;
}

export default function App() {
    const [graph, setGraph] = useState<GraphData>(() => generateDemoGraph());
    const onExpandNeighbors = (nodeId: string) => {
        setGraph((g) => {
            const next = { nodes: [...g.nodes], links: [...g.links] } as GraphData;
            const base = g.nodes.length;
            const add = 8;
            for (let i = 1; i <= add; i++) {
                next.nodes.push({ id: String(base + i), label: `N${base + i}`, type: i % 2 ? "Person" : "Asset" });
                next.links.push({ source: nodeId, target: String(base + i), type: i % 2 ? "DEFAULT" : "WORKS_AT", directed: true });
            }
            return next;
        });
    };
    return (
        <div style={{ height: "100vh", padding: 16, background: "#F3F4F6" }}>
            <h1 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>Graph Explorer Prototype</h1>
            <GraphExplorer data={graph} onExpandNeighbors={onExpandNeighbors} />
        </div>
    );
}
