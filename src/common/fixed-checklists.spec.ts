import { ServiceKind } from '@prisma/client';
import {
  applyChecklistSettings,
  checklistCatalogFor,
  FIXED_CHECKLIST_EQUIPMENT_TYPES,
  fixedChecklistFor,
  toChecklistItems,
} from './fixed-checklists';

const labels = (type: string, kind: ServiceKind) =>
  fixedChecklistFor(type, kind)!
    .filter(({ applicable }) => applicable)
    .map(({ label }) => label);

describe('fixedChecklistFor', () => {
  it('returns null for equipment types without a fixed checklist', () => {
    expect(fixedChecklistFor('Fork Lift', ServiceKind.B_SERVICE)).toBeNull();
  });

  it('has a checklist for every equipment type in the service sheet', () => {
    for (const type of FIXED_CHECKLIST_EQUIPMENT_TYPES)
      expect(fixedChecklistFor(type, ServiceKind.F_SERVICE)).not.toBeNull();
  });

  it('applies every part in the F-Service', () => {
    for (const type of FIXED_CHECKLIST_EQUIPMENT_TYPES)
      expect(
        fixedChecklistFor(type, ServiceKind.F_SERVICE)!.every(
          ({ applicable }) => applicable,
        ),
      ).toBe(true);
  });

  it('matches equipment type names loosely', () => {
    expect(fixedChecklistFor('PUSH BACK', ServiceKind.F_SERVICE)).toEqual(
      fixedChecklistFor('Pushback', ServiceKind.F_SERVICE),
    );
    expect(
      fixedChecklistFor('Belt-Loader', ServiceKind.F_SERVICE),
    ).not.toBeNull();
  });

  it.each([
    ['Push Back', ServiceKind.F_SERVICE, 76],
    ['Push Back', ServiceKind.B_SERVICE, 54],
    ['Push Back', ServiceKind.C_SERVICE, 76],
    ['Push Back', ServiceKind.D_SERVICE, 76],
    ['Push Back', ServiceKind.V_SERVICE, 39],
    ['Belt Loader', ServiceKind.F_SERVICE, 66],
    ['Belt Loader', ServiceKind.B_SERVICE, 45],
    ['Belt Loader', ServiceKind.V_SERVICE, 35],
    ['ACU', ServiceKind.F_SERVICE, 39],
    ['ACU', ServiceKind.B_SERVICE, 28],
    ['ACU', ServiceKind.C_SERVICE, 38],
    ['ACU', ServiceKind.D_SERVICE, 38],
    ['ACU', ServiceKind.E_SERVICE, 39],
    ['ACU', ServiceKind.V_SERVICE, 20],
    ['GPU', ServiceKind.F_SERVICE, 22],
    ['GPU', ServiceKind.B_SERVICE, 18],
    ['GPU', ServiceKind.V_SERVICE, 18],
    ['CPT TF-7', ServiceKind.F_SERVICE, 52],
    ['CPT TF-7', ServiceKind.B_SERVICE, 38],
    ['CPT TF-7', ServiceKind.V_SERVICE, 31],
    ['Passenger Steps', ServiceKind.F_SERVICE, 63],
    ['Passenger Steps', ServiceKind.B_SERVICE, 42],
    ['Passenger Steps', ServiceKind.V_SERVICE, 39],
  ])('%s %s has %i items', (type, kind, count) => {
    expect(labels(type, kind)).toHaveLength(count);
  });

  it('uses the same full parts catalog for every equipment type', () => {
    for (const kind of Object.values(ServiceKind)) {
      expect(checklistCatalogFor(kind)).toEqual(
        fixedChecklistFor('Push Back', kind),
      );
      expect(checklistCatalogFor(kind)).toHaveLength(76);
    }
  });

  it('applies per-item settings while leaving other items enabled by default', () => {
    const templates = fixedChecklistFor('Push Back', ServiceKind.F_SERVICE)!;
    const target = templates.find(({ label }) => label === 'Wiper')!;
    const configured = applyChecklistSettings(templates, [
      { ...target, sortOrder: 99, enabled: false },
    ]);
    expect(configured.find(({ label }) => label === 'Wiper')?.enabled).toBe(
      false,
    );
    expect(
      configured.find(({ label }) => label === 'Door 4 side')?.enabled,
    ).toBe(true);
  });

  it('omits disabled parts when creating ticket checklist items', () => {
    expect(
      toChecklistItems([
        { category: 'Body Work', label: 'Wiper', sortOrder: 0, enabled: false },
        { category: 'Body Work', label: 'Door 4 side', sortOrder: 1 },
      ]),
    ).toEqual([
      {
        category: 'Body Work',
        label: 'Door 4 side',
        sortOrder: 1,
        applicable: true,
      },
    ]);
  });

  it('keeps every part but marks shaded parts as not applicable', () => {
    const b = fixedChecklistFor('Push Back', ServiceKind.B_SERVICE)!;
    expect(b).toHaveLength(76);
    expect(b.map(({ sortOrder }) => sortOrder)).toEqual(
      b.map((_, index) => index),
    );
    expect(b.find(({ label }) => label === 'Fuel filter')?.applicable).toBe(
      false,
    );
    expect(labels('Push Back', ServiceKind.B_SERVICE)).toContain('Engine oil');
    expect(labels('Push Back', ServiceKind.B_SERVICE)).not.toContain(
      'Fuel filter',
    );
    expect(labels('Belt Loader', ServiceKind.V_SERVICE)).not.toContain(
      'Engine oil',
    );
    expect(labels('Belt Loader', ServiceKind.B_SERVICE)).toContain(
      'Engine oil',
    );
  });
});
