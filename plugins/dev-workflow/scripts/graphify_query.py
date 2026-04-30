#!/usr/bin/env python3
"""Graphify query script for code-graph-tool.ts"""
import json
import sys
from pathlib import Path

def main():
    if len(sys.argv) < 4:
        print("Usage: graphify_query.py <project_dir> <action> <target> [target_b] [mode] [budget]")
        sys.exit(1)

    project_dir = sys.argv[1]
    action = sys.argv[2]
    target = sys.argv[3]
    target_b = sys.argv[4] if len(sys.argv) > 4 else None
    mode = sys.argv[5] if len(sys.argv) > 5 else "bfs"
    budget = int(sys.argv[6]) if len(sys.argv) > 6 else 2000

    graph_json = Path(project_dir) / "graphify-out" / "graph.json"
    if not graph_json.exists():
        print("NO_GRAPH")
        sys.exit(0)

    import networkx as nx
    from networkx.readwrite import json_graph as jg

    data = json.loads(graph_json.read_text())
    G = jg.node_link_graph(data, edges="links")

    if action == "impact":
        action_impact(G, target, mode, budget)
    elif action == "trace":
        action_trace(G, target, target_b)
    elif action == "verify":
        action_verify(G, target, budget)
    else:
        print(f"UNKNOWN_ACTION:{action}")
        sys.exit(1)


def find_nodes(G, term):
    terms = term.lower().split()
    scored = []
    for nid, ndata in G.nodes(data=True):
        label = ndata.get("label", "").lower()
        score = sum(1 for t in terms if t in label)
        if score > 0:
            scored.append((score, nid))
    scored.sort(reverse=True)
    return [nid for _, nid in scored[:3]]


def action_impact(G, target, mode, budget):
    start_nodes = find_nodes(G, target)
    if not start_nodes:
        print("NO_MATCH")
        return

    subgraph_nodes = set(start_nodes)
    subgraph_edges = []

    if mode == "dfs":
        visited = set()
        stack = [(n, 0) for n in reversed(start_nodes)]
        while stack:
            node, depth = stack.pop()
            if node in visited or depth > 6:
                continue
            visited.add(node)
            subgraph_nodes.add(node)
            for neighbor in G.neighbors(node):
                if neighbor not in visited:
                    stack.append((neighbor, depth + 1))
                    subgraph_edges.append((node, neighbor))
    else:
        frontier = set(start_nodes)
        for _ in range(3):
            next_frontier = set()
            for n in frontier:
                for neighbor in G.neighbors(n):
                    if neighbor not in subgraph_nodes:
                        next_frontier.add(neighbor)
                        subgraph_edges.append((n, neighbor))
            subgraph_nodes.update(next_frontier)
            frontier = next_frontier

    def relevance(nid):
        label = G.nodes[nid].get("label", "").lower()
        return sum(1 for t in target.lower().split() if t in label)

    ranked = sorted(subgraph_nodes, key=relevance, reverse=True)
    lines = [f"START: {[G.nodes[n].get('label', n) for n in start_nodes]}"]
    lines.append(f"NODES: {len(subgraph_nodes)}")
    lines.append(f"EDGES: {len(subgraph_edges)}")
    lines.append("---")
    for nid in ranked:
        d = G.nodes[nid]
        lines.append(f"NODE {d.get('label', nid)} [src={d.get('source_file', '')}]")
    for u, v in subgraph_edges:
        if u in subgraph_nodes and v in subgraph_nodes:
            d = G.edges[u, v]
            lines.append(
                f"EDGE {G.nodes[u].get('label', u)} --{d.get('relation', '')} "
                f"[{d.get('confidence', '')}]--> {G.nodes[v].get('label', v)}"
            )

    output = "\n".join(lines)
    char_budget = budget * 4
    if len(output) > char_budget:
        output = output[:char_budget] + f"\n... (truncated at ~{budget} tokens)"
    print(output)


def action_trace(G, target, target_b):
    if not target_b:
        print("NO_TARGET_B")
        return

    def find_node(term):
        term_lower = term.lower()
        scored = sorted(
            [
                (sum(1 for w in term_lower.split() if w in G.nodes[n].get("label", "").lower()), n)
                for n in G.nodes()
            ],
            reverse=True,
        )
        return scored[0][1] if scored and scored[0][0] > 0 else None

    src = find_node(target)
    tgt = find_node(target_b)

    if not src or not tgt:
        missing = target if not src else target_b
        print(f"NO_MATCH:{missing}")
        return

    try:
        path = nx.shortest_path(G, src, tgt)
        lines = [f"PATH_LENGTH:{len(path) - 1}"]
        lines.append(f"SRC:{G.nodes[src].get('label', src)}")
        lines.append(f"TGT:{G.nodes[tgt].get('label', tgt)}")
        lines.append("---")
        for i, nid in enumerate(path):
            label = G.nodes[nid].get("label", nid)
            src_file = G.nodes[nid].get("source_file", "")
            if i < len(path) - 1:
                edge = G.edges[nid, path[i + 1]]
                rel = edge.get("relation", "")
                conf = edge.get("confidence", "")
                next_label = G.nodes[path[i + 1]].get("label", path[i + 1])
                lines.append(f"{label} [{src_file}] --{rel}--> [{conf}] {next_label}")
            else:
                lines.append(f"{label} [{src_file}]")
        print("\n".join(lines))
    except nx.NetworkXNoPath:
        print("NO_PATH")


def action_verify(G, target, budget):
    start_nodes = find_nodes(G, target)
    if not start_nodes:
        print("NO_MATCH")
        return

    subgraph_nodes = set(start_nodes)
    subgraph_edges = []
    frontier = set(start_nodes)
    for _ in range(2):
        next_frontier = set()
        for n in frontier:
            for neighbor in G.neighbors(n):
                if neighbor not in subgraph_nodes:
                    next_frontier.add(neighbor)
                    subgraph_edges.append((n, neighbor))
        subgraph_nodes.update(next_frontier)
        frontier = next_frontier

    def relevance(nid):
        label = G.nodes[nid].get("label", "").lower()
        return sum(1 for t in target.lower().split() if t in label)

    ranked = sorted(subgraph_nodes, key=relevance, reverse=True)
    lines = [f"MATCHED: {len(start_nodes)} start nodes"]
    lines.append(f"TOTAL_NODES: {len(subgraph_nodes)}")
    lines.append("---")
    for nid in ranked:
        d = G.nodes[nid]
        lines.append(f"NODE {d.get('label', nid)} [src={d.get('source_file', '')}]")
    for u, v in subgraph_edges:
        if u in subgraph_nodes and v in subgraph_nodes:
            d = G.edges[u, v]
            lines.append(
                f"EDGE {G.nodes[u].get('label', u)} --{d.get('relation', '')}--> {G.nodes[v].get('label', v)}"
            )

    output = "\n".join(lines)
    char_budget = budget * 4
    if len(output) > char_budget:
        output = output[:char_budget] + f"\n... (truncated at ~{budget} tokens)"
    print(output)


if __name__ == "__main__":
    main()
