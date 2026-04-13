import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { boardsApi, boardBackgroundToCss } from "../../../api/boards.api";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Slider } from "../../../components/ui/slider";
import type { BoardDetail } from "../../../types/api";

type Props = {
  board: Pick<
    BoardDetail,
    | "id"
    | "workspaceId"
    | "backgroundColor"
    | "backgroundLeftColor"
    | "backgroundRightColor"
    | "backgroundSplitPct"
    | "actor"
  >;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const BoardBackgroundDialog: React.FC<Props> = ({ board, open, onOpenChange }) => {
  const queryClient = useQueryClient();

  const canUpdate =
    (board.actor as any)?.canUpdateBoardSettings ?? board.actor?.canWriteBoard ?? false;

  const initial = useMemo(
    () => ({
      left: board.backgroundLeftColor ?? "#667eea",
      right: board.backgroundRightColor ?? "#764ba2",
      pct: typeof board.backgroundSplitPct === "number" ? board.backgroundSplitPct : 50,
    }),
    [board.backgroundLeftColor, board.backgroundRightColor, board.backgroundSplitPct]
  );

  const [left, setLeft] = useState(initial.left);
  const [right, setRight] = useState(initial.right);
  const [pct, setPct] = useState(initial.pct);

  React.useEffect(() => {
    setLeft(initial.left);
    setRight(initial.right);
    setPct(initial.pct);
  }, [initial.left, initial.right, initial.pct, open]);

  const preview = boardBackgroundToCss({
    backgroundLeftColor: left,
    backgroundRightColor: right,
    backgroundSplitPct: pct,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Always attempt the PATCH so we surface the real backend error (403/404)
      // instead of failing silently due to missing/incorrect actor flags.
      return boardsApi.updateBackground(board.id, {
        backgroundLeftColor: left,
        backgroundRightColor: right,
        backgroundSplitPct: pct,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["board", board.id, "detail"] }),
        queryClient.invalidateQueries({ queryKey: ["boards", "workspace", board.workspaceId] }),
      ]);
      toast.success("Đã cập nhật màu nền board");
      onOpenChange(false);
    },
    onError: (error: any) => {
      const apiError = error.response?.data?.error;
      toast.error(apiError?.message || "Không thể cập nhật màu nền board");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Màu nền board</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div
            className="h-24 w-full rounded-md border"
            style={{ background: preview }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Màu bên trái</Label>
              <div className="flex items-center gap-3">
                <Input type="color" value={left} onChange={(e) => setLeft(e.target.value)} className="w-14 p-1" />
                <Input value={left} onChange={(e) => setLeft(e.target.value)} placeholder="#667eea" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Màu bên phải</Label>
              <div className="flex items-center gap-3">
                <Input type="color" value={right} onChange={(e) => setRight(e.target.value)} className="w-14 p-1" />
                <Input value={right} onChange={(e) => setRight(e.target.value)} placeholder="#764ba2" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tỉ lệ màu trái: {pct}%</Label>
              <div className="text-xs text-muted-foreground">Gradient ngang</div>
            </div>
            <Slider
              value={[pct]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setPct(v[0] ?? 50)}
            />
          </div>

          {!canUpdate ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Chỉ OWNER/ADMIN của board mới được đổi màu nền.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            onClick={() => {
              if (!canUpdate) {
                toast.error("Bạn không có quyền đổi màu nền board (chỉ OWNER/ADMIN của board)");
              }
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
