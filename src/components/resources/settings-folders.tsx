"use client";

import { useEffect, useState, useTransition } from "react";
import { FolderOpen, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getRegisteredFolders,
  registerDriveFolder,
  unregisterDriveFolder,
} from "@/app/(protected)/resources/drive-actions";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface RegisteredFolder {
  id: string;
  folder_id: string;
  folder_url: string;
  name: string;
  created_at: string;
}

export function SettingsFolders() {
  const [folders, setFolders] = useState<RegisteredFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RegisteredFolder | null>(null);
  const [isPending, startTransition] = useTransition();

  // Add form state
  const [folderUrl, setFolderUrl] = useState("");
  const [folderName, setFolderName] = useState("");

  useEffect(() => {
    getRegisteredFolders().then((data) => {
      setFolders(data as RegisteredFolder[]);
      setLoading(false);
    });
  }, []);

  function handleAdd() {
    if (!folderUrl || !folderName.trim()) return;
    startTransition(async () => {
      const result = await registerDriveFolder(folderUrl, folderName.trim());
      if (result.success) {
        toast.success("Folder registered");
        setShowAdd(false);
        setFolderUrl("");
        setFolderName("");
        // Refresh list
        const data = await getRegisteredFolders();
        setFolders(data as RegisteredFolder[]);
      } else {
        toast.error(result.error ?? "Failed to register folder");
      }
    });
  }

  function handleRemove() {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await unregisterDriveFolder(removeTarget.id);
      if (result.success) {
        toast.success("Folder removed");
        setRemoveTarget(null);
        setFolders((prev) => prev.filter((f) => f.id !== removeTarget.id));
      } else {
        toast.error(result.error ?? "Failed to remove folder");
      }
    });
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading folders...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Register Google Drive folders to browse and link documents from.
        </p>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Folder
        </Button>
      </div>

      {folders.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No folders registered"
          description="Register a Google Drive folder to start linking documents."
        />
      ) : (
        <div className="space-y-2">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{folder.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Added {formatDate(new Date(folder.created_at))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setRemoveTarget(folder)}
                aria-label={`Remove ${folder.name}`}
                title="Remove folder"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add folder dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>Register Google Drive Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="folder-url">Folder URL</Label>
              <Input
                id="folder-url"
                placeholder="https://drive.google.com/drive/folders/..."
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-name">Display Name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. Policies Folder"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={isPending} aria-busy={isPending}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!folderUrl || !folderName.trim() || isPending} aria-busy={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &ldquo;{removeTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unregister the folder. Linked articles will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} aria-busy={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isPending}
              aria-busy={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
