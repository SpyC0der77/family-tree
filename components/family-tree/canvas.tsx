"use client";

import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useFamilyTreeStore } from "@/lib/family-tree-store";
import {
  HANDLE_RELATIONSHIP_IN,
  HANDLE_RELATIONSHIP_OUT,
  type FamilyTreeNodeType,
} from "@/types/family-tree";

import { ChildEdge } from "./child-edge";
import { PersonNode } from "./person-node";
import { RelationshipEdge } from "./relationship-edge";
import { RelationshipJunctionNode } from "./relationship-junction-node";
import { FamilyTreeTopbar } from "./topbar";

const nodeTypes = {
  person: PersonNode,
  relationshipJunction: RelationshipJunctionNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
  child: ChildEdge,
};

function FamilyTreeFlow() {
  const flowContainerRef = useRef<HTMLDivElement | null>(null);

  const nodes = useFamilyTreeStore((s) => s.nodes);
  const edges = useFamilyTreeStore((s) => s.edges);
  const onNodesChange = useFamilyTreeStore((s) => s.onNodesChange);
  const onEdgesChange = useFamilyTreeStore((s) => s.onEdgesChange);
  const onConnect = useFamilyTreeStore((s) => s.onConnect);

  useEffect(() => {
    void Promise.resolve(useFamilyTreeStore.persist.rehydrate()).then(() => {
      useFamilyTreeStore.getState().migrateRelationshipGraphIfNeeded();
    });
  }, []);

  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target || c.source === c.target) return false;
    const sourceHandle = c.sourceHandle ?? null;
    const targetHandle = c.targetHandle ?? null;
    return (
      sourceHandle === HANDLE_RELATIONSHIP_OUT &&
      targetHandle === HANDLE_RELATIONSHIP_IN
    );
  }, []);

  const defaultEdgeOptions = useMemo(
    () => ({ zIndex: 1000 }),
    [],
  );

  return (
    <div className="flex h-svh w-full flex-col">
      <FamilyTreeTopbar flowContainerRef={flowContainerRef} />
      <div
        ref={flowContainerRef}
        className="relative min-h-0 flex-1 bg-background"
      >
        <ReactFlow<FamilyTreeNodeType, Edge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          isValidConnection={isValidConnection}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="h-full w-full"
        >
          <Background gap={20} size={1} color="var(--color-border)" />
          <Controls className="m-3!" />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FamilyTreeCanvas() {
  return (
    <ReactFlowProvider>
      <FamilyTreeFlow />
    </ReactFlowProvider>
  );
}
