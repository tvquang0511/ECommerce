import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { assigneesApi, type CardAssignee } from "../../../../api/assignees.api";
import { boardsApi } from "../../../../api/boards.api";
import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Label } from "../../../../components/ui/label";
import { useAuth } from "../../../../providers/AuthProvider";
import type { BoardDetail, BoardMember } from "../../../../types/api";
import { getToastErrorMessage } from "../../../../lib/apiError";

export function CardAssigneesSection(props: {
  boardId: string;
  cardId: string;
  boardDetail?: BoardDetail;
  enabled: boolean;
  disabled?: boolean;
}) {
  const { boardId, cardId, boardDetail, enabled, disabled } = props;
  const { user } = useAuth();

  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const [assigneesSelected, setAssigneesSelected] = useState<CardAssignee | null>(null);

  const myUserId = user?.id;

  const canManageAssignees =
    boardDetail?.actor?.boardRole === "OWNER" ||
    boardDetail?.actor?.boardRole === "ADMIN";

  const canSelfAssign =
    boardDetail?.actor?.isBoardMember ?? Boolean(boardDetail?.actor?.boardRole);

  const { data: assignees = [], refetch: refetchAssignees } = useQuery({
    queryKey: ["card", cardId, "assignees"],
    queryFn: () => assigneesApi.listByCard(cardId),
    enabled,
  });

  const assignedUserIds = useMemo(() => {
    return new Set((assignees || []).map((a: CardAssignee) => a.id));
  }, [assignees]);

  const {
    data: boardMembers = [],
    isLoading: isBoardMembersLoading,
  } = useQuery({
    queryKey: ["board", boardId, "members"],
    queryFn: () => boardsApi.getMembers(boardId),
    enabled: assigneesOpen && canManageAssignees,
  });

  const assignSelfMutation = useMutation({
    mutationFn: () => assigneesApi.assignSelf(cardId),
    onSuccess: async () => {
      await refetchAssignees();
      toast.success("Đã tham gia card");
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể tham gia card"));
    },
  });

  const unassignSelfMutation = useMutation({
    mutationFn: () => assigneesApi.unassignSelf(cardId),
    onSuccess: async () => {
      await refetchAssignees();
      toast.success("Đã rời card");
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể rời card"));
    },
  });

  const addByAdminMutation = useMutation({
    mutationFn: (userId: string) => assigneesApi.addByAdmin(cardId, userId),
    onSuccess: async () => {
      await refetchAssignees();
      toast.success("Đã thêm thành viên vào card");
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể thêm thành viên"));
    },
  });

  const kickByAdminMutation = useMutation({
    mutationFn: (userId: string) => assigneesApi.kickByAdmin(cardId, userId),
    onSuccess: async () => {
      await refetchAssignees();
      toast.success("Đã gỡ thành viên khỏi card");
    },
    onError: (error: unknown) => {
      toast.error(getToastErrorMessage(error, "Không thể gỡ thành viên"));
    },
  });

  const isMeAssigned = Boolean(myUserId && (assignees || []).some((a: CardAssignee) => a.id === myUserId));

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Thành viên</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAssigneesOpen(true)}
            title={canManageAssignees ? "Quản lý thành viên" : "Xem thành viên"}
            className={disabled ? "opacity-50" : undefined}
          >
            {canManageAssignees ? <Plus className="mr-2 h-4 w-4" /> : null}
            Thành viên
          </Button>
        </div>

        {(assignees || []).length === 0 ? (
          <div className="text-sm text-muted-foreground">Chưa có ai được giao.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(assignees || []).map((a: CardAssignee) => (
              <button
                key={a.id}
                type="button"
                className="h-8 w-8 overflow-hidden rounded-full border bg-muted"
                title={a.displayName}
                onClick={() => setAssigneesSelected(a)}
              >
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt={a.displayName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold">
                    {(a.displayName || a.email || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(assigneesSelected)}
        onOpenChange={(open: boolean) => (!open ? setAssigneesSelected(null) : null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Thông tin</DialogTitle>
          </DialogHeader>
          {assigneesSelected ? (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border bg-muted">
                {assigneesSelected.avatarUrl ? (
                  <img
                    src={assigneesSelected.avatarUrl}
                    alt={assigneesSelected.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                    {(assigneesSelected.displayName || assigneesSelected.email || "?")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{assigneesSelected.displayName}</div>
                <div className="truncate text-sm text-muted-foreground">{assigneesSelected.email}</div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={assigneesOpen} onOpenChange={setAssigneesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thành viên</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {myUserId && canSelfAssign && !isMeAssigned ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="text-sm">Bạn</div>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => {
                    if (disabled) {
                      toast.error("Bạn không đủ quyền để cập nhật card");
                      return;
                    }
                    assignSelfMutation.mutate();
                  }}
                  disabled={assignSelfMutation.isPending}
                >
                  Tham gia
                </Button>
              </div>
            ) : null}

            {canManageAssignees ? (
              <div className="space-y-2">
                <Label>Thành viên trong board</Label>
                <div className="max-h-64 overflow-auto rounded-md border">
                  {isBoardMembersLoading ? (
                    <div className="p-3 text-sm text-muted-foreground">Đang tải…</div>
                  ) : boardMembers.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">Chưa có member nào.</div>
                  ) : (
                    <div className="divide-y">
                      {boardMembers
                        .filter((m: BoardMember) => !assignedUserIds.has(m.userId))
                        .map((m: BoardMember) => {
                        const isSelf = Boolean(myUserId && m.userId === myUserId);
                        const displayName = (m.user?.displayName || m.user?.email || m.userId).trim();
                        const email = (m.user?.email || "").trim();

                        return (
                          <div key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {displayName}
                                {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(Bạn)</span> : null}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">{email || "—"}</div>
                            </div>

                            {isSelf ? null : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  if (disabled) {
                                    toast.error("Bạn không đủ quyền để cập nhật card");
                                    return;
                                  }
                                  addByAdminMutation.mutate(m.userId);
                                }}
                                disabled={addByAdminMutation.isPending}
                                className={disabled ? "opacity-50" : undefined}
                              >
                                <UserPlus className="h-4 w-4" />
                                Thêm
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Đang được giao</Label>
              {(assignees || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Chưa có ai được giao.</div>
              ) : (
                <div className="space-y-2">
                  {(assignees || []).map((a: CardAssignee) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{a.displayName}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.email}</div>
                      </div>

                      {myUserId && a.id === myUserId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (disabled) {
                              toast.error("Bạn không đủ quyền để cập nhật card");
                              return;
                            }
                            if (!canSelfAssign) {
                              toast.error("Bạn không đủ quyền để rời card");
                              return;
                            }
                            unassignSelfMutation.mutate();
                          }}
                          disabled={unassignSelfMutation.isPending}
                          className={(!canSelfAssign || disabled) ? "opacity-50" : undefined}
                        >
                          Rời card
                        </Button>
                      ) : canManageAssignees ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (disabled) {
                              toast.error("Bạn không đủ quyền để cập nhật card");
                              return;
                            }
                            kickByAdminMutation.mutate(a.id);
                          }}
                          disabled={kickByAdminMutation.isPending}
                          className={disabled ? "opacity-50" : undefined}
                        >
                          Gỡ
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
