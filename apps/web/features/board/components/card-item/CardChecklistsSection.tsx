import { useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { checklistsApi, type Checklist, type ChecklistItem } from "../../../../api/checklists.api";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";

export function CardChecklistsSection(props: {
  boardId: string;
  cardId: string;
  enabled: boolean;
  disabled: boolean;
}) {
  const { boardId, cardId, enabled, disabled } = props;
  const queryClient = useQueryClient();

  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newItemTitles, setNewItemTitles] = useState<Record<string, string>>({});

  const { data: checklistsResp, refetch: refetchChecklists } = useQuery({
    queryKey: ["card", cardId, "checklists"],
    queryFn: () => checklistsApi.listByCard(cardId),
    enabled,
  });

  const checklists = checklistsResp?.checklists ?? [];

  const createChecklistMutation = useMutation({
    mutationFn: (title: string) => checklistsApi.createChecklist(cardId, { title }),
    onSuccess: async () => {
      setNewChecklistTitle("");
      await refetchChecklists();
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: (checklistId: string) => checklistsApi.deleteChecklist(checklistId),
    onSuccess: async () => {
      await refetchChecklists();
    },
  });

  const createItemMutation = useMutation({
    mutationFn: ({ checklistId, title }: { checklistId: string; title: string }) =>
      checklistsApi.createItem(checklistId, { title }),
    onSuccess: async (_item, vars) => {
      setNewItemTitles((m) => ({ ...m, [vars.checklistId]: "" }));
      await refetchChecklists();
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: ({ itemId, isDone }: { itemId: string; isDone: boolean }) =>
      checklistsApi.updateItem(itemId, { isDone }),
    onSuccess: async () => {
      await refetchChecklists();
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "detail"] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => checklistsApi.deleteItem(itemId),
    onSuccess: async () => {
      await refetchChecklists();
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "detail"] });
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Checklist</Label>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newChecklistTitle}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setNewChecklistTitle(e.target.value)}
          placeholder="Tạo checklist mới..."
          disabled={disabled}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const t = newChecklistTitle.trim();
            if (!t) return;
            createChecklistMutation.mutate(t);
          }}
          disabled={disabled || createChecklistMutation.isPending}
        >
          Tạo
        </Button>
      </div>

      {checklists.length === 0 ? (
        <div className="text-sm text-muted-foreground">Chưa có checklist.</div>
      ) : (
        <div className="space-y-3">
          {checklists.map((cl: Checklist) => {
            const items: ChecklistItem[] = cl.items ?? [];
            const done = items.filter((i: ChecklistItem) => i.isDone).length;

            return (
              <div key={cl.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{cl.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {done}/{items.length} đã xong
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteChecklistMutation.mutate(cl.id)}
                    disabled={disabled || deleteChecklistMutation.isPending}
                  >
                    Xoá
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Chưa có item.</div>
                  ) : (
                    items.map((it: ChecklistItem) => (
                      <div key={it.id} className="flex items-center justify-between gap-2">
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={it.isDone}
                            disabled={disabled}
                            onChange={(e) => {
                              if (disabled) return;
                              toggleItemMutation.mutate({ itemId: it.id, isDone: e.target.checked });
                            }}
                          />
                          <span
                            className={`truncate text-sm ${it.isDone ? "line-through text-muted-foreground" : ""}`}
                          >
                            {it.title}
                          </span>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteItemMutation.mutate(it.id)}
                          disabled={disabled || deleteItemMutation.isPending}
                        >
                          Xoá
                        </Button>
                      </div>
                    ))
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      value={newItemTitles[cl.id] ?? ""}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setNewItemTitles((m) => ({ ...m, [cl.id]: e.target.value }))
                      }
                      placeholder="Thêm item..."
                      disabled={disabled}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const t = (newItemTitles[cl.id] ?? "").trim();
                        if (!t) return;
                        createItemMutation.mutate({ checklistId: cl.id, title: t });
                      }}
                      disabled={disabled || createItemMutation.isPending}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
