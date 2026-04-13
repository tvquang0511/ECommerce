import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDrag, useDrop } from "react-dnd";
import { listsApi } from "../../../api/lists.api";
import { cardsApi } from "../../../api/cards.api";
import { CardItem } from "./CardItem";
import { AddCardButton } from "./AddCardButton";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Edit2, Hand } from "lucide-react";
import { toast } from "sonner";
import type { BoardDetail, List } from "../../../types/api";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";

type CardDragItem = {
  id: string;
  listId: string;
  targetListId?: string;
};

interface ListColumnProps {
  list: List;
  boardId: string;
  canWrite?: boolean;
  selectedCardId?: string;
  onCloseSelectedCard?: () => void;
  onListDropCommit?: (
    dragListId: string,
    dropTargetListId: string,
    intent: "before" | "after",
  ) => void;
}

export const ListColumn: React.FC<ListColumnProps> = ({
  list,
  boardId,
  canWrite = true,
  selectedCardId,
  onCloseSelectedCard,
  onListDropCommit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [listName, setListName] = useState(list.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const [{ isListDragging }, dragList] = useDrag(() => ({
    type: "LIST",
    item: { id: list.id },
    canDrag: canWrite,
    collect: (monitor) => ({
      isListDragging: monitor.isDragging(),
    }),
  }), [list.id, canWrite]);

  const updateListMutation = useMutation({
    mutationFn: (name: string) => listsApi.update(list.id, { name }),
    onMutate: async (name: string) => {
      const key = ["board", boardId, "detail"] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardDetail>(key);
      if (!previous) return { previous };

      const lists = previous.lists.map((l) =>
        l.id === list.id ? { ...l, name, updatedAt: new Date().toISOString() } : l
      );
      queryClient.setQueryData<BoardDetail>(key, { ...previous, lists });

      setIsEditing(false);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const key = ["board", boardId, "detail"] as const;
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error("Không thể cập nhật list");
    },
    onSuccess: (updated) => {
      const key = ["board", boardId, "detail"] as const;
      const current = queryClient.getQueryData<BoardDetail>(key);
      if (!current) return;

      const lists = current.lists.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));
      queryClient.setQueryData<BoardDetail>(key, { ...current, lists });
      toast.success("Đã cập nhật list!");
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: () => listsApi.delete(list.id),
    onMutate: async () => {
      const key = ["board", boardId, "detail"] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardDetail>(key);
      if (!previous) return { previous };

      const lists = previous.lists.filter((l) => l.id !== list.id);
      queryClient.setQueryData<BoardDetail>(key, { ...previous, lists });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const key = ["board", boardId, "detail"] as const;
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error("Không thể xoá list");
    },
    onSuccess: () => {
      toast.success("Đã xoá list!");
      setConfirmDelete(false);
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: any }) =>
      cardsApi.move(cardId, data),
    onSuccess: () => {
      // Invalidate to refetch from server (no optimistic update, server is source of truth)
      const key = ["board", boardId, "detail"] as const;
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => {
      toast.error("Không thể di chuyển card");
    },
  });

  const sortedCards = [...list.cards].sort((a, b) => a.position - b.position);

  /**
   * Handle card drop: compute prev/next and call API
   */
  const handleCardDropped = (dragCardId: string, hoverCardId: string, hoverAbove: boolean) => {
    if (!canWrite) return;
    const key = ["board", boardId, "detail"] as const;
    const current = queryClient.getQueryData<BoardDetail>(key);
    if (!current) return;

    // Find the list containing the hover card
    const targetList = current.lists.find((l) => l.cards.some((c) => c.id === hoverCardId));
    if (!targetList) return;

    const ordered = [...targetList.cards]
      .filter((c) => !c.id.startsWith("temp:"))
      .sort((a, b) => a.position - b.position);

    const hoverIndex = ordered.findIndex((c) => c.id === hoverCardId);
    if (hoverIndex < 0) return;

    // Compute insertion index based on hoverAbove
    const insertIndex = hoverAbove ? hoverIndex : hoverIndex + 1;

    // Find prev/next cards around insertion point
    const prevCard = insertIndex > 0 ? ordered[insertIndex - 1] : null;
    const nextCard = insertIndex < ordered.length ? ordered[insertIndex] : null;

    // Call move API with prev/next
    moveCardMutation.mutate({
      cardId: dragCardId,
      data: {
        toListId: targetList.id,
        prevCardId: prevCard?.id ?? undefined,
        nextCardId: nextCard?.id ?? undefined,
      },
    });
  };

  // End-of-list drop zone (allows "drop to end" without hovering a card)
  const [{ isOverEnd }, dropEnd] = useDrop(() => ({
    accept: "CARD",
    canDrop: () => canWrite,
    drop: (item: CardDragItem) => {
      if (!canWrite) return;
      // Drop at end of list
      const lastCard = sortedCards[sortedCards.length - 1];
      if (!lastCard) {
        // List is empty, just move card with no prev/next
        moveCardMutation.mutate({
          cardId: item.id,
          data: {
            toListId: list.id,
            prevCardId: undefined,
            nextCardId: undefined,
          },
        });
      } else {
        // Insert after last card
        handleCardDropped(item.id, lastCard.id, false);
      }
    },
    collect: (monitor) => ({
      isOverEnd: monitor.isOver({ shallow: true }),
    }),
  }), [sortedCards, list.id, canWrite]);

  const [{ isOverCard }, dropCard] = useDrop(() => ({
    accept: "CARD",
    canDrop: () => canWrite,
    drop: (item: { id: string; listId: string }) => {
      if (!canWrite) return;
      // This drop handler catches drops within the list area (not on specific card)
      if (item.listId === list.id && sortedCards.length > 0) {
        // Within same list, just move to end
        handleCardDropped(item.id, sortedCards[0].id, true);
      }
    },
    collect: (monitor) => ({
      isOverCard: monitor.isOver({ shallow: true }),
    }),
  }), [list.id, sortedCards, canWrite]);

  const [{ isOverList }, dropList] = useDrop(() => ({
    accept: "LIST",
    canDrop: () => canWrite,
    drop: (item: { id: string }, monitor) => {
      if (!canWrite) return;
      // Prevent nested drops firing twice
      if (monitor.didDrop()) return;
      if (!onListDropCommit) return;
      if (item.id === list.id) return;

      // Determine if user intended to drop before/after this list based on cursor X.
      const client = monitor.getClientOffset();
      let intent: "before" | "after" = "before";
      if (client) {
        const elementAtPoint = document.elementFromPoint(client.x, client.y) as HTMLElement | null;
        const listRoot = elementAtPoint?.closest?.('[data-list-column="true"]') as HTMLElement | null;
        const rect = listRoot?.getBoundingClientRect();
        if (rect) {
          intent = client.x < rect.left + rect.width / 2 ? "before" : "after";
        }
      }

      // Commit-on-drop like cards: parent will compute prev/next based on intent then call API.
      onListDropCommit(item.id, list.id, intent);
    },
    collect: (monitor) => ({
      isOverList: monitor.isOver({ shallow: true }),
    }),
  }), [list.id, onListDropCommit, canWrite]);

  const handleSaveName = () => {
    if (!canWrite) return;
    if (listName.trim() && listName !== list.name) {
      updateListMutation.mutate(listName);
    } else {
      setIsEditing(false);
      setListName(list.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setListName(list.name);
    }
  };

  return (
    <div
      ref={(node) => {
        dropList(node);
        dropCard(node);
      }}
      data-list-column="true"
      className={`flex h-fit min-w-70 max-w-70 flex-col rounded-lg bg-gray-100 transition-colors ${
        isOverCard ? "bg-gray-200" : ""
      } ${isOverList ? "ring-2 ring-white/60" : ""} ${
        isListDragging ? "opacity-60" : ""
      }`}
    >
      {/* List Header */}
      <div className="flex items-center justify-between gap-2 p-3">
        <div
          ref={(node) => {
            dragList(node);
          }}
          className={
            "-ml-1 flex h-8 w-6 items-center justify-center rounded " +
            (canWrite ? "hover:bg-black/5 cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50")
          }
          title={canWrite ? "Kéo để sắp xếp list" : "Board đang ở chế độ chỉ xem"}
        >
          <Hand className="h-5 w-5 text-gray-600" />
        </div>
        {isEditing ? (
          <Input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8 flex-1"
          />
        ) : (
          <h3
            className={"flex-1 font-semibold " + (canWrite ? "cursor-pointer" : "cursor-default")}
            onClick={() => {
              if (!canWrite) return;
              setIsEditing(true);
            }}
          >
            {list.name}
          </h3>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!canWrite}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)} disabled={!canWrite}>
              <Edit2 className="mr-2 h-4 w-4" />
              Đổi tên
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmDelete(true)}
              className="text-red-600"
              disabled={!canWrite}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Xoá list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 px-3 pb-2">
        {sortedCards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            listId={list.id}
            boardId={boardId}
            forceOpen={Boolean(selectedCardId && selectedCardId === card.id)}
            onForceClose={selectedCardId && selectedCardId === card.id ? onCloseSelectedCard : undefined}
            onCardDropped={handleCardDropped}
          />
        ))}

        {/* Drop zone for inserting to the end of list */}
        <div
          ref={(node) => {
            dropEnd(node);
          }}
          className={`h-10 rounded-md border border-dashed transition-colors ${
            isOverEnd ? "border-blue-500 bg-blue-50" : "border-transparent"
          }`}
          title="Thả vào đây để đưa card xuống cuối list"
        />
      </div>

      {/* Add Card Button */}
      <div className="p-3 pt-0">
        <AddCardButton listId={list.id} boardId={boardId} canWrite={canWrite} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xoá list?"
        description="List sẽ bị ẩn (archive) và các card trong list cũng sẽ bị archive."
        confirmText="Xoá"
        destructive
        loading={deleteListMutation.isPending}
        onConfirm={() => deleteListMutation.mutate()}
      />
    </div>
  );
};
