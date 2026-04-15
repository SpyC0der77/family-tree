"use client";

import { useReactFlow } from "@xyflow/react";
import { Download, UserPlus } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { downloadFamilyTreePng } from "@/lib/family-tree-utils";
import { useFamilyTreeStore } from "@/lib/family-tree-store";

interface FamilyTreeTopbarProps {
  flowContainerRef: RefObject<HTMLDivElement | null>;
}

export function FamilyTreeTopbar({ flowContainerRef }: FamilyTreeTopbarProps) {
  const { screenToFlowPosition } = useReactFlow();
  const addPersonAtPosition = useFamilyTreeStore((s) => s.addPersonAtPosition);

  function handleAddPerson() {
    const el = flowContainerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    addPersonAtPosition(
      screenToFlowPosition({
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      }),
    );
  }

  async function handleDownload() {
    const vp = flowContainerRef.current?.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;
    if (!vp) return;
    try {
      await downloadFamilyTreePng(vp);
    } catch {
      // html-to-image can fail on some GPUs/fonts; fail silently in UI
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <span className="mr-2 text-sm font-semibold text-foreground">
        Family tree
      </span>
      <Button type="button" size="sm" onClick={handleAddPerson}>
        <UserPlus data-icon="inline-start" />
        Add person
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void handleDownload()}
      >
        <Download data-icon="inline-start" />
        Download
      </Button>
    </header>
  );
}
