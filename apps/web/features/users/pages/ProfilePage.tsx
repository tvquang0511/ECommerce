import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usersApi } from "../../../api/users.api";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const ProfilePage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: me, isLoading, isError } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => usersApi.me(),
  });

  const [displayName, setDisplayName] = React.useState("");
  const [description, setDescription] = React.useState<string>("");

  React.useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName ?? "");
    setDescription(me.description ?? "");
  }, [me]);

  const updateMutation = useMutation({
    mutationFn: (payload: { displayName?: string; description?: string | null }) => usersApi.updateMe(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(["users", "me"], user);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const upload = await usersApi.initAvatarUpload({ fileName: file.name, contentType: file.type });

      await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: {
          ...(upload.headers || {}),
        },
        body: file,
      });

      return usersApi.commitAvatarUpload({ objectKey: upload.objectKey });
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["users", "me"], user);
    },
  });

  const onSave = () => {
    updateMutation.mutate({
      displayName: displayName.trim() || undefined,
      description: description.trim() ? description.trim() : null,
    });
  };

  const onPickAvatar: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    avatarMutation.mutate(file);
    e.currentTarget.value = "";
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-600">Đang tải…</div>;
  }

  if (isError || !me) {
    return <div className="p-6 text-sm text-red-600">Không thể tải profile.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-600">Cập nhật thông tin cá nhân của bạn.</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-start gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-full border">
              {me.avatarUrl ? (
                <img src={me.avatarUrl} alt={me.displayName} className="h-full w-full object-cover" />
              ) : (
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-blue-600 text-xl text-white">
                    {getInitials(me.displayName)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <label className="cursor-pointer text-sm font-medium text-blue-600 hover:underline">
              Đổi avatar
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={onPickAvatar}
                disabled={avatarMutation.isPending}
              />
            </label>
            {avatarMutation.isPending ? (
              <div className="text-xs text-gray-500">Đang upload…</div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="mb-1 text-sm font-medium text-gray-700">Email</div>
                <Input value={me.email} readOnly />
              </div>

              <div>
                <div className="mb-1 text-sm font-medium text-gray-700">Tên hiển thị</div>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>

              <div>
                <div className="mb-1 text-sm font-medium text-gray-700">Mô tả</div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Giới thiệu ngắn về bạn…"
                  rows={5}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={onSave} disabled={updateMutation.isPending || avatarMutation.isPending}>
                Lưu
              </Button>
              {updateMutation.isPending ? <div className="text-sm text-gray-500">Đang lưu…</div> : null}
              {updateMutation.isError ? <div className="text-sm text-red-600">Lưu thất bại.</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <div>Tip: avatar đang dùng cơ chế upload qua MinIO (presigned PUT) và lưu objectKey vào DB.</div>
      </div>
    </div>
  );
};
