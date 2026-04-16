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
  PersonData,
  PersonNodeType,
  RelationshipEdgeData,
  RelationshipJunctionNodeType,
} from "@/types/family-tree";
import {
  HANDLE_CHILD_TARGET,
  HANDLE_JUNCTION_OUT,
  HANDLE_RELATIONSHIP_IN,
  HANDLE_RELATIONSHIP_OUT,
  PERSON_NODE_DRAG_HANDLE_SELECTOR,
} from "@/types/family-tree";

function jitterPosition(position: XYPosition): XYPosition {
  return {
    x: position.x + (Math.random() - 0.5) * 80,
    y: position.y + (Math.random() - 0.5) * 80,
  };
}

const PERSON_PLACEHOLDER_W = 88;
const PERSON_PLACEHOLDER_H = 108;
const CHILD_GRID_PAD = 14;

function personNodeRect(n: PersonNodeType) {
  const w = n.measured?.width ?? 80;
  const h = n.measured?.height ?? 96;
  return {
    left: n.position.x,
    top: n.position.y,
    right: n.position.x + w,
    bottom: n.position.y + h,
  };
}

function rectMarginOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
  margin: number,
) {
  return !(
    a.right + margin < b.left ||
    a.left - margin > b.right ||
    a.bottom + margin < b.top ||
    a.top - margin > b.bottom
  );
}

function findFreeChildPositionBelowJunction(
  nodes: FamilyTreeNodeType[],
  junctionId: string,
): XYPosition {
  const junction = nodes.find(
    (n) => n.id === junctionId && n.type === "relationshipJunction",
  );
  if (!junction) return { x: 0, y: 0 };

  const jw = junction.measured?.width ?? 12;
  const jh = junction.measured?.height ?? 12;
  const anchorX = junction.position.x + jw / 2 - PERSON_PLACEHOLDER_W / 2;
  const anchorY = junction.position.y + jh + 28;

  const people = nodes.filter((n) => n.type === "person") as PersonNodeType[];

  for (let row = 0; row < 14; row++) {
    for (let col = -5; col <= 5; col++) {
      const x = anchorX + col * (PERSON_PLACEHOLDER_W + CHILD_GRID_PAD);
      const y = anchorY + row * (PERSON_PLACEHOLDER_H + CHILD_GRID_PAD);
      const probe = {
        left: x,
        top: y,
        right: x + PERSON_PLACEHOLDER_W,
        bottom: y + PERSON_PLACEHOLDER_H,
      };
      const hit = people.some((p) =>
        rectMarginOverlap(probe, personNodeRect(p), 6),
      );
      if (!hit) return { x, y };
    }
  }

  return {
    x: anchorX + (Math.random() - 0.5) * 120,
    y: anchorY + (Math.random() - 0.5) * 120,
  };
}

function hasRelationshipBetween(
  edges: Edge[],
  a: string,
  b: string,
): boolean {
  return edges.some(
    (e) =>
      e.type === "relationship" &&
      ((e.source === a && e.target === b) ||
        (e.source === b && e.target === a)),
  );
}

function syncJunctionPositions(
  nodes: FamilyTreeNodeType[],
  edges: Edge[],
): FamilyTreeNodeType[] {
  const relationships = edges.filter((e) => e.type === "relationship");
  return nodes.map((n) => {
    if (n.type !== "relationshipJunction") return n;
    const m = relationships.find((e) => e.id === n.data.relationshipEdgeId);
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

/** Maps graphs persisted before the marriage → relationship rename. */
function normalizePersistedRelationshipModel(
  nodes: FamilyTreeNodeType[],
  edges: Edge[],
): { nodes: FamilyTreeNodeType[]; edges: Edge[]; changed: boolean } {
  let changed = false;

  const nextEdges = edges.map((e) => {
    if (e.type === "marriage") {
      changed = true;
      return { ...e, type: "relationship" as const };
    }
    return e;
  });

  const nextNodes = nodes.map((n) => {
    const legacyType = (n as { type: string }).type;
    if (legacyType === "marriageJunction") {
      changed = true;
      const d = n.data as Record<string, unknown>;
      const rid = d.relationshipEdgeId ?? d.marriageEdgeId;
      return {
        ...n,
        type: "relationshipJunction" as const,
        data: { relationshipEdgeId: String(rid) },
      };
    }
    if (n.type === "relationshipJunction") {
      const d = n.data as Record<string, unknown>;
      if (d.marriageEdgeId != null && d.relationshipEdgeId == null) {
        changed = true;
        return {
          ...n,
          data: { relationshipEdgeId: String(d.marriageEdgeId) },
        };
      }
    }
    return n;
  });

  return { nodes: nextNodes, edges: nextEdges, changed };
}

interface FamilyTreeState {
  nodes: FamilyTreeNodeType[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<FamilyTreeNodeType>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addPersonAtPosition: (position: XYPosition) => void;
  addChildFromRelationship: (
    relationshipEdgeId: string,
    position?: XYPosition,
  ) => void;
  updatePersonData: (nodeId: string, patch: Partial<PersonData>) => void;
  migrateRelationshipGraphIfNeeded: () => void;
}

export const useFamilyTreeStore = create<FamilyTreeState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],

      migrateRelationshipGraphIfNeeded: () => {
        const { nodes, edges } = get();
        const normalized = normalizePersistedRelationshipModel(nodes, edges);
        let nextNodes = [...normalized.nodes];
        let nextEdges = normalized.edges.map((e) => ({
          ...e,
          data: e.data ? { ...(e.data as object) } : {},
        }));
        let changed = normalized.changed;

        for (let i = 0; i < nextEdges.length; i++) {
          const e = nextEdges[i];
          if (e.type !== "relationship") continue;
          const data = (e.data ?? {}) as RelationshipEdgeData;
          let junctionId = data.junctionId;
          const hasJunctionNode =
            junctionId &&
            nextNodes.some(
              (n) => n.id === junctionId && n.type === "relationshipJunction",
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
            type: "relationshipJunction",
            position: junctionPositionFromSpouses(na, nb),
            data: { relationshipEdgeId: e.id },
            draggable: false,
            selectable: false,
          });
          nextEdges[i] = {
            ...e,
            data: { ...data, junctionId },
          };
          changed = true;
        }

        const relationships = nextEdges.filter((e) => e.type === "relationship");
        for (const m of relationships) {
          const jid = (m.data as RelationshipEdgeData).junctionId;
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
            if (gone?.type === "relationship") {
              const jid = (gone.data as RelationshipEdgeData | undefined)
                ?.junctionId;
              if (jid) junctionIdsToRemove.add(jid);
            }
          }
          if (junctionIdsToRemove.size > 0) {
            nodes = nodes.filter(
              (n) =>
                n.type !== "relationshipJunction" ||
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
          sourceHandle !== HANDLE_RELATIONSHIP_OUT ||
          targetHandle !== HANDLE_RELATIONSHIP_IN
        ) {
          return;
        }

        const { edges, nodes } = get();
        if (hasRelationshipBetween(edges, source, target)) return;

        const na = nodes.find(
          (n) => n.id === source && n.type === "person",
        ) as PersonNodeType | undefined;
        const nb = nodes.find(
          (n) => n.id === target && n.type === "person",
        ) as PersonNodeType | undefined;
        if (!na || !nb) return;

        const relationshipId = crypto.randomUUID();
        const junctionId = crypto.randomUUID();

        const junctionNode: RelationshipJunctionNodeType = {
          id: junctionId,
          type: "relationshipJunction",
          position: junctionPositionFromSpouses(na, nb),
          data: { relationshipEdgeId: relationshipId },
          draggable: false,
          selectable: false,
        };

        set({
          nodes: [...nodes, junctionNode],
          edges: addEdge(
            {
              ...connection,
              id: relationshipId,
              type: "relationship",
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

      addChildFromRelationship: (relationshipEdgeId, position) => {
        const { edges, nodes } = get();
        const relationship = edges.find(
          (e) => e.id === relationshipEdgeId && e.type === "relationship",
        );
        if (!relationship) return;

        const junctionId = (relationship.data as RelationshipEdgeData | undefined)
          ?.junctionId;
        if (!junctionId) return;

        const resolvedPosition =
          position === undefined
            ? findFreeChildPositionBelowJunction(nodes, junctionId)
            : jitterPosition(position);

        const childId = crypto.randomUUID();

        const childNode: PersonNodeType = {
          id: childId,
          type: "person",
          position: resolvedPosition,
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
