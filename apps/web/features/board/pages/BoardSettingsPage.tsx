import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { boardsApi, boardBackgroundToCss } from "../../../api/boards.api";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { useBoardMutations } from "../../../hooks/useBoardMutations";
import { ArrowLeft, Trash2, Save } from "lucide-react";

export const BoardSettingsPage: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();

  const { data: board, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => boardsApi.getById(boardId!),
    enabled: !!boardId,
  });

  const mutations = useBoardMutations({
    boardId,
    workspaceId: board?.workspaceId,
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  const initial = useMemo(
    () => ({
      name: board?.name ?? "",
      description: board?.description ?? "",
      backgroundColor: board?.backgroundColor ?? "",
      backgroundLeftColor: board?.backgroundLeftColor ?? "#667eea",
      backgroundRightColor: board?.backgroundRightColor ?? "#764ba2",
      backgroundSplitPct: typeof board?.backgroundSplitPct === "number" ? board.backgroundSplitPct : 50,
    }),
    [board]
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("");
  const [backgroundLeftColor, setBackgroundLeftColor] = useState("");
  const [backgroundRightColor, setBackgroundRightColor] = useState("");
  const [backgroundSplitPct, setBackgroundSplitPct] = useState(50);

  React.useEffect(() => {
    setName(initial.name);
    setDescription(initial.description);
    setBackgroundColor(initial.backgroundColor);
    setBackgroundLeftColor(initial.backgroundLeftColor);
    setBackgroundRightColor(initial.backgroundRightColor);
    setBackgroundSplitPct(initial.backgroundSplitPct);
  }, [initial]);

  const save = () => {
    if (!boardId) return;
    mutations.updateBoard.mutate({
      id: boardId,
      data: {
        name,
        description: description || undefined,
        // Prefer gradient fields.
        backgroundLeftColor: backgroundLeftColor || undefined,
        backgroundRightColor: backgroundRightColor || undefined,
        backgroundSplitPct,
        // Keep legacy string optional.
        backgroundColor: backgroundColor || undefined,
      },
    });
  };

  const del = async () => {
    if (!boardId) return;
    mutations.deleteBoard.mutate(boardId, {
      onSuccess: () => {
        setConfirmDelete(false);
        navigate(`/workspaces/${board?.workspaceId}`);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg">Đang tải board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg">Không tìm thấy board</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <Button
        variant="ghost"
        onClick={() => navigate(`/boards/${board.id}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại board
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Cài đặt board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Tên board</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Mô tả</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <Label>Màu nền (Gradient ngang)</Label>

            <div
              className="h-10 w-full rounded-md border"
              style={{
                background:
                  boardBackgroundToCss({
                    backgroundColor,
                    backgroundLeftColor,
                    backgroundRightColor,
                    backgroundSplitPct,
                  }) ?? undefined,
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Màu trái</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={backgroundLeftColor}
                    onChange={(e) => setBackgroundLeftColor(e.target.value)}
                    className="w-14 p-1"
                  />
                  <Input
                    value={backgroundLeftColor}
                    onChange={(e) => setBackgroundLeftColor(e.target.value)}
                    placeholder="#667eea"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Màu phải</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={backgroundRightColor}
                    onChange={(e) => setBackgroundRightColor(e.target.value)}
                    className="w-14 p-1"
                  />
                  <Input
                    value={backgroundRightColor}
                    onChange={(e) => setBackgroundRightColor(e.target.value)}
                    placeholder="#764ba2"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tỉ lệ màu trái: {backgroundSplitPct}%</Label>
              <Input
                type="range"
                min={0}
                max={100}
                value={backgroundSplitPct}
                onChange={(e) => setBackgroundSplitPct(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bg">(Tuỳ chọn) CSS nền (legacy)</Label>
              <Input
                id="bg"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                placeholder="linear-gradient(...) hoặc #111827"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={save}
              disabled={mutations.updateBoard.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {mutations.updateBoard.isPending ? "Đang lưu..." : "Lưu"}
            </Button>

            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Xoá board
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xoá board?"
        description="Hành động này không thể hoàn tác."
        confirmText="Xoá"
        destructive
        loading={mutations.deleteBoard.isPending}
        onConfirm={del}
      />
    </div>
  );
};
