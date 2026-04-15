import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeRemoveChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { generateRandomPersonName } from "@/lib/family-tree-names";
import { junctionPositionFromSpouses } from "@/lib/marriage-geometry";
import type {
  FamilyTreeNodeType,
  MarriageEdgeData,
  MarriageJunctionNodeType,
  PersonData,
  PersonNodeType,
} from "@/types/family-tree";
import {
  HANDLE_CHILD_TARGET,
  HANDLE_JUNCTION_OUT,
  HANDLE_MARRIAGE_IN,
  HANDLE_MARRIAGE_OUT,
  PERSON_NODE_DRAG_HANDLE_SELECTOR,
} from "@/types/family-tree";

function jitterPosition(position: XYPosition): XYPosition {
  return {
    x: position.x + (Math.random() - 0.5) * 80,
    y: position.y + (Math.random() - 0.5) * 80,
  };
}

function hasMarriageBetween(
  edges: Edge[],
  a: string,
  b: string,
): boolean {
  return edges.some(
    (e) =>
      e.type === "marriage" &&
      ((e.source === a && e.target === b) ||
        (e.source === b && e.target === a)),
  );
}

function syncJunctionPositions(
  nodes: FamilyTreeNodeType[],
  edges: Edge[],
): FamilyTreeNodeType[] {
  const marriages = edges.filter((e) => e.type === "marriage");
  return nodes.map((n) => {
    if (n.type !== "marriageJunction") return n;
    const m = marriages.find((e) => e.id === n.data.marriageEdgeId);
    if (!m) return n;
    const na = nodes.find(
      (x) => x.id === m.source && x.type === "person",
    ) as PersonNodeType | undefined;
    const nb = nodes.find(
      (x) => x.id === m.target && x.type === "person",
    ) as PersonNodeType | undefined;
    if (!na || !nb) return n;
    return {
      ...n,
      position: junctionPositionFromSpouses(na, nb),
    };
  });
}

interface FamilyTreeState {
  nodes: FamilyTreeNodeType[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<FamilyTreeNodeType>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addPersonAtPosition: (position: XYPosition) => void;
  addChildFromMarriage: (marriageEdgeId: string, position: XYPosition) => void;
  updatePersonData: (nodeId: string, patch: Partial<PersonData>) => void;
  migrateMarriageJunctionsIfNeeded: () => void;
}

export const useFamilyTreeStore = create<FamilyTreeState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],

      migrateMarriageJunctionsIfNeeded: () => {
        const { nodes, edges } = get();
        let nextNodes = [...nodes];
        let nextEdges = edges.map((e) => ({
          ...e,
          data: e.data ? { ...(e.data as object) } : {},
        }));
        let changed = false;

        for (let i = 0; i < nextEdges.length; i++) {
          const e = nextEdges[i];
          if (e.type !== "marriage") continue;
          const data = (e.data ?? {}) as MarriageEdgeData;
          let junctionId = data.junctionId;
          const hasJunctionNode =
            junctionId &&
            nextNodes.some(
              (n) => n.id === junctionId && n.type === "marriageJunction",
            );
          if (hasJunctionNode) continue;

          junctionId = crypto.randomUUID();
          const na = nextNodes.find(
            (n) => n.id === e.source && n.type === "person",
          ) as PersonNodeType | undefined;
          const nb = nextNodes.find(
            (n) => n.id === e.target && n.type === "person",
          ) as PersonNodeType | undefined;
          if (!na || !nb) continue;

          nextNodes.push({
            id: junctionId,
            type: "marriageJunction",
            position: junctionPositionFromSpouses(na, nb),
            data: { marriageEdgeId: e.id },
            draggable: false,
            selectable: false,
          });
          nextEdges[i] = {
            ...e,
            data: { ...data, junctionId },
          };
          changed = true;
        }

        const marriages = nextEdges.filter((e) => e.type === "marriage");
        for (const m of marriages) {
          const jid = (m.data as MarriageEdgeData).junctionId;
          if (!jid) continue;
          const A = m.source;
          const B = m.target;
          const targetsFromA = new Set(
            nextEdges
              .filter((e) => e.type === "child" && e.source === A)
              .map((e) => e.target),
          );
          const targetsFromB = new Set(
            nextEdges
              .filter((e) => e.type === "child" && e.source === B)
              .map((e) => e.target),
          );
          for (const childId of targetsFromA) {
            if (!targetsFromB.has(childId)) continue;
            const hasJ = nextEdges.some(
              (e) =>
                e.type === "child" &&
                e.source === jid &&
                e.target === childId,
            );
            if (hasJ) {
              const before = nextEdges.length;
              nextEdges = nextEdges.filter(
                (e) =>
                  !(
                    e.type === "child" &&
                    (e.source === A || e.source === B) &&
                    e.target === childId
                  ),
              );
              if (nextEdges.length !== before) changed = true;
              continue;
            }
            nextEdges = nextEdges.filter(
              (e) =>
                !(
                  e.type === "child" &&
                  (e.source === A || e.source === B) &&
                  e.target === childId
                ),
            );
            nextEdges.push({
              id: crypto.randomUUID(),
              type: "child",
              source: jid,
              target: childId,
              sourceHandle: HANDLE_JUNCTION_OUT,
              targetHandle: HANDLE_CHILD_TARGET,
              data: {},
            });
            changed = true;
          }
        }

        nextNodes = nextNodes.map((n) => {
          if (n.type !== "person") return n;
          if (n.dragHandle === PERSON_NODE_DRAG_HANDLE_SELECTOR) return n;
          changed = true;
          return { ...n, dragHandle: PERSON_NODE_DRAG_HANDLE_SELECTOR };
        });

        if (changed) {
          nextNodes = syncJunctionPositions(nextNodes, nextEdges);
          set({ nodes: nextNodes, edges: nextEdges });
        }
      },

      onNodesChange: (changes) => {
        const nodes = syncJunctionPositions(
          applyNodeChanges(changes, get().nodes),
          get().edges,
        );
        set({ nodes });
      },

      onEdgesChange: (changes) => {
        const prevEdges = get().edges;
        let edges = applyEdgeChanges(changes, prevEdges);
        let nodes = get().nodes;

        const removed = changes.filter(
          (c): c is EdgeRemoveChange => c.type === "remove",
        );
        if (removed.length > 0) {
          const junctionIdsToRemove = new Set<string>();
          for (const c of removed) {
            const gone = prevEdges.find((e) => e.id === c.id);
            if (gone?.type === "marriage") {
              const jid = (gone.data as MarriageEdgeData | undefined)
                ?.junctionId;
              if (jid) junctionIdsToRemove.add(jid);
            }
          }
          if (junctionIdsToRemove.size > 0) {
            nodes = nodes.filter(
              (n) =>
                n.type !== "marriageJunction" ||
                !junctionIdsToRemove.has(n.id),
            );
            edges = edges.filter(
              (e) =>
                !(
                  e.type === "child" &&
                  junctionIdsToRemove.has(e.source)
                ),
            );
          }
        }

        set({ edges, nodes });
      },

      onConnect: (connection) => {
        const { source, target, sourceHandle, targetHandle } = connection;
        if (!source || !target) return;
        if (source === target) return;
        if (
          sourceHandle !== HANDLE_MARRIAGE_OUT ||
          targetHandle !== HANDLE_MARRIAGE_IN
        ) {
          return;
        }

        const { edges, nodes } = get();
        if (hasMarriageBetween(edges, source, target)) return;

        const na = nodes.find(
          (n) => n.id === source && n.type === "person",
        ) as PersonNodeType | undefined;
        const nb = nodes.find(
          (n) => n.id === target && n.type === "person",
        ) as PersonNodeType | undefined;
        if (!na || !nb) return;

        const marriageId = crypto.randomUUID();
        const junctionId = crypto.randomUUID();

        const junctionNode: MarriageJunctionNodeType = {
          id: junctionId,
          type: "marriageJunction",
          position: junctionPositionFromSpouses(na, nb),
          data: { marriageEdgeId: marriageId },
          draggable: false,
          selectable: false,
        };

        set({
          nodes: [...nodes, junctionNode],
          edges: addEdge(
            {
              ...connection,
              id: marriageId,
              type: "marriage",
              data: { junctionId },
            },
            edges,
          ),
        });
      },

      addPersonAtPosition: (position) => {
        const id = crypto.randomUUID();
        const node: PersonNodeType = {
          id,
          type: "person",
          position: jitterPosition(position),
          dragHandle: PERSON_NODE_DRAG_HANDLE_SELECTOR,
          data: {
            name: generateRandomPersonName(),
            gender: "male",
          },
        };
        set({ nodes: [...get().nodes, node] });
      },

      addChildFromMarriage: (marriageEdgeId, position) => {
        const { edges, nodes } = get();
        const marriage = edges.find(
          (e) => e.id === marriageEdgeId && e.type === "marriage",
        );
        if (!marriage) return;

        const junctionId = (marriage.data as MarriageEdgeData | undefined)
          ?.junctionId;
        if (!junctionId) return;

        const childId = crypto.randomUUID();

        const childNode: PersonNodeType = {
          id: childId,
          type: "person",
          position: jitterPosition(position),
          dragHandle: PERSON_NODE_DRAG_HANDLE_SELECTOR,
          data: {
            name: generateRandomPersonName(),
            gender: "male",
          },
        };

        set({
          nodes: [...nodes, childNode],
          edges: [
            ...edges,
            {
              id: crypto.randomUUID(),
              type: "child",
              source: junctionId,
              target: childId,
              sourceHandle: HANDLE_JUNCTION_OUT,
              targetHandle: HANDLE_CHILD_TARGET,
              data: {},
            },
          ],
        });
      },

      updatePersonData: (nodeId, patch) => {
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== nodeId || n.type !== "person") return n;
            return {
              ...n,
              data: {
                name: patch.name ?? n.data.name,
                gender: patch.gender ?? n.data.gender,
              },
            };
          }),
        });
      },
    }),
    {
      name: "family-tree-whiteboard",
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
      skipHydration: true,
    },
  ),
);
