import { Position } from "@xyflow/react";

import type { PersonNodeType } from "@/types/family-tree";

const DEFAULT_NODE_SIZE = 80;

function calculateControlOffset(distance: number, curvature: number): number {
  if (distance >= 0) return 0.5 * distance;
  return curvature * 25 * Math.sqrt(-distance);
}

function getControlWithCurvature({
  pos,
  x1,
  y1,
  x2,
  y2,
  c,
}: {
  pos: Position;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  c: number;
}): [number, number] {
  switch (pos) {
    case Position.Left:
      return [x1 - calculateControlOffset(x1 - x2, c), y1];
    case Position.Right:
      return [x1 + calculateControlOffset(x2 - x1, c), y1];
    case Position.Top:
      return [x1, y1 - calculateControlOffset(y1 - y2, c)];
    case Position.Bottom:
      return [x1, y1 + calculateControlOffset(y2 - y1, c)];
  }
}

export interface BezierPoints {
  p0: { x: number; y: number };
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  p3: { x: number; y: number };
}

export function getMarriageBezierPoints(params: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  curvature?: number;
}): BezierPoints {
  const c = params.curvature ?? 0.25;
  const [sourceControlX, sourceControlY] = getControlWithCurvature({
    pos: params.sourcePosition,
    x1: params.sourceX,
    y1: params.sourceY,
    x2: params.targetX,
    y2: params.targetY,
    c,
  });
  const [targetControlX, targetControlY] = getControlWithCurvature({
    pos: params.targetPosition,
    x1: params.targetX,
    y1: params.targetY,
    x2: params.sourceX,
    y2: params.sourceY,
    c,
  });
  return {
    p0: { x: params.sourceX, y: params.sourceY },
    p1: { x: sourceControlX, y: sourceControlY },
    p2: { x: targetControlX, y: targetControlY },
    p3: { x: params.targetX, y: params.targetY },
  };
}

function lerpPt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/** Split cubic Bézier at t; left is [0,t], right is [t,1]. */
export function splitCubicAt(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): {
  left: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  right: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
} {
  const p01 = lerpPt(p0, p1, t);
  const p12 = lerpPt(p1, p2, t);
  const p23 = lerpPt(p2, p3, t);
  const p012 = lerpPt(p01, p12, t);
  const p123 = lerpPt(p12, p23, t);
  const p0123 = lerpPt(p012, p123, t);
  return {
    left: [p0, p01, p012, p0123],
    right: [p0123, p123, p23, p3],
  };
}

export function cubicToPathD(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): string {
  return `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
}

/** t=0.5 point on cubic (matches xyflow label center approximation). */
export function cubicMidpoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): { x: number; y: number } {
  return {
    x:
      p0.x * 0.125 +
      p1.x * 0.375 +
      p2.x * 0.375 +
      p3.x * 0.125,
    y:
      p0.y * 0.125 +
      p1.y * 0.375 +
      p2.y * 0.375 +
      p3.y * 0.125,
  };
}

const JUNCTION_NODE = 12;

export function junctionPositionFromSpouses(
  na: PersonNodeType,
  nb: PersonNodeType,
): { x: number; y: number } {
  const wa = na.measured?.width ?? DEFAULT_NODE_SIZE;
  const ha = na.measured?.height ?? DEFAULT_NODE_SIZE;
  const wb = nb.measured?.width ?? DEFAULT_NODE_SIZE;
  const hb = nb.measured?.height ?? DEFAULT_NODE_SIZE;
  const cax = na.position.x + wa / 2;
  const cay = na.position.y + ha / 2;
  const cbx = nb.position.x + wb / 2;
  const cby = nb.position.y + hb / 2;
  const half = JUNCTION_NODE / 2;
  return {
    x: (cax + cbx) / 2 - half,
    y: (cay + cby) / 2 - half,
  };
}

export const MARRIAGE_GAP_T_LOW = 0.42;
export const MARRIAGE_GAP_T_HIGH = 0.58;
