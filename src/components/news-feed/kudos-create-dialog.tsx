"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Award, Loader2, X, Search } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import {
  KUDOS_CATEGORY_ORDER,
  KUDOS_MAX_RECIPIENTS,
  KUDOS_MESSAGE_MAX_LENGTH,
  type KudosCategory,
} from "@/lib/intranet";
import { createKudosPost } from "@/app/(protected)/intranet/actions";
import type { MentionUser } from "./mention-list";

interface KudosCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Roster of staff the sender can recognise. Sender is filtered out by id. */
  staff: MentionUser[];
  currentUserId: string;
}

export function KudosCreateDialog({
  open,
  onOpenChange,
  staff,
  currentUserId,
}: KudosCreateDialogProps) {
  const [category, setCategory] = useState<KudosCategory | null>(null);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Eligible staff = active mention list minus the sender. The sender
  // is also dropped server-side; client-side filter just keeps them
  // out of the picker so it doesn't read as "you can recognise yourself".
  const eligibleStaff = useMemo(
    () => staff.filter((u) => u.id !== currentUserId),
    [staff, currentUserId],
  );

  const recipientById = useMemo(() => {
    const map = new Map<string, MentionUser>();
    for (const u of eligibleStaff) map.set(u.id, u);
    return map;
  }, [eligibleStaff]);

  const selectedRecipients = useMemo(
    () =>
      recipientIds
        .map((id) => recipientById.get(id))
        .filter((u): u is MentionUser => Boolean(u)),
    [recipientIds, recipientById],
  );

  // Search results: filter by query (case-insensitive label match), exclude
  // already-selected. Cap at 50 to avoid scroll-list-of-the-whole-org.
  const searchResults = useMemo(() => {
    const selectedSet = new Set(recipientIds);
    const query = searchQuery.trim().toLowerCase();
    return eligibleStaff
      .filter((u) => !selectedSet.has(u.id))
      .filter((u) => (query === "" ? true : u.label.toLowerCase().includes(query)))
      .slice(0, 50);
  }, [eligibleStaff, recipientIds, searchQuery]);

  const hasContent = useMemo(
    () =>
      category !== null ||
      recipientIds.length > 0 ||
      message.trim().length > 0,
    [category, recipientIds, message],
  );

  const remainingSlots = KUDOS_MAX_RECIPIENTS - recipientIds.length;
  const charCount = message.length;
  const charsOver = charCount > KUDOS_MESSAGE_MAX_LENGTH;

  const isSubmitDisabled =
    isPending ||
    !category ||
    recipientIds.length === 0 ||
    !message.trim() ||
    charsOver;

  const reset = useCallback(() => {
    setCategory(null);
    setRecipientIds([]);
    setMessage("");
    setSearchQuery("");
    setSearchOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    if (hasContent && !isPending) {
      setShowDiscardAlert(true);
    } else {
      onOpenChange(false);
      reset();
    }
  }, [hasContent, isPending, onOpenChange, reset]);

  const handleDiscard = useCallback(() => {
    setShowDiscardAlert(false);
    onOpenChange(false);
    reset();
  }, [onOpenChange, reset]);

  const addRecipient = useCallback(
    (id: string) => {
      setRecipientIds((prev) => {
        if (prev.includes(id)) return prev;
        if (prev.length >= KUDOS_MAX_RECIPIENTS) return prev;
        return [...prev, id];
      });
      setSearchQuery("");
      // Refocus the search input so the next pick is one type away.
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    },
    [],
  );

  const removeRecipient = useCallback((id: string) => {
    setRecipientIds((prev) => prev.filter((rid) => rid !== id));
  }, []);

  const handleSubmit = useCallback(() => {
    if (isSubmitDisabled || !category) return;
    startTransition(async () => {
      const result = await createKudosPost({
        message: message.trim(),
        category,
        recipientIds,
      });
      if (result.success) {
        toast.success("Kudos sent");
        reset();
        onOpenChange(false);
      } else {
        toast.error(
          result.error ??
            "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org",
        );
      }
    });
  }, [
    isSubmitDisabled,
    category,
    message,
    recipientIds,
    onOpenChange,
    reset,
  ]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            handleClose();
          } else {
            onOpenChange(true);
          }
        }}
      >
        <DialogContent
          className="max-w-lg gap-0"
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            if (hasContent) {
              e.preventDefault();
              setShowDiscardAlert(true);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (hasContent) {
              e.preventDefault();
              setShowDiscardAlert(true);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-mcr-yellow/20">
                <Award className="h-5 w-5" />
              </span>
              Send kudos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Category picker — single-select chips. Required. */}
            <div className="space-y-2">
              <p className="text-sm font-medium">For…</p>
              <div className="flex flex-wrap gap-2">
                {KUDOS_CATEGORY_ORDER.map((c) => {
                  const selected = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      disabled={isPending}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        "motion-safe:active:scale-95",
                        selected
                          ? "border-mcr-yellow bg-mcr-yellow/15 text-foreground font-medium"
                          : "border-border bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recipient picker — selected chips + search input. */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">To…</p>
                <p className="text-xs text-muted-foreground">
                  {recipientIds.length === 0
                    ? `Up to ${KUDOS_MAX_RECIPIENTS} colleagues`
                    : `${recipientIds.length} of ${KUDOS_MAX_RECIPIENTS} selected`}
                </p>
              </div>

              {/* Selected chips */}
              {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecipients.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-mcr-yellow/15 border border-mcr-yellow/40 py-0.5 pl-1 pr-2 text-sm"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage
                          src={filterAvatarUrl(u.avatar_url)}
                          alt={u.label}
                        />
                        <AvatarFallback
                          className={cn(
                            getAvatarColour(u.label).bg,
                            getAvatarColour(u.label).fg,
                            "text-[9px]",
                          )}
                        >
                          {getInitials(u.label)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.label}</span>
                      <button
                        type="button"
                        onClick={() => removeRecipient(u.id)}
                        disabled={isPending}
                        aria-label={`Remove ${u.label}`}
                        className="rounded-full p-0.5 hover:bg-mcr-yellow/30"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search input — always visible so adding more recipients
                  is one keystroke away. Disabled past the cap with an
                  inline hint instead of hiding (prevents the "where did
                  it go" moment). */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => {
                    // Delay close so click-on-result registers before the
                    // dropdown unmounts.
                    setTimeout(() => setSearchOpen(false), 150);
                  }}
                  placeholder={
                    remainingSlots <= 0
                      ? "Recipient cap reached"
                      : "Search colleagues by name…"
                  }
                  disabled={isPending || remainingSlots <= 0}
                  className="pl-9"
                />

                {/* Result dropdown — appears below the input on focus.
                    Capped at 50 results in useMemo. Shows job_title as
                    a hint to disambiguate same-named colleagues. */}
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-60 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addRecipient(u.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted text-sm"
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage
                            src={filterAvatarUrl(u.avatar_url)}
                            alt={u.label}
                          />
                          <AvatarFallback
                            className={cn(
                              getAvatarColour(u.label).bg,
                              getAvatarColour(u.label).fg,
                              "text-[10px]",
                            )}
                          >
                            {getInitials(u.label)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{u.label}</p>
                          {u.job_title && (
                            <p className="text-xs text-muted-foreground truncate">
                              {u.job_title}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchOpen &&
                  searchQuery.trim() !== "" &&
                  searchResults.length === 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
                      No colleagues match &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
              </div>
            </div>

            {/* Message body */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">Why…</p>
                <p
                  className={cn(
                    "text-xs",
                    charCount > KUDOS_MESSAGE_MAX_LENGTH * 0.9
                      ? "text-amber-500"
                      : "text-muted-foreground",
                    charsOver && "text-destructive",
                  )}
                >
                  {charCount} / {KUDOS_MESSAGE_MAX_LENGTH}
                </p>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Say what they did and why it mattered…"
                disabled={isPending}
                rows={4}
                className={cn(
                  "w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  charsOver && "border-destructive",
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Award className="mr-1.5 h-4 w-4" />
                  Send kudos
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard kudos?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved kudos content. Are you sure you want to discard?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDiscardAlert(false)}
            >
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
