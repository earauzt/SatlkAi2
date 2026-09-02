/** Flujo de inbox en el dispositivo. Stalkr: open / done / follow_up. */
export const INBOX_STATUSES = ['open', 'seen', 'follow_up'] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const INBOX_STATUS_META: Record<InboxStatus, { label: string }> = {
  open: { label: 'Abierto' },
  seen: { label: 'Visto' },
  follow_up: { label: 'Seguimiento' },
};

export const INBOX_STATUS_STORAGE_KEY = 'satlk.guschmer.inboxStatus.v1';
export const INBOX_STATUS_EVENT = 'satlk-inbox-status';
