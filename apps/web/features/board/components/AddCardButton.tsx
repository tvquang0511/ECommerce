import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cardsApi } from "../../../api/cards.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Plus, X } from "lucide-react";
import type { BoardDetail } from "../../../types/api";
// toast placeholder (wire real toast later)

interface AddCardButtonProps {
  listId: string;
  boardId: string;
  canWrite?: boolean;
}

export const AddCardButton: React.FC<AddCardButtonProps> = ({
  listId,
  boardId,
  canWrite = true,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const queryClient = useQueryClient();

  const createCardMutation = useMutation({
    mutationFn: cardsApi.create,
    onMutate: async (vars) => {
      const key = ["board", boardId, "detail"] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardDetail>(key);
      if (!previous) return { previous };

      const tempId = `temp:card:${crypto.randomUUID()}`;
      const targetList = previous.lists.find((l) => l.id === vars.listId);
      const ordered = targetList ? [...targetList.cards].sort((a, b) => a.position - b.position) : [];
      const maxPos = ordered.length ? ordered[ordered.length - 1].position : 0;

      const optimisticCard = {
        id: tempId,
        title: vars.title,
        description: vars.description ?? undefined,
        listId: vars.listId,
        position: maxPos + 1024,
  dueAt: undefined,
        labels: [],
        assignees: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const lists = previous.lists.map((l) =>
        l.id === vars.listId ? { ...l, cards: [...l.cards, optimisticCard] } : l
      );

      queryClient.setQueryData<BoardDetail>(key, { ...previous, lists });
      return { previous, tempId };
    },
    onError: (error: any, _vars, ctx) => {
      const key = ["board", boardId, "detail"] as const;
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      console.error(error.response?.data?.error?.message || "Không thể tạo card");
    },
    onSuccess: (created, vars, ctx) => {
      const key = ["board", boardId, "detail"] as const;
      const current = queryClient.getQueryData<BoardDetail>(key);
      if (!current) return;

      const lists = current.lists.map((l) => {
        if (l.id !== vars.listId) return l;
        const replaced = l.cards.map((c) => (c.id === ctx?.tempId ? created : c));
        const normalized = [...replaced]
          .sort((a, b) => a.position - b.position)
          .map((c, idx) => ({ ...c, position: (idx + 1) * 1024 }));
        return { ...l, cards: normalized };
      });

      queryClient.setQueryData<BoardDetail>(key, { ...current, lists });
      setCardTitle("");
      setIsAdding(false);
      // toast: created
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardTitle.trim()) {
      createCardMutation.mutate({
        title: cardTitle,
        listId,
      });
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setCardTitle("");
  };

  if (isAdding) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          value={cardTitle}
          onChange={(e) => setCardTitle(e.target.value)}
          placeholder="Nhập tiêu đề card..."
          autoFocus
          disabled={!canWrite}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              handleCancel();
            }
          }}
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={createCardMutation.isPending || !canWrite}
          >
            Thêm thẻ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-gray-600"
      onClick={() => setIsAdding(true)}
      disabled={!canWrite}
      title={!canWrite ? "Board đang ở chế độ chỉ xem" : undefined}
    >
      <Plus className="mr-2 h-4 w-4" />
      Thêm thẻ
    </Button>
  );
};
