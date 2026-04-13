import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link as LinkIcon, Paperclip, Route, Upload } from "lucide-react";

import type { BoardDetail, Card } from "../../../types/api";
import { attachmentsApi } from "../../../api/attachments.api";
import { cardsApi } from "../../../api/cards.api";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

type Mode = "menu" | "link" | "file" | "card";

export function AttachmentsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  boardId: string;
  cardId: string;
  boardDetail?: BoardDetail;
  onCreated?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("menu");
  const disabled = Boolean(props.disabled);

  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  const [cardQuery, setCardQuery] = useState("");
  const [pickedCardId, setPickedCardId] = useState<string>("");
  const [cardTitle, setCardTitle] = useState("");

  const reset = () => {
    setMode("menu");
    setLinkUrl("");
    setLinkTitle("");
    setCardQuery("");
    setPickedCardId("");
    setCardTitle("");
  };

  const createLinkMutation = useMutation({
    mutationFn: () => attachmentsApi.createLink(props.cardId, { linkUrl: linkUrl.trim(), linkTitle: linkTitle.trim() || undefined }),
    onSuccess: () => {
      props.onCreated?.();
      props.onOpenChange(false);
      reset();
    },
  });

  const isValidHttpUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const uploadFileMutation = useMutation({
    mutationFn: (file: File) => attachmentsApi.uploadFileToCard(props.cardId, file),
    onSuccess: () => {
      props.onCreated?.();
      props.onOpenChange(false);
      reset();
    },
  });

  const attachCardMutation = useMutation({
    mutationFn: () => attachmentsApi.createCardRef(props.cardId, { referencedCardId: pickedCardId, linkTitle: cardTitle.trim() || undefined }),
    onSuccess: () => {
      props.onCreated?.();
      props.onOpenChange(false);
      reset();
    },
  });

  const { data: referencedCard } = useQuery({
    queryKey: ["card", pickedCardId],
    queryFn: () => cardsApi.getById(pickedCardId),
    enabled: !!pickedCardId && mode === "card",
  });

  const allCardsInBoard: Card[] = useMemo(() => {
    const bd = props.boardDetail;
    if (!bd) return [];
    const cards: Card[] = [];
    for (const l of bd.lists) {
      for (const c of l.cards) cards.push(c);
    }
    return cards;
  }, [props.boardDetail]);

  const candidates = useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    const base = allCardsInBoard.filter((c) => c.id !== props.cardId);
    if (!q) return base.slice(0, 20);
    return base.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 20);
  }, [allCardsInBoard, cardQuery, props.cardId]);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        props.onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Add attachment
            </span>
          </DialogTitle>
        </DialogHeader>

        {mode === "menu" ? (
          <div className="grid gap-2">
            <Button variant="secondary" type="button" onClick={() => setMode("link")} disabled={disabled}>
              <LinkIcon className="h-4 w-4" />
              Attach a link
            </Button>
            <Button variant="secondary" type="button" onClick={() => setMode("file")} disabled={disabled}>
              <Upload className="h-4 w-4" />
              Upload a file
            </Button>
            <Button variant="secondary" type="button" onClick={() => setMode("card")} disabled={disabled}>
              <Route className="h-4 w-4" />
              Attach another card
            </Button>
          </div>
        ) : null}

        {mode === "link" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Display name" disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." disabled={disabled} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={reset}>Back</Button>
              <Button
                type="button"
                disabled={disabled || !linkUrl.trim() || !isValidHttpUrl(linkUrl.trim()) || createLinkMutation.isPending}
                onClick={() => {
                  if (disabled) return;
                  const url = linkUrl.trim();
                  if (!isValidHttpUrl(url)) return;
                  createLinkMutation.mutate();
                }}
              >
                {createLinkMutation.isPending ? "Saving..." : "Attach"}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "file" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>File</Label>
              <Input
                type="file"
                disabled={disabled || uploadFileMutation.isPending}
                onChange={(e) => {
                  if (disabled) {
                    e.currentTarget.value = "";
                    return;
                  }
                  const f = e.target.files?.[0];
                  if (f) uploadFileMutation.mutate(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={reset}>Back</Button>
            </div>
          </div>
        ) : null}

        {mode === "card" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Search card in this board</Label>
              <Input value={cardQuery} onChange={(e) => setCardQuery(e.target.value)} placeholder="Type to search..." disabled={disabled} />
            </div>

            <div className="max-h-48 overflow-auto rounded-md border">
              {candidates.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No cards found.</div>
              ) : (
                <div className="divide-y">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={
                        "flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent " +
                        (pickedCardId === c.id ? "bg-accent" : "")
                      }
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        setPickedCardId(c.id);
                        setCardTitle("");
                      }}
                    >
                      <span className="truncate text-sm">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{c.id.slice(0, 6)}...</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pickedCardId ? (
              <div className="space-y-2 rounded-md border p-3">
                <div className="text-sm font-medium">Selected</div>
                <div className="text-sm">{referencedCard?.title || pickedCardId}</div>
                <div className="space-y-2">
                  <Label>Title override (optional)</Label>
                  <Input value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="e.g. 'Dependency: Login card'" disabled={disabled} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={reset}>Back</Button>
                  <Button
                    type="button"
                    disabled={disabled || !pickedCardId || attachCardMutation.isPending}
                    onClick={() => {
                      if (disabled) return;
                      attachCardMutation.mutate();
                    }}
                  >
                    {attachCardMutation.isPending ? "Attaching..." : "Attach"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button variant="outline" type="button" onClick={reset}>Back</Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
