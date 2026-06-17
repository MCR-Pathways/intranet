"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
import { Award, Loader2, X, Search, Lock, Check } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials, getAvatarColour, filterAvatarUrl } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  KUDOS_CATEGORY_ORDER,
  KUDOS_MAX_RECIPIENTS,
  KUDOS_MESSAGE_MAX_LENGTH,
  KUDOS_MAX_CATEGORIES,
  isExclusiveKudosCategory,
  type KudosCategory,
} from "@/lib/intranet";
import { editPost } from "@/app/(protected)/intranet/actions";
import {
  createKudosPost,
  addKudosRecipients,
} from "@/app/(protected)/intranet/kudos-actions";
import type { MentionUser } from "./mention-list";
import { KudosSentence } from "./kudos-sentence";

/**
 * In edit mode, the dialog opens populated with these fields. Category
 * and existing recipients are immutable (W4 design call: kudos is
 * recognition, rewriting it after publish would change who got
 * recognised and for what). Message is editable; new recipients can
 * be added up to the cap.
 *
 * `existingRecipients` carries the full locked-row data rather than
 * just ids — so a recipient who's since been deactivated still
 * renders correctly in the locked chip (their name + avatar are on
 * the kudos record, not on the live staff list).
 */
export interface KudosEditTarget {
  postId: string;
  message: string;
  categories: KudosCategory[];
  existingRecipients: MentionUser[];
}

interface KudosCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Roster of staff the sender can recognise. Sender is filtered out by id. */
  staff: MentionUser[];
  currentUserId: string;
  /** When provided, the dialog opens in edit mode for this kudos post. */
  editTarget?: KudosEditTarget;
}

export function KudosCreateDialog({
  open,
  onOpenChange,
  staff,
  currentUserId,
  editTarget,
}: KudosCreateDialogProps) {
  const isEditMode = !!editTarget;

  const [categories, setCategories] = useState<KudosCategory[]>([]);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  // Immutable in edit mode — drives the "no remove button on this chip"
  // visual. Empty in create mode (every recipient is removable).
  const [lockedRecipientIds, setLockedRecipientIds] = useState<string[]>([]);
  const [originalMessage, setOriginalMessage] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const wasOpenRef = useRef(open);

  // Hydrate from editTarget — used by both the open-transition effect
  // and the post-discard reset path. Setting it up before either
  // caller so React's rules-of-hooks ordering stays linear.
  const reset = useCallback(() => {
    if (editTarget) {
      // Re-hydrate from the original target — same state the dialog
      // started with — so re-opening lands clean rather than blank.
      const existingIds = editTarget.existingRecipients.map((r) => r.id);
      setCategories(editTarget.categories);
      setRecipientIds(existingIds);
      setLockedRecipientIds(existingIds);
      setOriginalMessage(editTarget.message);
      setMessage(editTarget.message);
    } else {
      setCategories([]);
      setRecipientIds([]);
      setLockedRecipientIds([]);
      setOriginalMessage("");
      setMessage("");
    }
    setSearchQuery("");
    setSearchOpen(false);
  }, [editTarget]);

  // Hydrate on each open false→true transition. Re-running on every
  // open means a save → revalidation → reopen cycle picks up the
  // fresh server-side data, even though the editTarget object's
  // postId hasn't changed. The wasOpenRef gate prevents re-hydration
  // on parent re-renders that don't change `open`, which would
  // otherwise stomp the user's in-progress edits.
  useEffect(() => {
    const transitionedOpen = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!transitionedOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset() sets multiple state values intentionally on the open false→true transition; the wasOpenRef gate prevents re-firing on parent re-renders.
    reset();
  }, [open, reset]);

  // Eligible staff = active mention list minus the sender. The sender
  // is also dropped server-side; client-side filter just keeps them
  // out of the picker so it doesn't read as "you can recognise yourself".
  const eligibleStaff = useMemo(
    () => staff.filter((u) => u.id !== currentUserId),
    [staff, currentUserId],
  );

  // Lookup union: live staff first (most up-to-date), then locked
  // recipients carried by editTarget (covers deactivated colleagues
  // who are no longer in the mention list but still on the kudos).
  // Live data wins on conflict so a recipient who's still active
  // gets their current avatar / job title.
  const recipientById = useMemo(() => {
    const map = new Map<string, MentionUser>();
    if (editTarget) {
      for (const r of editTarget.existingRecipients) map.set(r.id, r);
    }
    for (const u of eligibleStaff) map.set(u.id, u);
    return map;
  }, [eligibleStaff, editTarget]);

  const selectedRecipients = useMemo(
    () =>
      recipientIds
        .map((id) => recipientById.get(id))
        .filter((u): u is MentionUser => Boolean(u)),
    [recipientIds, recipientById],
  );

  // The sender's own name, for the live preview (the feed shows it too).
  const senderName = useMemo(
    () => staff.find((u) => u.id === currentUserId)?.label ?? "You",
    [staff, currentUserId],
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

  // New recipients = anyone in the picker not in the locked set. In
  // create mode lockedRecipientIds is empty so this equals recipientIds.
  const newRecipientIds = useMemo(() => {
    if (!isEditMode) return recipientIds;
    const locked = new Set(lockedRecipientIds);
    return recipientIds.filter((id) => !locked.has(id));
  }, [isEditMode, recipientIds, lockedRecipientIds]);

  const messageChanged = isEditMode && message.trim() !== originalMessage.trim();
  const hasNewRecipients = newRecipientIds.length > 0;

  const hasContent = useMemo(() => {
    if (isEditMode) {
      // In edit mode "has content" means "user has made changes worth
      // confirming before discard". Just opening on an existing kudos
      // doesn't count.
      return messageChanged || hasNewRecipients;
    }
    return (
      categories.length > 0 ||
      recipientIds.length > 0 ||
      message.trim().length > 0
    );
  }, [
    isEditMode,
    messageChanged,
    hasNewRecipients,
    categories,
    recipientIds,
    message,
  ]);

  const remainingSlots = KUDOS_MAX_RECIPIENTS - recipientIds.length;
  const charCount = message.length;
  const charsOver = charCount > KUDOS_MESSAGE_MAX_LENGTH;

  const isSubmitDisabled = isEditMode
    ? // Edit mode: disable when no actionable change OR validation fails
      isPending ||
      !message.trim() ||
      charsOver ||
      (!messageChanged && !hasNewRecipients)
    : // Create mode: every field is required
      isPending ||
      categories.length === 0 ||
      recipientIds.length === 0 ||
      !message.trim() ||
      charsOver;

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

  const removeRecipient = useCallback(
    (id: string) => {
      // Locked recipients are the people who got the original kudos —
      // removing them would rewrite who got recognised. Defensive
      // check; the chip's × button doesn't render for locked rows
      // anyway, but a future caller might wire this directly.
      if (lockedRecipientIds.includes(id)) return;
      setRecipientIds((prev) => prev.filter((rid) => rid !== id));
    },
    [lockedRecipientIds],
  );

  // Toggle a category. Up to 2; "Thank you" is exclusive — picking it clears
  // the rest, and picking any other clears it.
  const toggleCategory = useCallback((c: KudosCategory) => {
    setCategories((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (isExclusiveKudosCategory(c)) return [c];
      const next = prev.filter((x) => !isExclusiveKudosCategory(x));
      if (next.length >= KUDOS_MAX_CATEGORIES) return next;
      return [...next, c];
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (isSubmitDisabled || categories.length === 0) return;
    startTransition(async () => {
      // Wrap the server-action call so a network-layer throw (the
      // underlying fetch failing rather than the action returning an
      // error object) doesn't leave the dialog stuck with no toast.
      // The actions themselves still return {success, error} for
      // handled DB failures.
      try {
        if (isEditMode && editTarget) {
          // Edit mode: dispatch message edit BEFORE recipient adds.
          // They look independent (different tables) but addKudosRecipients
          // reads `posts.content` server-side to populate the notification
          // body for the new recipients. Running in parallel races the
          // UPDATE against the SELECT — if the SELECT wins, new recipients
          // get a notification with the OLD message text and the post
          // shows the new one. Sequential ordering closes the gap.
          if (messageChanged) {
            const result = await editPost(editTarget.postId, {
              content: message.trim(),
            });
            if (!result.success) {
              toast.error(
                result.error ??
                  "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org",
              );
              return;
            }
          }
          if (hasNewRecipients) {
            const result = await addKudosRecipients({
              postId: editTarget.postId,
              recipientIds: newRecipientIds,
            });
            if (!result.success) {
              toast.error(
                result.error ??
                  "Something went wrong. Please contact the HelpDesk at helpdesk@mcrpathways.org",
              );
              return;
            }
          }
          toast.success("Kudos updated");
          onOpenChange(false);
          // Don't reset — the dialog will rehydrate from the (now
          // stale) editTarget if reopened. Parent should pass a fresh
          // target after revalidation.
        } else {
          const result = await createKudosPost({
            message: message.trim(),
            categories,
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
        }
      } catch (err) {
        logger.error(
          isEditMode ? "Failed to edit kudos post" : "Failed to create kudos post",
          { error: err },
        );
        toast.error(
          "Something went wrong. Please try again, or contact the HelpDesk at helpdesk@mcrpathways.org if the issue continues.",
        );
      }
    });
  }, [
    isSubmitDisabled,
    isEditMode,
    editTarget,
    messageChanged,
    hasNewRecipients,
    newRecipientIds,
    categories,
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
              {isEditMode ? "Edit kudos" : "Send kudos"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Recipient picker — selected chips + search input. In
                edit mode existing recipients are locked (no × button)
                — kudos is add-only post-publish. */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">To…</p>
                <p className="text-xs text-muted-foreground">
                  {isEditMode
                    ? hasNewRecipients
                      ? `${recipientIds.length} of ${KUDOS_MAX_RECIPIENTS} (${newRecipientIds.length} new)`
                      : `${recipientIds.length} of ${KUDOS_MAX_RECIPIENTS}`
                    : recipientIds.length === 0
                      ? `Up to ${KUDOS_MAX_RECIPIENTS} colleagues`
                      : `${recipientIds.length} of ${KUDOS_MAX_RECIPIENTS} selected`}
                </p>
              </div>

              {/* Selected chips */}
              {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecipients.map((u) => {
                    const locked = lockedRecipientIds.includes(u.id);
                    return (
                      <span
                        key={u.id}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2 text-sm",
                          locked
                            ? "border-border bg-muted text-muted-foreground"
                            : "border-mcr-yellow/40 bg-mcr-yellow/15",
                        )}
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
                        {locked ? (
                          <Lock
                            className="h-3 w-3 opacity-60"
                            aria-label="Already received this kudos"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeRecipient(u.id)}
                            disabled={isPending}
                            aria-label={`Remove ${u.label}`}
                            className="rounded-full p-0.5 hover:bg-mcr-yellow/30"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    );
                  })}
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

            {/* For — category pills. Multi-select up to 2; "Thank you" is
                exclusive (picking it clears the rest, and any other clears it).
                Locked to static chips in edit mode. */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">For…</p>
                {!isEditMode && (
                  <p className="text-xs text-muted-foreground">Pick 1 or 2</p>
                )}
              </div>
              {isEditMode ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e3bd2d] bg-mcr-yellow px-3 py-1.5 text-sm font-medium text-mcr-dark-blue"
                      aria-label={`Category: ${c} (locked)`}
                    >
                      {c}
                      <Lock className="h-3 w-3 opacity-60" aria-hidden="true" />
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {KUDOS_CATEGORY_ORDER.map((c) => {
                    const selected = categories.includes(c);
                    const atCap =
                      categories.length >= KUDOS_MAX_CATEGORIES &&
                      !categories.some(isExclusiveKudosCategory);
                    const blocked =
                      !selected && atCap && !isExclusiveKudosCategory(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCategory(c)}
                        disabled={isPending || blocked}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          "motion-safe:active:scale-95",
                          selected
                            ? "border-[#e3bd2d] bg-mcr-yellow font-medium text-mcr-dark-blue"
                            : "border-border bg-card text-muted-foreground hover:bg-muted",
                          blocked && "cursor-not-allowed opacity-40 hover:bg-card",
                        )}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}
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
                aria-label="Why this kudos"
                className={cn(
                  "w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  charsOver && "border-destructive",
                )}
              />
            </div>

            {/* Live preview — the exact sentence the feed will render, so
                there are no surprises after posting. */}
            {categories.length > 0 && recipientIds.length > 0 && (
              <div className="flex items-start gap-2 rounded-[10px] border border-mcr-yellow-border bg-mcr-yellow-50 px-3 py-2.5">
                <Award
                  className="mt-0.5 h-4 w-4 shrink-0 text-mcr-dark-blue"
                  aria-hidden="true"
                />
                <p className="text-[13px] leading-snug text-muted-foreground">
                  <span className="text-muted-foreground/70">Will appear as: </span>
                  <KudosSentence
                    senderName={senderName}
                    recipientNames={selectedRecipients.map((u) => u.label)}
                    categories={categories}
                  />
                </p>
              </div>
            )}
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
              aria-busy={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  {isEditMode ? "Saving…" : "Sending…"}
                </>
              ) : (
                <>
                  <Award className="mr-1.5 h-4 w-4" />
                  {isEditMode ? "Save changes" : "Send kudos"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEditMode ? "Discard changes?" : "Discard kudos?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isEditMode
                ? "You have unsaved changes. Are you sure you want to discard them?"
                : "You have unsaved kudos content. Are you sure you want to discard?"}
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
