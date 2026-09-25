import {
  Organization as DbOrganization,
  Role as DbRole,
  ServiceKind,
} from '@prisma/client';
import { AppRole } from './roles.decorator';

export const roleToDb: Record<AppRole, DbRole> = {
  'Super Admin': DbRole.SUPER_ADMIN,
  Manager: DbRole.MANAGER,
  Engineer: DbRole.ENGINEER,
  'Biman Admin': DbRole.BIMAN_ADMIN,
};

export const roleFromDb: Record<DbRole, AppRole> = {
  [DbRole.SUPER_ADMIN]: 'Super Admin',
  [DbRole.MANAGER]: 'Manager',
  [DbRole.ENGINEER]: 'Engineer',
  [DbRole.BIMAN_ADMIN]: 'Biman Admin',
};

export const organizationToDb = (organization: 'NGGL' | 'Biman') =>
  organization === 'Biman' ? DbOrganization.BIMAN : DbOrganization.NGGL;

export const serviceKindFromName = (name: string): ServiceKind => {
  const normalized = name.trim().toLowerCase();
  const standard: Record<string, ServiceKind> = {
    'f-service': ServiceKind.F_SERVICE,
    'b-service': ServiceKind.B_SERVICE,
    'c-service': ServiceKind.C_SERVICE,
    'd-service': ServiceKind.D_SERVICE,
    'e-service': ServiceKind.E_SERVICE,
    'v-service': ServiceKind.V_SERVICE,
    others: ServiceKind.OTHERS,
  };
  return standard[normalized] ?? ServiceKind.OTHERS;
};

export const serviceKindToTicketType = (kind: ServiceKind) => kind;
