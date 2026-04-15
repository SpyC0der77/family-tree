"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";

import {
  cubicMidpoint,
  cubicToPathD,
  getMarriageBezierPoints,
  MARRIAGE_GAP_T_HIGH,
  MARRIAGE_GAP_T_LOW,
  splitCubicAt,
} from "@/lib/marriage-geometry";
import { useFamilyTreeStore } from "@/lib/family-tree-store";

const MIN_DRAG_PX = 28;

export function MarriageEdge({
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
      getMarriageBezierPoints({
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
    const { left: seg1 } = splitCubicAt(p0, p1, p2, p3, MARRIAGE_GAP_T_LOW);
    const { right: seg2 } = splitCubicAt(p0, p1, p2, p3, MARRIAGE_GAP_T_HIGH);
    const mid = cubicMidpoint(p0, p1, p2, p3);
    return {
      path1: cubicToPathD(seg1[0], seg1[1], seg1[2], seg1[3]),
      path2: cubicToPathD(seg2[0], seg2[1], seg2[2], seg2[3]),
      labelX: mid.x,
      labelY: mid.y,
    };
  }, [bez]);

  const { screenToFlowPosition } = useReactFlow();
  const addChildFromMarriage = useFamilyTreeStore(
    (s) => s.addChildFromMarriage,
  );

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (start && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (!start) return;
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (dist < MIN_DRAG_PX) return;
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addChildFromMarriage(id, flow);
    },
    [addChildFromMarriage, id, screenToFlowPosition],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      dragStartRef.current = null;
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
            title="Drag to place a child"
            className="flex size-5 cursor-grab items-center justify-center rounded-full border border-background bg-card text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <Plus className="size-2.5" aria-hidden />
            <span className="sr-only">Drag to add child</span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
