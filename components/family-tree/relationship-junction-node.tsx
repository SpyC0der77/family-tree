"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { RelationshipJunctionNodeType } from "@/types/family-tree";
import { HANDLE_JUNCTION_OUT } from "@/types/family-tree";

export function RelationshipJunctionNode({}: NodeProps<RelationshipJunctionNodeType>) {
  return (
    <div
      className="flex size-3 items-center justify-center"
      aria-hidden
    >
      <Handle
        id={HANDLE_JUNCTION_OUT}
        type="source"
        position={Position.Bottom}
        className="!size-2 !opacity-0"
      />
    </div>
  );
}
