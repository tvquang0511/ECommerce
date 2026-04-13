import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { usersApi } from "../../../api/users.api";
import { workspacesApi } from "../../../api/workspaces.api";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { User, WorkspaceMember } from "../../../types/api";
import { ConfirmWithRoleDialog, type Role3 } from "../../../components/shared/ConfirmWithRoleDialog";
import { getToastErrorMessage } from "../../../lib/apiError";

type Props = {
  workspaceId: string;
  existingMembers?: WorkspaceMember[];
  canManage: boolean;
};

export const AddWorkspaceMemberCard: React.FC<Props> = ({
  workspaceId,
  existingMembers,
  canManage,
}) => {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selected, setSelected] = useState<User | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const existingUserIds = useMemo(() => {
    return new Set((existingMembers || []).map((m) => m.userId));
  }, [existingMembers]);

  const addMemberMutation = useMutation({
    mutationFn: (input: { email: string; role: "ADMIN" | "MEMBER" }) =>
      workspacesApi.addMemberByEmail(workspaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
      toast.success("Đã thêm thành viên vào workspace");
      setConfirmOpen(false);
      setSelected(null);
      setSearchQuery("");
      setResults([]);
    },
    onError: (error: any) => {
      toast.error(getToastErrorMessage(error, "Không thể thêm thành viên"));
    },
  });

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const users = await usersApi.search(searchQuery, { limit: 8 });
        setResults(users);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, workspaceId]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const openConfirm = (u: User) => {
    if (!canManage) {
      toast.error("Bạn không đủ quyền để thêm thành viên vào workspace");
      return;
    }
    setSelected(u);
    setConfirmOpen(true);
  };

  const handleConfirm = (role: Role3) => {
    if (!selected) return;

    if (role === "OWNER") {
      // Workspace add shouldn't allow OWNER from UI.
      return;
    }

    addMemberMutation.mutate({ email: selected.email, role: role as "ADMIN" | "MEMBER" });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Thêm thành viên</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Tìm kiếm người dùng</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Tìm theo tên hoặc email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {!canManage ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Chỉ OWNER/ADMIN của workspace mới có thể thêm thành viên.
            </div>
          ) : null}

          {searchQuery ? (
            <div className="mt-2 rounded-md border">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-gray-500">Đang tìm kiếm...</div>
              ) : results.length > 0 ? (
                <div className="max-h-64 overflow-y-auto">
                  {results.map((u) => {
                    const already = existingUserIds.has(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => openConfirm(u)}
                        disabled={already || addMemberMutation.isPending}
                        className={
                          "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 " +
                          (!canManage ? "opacity-60" : "")
                        }
                      >
                        <Avatar>
                          <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{u.displayName}</div>
                          <div className="truncate text-sm text-gray-500">{u.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {already ? (
                            <span className="text-xs text-gray-500">Đã là thành viên</span>
                          ) : (
                            <UserPlus className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-500">Không tìm thấy người dùng</div>
              )}
            </div>
          ) : null}

          <div className="text-xs text-gray-500">
            Tip: bạn có thể gõ email để tìm nhanh.
          </div>
        </CardContent>
      </Card>

      <ConfirmWithRoleDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={selected ? `Thêm ${selected.displayName} vào workspace?` : "Thêm thành viên"}
        description={selected ? selected.email : undefined}
        confirmText="Thêm"
        roleLabel="Chọn vai trò"
        allowOwner={false}
        defaultRole="MEMBER"
        loading={addMemberMutation.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
};
