import React, { useMemo } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

type InviteKind = "workspace";

type Props = {
  kind: InviteKind;
  token?: string;
};

export const InviteLinkBox: React.FC<Props> = ({ kind, token }) => {
  const inviteUrl = useMemo(() => {
    if (!token) return "";
    const origin = window.location.origin;
    // Frontend route: /invites/:kind/:token/accept
    return `${origin}/invites/${kind}/${token}/accept?redirect=/workspaces`;
  }, [kind, token]);

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      // toast placeholder
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }
  };

  if (!token) return null;

  return (
    <div className="space-y-2">
      <Label>Link mời</Label>
      <div className="flex gap-2">
        <Input readOnly value={inviteUrl} />
        <Button type="button" variant="secondary" onClick={copy}>
          Copy
        </Button>
      </div>
      <div className="text-xs text-gray-500">
        Gửi link này cho người được mời. Khi họ mở link và đã đăng nhập đúng email,
        hệ thống sẽ tự động thêm họ vào.
      </div>
    </div>
  );
};
