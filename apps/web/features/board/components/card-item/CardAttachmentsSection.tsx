import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Link as LinkIcon, Route } from "lucide-react";

import { attachmentsApi, type Attachment } from "../../../../api/attachments.api";
import { Button } from "../../../../components/ui/button";
import { Label } from "../../../../components/ui/label";
import { AttachmentsDialog } from "../AttachmentsDialog";
import type { BoardDetail } from "../../../../types/api";

export function CardAttachmentsSection(props: {
  boardId: string;
  cardId: string;
  boardDetail?: BoardDetail;
  enabled: boolean;
  disabled: boolean;
}) {
  const { boardId, cardId, boardDetail, enabled, disabled } = props;

  const [attachmentsOpen, setAttachmentsOpen] = useState(false);

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["card", cardId, "attachments"],
    queryFn: () => attachmentsApi.listByCard(cardId),
    enabled,
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.delete(attachmentId),
    onSuccess: async () => {
      await refetchAttachments();
    },
  });

  const downloadAttachment = async (att: Attachment) => {
    if (att.type !== "FILE") return;
    const presign = await attachmentsApi.presignDownload(att.id);
    window.open(presign.downloadUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Attachments</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAttachmentsOpen(true)}
            disabled={disabled}
          >
            Add
          </Button>
        </div>

        {attachments.length === 0 ? (
          <div className="text-sm text-muted-foreground">Chưa có attachment nào.</div>
        ) : (
          <div className="space-y-2">
            {attachments.map((a: Attachment) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="mt-0.5 rounded bg-muted p-1">
                    {a.type === "FILE" ? (
                      <FileText className="h-4 w-4" />
                    ) : a.type === "LINK" ? (
                      <LinkIcon className="h-4 w-4" />
                    ) : (
                      <Route className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    {a.type === "FILE" ? (
                      <button
                        type="button"
                        className="block truncate text-left text-sm font-medium underline"
                        onClick={() => downloadAttachment(a)}
                        title="Download"
                      >
                        {a.fileName || a.objectKey || a.id}
                      </button>
                    ) : a.type === "LINK" ? (
                      <a
                        href={a.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-medium underline"
                        title={a.linkUrl}
                      >
                        {a.linkTitle || a.linkUrl}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="block truncate text-left text-sm font-medium underline"
                        title="Open referenced card"
                        onClick={() => {
                          const refId = a.referencedCardId;
                          if (!refId) return;
                          window.location.assign(`/boards/${boardId}?cardId=${refId}`);
                        }}
                      >
                        {a.linkTitle || "Card reference"}
                      </button>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {a.type === "FILE" ? "File" : a.type === "LINK" ? "Link" : "Card"}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => deleteAttachmentMutation.mutate(a.id)}
                  disabled={disabled || deleteAttachmentMutation.isPending}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AttachmentsDialog
        open={attachmentsOpen}
        onOpenChange={setAttachmentsOpen}
        disabled={disabled}
        boardId={boardId}
        cardId={cardId}
        boardDetail={boardDetail}
        onCreated={() => refetchAttachments()}
      />
    </>
  );
}
