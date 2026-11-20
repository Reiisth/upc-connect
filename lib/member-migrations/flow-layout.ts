import type { MigrationAnalytics } from "./server";

export type FlowKind = "transfer" | "departure" | "return";
export type FlowNode = { id: string; label: string; category: "branch" | "church" | "restricted"; color: string };
export type MigrationFlow = { id: string; source: string; destination: string; count: number; kind: FlowKind; color: string };
export type MigrationFlowModel = { nodes: FlowNode[]; flows: MigrationFlow[] };
const colors = ["#16836B", "#A35B38", "#8B5CB5", "#587630", "#5D94E8"];

export function migrationFlowModel(data: MigrationAnalytics, includeExternal: boolean): MigrationFlowModel {
  const nodes = new Map<string, FlowNode>();
  const flows = new Map<string, MigrationFlow>();
  function node(label: string, category: FlowNode["category"] = "branch") {
    if (label === "Outside accessible branches") category = "restricted";
    const id = `${category}:${label}`;
    if (!nodes.has(id)) {
      const hash = Array.from(label).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
      nodes.set(id, { id, label, category, color: category === "branch" ? colors[hash % colors.length] : category === "restricted" ? "#94A3B8" : "#64748B" });
    }
    return id;
  }
  function add(source: string, destination: string, count: number, kind: FlowKind) {
    if (!Number.isSafeInteger(count) || count <= 0) return;
    const id = JSON.stringify([source, destination, kind]);
    const color = kind === "departure" ? "#B7791F" : kind === "return" ? "#16836B" : nodes.get(source)!.color;
    const existing = flows.get(id);
    if (existing) existing.count += count;
    else flows.set(id, { id, source, destination, count, kind, color });
  }
  for (const branch of data.branches) node(branch.name);
  for (const flow of data.flows) add(node(flow.source), node(flow.destination), flow.transfers, "transfer");
  if (includeExternal) {
    const outside = node("Outside the church", "church");
    for (const branch of data.branches) {
      add(node(branch.name), outside, branch.departures, "departure");
      add(outside, node(branch.name), branch.returns, "return");
    }
  }
  return { nodes: [...nodes.values()].sort((a,b) => a.label.localeCompare(b.label,"en")), flows: [...flows.values()].sort((a,b) => b.count-a.count || a.id.localeCompare(b.id,"en")) };
}

export function migrationFlowSummary(model: MigrationFlowModel, selected = "all") {
  const branches = new Set(model.nodes.filter(node => node.category === "branch").map(node => node.id));
  let incoming = 0, outgoing = 0;
  for (const flow of model.flows) {
    if (selected === "all" ? branches.has(flow.destination) : flow.destination === selected) incoming += flow.count;
    if (selected === "all" ? branches.has(flow.source) : flow.source === selected) outgoing += flow.count;
  }
  return { incoming, outgoing, net: incoming-outgoing };
}

export type PositionedFlowNode = FlowNode & { x: number; y: number; height: number; total: number };
export type PositionedFlow = MigrationFlow & { thickness: number; path: string; labelX: number; labelY: number };

/** Two independent columns prevent reciprocal transfers from becoming circular paths. */
export function layoutMigrationFlows(model: MigrationFlowModel, compact = false) {
  const width = compact ? 760 : 960, sourceX = 196, targetX = width - 214, barWidth = 18, gap = 24, minimum = 44;
  const total = model.flows.reduce((sum,flow) => sum+flow.count,0);
  const sources = model.nodes.filter(node => model.flows.some(flow => flow.source === node.id));
  const targets = model.nodes.filter(node => model.flows.some(flow => flow.destination === node.id));
  const largest = Math.max(sources.length,targets.length,1);
  const plotHeight = Math.max(280,largest*68+120);
  const unit = total ? (plotHeight-largest*minimum-(largest-1)*gap)/total : 0;
  function column(nodes: FlowNode[], side: "source" | "destination", x: number): PositionedFlowNode[] {
    const used = nodes.length*minimum+total*unit+Math.max(0,nodes.length-1)*gap;
    let y = 8+(plotHeight-used)/2;
    return nodes.map(node => {
      const value = model.flows.filter(flow => flow[side] === node.id).reduce((sum,flow) => sum+flow.count,0);
      const result = { ...node, x, y, total:value, height:minimum+value*unit };
      y += result.height+gap;
      return result;
    });
  }
  const left = column(sources,"source",sourceX), right = column(targets,"destination",targetX);
  const sourceOffsets = new Map<string,number>(), targetOffsets = new Map<string,number>();
  for (const node of left) {
    let y = node.y+minimum/2;
    for (const flow of model.flows.filter(flow => flow.source === node.id).sort((a,b) => model.nodes.findIndex(node => node.id === a.destination)-model.nodes.findIndex(node => node.id === b.destination) || a.id.localeCompare(b.id))) {
      sourceOffsets.set(flow.id,y);y+=flow.count*unit;
    }
  }
  for (const node of right) {
    let y = node.y+minimum/2;
    for (const flow of model.flows.filter(flow => flow.destination === node.id).sort((a,b) => model.nodes.findIndex(node => node.id === a.source)-model.nodes.findIndex(node => node.id === b.source) || a.id.localeCompare(b.id))) {
      targetOffsets.set(flow.id,y);y+=flow.count*unit;
    }
  }
  const x0=sourceX+barWidth,x1=targetX,mid=(x0+x1)/2,t=0.28,smooth=3*t*t-2*t*t*t;
  const links: PositionedFlow[] = model.flows.map(flow => {
    const sy=sourceOffsets.get(flow.id)!,ty=targetOffsets.get(flow.id)!,thickness=flow.count*unit;
    return { ...flow, thickness,
      path:`M ${x0} ${sy} C ${mid} ${sy} ${mid} ${ty} ${x1} ${ty} L ${x1} ${ty+thickness} C ${mid} ${ty+thickness} ${mid} ${sy+thickness} ${x0} ${sy+thickness} Z`,
      labelX:x0*(1-t)**3+3*mid*(1-t)**2*t+3*mid*(1-t)*t*t+x1*t**3,
      labelY:(sy+thickness/2)*(1-smooth)+(ty+thickness/2)*smooth };
  });
  return { width, height:plotHeight+16, left, right, links };
}

export function wrapFlowLabel(label: string) {
  const chunks = label.match(/.{1,24}(?:\s|$)|\S{1,24}/g)?.map(chunk => chunk.trim()) ?? [label];
  return chunks.length > 2 ? [chunks[0],`${chunks[1].slice(0,21)}…`] : chunks;
}
