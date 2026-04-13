import React, { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { cardsApi } from "../../../api/cards.api";
import { Button } from "../../../components/ui/button";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { useCardMutations } from "../../../hooks/useCardMutations";
import { ArrowLeft, Trash2, Save } from "lucide-react";

/**
 * Standalone card detail page.
 *
 * Route: /cards/:cardId?boardId=...
 * boardId is used only for invalidation of board detail query.
 */
export const CardDetailPage: React.FC = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const boardId = searchParams.get("boardId") || "";

  const { data: card, isLoading } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => cardsApi.getById(cardId!),
    enabled: !!cardId,
  });

  const mutations = useCardMutations({ boardId: boardId || "_" });

  const initial = useMemo(
    () => ({
      title: card?.title ?? "",
      description: card?.description ?? "",
    }),
    [card]
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  React.useEffect(() => {
    setTitle(initial.title);
    setDescription(initial.description);
  }, [initial]);

  const save = () => {
    if (!cardId) return;
    mutations.updateCard.mutate({
      cardId,
      data: { title, description: description || undefined },
    });
  };

  const del = () => {
    if (!cardId) return;
    mutations.deleteCard.mutate(cardId, {
      onSuccess: () => {
        setConfirmDelete(false);
        navigate(-1);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg">Đang tải card...</div>
      </div>
    );
  }

    if (!card) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg">Không tìm thấy card</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại
      </Button>

      <UICard>
        <CardHeader>
          <CardTitle>Chi tiết card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Tiêu đề</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Mô tả</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button onClick={save} disabled={mutations.updateCard.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {mutations.updateCard.isPending ? "Đang lưu..." : "Lưu"}
            </Button>

            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Xoá card
            </Button>
          </div>
        </CardContent>
      </UICard>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xoá card?"
        description="Hành động này không thể hoàn tác."
        confirmText="Xoá"
        destructive
        loading={mutations.deleteCard.isPending}
        onConfirm={del}
      />
    </div>
  );
};
