import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { Label } from "../../../types/api";
import { labelsApi } from "../../../api/labels.api";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

const DEFAULT_COLOR = "#3B82F6";

export function BoardLabelsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}) {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);

  const listQuery = useQuery({
    queryKey: ["labels", "board", props.boardId],
    queryFn: () => labelsApi.listByBoard(props.boardId),
    enabled: props.open && !!props.boardId,
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: () => labelsApi.create({ boardId: props.boardId, name: name.trim(), color }),
    onSuccess: async () => {
      setName("");
      await listQuery.refetch();
    },
  });

  const filtered = useMemo(() => {
    const labels = listQuery.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return labels;
    return labels.filter((l) => l.name.toLowerCase().includes(needle));
  }, [listQuery.data, q]);

  const canCreate = name.trim().length > 0;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        props.onOpenChange(next);
        if (!next) {
          setQ("");
          setName("");
          setColor(DEFAULT_COLOR);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Labels trong board</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm label..." />

          <div className="max-h-64 space-y-1 overflow-auto rounded-md border p-2">
            {listQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Đang tải labels...</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">Chưa có label nào.</div>
            ) : (
              filtered.map((l: Label) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-8 shrink-0 rounded" style={{ backgroundColor: l.color || "#64748B" }} />
                    <span className="truncate text-sm">{l.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{l.color || "#64748B"}</div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium">Tạo label mới</div>
            <div className="mt-2 space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên label..." />
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-14 p-1"
                  aria-label="Chọn màu label"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#RRGGBB"
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            type="button"
            disabled={!canCreate || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Đang tạo..." : "Tạo label"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
