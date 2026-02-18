"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(protected)/notifications/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck, ExternalLink, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationBellProps {
  initialNotifications?: Notification[];
}

export function NotificationBell({ initialNotifications }: NotificationBellProps) {
  const router = useRouter();
  const hasInitialData = initialNotifications !== undefined;
  const [notifications, setNotifications] = useState<Notification[]>(
    initialNotifications ?? []
  );
  const [unreadCount, setUnreadCount] = useState(
    initialNotifications?.filter((n) => !n.is_read).length ?? 0
  );
  const [isLoading, setIsLoading] = useState(!hasInitialData);

  const fetchNotifications = useCallback(async () => {
    const { notifications: data, error } = await getNotifications();

    if (error) {
      console.error("Error fetching notifications:", error);
      setIsLoading(false);
      return;
    }

    setNotifications((data as Notification[]) || []);
    setUnreadCount(
      (data as Notification[])?.filter((n) => !n.is_read).length || 0
    );
    setIsLoading(false);
  }, []);

  // Sync state when server-provided notifications change (e.g. after revalidatePath)
  /* eslint-disable react-hooks/set-state-in-effect -- syncing server props to client state */
  useEffect(() => {
    if (initialNotifications === undefined) return;
    setNotifications(initialNotifications);
    setUnreadCount(initialNotifications.filter((n) => !n.is_read).length);
    setIsLoading(false);
  }, [initialNotifications]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Only fetch client-side if no server data was provided
  /* eslint-disable react-hooks/set-state-in-effect -- legitimate data-fetching-on-mount pattern */
  useEffect(() => {
    if (hasInitialData) return;
    fetchNotifications();
  }, [fetchNotifications, hasInitialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    try {
      await markAllNotificationsRead();

      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }

    // Navigate if there's a link
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[300px]">
          {isLoading ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-accent rounded-sm ${
                    !notification.is_read ? "bg-accent/50" : ""
                  } ${notification.type === "mandatory_course" && !notification.is_read ? "border-l-2 border-destructive" : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-2">
                    {!notification.is_read && notification.type === "mandatory_course" ? (
                      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                    ) : !notification.is_read ? (
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                    ) : null}
                    <div className={`flex-1 ${notification.is_read ? "pl-4" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium leading-tight">
                            {notification.title}
                          </p>
                          {notification.type === "mandatory_course" && !notification.is_read && (
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                              Required
                            </span>
                          )}
                        </div>
                        {notification.link && (
                          <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
