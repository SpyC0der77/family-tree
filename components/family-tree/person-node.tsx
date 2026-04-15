"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GripHorizontal } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useFamilyTreeStore } from "@/lib/family-tree-store";
import type { PersonNodeType } from "@/types/family-tree";
import {
  GENDER_BORDER,
  HANDLE_CHILD_TARGET,
  HANDLE_MARRIAGE_IN,
  HANDLE_MARRIAGE_OUT,
  nextGender,
} from "@/types/family-tree";

export function PersonNode({ id, data }: NodeProps<PersonNodeType>) {
  const updatePersonData = useFamilyTreeStore((s) => s.updatePersonData);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(data.name);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (!editingName || !textareaRef.current) return;
    const el = textareaRef.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editingName]);

  const commitName = useCallback(() => {
    const next = nameDraft.trim() || "Unnamed";
    setNameDraft(next);
    updatePersonData(id, { name: next });
    setEditingName(false);
  }, [id, nameDraft, updatePersonData]);

  const cancelNameEdit = useCallback(() => {
    setNameDraft(data.name);
    setEditingName(false);
  }, [data.name]);

  const ringColor = GENDER_BORDER[data.gender];

  const onRingClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      e.stopPropagation();
      updatePersonData(id, { gender: nextGender(data.gender) });
    },
    [data.gender, id, updatePersonData],
  );

  const onRingKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        updatePersonData(id, { gender: nextGender(data.gender) });
      }
    },
    [data.gender, id, updatePersonData],
  );

  const startNameEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setNameDraft(data.name);
      setEditingName(true);
    },
    [data.name],
  );

  return (
    <div className="relative flex flex-col items-center pb-2">
      <Handle
        id={HANDLE_CHILD_TARGET}
        type="target"
        position={Position.Top}
        className="!size-2.5 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="relative flex items-center">
        <Handle
          id={HANDLE_MARRIAGE_IN}
          type="target"
          position={Position.Left}
          className="!top-1/2 !left-0 !size-2.5 !-translate-y-1/2 !border-2 !border-background !bg-muted-foreground"
        />
        <div
          role="button"
          tabIndex={0}
          title="Click the colored ring to change gender"
          className={cn(
            "nodrag flex size-20 shrink-0 cursor-pointer rounded-full p-1 shadow-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
          style={{ backgroundColor: ringColor }}
          onClick={onRingClick}
          onKeyDown={onRingKeyDown}
        >
          {editingName ? (
            <div className="nodrag flex h-full w-full min-h-0 min-w-0 cursor-text items-center justify-center rounded-full bg-card px-1.5 py-1">
              <textarea
                ref={textareaRef}
                spellCheck={false}
                className="field-sizing-content max-h-full min-h-0 w-full min-w-0 cursor-text resize-none overflow-y-auto border-0 bg-transparent px-0 py-0 text-center text-[10px] leading-tight font-medium break-words whitespace-pre-wrap text-foreground outline-none ring-0 focus-visible:ring-0"
                aria-label="Name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitName();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelNameEdit();
                  }
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              title="Click to edit name"
              className="nodrag flex h-full w-full min-h-0 min-w-0 cursor-text items-center justify-center rounded-full bg-card px-1.5 py-1 text-center"
              onClick={startNameEdit}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="line-clamp-3 max-h-full min-w-0 break-words whitespace-pre-wrap text-[10px] leading-tight font-medium text-foreground">
                {data.name}
              </span>
            </button>
          )}
        </div>
        <Handle
          id={HANDLE_MARRIAGE_OUT}
          type="source"
          position={Position.Right}
          className="!top-1/2 !right-0 !size-2.5 !-translate-y-1/2 !border-2 !border-background !bg-muted-foreground"
        />
      </div>
      <div
        className="person-node-drag-handle absolute bottom-[2px] left-1/2 z-10 flex size-4 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-background bg-muted-foreground text-background shadow-sm active:cursor-grabbing"
        title="Drag to move"
      >
        <GripHorizontal className="size-2 shrink-0 opacity-90" aria-hidden />
      </div>
    </div>
  );
}
