import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { invitesApi } from "../../../api/invites.api";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { InviteLinkBox } from "../components/InviteLinkBox";

export const CreateWorkspaceInvitePage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Missing workspaceId");
      return invitesApi.inviteToWorkspace(workspaceId, { email });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    mutation.mutate();
  };

  const errorMessage = (() => {
    if (!mutation.isError) return null;
    const anyErr: any = mutation.error;
    return (
      anyErr?.response?.data?.error?.message || anyErr?.message || "Không thể tạo lời mời"
    );
  })();

  return (
    <div className="container mx-auto max-w-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle>Mời thành viên vào workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email người được mời</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Đang tạo..." : "Tạo lời mời"}
            </Button>
          </form>

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <InviteLinkBox kind="workspace" token={mutation.data?.invite?.token} />
        </CardContent>
      </Card>
    </div>
  );
};
