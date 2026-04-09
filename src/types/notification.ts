export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean | null;
  read_at: string | null;
  created_at: string | null;
}
