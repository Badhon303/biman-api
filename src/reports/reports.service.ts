import { Injectable } from '@nestjs/common';
import { TicketType } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthUser) {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const [equipmentTotal, available, closedBreakdowns, pmTickets] =
      await Promise.all([
        this.prisma.equipment.count({ where: { deletedAt: null } }),
        this.prisma.equipment.count({
          where: { deletedAt: null, status: 'AVAILABLE' },
        }),
        this.prisma.ticket.findMany({
          where: {
            serviceType: TicketType.BREAKDOWN,
            status: 'CLOSED',
            closedDate: { gte: since },
          },
          select: { downtimeHours: true, closedDate: true },
        }),
        this.prisma.ticket.findMany({
          where: {
            serviceType: {
              in: [
                TicketType.F_SERVICE,
                TicketType.B_SERVICE,
                TicketType.C_SERVICE,
                TicketType.D_SERVICE,
                TicketType.E_SERVICE,
                TicketType.V_SERVICE,
                TicketType.OTHERS,
              ],
            },
            status: 'CLOSED',
          },
          select: { dueDate: true, closedDate: true },
        }),
      ]);
    const downtimeHours = closedBreakdowns.reduce(
      (sum, ticket) => sum + (ticket.downtimeHours ?? 0),
      0,
    );
    const closedCount = closedBreakdowns.length;
    const calendarHours = 365 * 24;
    const pmOnTime = pmTickets.filter(
      (ticket) => ticket.closedDate && ticket.closedDate <= ticket.dueDate,
    ).length;
    const summary = {
      equipment: {
        total: equipmentTotal,
        available,
        availabilityPercent: equipmentTotal
          ? Number(((available / equipmentTotal) * 100).toFixed(2))
          : 0,
      },
      breakdowns: {
        closedLastYear: closedCount,
        downtimeHours: Number(downtimeHours.toFixed(2)),
        mtbfHours: closedCount
          ? Number(((calendarHours - downtimeHours) / closedCount).toFixed(2))
          : null,
      },
      pmCompliance: {
        completed: pmTickets.length,
        onTime: pmOnTime,
        late: pmTickets.length - pmOnTime,
        percent: pmTickets.length
          ? Number(((pmOnTime / pmTickets.length) * 100).toFixed(2))
          : 0,
      },
    };
    if (user.role === 'Engineer')
      return {
        breakdowns: summary.breakdowns,
        assignedTickets: await this.prisma.ticket.count({
          where: { assignedEngineerId: user.sub },
        }),
      };
    if (user.role === 'Biman Admin')
      return { equipment: summary.equipment, breakdowns: summary.breakdowns };
    return summary;
  }
}
