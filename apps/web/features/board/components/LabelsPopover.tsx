import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

import type { BoardDetail, Label } from "../../../types/api";
import { labelsApi } from "../../../api/labels.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { getToastErrorMessage } from "../../../lib/apiError";

const DEFAULT_COLORS = [
  "#EF4444", // red
  "#F59E0B", // amber
  "#84CC16", // lime
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#64748B", // slate
];

export function LabelsPopover(props: {
  boardId: string;
  cardId: string;
  boardLabels: Label[];
  attachedLabels: Label[];
  onToggle: (labelId: string, nextAttached: boolean) => void;
  disabled?: boolean;
  canCreate?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(DEFAULT_COLORS[0]!);

  const attached = useMemo(() => new Set(props.attachedLabels.map((l) => l.id)), [props.attachedLabels]);
  const attachedCount = props.attachedLabels.length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return props.boardLabels;
    return props.boardLabels.filter((l) => l.name.toLowerCase().includes(needle));
  }, [q, props.boardLabels]);

  const createMutation = useMutation({
    mutationFn: () =>
      labelsApi.create({
        boardId: props.boardId,
        name: newName.trim(),
        color: newColor,
      }),
    onSuccess: (created) => {
      // Update board detail cache labels so the popover reflects immediately
      const key = ["board", props.boardId, "detail"] as const;
      const current = qc.getQueryData<BoardDetail>(key);
      if (current) {
        qc.setQueryData<BoardDetail>(key, {
          ...current,
          labels: [...(current.labels ?? []), created],
        });
      }

      setNewName("");
      // Convenience: auto-attach right after create
      props.onToggle(created.id, true);
      toast.success("Đã tạo label");
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể tạo label"));
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" type="button" disabled={props.disabled}>
          <Tag className="h-4 w-4" />
          Labels
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search labels..." />

          <div className="max-h-56 space-y-1 overflow-auto rounded-md border p-2">
            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">No labels found.</div>
            ) : (
              filtered.map((l) => {
                const isOn = attached.has(l.id);
                const wouldExceedLimit = !isOn && attachedCount >= 5;
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent " +
                      (isOn ? "bg-accent" : "")
                    }
                    onClick={() => props.onToggle(l.id, !isOn)}
                    disabled={props.disabled || wouldExceedLimit}
                    title={wouldExceedLimit ? "Mỗi card tối đa 5 labels" : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-6 shrink-0 rounded"
                        style={{ backgroundColor: l.color || "#64748B" }}
                      />
                      <span className="truncate">{l.name}</span>
                    </span>
                    {isOn ? <Check className="h-4 w-4" /> : null}
                  </button>
                );
              })
            )}
          </div>

          {props.canCreate ? (
            <div className="space-y-2 rounded-md border p-2">
              <div className="text-sm font-medium">Create new label</div>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Label name"
              />
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={
                      "h-6 w-6 rounded border " +
                      (newColor === c ? "ring-2 ring-black/30" : "")
                    }
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={!newName.trim() || createMutation.isPending || props.disabled}
                onClick={() => createMutation.mutate()}
              >
                <Plus className="h-4 w-4" />
                {createMutation.isPending ? "Creating..." : "Create & attach"}
              </Button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              You don't have permission to create labels in this workspace.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
