import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { boardsApi } from "../../../api/boards.api";
import { usersApi } from "../../../api/users.api";
import { workspacesApi } from "../../../api/workspaces.api";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Button } from "../../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

import { Search, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import type { BoardMember, User, WorkspaceMember } from "../../../types/api";
import { ConfirmWithRoleDialog, type Role3 } from "../../../components/shared/ConfirmWithRoleDialog";

interface Props {
  boardId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

export const BoardMembersDialog: React.FC<Props> = ({
  boardId,
  workspaceId,
  open,
  onOpenChange,
}) => {
  const queryClient = useQueryClient();

  const { data: boardDetail } = useQuery({
    queryKey: ["board", boardId, "detail"],
    queryFn: () => boardsApi.getDetail(boardId),
    enabled: open && !!boardId,
  });

  const { data: workspaceMembers } = useQuery({
    queryKey: ["workspace", workspaceId, "members"],
    queryFn: () => workspacesApi.getMembers(workspaceId),
    enabled: open && !!workspaceId,
  });

  const boardMembers = boardDetail?.members || [];
  const boardUserIds = useMemo(() => new Set(boardMembers.map((m) => m.userId)), [boardMembers]);

  // --- Add tab search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const candidatesFromWorkspace = useMemo(() => {
    const members = workspaceMembers || [];
    return members.filter((m) => !boardUserIds.has(m.userId));
  }, [workspaceMembers, boardUserIds]);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const addMemberMutation = useMutation({
    mutationFn: (input: { email: string; role: "ADMIN" | "MEMBER" }) =>
      boardsApi.addMemberByEmail(boardId, { email: input.email, role: input.role } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "members"] });
      toast.success("Đã thêm thành viên vào board");
      setConfirmOpen(false);
      setSelectedUser(null);
      setSearchQuery("");
      setSearchResults([]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || "Không thể thêm thành viên");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (input: { userId: string; role: "ADMIN" | "MEMBER" }) =>
      boardsApi.updateMemberRole(boardId, input.userId, input.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "members"] });
      toast.success("Đã cập nhật vai trò thành viên");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || "Không thể cập nhật vai trò");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => boardsApi.removeMember(boardId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId, "members"] });
      toast.success("Đã xoá thành viên khỏi board");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || "Không thể xoá thành viên");
    },
  });

  useEffect(() => {
    if (!searchQuery.trim() || !open) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await usersApi.search(searchQuery, { limit: 8 });
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, open, workspaceId]);

  const canManage = boardDetail?.actor?.canManageBoardMembers ?? false;

  const openConfirm = (u: User) => {
    setSelectedUser(u);
    setConfirmOpen(true);
  };

  const handleConfirmAdd = async (role: Role3) => {
    if (!selectedUser) return;

    addMemberMutation.mutate(
      { email: selectedUser.email, role: role === "OWNER" ? "MEMBER" : (role as any) }
    );
  };

  const addList = useMemo(() => {
    // Show workspace members not on board first; fallback to search results.
    const wsAsUsers: User[] = (candidatesFromWorkspace || []).map((m: WorkspaceMember) => ({
      id: m.userId,
      email: m.email || "",
      displayName: m.displayName || m.email || "",
      avatarUrl: m.avatarUrl ?? null,
    }));

    const merged = [...wsAsUsers];

    // Add search results that aren’t already in list.
    for (const u of searchResults) {
      const exists = merged.some((x) => x.id === u.id);
      if (!exists) merged.push(u);
    }

    // Filter out users already on board.
    return merged.filter((u) => !boardUserIds.has(u.id));
  }, [candidatesFromWorkspace, searchResults, boardUserIds]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thành viên board</DialogTitle>
            <DialogDescription>
              Thêm thành viên từ workspace hoặc quản lý thành viên hiện tại.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="add" className="w-full">
            <TabsList>
              <TabsTrigger value="add">Thêm</TabsTrigger>
              <TabsTrigger value="manage">Quản lý</TabsTrigger>
            </TabsList>

            <TabsContent value="add" className="mt-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Tìm kiếm trong workspace</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Tìm theo tên hoặc email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="rounded-md border">
                  {!canManage ? (
                    <div className="p-4 text-center text-sm text-gray-600">
                      Bạn không có quyền quản lý thành viên board.
                    </div>
                  ) : isSearching ? (
                    <div className="p-4 text-center text-sm text-gray-500">Đang tìm kiếm...</div>
                  ) : addList.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto">
                      {addList.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => openConfirm(u)}
                          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50"
                          disabled={addMemberMutation.isPending || updateRoleMutation.isPending}
                        >
                          <Avatar>
                            {u.avatarUrl ? (
                              <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                            ) : null}
                            <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{u.displayName}</div>
                            <div className="truncate text-sm text-gray-500">{u.email}</div>
                          </div>
                          <UserPlus className="h-4 w-4 text-gray-400" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500">Không có ứng viên phù hợp</div>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  Gợi ý: ưu tiên hiển thị thành viên workspace chưa ở trong board.
                </div>
              </div>
            </TabsContent>

            <TabsContent value="manage" className="mt-4">
              <div className="space-y-3">
                <div className="rounded-md border">
                  {boardMembers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">Board chưa có thành viên.</div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto">
                      {boardMembers.map((m: BoardMember) => (
                        <div key={m.id} className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              {m.user.avatarUrl ? (
                                <AvatarImage src={m.user.avatarUrl} alt={m.user.displayName} />
                              ) : null}
                              <AvatarFallback>{getInitials(m.user.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{m.user.displayName}</div>
                              <div className="truncate text-sm text-gray-500">{m.user.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Select
                              value={m.role}
                              onValueChange={(v) => {
                                const next = v as "ADMIN" | "MEMBER" | "OWNER";
                                if (next === "OWNER") return;
                                updateRoleMutation.mutate({ userId: m.userId, role: next });
                              }}
                              disabled={!canManage || m.role === "OWNER" || updateRoleMutation.isPending}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="OWNER" disabled>
                                  OWNER
                                </SelectItem>
                                <SelectItem value="ADMIN">ADMIN</SelectItem>
                                <SelectItem value="MEMBER">MEMBER</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeMemberMutation.mutate(m.userId)}
                              disabled={!canManage || m.role === "OWNER" || removeMemberMutation.isPending}
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Kick
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  Lưu ý: không thể đổi/kick OWNER.
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmWithRoleDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={selectedUser ? `Thêm ${selectedUser.displayName} vào board?` : "Thêm thành viên"}
        description={selectedUser ? selectedUser.email : undefined}
        confirmText="Thêm"
        allowOwner={false}
        defaultRole="MEMBER"
        loading={addMemberMutation.isPending || updateRoleMutation.isPending}
        onConfirm={handleConfirmAdd}
      />
    </>
  );
};
