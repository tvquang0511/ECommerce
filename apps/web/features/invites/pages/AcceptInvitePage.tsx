import React, { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { invitesApi } from "../../../api/invites.api";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

type InviteKind = "workspace";

/**
 * Accept invite links.
 *
 * Supported URLs:
 * - /invites/workspace/:token/accept
 * - /invites/board/:token/accept
 *
 * Optional redirect:
 * - ?redirect=/workspaces
 */
export const AcceptInvitePage: React.FC = () => {
  const { kind, token } = useParams<{ kind: InviteKind; token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirect = searchParams.get("redirect") || "/workspaces";

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!kind || !token) throw new Error("Missing invite info");
      return invitesApi.acceptWorkspaceInvite(token);
    },
    onSuccess: () => {
      navigate(redirect);
    },
  });

  useEffect(() => {
    if (kind && token) {
      acceptMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, token]);

  const message = (() => {
    if (!kind || !token) return "Link mời không hợp lệ.";
    if (acceptMutation.isPending) return "Đang chấp nhận lời mời...";
    if (acceptMutation.isError) {
      const anyErr: any = acceptMutation.error;
      return (
        anyErr?.response?.data?.error?.message ||
        anyErr?.message ||
        "Không thể chấp nhận lời mời."
      );
    }
    return "Đã chấp nhận lời mời. Đang chuyển hướng...";
  })();

  return (
    <div className="container mx-auto max-w-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle>Chấp nhận lời mời</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">{message}</div>

          {acceptMutation.isError && (
            <div className="flex gap-2">
              <Button onClick={() => acceptMutation.mutate()}>
                Thử lại
              </Button>
              <Button variant="outline" onClick={() => navigate("/workspaces")}>
                Về Workspaces
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
