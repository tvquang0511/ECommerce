import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { workspacesApi } from "../../../api/workspaces.api";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Plus, Briefcase, ChevronRight } from "lucide-react";
// toast placeholder (wire real toast later)

export const WorkspaceListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspacesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      // toast: created
    },
    onError: (error: any) => {
      console.error(error.response?.data?.error?.message || "Tạo workspace thất bại");
    },
  });

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: newWorkspaceName,
      // Backend currently accepts only name; keep description for future.
      description: newWorkspaceDescription || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg">Đang tải workspaces...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspaces của bạn</h1>
          <p className="mt-2 text-gray-600">
            Quản lý tất cả workspaces và boards
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Tạo Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateWorkspace}>
              <DialogHeader>
                <DialogTitle>Tạo Workspace mới</DialogTitle>
                <DialogDescription>
                  Workspace là nơi nhóm của bạn cộng tác trên các boards
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên workspace</Label>
                  <Input
                    id="name"
                    placeholder="VD: Marketing Team"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
                  <Textarea
                    id="description"
                    placeholder="Mô tả ngắn về workspace này..."
                    value={newWorkspaceDescription}
                    onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Huỷ
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Đang tạo..." : "Tạo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {workspaces && workspaces.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => navigate(`/workspaces/${workspace.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
                <CardTitle className="mt-4">{workspace.name}</CardTitle>
                {workspace.description && (
                  <CardDescription className="line-clamp-2">
                    {workspace.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500">
                  {workspace.createdAt
                    ? `Tạo lúc ${new Date(workspace.createdAt).toLocaleDateString("vi-VN")}`
                    : ""}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-semibold">
              Chưa có workspace nào
            </h3>
            <p className="mb-4 text-center text-sm text-gray-600">
              Tạo workspace đầu tiên để bắt đầu quản lý dự án
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tạo Workspace đầu tiên
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
