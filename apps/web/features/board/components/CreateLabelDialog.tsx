import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { BoardDetail } from "../../../types/api";
import { labelsApi } from "../../../api/labels.api";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

const DEFAULT_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#84CC16",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#64748B",
];

export function CreateLabelDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]!);

  const listQuery = useQuery({
    queryKey: ["labels", "board", props.boardId],
    queryFn: () => labelsApi.listByBoard(props.boardId),
    enabled: props.open && !!props.boardId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!props.open) return;
    const labels = listQuery.data;
    if (!labels) return;

    const key = ["board", props.boardId, "detail"] as const;
    const current = qc.getQueryData<BoardDetail>(key);
    if (current) {
      qc.setQueryData<BoardDetail>(key, {
        ...current,
        labels,
      });
    }
  }, [props.open, props.boardId, listQuery.data, qc]);

  useEffect(() => {
    if (!props.open) {
      setName("");
      setColor(DEFAULT_COLORS[0]!);
    }
  }, [props.open]);

  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  const createMutation = useMutation({
    mutationFn: () => labelsApi.create({ boardId: props.boardId, name: name.trim(), color }),
    onSuccess: (created) => {
      const key = ["board", props.boardId, "detail"] as const;
      const current = qc.getQueryData<BoardDetail>(key);
      if (current) {
        qc.setQueryData<BoardDetail>(key, {
          ...current,
          labels: [...(current.labels ?? []), created],
        });
      }
      props.onOpenChange(false);
    },
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo label</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên label..." />

          <div className="flex flex-wrap gap-2">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={
                  "h-7 w-7 rounded border " +
                  (c === color ? "ring-2 ring-offset-2 ring-primary" : "hover:ring-2 hover:ring-offset-2")
                }
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`Select ${c}`}
              />
            ))}
          </div>

          <div className="rounded border p-2">
            <div className="text-xs text-muted-foreground">Preview</div>
            <div className="mt-1 inline-flex items-center rounded px-2 py-1 text-xs text-white" style={{ backgroundColor: color }}>
              {name.trim() || "Label"}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="button" disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? "Đang tạo..." : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
