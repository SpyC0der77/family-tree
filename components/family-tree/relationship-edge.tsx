"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  cubicMidpoint,
  cubicToPathD,
  getRelationshipBezierPoints,
  RELATIONSHIP_GAP_T_HIGH,
  RELATIONSHIP_GAP_T_LOW,
  splitCubicAt,
} from "@/lib/marriage-geometry";
import { useFamilyTreeStore } from "@/lib/family-tree-store";

const MIN_DRAG_PX = 28;
const DRAG_HINT_PX = 6;

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const bez = useMemo(
    () =>
      getRelationshipBezierPoints({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      }),
    [
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    ],
  );

  const { path1, path2, labelX, labelY } = useMemo(() => {
    const { p0, p1, p2, p3 } = bez;
    const { left: seg1 } = splitCubicAt(p0, p1, p2, p3, RELATIONSHIP_GAP_T_LOW);
    const { right: seg2 } = splitCubicAt(
      p0,
      p1,
      p2,
      p3,
      RELATIONSHIP_GAP_T_HIGH,
    );
    const mid = cubicMidpoint(p0, p1, p2, p3);
    return {
      path1: cubicToPathD(seg1[0], seg1[1], seg1[2], seg1[3]),
      path2: cubicToPathD(seg2[0], seg2[1], seg2[2], seg2[3]),
      labelX: mid.x,
      labelY: mid.y,
    };
  }, [bez]);

  const { screenToFlowPosition } = useReactFlow();
  const addChildFromRelationship = useFamilyTreeStore(
    (s) => s.addChildFromRelationship,
  );

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setIsDragging(false);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const start = dragStartRef.current;
      if (!start || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (dist > DRAG_HINT_PX) setIsDragging(true);
    },
    [],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      setIsDragging(false);
      if (start && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (!start) return;
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (dist < MIN_DRAG_PX) {
        addChildFromRelationship(id);
        return;
      }
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addChildFromRelationship(id, flow);
    },
    [addChildFromRelationship, id, screenToFlowPosition],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      dragStartRef.current = null;
      setIsDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  return (
    <>
      <BaseEdge
        id={`${id}-a`}
        path={path1}
        style={{
          ...style,
          strokeWidth: 2.5,
          stroke: "var(--color-muted-foreground)",
        }}
      />
      <BaseEdge
        id={`${id}-b`}
        path={path2}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2.5,
          stroke: "var(--color-muted-foreground)",
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <button
            type="button"
            title="Click to add a child in a free spot, or drag to place on the canvas"
            className={cn(
              "flex size-5 touch-none items-center justify-center rounded-full border border-background shadow-sm ring-1 transition-[transform,box-shadow,colors,ring-color] duration-150",
              isDragging
                ? "z-50 scale-125 cursor-grabbing bg-primary text-primary-foreground shadow-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "cursor-grab bg-card text-muted-foreground ring-border hover:bg-accent hover:text-accent-foreground active:cursor-grabbing",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <Plus
              className={cn("size-2.5 transition-transform", isDragging && "scale-110")}
              aria-hidden
            />
            <span className="sr-only">
              Add child from this relationship: click for automatic placement,
              or drag to choose a position
            </span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
