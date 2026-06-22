export type AdminChatRoomType = "direct" | "group";

export type AdminChatRoomRow = {
  id: string;
  type: AdminChatRoomType;
  name: string | null;
  direct_key: string | null;
  created_by_key: string;
  created_at: string;
  updated_at: string;
};

export type AdminChatMemberRow = {
  id: string;
  room_id: string;
  admin_user_key: string;
  role: "owner" | "member";
  joined_at: string;
  last_read_at: string | null;
};

export type AdminChatMessageRow = {
  id: string;
  room_id: string;
  sender_key: string;
  sender_display_name: string;
  sender_role_label: string;
  body: string;
  created_at: string;
};

export type AdminChatMessageDto = {
  id: string;
  roomId: string;
  senderKey: string;
  senderDisplayName: string;
  senderRoleLabel: string;
  body: string;
  createdAt: string;
};

export type AdminChatRoomSummary = {
  id: string;
  type: AdminChatRoomType;
  name: string;
  memberCount: number;
  otherParticipant?: {
    key: string;
    displayName: string;
    roleLabel: string;
  };
  lastMessage?: AdminChatMessageDto;
  unreadCount: number;
  updatedAt: string;
};

export type AdminChatAdminOption = {
  key: string;
  displayName: string;
  roleLabel: string;
  username: string;
  isBootstrap: boolean;
};

export function mapMessageRow(row: AdminChatMessageRow): AdminChatMessageDto {
  return {
    id: row.id,
    roomId: row.room_id,
    senderKey: row.sender_key,
    senderDisplayName: row.sender_display_name,
    senderRoleLabel: row.sender_role_label,
    body: row.body,
    createdAt: row.created_at,
  };
}
