import { TicketStatus } from '@prisma/client';

// Maintenance record inputs do not depend on parts requests: the engineer can
// keep working (and submit) while the ticket is awaiting parts.
export const WORKABLE_STATUSES: TicketStatus[] = [
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_PARTS,
];
