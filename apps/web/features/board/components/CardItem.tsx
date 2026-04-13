import React, { useEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cardsApi } from "../../../api/cards.api";
import { labelsApi } from "../../../api/labels.api";
import { commentsApi, type CardComment } from "../../../api/comments.api";
import { LabelsPopover } from "./LabelsPopover";
import { CardAssigneesSection } from "./card-item/CardAssigneesSection";
import { CardAttachmentsSection } from "./card-item/CardAttachmentsSection";
import { CardChecklistsSection } from "./card-item/CardChecklistsSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Label } from "../../../components/ui/label";
import {
  Calendar,
  ChevronLeft,
  Check,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { BoardDetail, Card } from "../../../types/api";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { getToastErrorMessage } from "../../../lib/apiError";

type CardDnDItem = {
  id: string;
  listId: string;
};

interface CardItemProps {
  card: Card;
  listId: string;
  boardId: string;
  forceOpen?: boolean;
  onForceClose?: () => void;
  onCardDropped?: (dragCardId: string, hoverCardId: string, hoverAbove: boolean) => void;
}

export const CardItem: React.FC<CardItemProps> = ({
  card,
  listId,
  boardId,
  forceOpen,
  onForceClose,
  onCardDropped,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [dueAtInput, setDueAtInput] = useState<string>(card.dueAt ? card.dueAt.slice(0, 16) : "");
  const [remindAtInput, setRemindAtInput] = useState<string>("");
  const [commentDraft, setCommentDraft] = useState("");
  const [activePane, setActivePane] = useState<"main" | "comments">("main");
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const dueAtInputRef = useRef<HTMLInputElement | null>(null);
  const remindAtInputRef = useRef<HTMLInputElement | null>(null);

  const boardDetail = queryClient.getQueryData<BoardDetail>([
    "board",
    boardId,
    "detail",
  ]);
  const boardLabels = boardDetail?.labels ?? [];
  const canWriteBoard = boardDetail?.actor?.canWriteBoard ?? true;
  const isReadOnlyBoard = !canWriteBoard;
  const canCreateLabels =
    boardDetail?.actor?.boardRole === "OWNER" ||
    boardDetail?.actor?.boardRole === "ADMIN";

  const { data: cardLabels = [], refetch: refetchCardLabels } = useQuery({
    queryKey: ["card", card.id, "labels"],
    queryFn: () => labelsApi.listByCard(card.id),
    enabled: isModalOpen,
  });

  const attachLabelMutation = useMutation({
    mutationFn: (labelId: string) => labelsApi.attachToCard(card.id, labelId),
    onSuccess: async () => {
      await refetchCardLabels();
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "detail"] });
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể gắn label"));
    },
  });

  const detachLabelMutation = useMutation({
    mutationFn: (labelId: string) => labelsApi.detachFromCard(card.id, labelId),
    onSuccess: async () => {
      await refetchCardLabels();
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "detail"] });
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể gỡ label"));
    },
  });

  const mergeCardPreserveRelations = (existing: Card, updated: Card): Card => {
    return {
      ...existing,
      ...updated,
      labels:
        updated.labels && updated.labels.length > 0
          ? updated.labels
          : existing.labels,
      assignees:
        updated.assignees && updated.assignees.length > 0
          ? updated.assignees
          : existing.assignees,
      checklistTotal: updated.checklistTotal ?? existing.checklistTotal,
      checklistDone: updated.checklistDone ?? existing.checklistDone,
    };
  };


  const [{ isDragging }, drag] = useDrag(() => ({
    type: "CARD",
    item: { id: card.id, listId } satisfies CardDnDItem,
    canDrag: canWriteBoard,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [card.id, listId, canWriteBoard]);

  useEffect(() => {
    if (forceOpen) setIsModalOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    // Reset when opening/closing so you don't get stuck in comments pane.
    if (!isModalOpen) setActivePane("main");
  }, [isModalOpen]);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: "CARD",
    canDrop: () => canWriteBoard,
    drop: (item: CardDnDItem, monitor) => {
      if (!canWriteBoard) return;
      // Only trigger on actual drop, not hover
      if (item.id === card.id) return;
      if (!onCardDropped) return;

      const ref = cardRef.current;
      if (!ref) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const rect = ref.getBoundingClientRect();
      const hoverAbove = clientOffset.y - rect.top < rect.height / 2;

      onCardDropped(item.id, card.id, hoverAbove);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }), [card.id, canWriteBoard, onCardDropped]);

  const updateCardMutation = useMutation({
    mutationFn: (data: { title?: string; description?: string }) =>
      cardsApi.update(card.id, data),
    onMutate: async (data) => {
      const key = ["board", boardId, "detail"] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardDetail>(key);
      if (!previous) return { previous };

      const lists = previous.lists.map((l) => {
        if (l.id !== listId) return l;
        const cards = l.cards.map((c) =>
          c.id === card.id
            ? {
                ...c,
                title: data.title ?? c.title,
                description: data.description ?? c.description,
                updatedAt: new Date().toISOString(),
              }
            : c
        );
        return { ...l, cards };
      });

      queryClient.setQueryData<BoardDetail>(key, { ...previous, lists });
      return { previous };
    },
    onError: (error: unknown, _vars, ctx) => {
      const key = ["board", boardId, "detail"] as const;
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(getToastErrorMessage(error, "Không thể lưu thay đổi"));
    },
    onSuccess: (updated) => {
      const key = ["board", boardId, "detail"] as const;
      const current = queryClient.getQueryData<BoardDetail>(key);
      if (!current) return;

      const lists = current.lists.map((l) => {
        if (l.id !== updated.listId) return l;
        const cards = l.cards.map((c) =>
          c.id === updated.id ? mergeCardPreserveRelations(c, updated) : c,
        );
        return { ...l, cards };
      });

      queryClient.setQueryData<BoardDetail>(key, { ...current, lists });
      toast.success("Đã lưu thay đổi");
    },
  });

  const setDueDateMutation = useMutation({
    mutationFn: (dueAt: string | null) => cardsApi.setDueDate(card.id, dueAt),
    onSuccess: (updated) => {
      const key = ["board", boardId, "detail"] as const;
      const current = queryClient.getQueryData<BoardDetail>(key);
      if (!current) return;

      const lists = current.lists.map((l) => {
        const cards = l.cards.map((c) =>
          c.id === updated.id ? mergeCardPreserveRelations(c, updated) : c,
        );
        return { ...l, cards };
      });

      queryClient.setQueryData<BoardDetail>(key, { ...current, lists });
      setDueAtInput(updated.dueAt ? updated.dueAt.slice(0, 16) : "");
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể cập nhật ngày đến hạn"));
    },
  });

  const { data: reminders = [], refetch: refetchReminders } = useQuery({
    queryKey: ["card", card.id, "reminders"],
    queryFn: () => cardsApi.listReminders(card.id),
    enabled: isModalOpen,
  });

  const pendingReminders = (reminders || []).filter((r) => r.status === "PENDING");
  const activeReminder = pendingReminders.sort(
    (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
  )[0];

  // Initialize reminder input when modal opens or when backend returns reminders.
  useEffect(() => {
    if (!isModalOpen) return;
    setRemindAtInput(activeReminder?.remindAt ? activeReminder.remindAt.slice(0, 16) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, activeReminder?.id]);

  const setReminderMutation = useMutation({
    mutationFn: (remindAtIso: string) => cardsApi.setReminder(card.id, remindAtIso),
    onSuccess: async () => {
      await refetchReminders();
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể đặt reminder"));
    },
  });

  const cancelReminderMutation = useMutation({
    mutationFn: async (reminderJobId: string) => {
      await cardsApi.cancelReminder(card.id, reminderJobId);
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể huỷ reminder"));
    },
  });

  useEffect(() => {
    if (!isModalOpen) return;
    if (!canWriteBoard) return;

    const t = setTimeout(() => {
      const next = dueAtInput?.trim() ? new Date(dueAtInput).toISOString() : null;
      const current = card.dueAt ? card.dueAt.slice(0, 16) : "";
      if ((dueAtInput ?? "") === current) return;
      setDueDateMutation.mutate(next);
    }, 500);

    return () => clearTimeout(t);
    // Intentionally skip `card.dueAt` to avoid re-triggering after server writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueAtInput, isModalOpen, canWriteBoard]);

  // Keep reminder <= dueAt (if dueAt is set).
  useEffect(() => {
    if (!isModalOpen) return;
    if (!dueAtInput?.trim() || !remindAtInput?.trim()) return;
    if (remindAtInput > dueAtInput) {
      setRemindAtInput(dueAtInput);
    }
  }, [dueAtInput, remindAtInput, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;
    // Read-only board: allow viewing reminders but don't mutate.
    if (isReadOnlyBoard) return;

    const t = setTimeout(async () => {
      const current = activeReminder?.remindAt ? activeReminder.remindAt.slice(0, 16) : "";
      if ((remindAtInput ?? "") === current) return;

      // Clear => cancel existing pending reminders
      if (!remindAtInput?.trim()) {
        await Promise.all(pendingReminders.map((r) => cancelReminderMutation.mutateAsync(r.id)));
        await refetchReminders();
        return;
      }

      // Enforce remindAt <= dueAt (if dueAt is set)
      if (dueAtInput?.trim() && remindAtInput > dueAtInput) {
        return;
      }

      // Keep single reminder per card in UI: cancel existing pending ones first.
      await Promise.all(pendingReminders.map((r) => cancelReminderMutation.mutateAsync(r.id)));

      const remindAtIso = new Date(remindAtInput).toISOString();
      await setReminderMutation.mutateAsync(remindAtIso);
      await refetchReminders();
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindAtInput, isModalOpen, isReadOnlyBoard]);

  const setDoneMutation = useMutation({
    mutationFn: (isDone: boolean) => cardsApi.setDone(card.id, isDone),
    onSuccess: (updated) => {
      const key = ["board", boardId, "detail"] as const;
      const current = queryClient.getQueryData<BoardDetail>(key);
      if (!current) return;

      const lists = current.lists.map((l) => {
        const cards = l.cards.map((c) =>
          c.id === updated.id ? mergeCardPreserveRelations(c, updated) : c,
        );
        return { ...l, cards };
      });

      queryClient.setQueryData<BoardDetail>(key, { ...current, lists });
      toast.success(updated.isDone ? "Đã đánh dấu Done" : "Đã bỏ đánh dấu Done");
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể cập nhật trạng thái Done"));
    },
  });

  const { data: commentsResp, refetch: refetchComments } = useQuery({
    queryKey: ["card", card.id, "comments"],
    queryFn: () => commentsApi.listByCard({ cardId: card.id, limit: 50 }),
    enabled: isModalOpen,
  });

  const comments = commentsResp?.comments ?? [];

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => commentsApi.create({ cardId: card.id, content }),
    onSuccess: async () => {
      setCommentDraft("");
      await refetchComments();
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể tạo comment"));
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(commentId),
    onSuccess: async () => {
      await refetchComments();
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể xoá comment"));
    },
  });


  const deleteCardMutation = useMutation({
    mutationFn: () => cardsApi.delete(card.id),
    onMutate: async () => {
      const key = ["board", boardId, "detail"] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardDetail>(key);
      if (!previous) return { previous };

      // Keep the cursor card visible until the new server ordering arrives.
      // This avoids the "card jumped away" feel during cross-list moves.
      const nextLists = previous.lists.map((l) => {
        if (l.id !== listId) return l;
        return {
          ...l,
          cards: l.cards.filter((c) => c.id !== card.id),
        };
      });

      queryClient.setQueryData<BoardDetail>(key, { ...previous, lists: nextLists });
      return { previous };
    },
    onError: (error: unknown, _vars, ctx) => {
      const key = ["board", boardId, "detail"] as const;
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error(getToastErrorMessage(error, "Không thể xoá card"));
    },
    onSuccess: () => {
      toast.success("Đã xoá card");
      setConfirmDelete(false);
    },
  });

  const handleSave = () => {
    if (!canWriteBoard) {
      toast.error("Bạn không đủ quyền để chỉnh sửa card");
      return;
    }
    if (title.trim()) {
      updateCardMutation.mutate({
        title: title !== card.title ? title : undefined,
        description: description !== card.description ? description : undefined,
      });
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <div
        ref={(node) => {
          drop(node);
          drag(node);
          cardRef.current = node;
        }}
        onClick={() => setIsModalOpen(true)}
        className={`cursor-pointer rounded-md bg-white p-2 shadow-sm transition-shadow hover:shadow-md ${
          isDragging ? "opacity-50" : ""
        } ${isOver ? "ring-2 ring-blue-400" : ""}
        }`}
      >
        {/* Trello-like label bars */}
        <div className="mb-2 flex h-2 flex-wrap gap-1">
          {(card.labels || []).slice(0, 5).map((label) => (
            <span
              key={label.id}
              className="h-2 w-10 rounded"
              style={{ backgroundColor: label.color || "#64748B" }}
              title={label.name}
            />
          ))}
        </div>

        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-5">{card.title}</p>
        </div>

        {(card.dueAt || (card.checklistTotal ?? 0) > 0 || card.isDone) ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {card.isDone ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700">
                <Check className="h-3 w-3" />
                Done
              </span>
            ) : null}
            {card.dueAt ? (
              <span className="rounded bg-muted px-2 py-1">
                {new Date(card.dueAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            ) : null}

            {(card.checklistTotal ?? 0) > 0 ? (
              <span className="rounded bg-muted px-2 py-1">
                ✓ {card.checklistDone ?? 0}/{card.checklistTotal ?? 0}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Card Detail Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open && forceOpen) onForceClose?.();
        }}
      >
        <DialogContent className={activePane === "comments" ? "sm:max-w-5xl" : "sm:max-w-2xl"}>
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>Chi tiết</DialogTitle>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full">
                {/* Main pane */}
                <div
                  className={`min-w-0 flex-1 overflow-y-auto pr-1 ${
                    activePane === "comments" ? "hidden md:block" : "block"
                  }`}
                >
                  <div className="space-y-4 pb-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardTitle">Tiêu đề</Label>
                      <Input
                        id="cardTitle"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Tiêu đề card..."
                        disabled={isReadOnlyBoard}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardDescription">Mô tả</Label>
                      <Textarea
                        id="cardDescription"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Thêm mô tả chi tiết..."
                        rows={6}
                        disabled={isReadOnlyBoard}
                      />
                    </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Ngày đến hạn</Label>
                  {setDueDateMutation.isPending ? (
                    <div className="text-xs text-muted-foreground">Đang lưu…</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    ref={dueAtInputRef}
                    type="datetime-local"
                    value={dueAtInput}
                    onChange={(e) => setDueAtInput(e.target.value)}
                    disabled={isReadOnlyBoard}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const el = dueAtInputRef.current;
                      // `showPicker` is supported in Chromium.
                      (el as any)?.showPicker?.();
                      el?.focus();
                    }}
                    disabled={isReadOnlyBoard}
                    title="Mở lịch"
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                {card.dueAt ? (
                  <div className="text-xs text-muted-foreground">
                    Đang đặt: {new Date(card.dueAt).toLocaleString("vi-VN")}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Chưa đặt ngày đến hạn.</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Reminder</Label>
                  {setReminderMutation.isPending || cancelReminderMutation.isPending ? (
                    <div className="text-xs text-muted-foreground">Đang lưu…</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    ref={remindAtInputRef}
                    type="datetime-local"
                    value={remindAtInput}
                    max={dueAtInput?.trim() ? dueAtInput : undefined}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (dueAtInput?.trim() && next && next > dueAtInput) {
                        setRemindAtInput(dueAtInput);
                        return;
                      }
                      setRemindAtInput(next);
                    }}
                    disabled={isReadOnlyBoard || !dueAtInput?.trim()}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const el = remindAtInputRef.current;
                      (el as any)?.showPicker?.();
                      el?.focus();
                    }}
                    disabled={isReadOnlyBoard || !dueAtInput?.trim()}
                    title="Mở lịch"
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                {activeReminder ? (
                  <div className="text-xs text-muted-foreground">
                    Đang đặt: {new Date(activeReminder.remindAt).toLocaleString("vi-VN")}
                  </div>
                ) : dueAtInput?.trim() ? (
                  <div className="text-xs text-muted-foreground">Chưa đặt reminder.</div>
                ) : (
                  <div className="text-xs text-muted-foreground">Đặt ngày đến hạn trước.</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Labels</Label>
                <LabelsPopover
                  boardId={boardId}
                  cardId={card.id}
                  boardLabels={boardLabels}
                  attachedLabels={cardLabels}
                    disabled={isReadOnlyBoard || attachLabelMutation.isPending || detachLabelMutation.isPending}
                  canCreate={canCreateLabels}
                  onToggle={(labelId, nextAttached) => {
                      if (isReadOnlyBoard) return;
                    if (nextAttached) attachLabelMutation.mutate(labelId);
                    else detachLabelMutation.mutate(labelId);
                  }}
                />
              </div>

              {cardLabels.length === 0 ? (
                <div className="text-sm text-muted-foreground">Chưa gắn label nào.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cardLabels.map((l) => (
                    <span
                      key={l.id}
                      className="rounded px-2 py-1 text-xs text-white"
                      style={{ backgroundColor: l.color || "#64748B" }}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <CardChecklistsSection
              boardId={boardId}
              cardId={card.id}
              enabled={isModalOpen}
              disabled={isReadOnlyBoard}
            />

            <CardAttachmentsSection
              boardId={boardId}
              cardId={card.id}
              enabled={isModalOpen}
              disabled={isReadOnlyBoard}
              boardDetail={boardDetail}
            />

            <CardAssigneesSection
              boardId={boardId}
              cardId={card.id}
              boardDetail={boardDetail}
              enabled={isModalOpen}
              disabled={isReadOnlyBoard}
            />

            <button
              type="button"
              className="w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted"
              onClick={() => setActivePane("comments")}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Comments</div>
                <div className="text-xs text-muted-foreground">{comments.length}</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Bấm để xem và viết comment</div>
            </button>

                  </div>
                </div>

                {/* Comments pane */}
                <div
                  className={`h-full w-full shrink-0 overflow-y-auto border-l pl-3 pr-1 md:w-90 ${
                    activePane === "comments" ? "block" : "hidden"
                  }`}
                >
                  <div className="flex items-center gap-2 py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setActivePane("main")}> 
                      <ChevronLeft className="h-4 w-4" />
                      Quay lại
                    </Button>
                    <div className="text-sm font-semibold">Comments</div>
                  </div>

                  <div className="space-y-3 pb-4">
                    <div className="flex gap-2">
                      <Input
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Viết comment..."
                        disabled={isReadOnlyBoard}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const content = commentDraft.trim();
                          if (!content) return;
                          createCommentMutation.mutate(content);
                        }}
                        disabled={isReadOnlyBoard || createCommentMutation.isPending}
                      >
                        Gửi
                      </Button>
                    </div>

                    {comments.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Chưa có comment nào.</div>
                    ) : (
                      <div className="space-y-2">
                        {comments.map((c: CardComment) => (
                          <div key={c.id} className="rounded-md border px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium">{c.author?.displayName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(c.createdAt).toLocaleString("vi-VN")}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCommentMutation.mutate(c.id)}
                                disabled={isReadOnlyBoard || deleteCommentMutation.isPending}
                              >
                                Xoá
                              </Button>
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-sm">{c.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t pt-3">
              <div className="flex justify-between">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (isReadOnlyBoard) {
                      toast.error("Bạn không đủ quyền để xoá card");
                      return;
                    }
                    setConfirmDelete(true);
                  }}
                  disabled={deleteCardMutation.isPending}
                  className={isReadOnlyBoard ? "opacity-50" : undefined}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xoá thẻ
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={card.isDone ? "secondary" : "outline"}
                    onClick={() => {
                      if (isReadOnlyBoard) {
                        toast.error("Bạn không đủ quyền để cập nhật card");
                        return;
                      }
                      setDoneMutation.mutate(!Boolean(card.isDone));
                    }}
                    disabled={setDoneMutation.isPending}
                    className={isReadOnlyBoard ? "opacity-50" : undefined}
                    title="Hoàn thành"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                    Huỷ
                  </Button>
                  <Button onClick={handleSave} disabled={updateCardMutation.isPending} className={isReadOnlyBoard ? "opacity-50" : undefined}>
                    Lưu thay đổi
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xoá card?"
        description="Card sẽ bị ẩn (archive). Bạn có thể khôi phục sau (tính năng tương lai)."
        confirmText="Xoá"
        destructive
        loading={deleteCardMutation.isPending}
        onConfirm={() => {
          if (isReadOnlyBoard) {
            toast.error("Bạn không đủ quyền để xoá card");
            return;
          }
          deleteCardMutation.mutate();
        }}
      />
    </>
  );
};
