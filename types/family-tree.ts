import type { Edge, Node } from "@xyflow/react";

export type Gender = "male" | "female" | "other";

const GENDER_ORDER: readonly Gender[] = ["male", "female", "other"];

export function nextGender(current: Gender): Gender {
  const i = GENDER_ORDER.indexOf(current);
  const next = (i + 1) % GENDER_ORDER.length;
  return GENDER_ORDER[next] ?? "male";
}

export interface PersonData extends Record<string, unknown> {
  name: string;
  gender: Gender;
}

export type PersonNodeType = Node<PersonData, "person">;

export interface MarriageJunctionData extends Record<string, unknown> {
  marriageEdgeId: string;
}

export type MarriageJunctionNodeType = Node<
  MarriageJunctionData,
  "marriageJunction"
>;

export type FamilyTreeNodeType = PersonNodeType | MarriageJunctionNodeType;

export interface MarriageEdgeData extends Record<string, unknown> {
  junctionId: string;
}

export type MarriageEdgeType = Edge<MarriageEdgeData, "marriage">;

export type ChildEdgeType = Edge<Record<string, never>, "child">;

export type FamilyTreeEdgeType = MarriageEdgeType | ChildEdgeType;

export const GENDER_BORDER: Record<Gender, string> = {
  male: "#3b82f6",
  female: "#ec4899",
  other: "#f97316",
};

export const HANDLE_MARRIAGE_IN = "marriage-in";
export const HANDLE_MARRIAGE_OUT = "marriage-out";
export const HANDLE_CHILD_TARGET = "child-target";
export const HANDLE_JUNCTION_OUT = "junction-out";

/** CSS selector for the person-node grip; must match `dragHandle` on person nodes. */
export const PERSON_NODE_DRAG_HANDLE_SELECTOR = ".person-node-drag-handle";
