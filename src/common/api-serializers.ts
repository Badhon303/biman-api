import {
  EquipmentStatus,
  RequestStatus,
  ScheduleStatus,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@prisma/client';

export const equipmentStatusLabel: Record<EquipmentStatus, string> = {
  [EquipmentStatus.AVAILABLE]: 'Available',
  [EquipmentStatus.UNDER_MAINTENANCE]: 'Under Maintenance',
  [EquipmentStatus.OUT_OF_SERVICE]: 'Out of Service',
  [EquipmentStatus.INACTIVE]: 'Inactive',
};

export const ticketTypeLabel: Record<TicketType, string> = {
  [TicketType.F_SERVICE]: 'F-Service',
  [TicketType.B_SERVICE]: 'B-Service',
  [TicketType.C_SERVICE]: 'C-Service',
  [TicketType.D_SERVICE]: 'D-Service',
  [TicketType.E_SERVICE]: 'E-Service',
  [TicketType.V_SERVICE]: 'V-Service',
  [TicketType.OTHERS]: 'Others',
  [TicketType.BREAKDOWN]: 'Breakdown',
  [TicketType.GENERAL]: 'General',
  [TicketType.WASHING]: 'Washing',
};

export const ticketStatusLabel: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Open',
  [TicketStatus.ASSIGNED]: 'Assigned',
  [TicketStatus.IN_PROGRESS]: 'In Progress',
  [TicketStatus.AWAITING_PARTS]: 'Awaiting Parts',
  [TicketStatus.AWAITING_VERIFICATION]: 'Awaiting Verification',
  [TicketStatus.COMPLETED]: 'Completed',
  [TicketStatus.CLOSED]: 'Closed',
};

export const ticketPriorityLabel: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'Low',
  [TicketPriority.MEDIUM]: 'Medium',
  [TicketPriority.HIGH]: 'High',
  [TicketPriority.CRITICAL]: 'Critical',
};

export const requestStatusLabel: Record<RequestStatus, string> = {
  [RequestStatus.PENDING]: 'Pending',
  [RequestStatus.APPROVED]: 'Approved',
  [RequestStatus.REJECTED]: 'Rejected',
  [RequestStatus.RECEIVED]: 'Received',
};

export const scheduleStatusLabel: Record<ScheduleStatus, string> = {
  [ScheduleStatus.SCHEDULED]: 'Scheduled',
  [ScheduleStatus.DUE_SOON]: 'Due soon',
  [ScheduleStatus.OVERDUE]: 'Overdue',
};

export function serializeTicket(ticket: any) {
  const {
    equipment,
    pmService,
    assignedEngineer,
    createdBy,
    maintenanceRecord,
    feedback,
    history,
    requests,
    ...fields
  } = ticket;
  return {
    ...fields,
    serviceType: ticketTypeLabel[ticket.serviceType],
    status: ticketStatusLabel[ticket.status],
    priority: ticketPriorityLabel[ticket.priority],
    createdDate: ticket.createdAt,
    pmType: pmService?.name,
    equipment: equipment
      ? {
          id: equipment.id,
          assetNo: equipment.assetNo,
          model: equipment.model,
          equipmentType:
            typeof equipment.equipmentType === 'string'
              ? equipment.equipmentType
              : equipment.equipmentType?.name,
        }
      : undefined,
    assignedEngineer: assignedEngineer
      ? { id: assignedEngineer.id, name: assignedEngineer.name }
      : undefined,
    createdBy: createdBy
      ? { id: createdBy.id, name: createdBy.name, email: createdBy.email }
      : undefined,
    maintenanceRecord: maintenanceRecord
      ? {
          ...maintenanceRecord,
          inspectionChecklist: maintenanceRecord.checklistItems ?? [],
          workImages:
            maintenanceRecord.workImages?.map(({ fileAsset }) => ({
              id: fileAsset.id,
              url: `/api/files/${fileAsset.id}`,
              thumbnailUrl: `/api/files/${fileAsset.id}/thumbnail`,
            })) ?? [],
          engineerFeedback: feedback?.at(-1)?.bodyHtml ?? '',
        }
      : undefined,
    feedback:
      feedback?.map((entry: any) => ({
        id: entry.id,
        bodyHtml: entry.bodyHtml,
        createdAt: entry.createdAt,
        author: entry.author,
        images:
          entry.images?.map(({ fileAsset }: any) => ({
            id: fileAsset.id,
            url: `/api/files/${fileAsset.id}`,
            thumbnailUrl: `/api/files/${fileAsset.id}/thumbnail`,
          })) ?? [],
      })) ?? [],
    history:
      history?.map((entry: any) => ({
        id: entry.id,
        label: entry.label,
        timestamp: entry.createdAt,
        actor: entry.actor?.name,
        actorUserId: entry.actorId,
      })) ?? [],
    requests:
      requests?.map((request: any) => ({
        ...request,
        status: requestStatusLabel[request.status],
      })) ?? [],
  };
}
