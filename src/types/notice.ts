export type Notice = {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
};
