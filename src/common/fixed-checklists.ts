import { ServiceKind } from '@prisma/client';

// Source: docs/SERVICE UNIT TLD (new).xlsx. Each part lists the services it is
// NOT performed in (shaded cells) as service letters, e.g. 'BV' = not part of
// the B-Service or the V-Service. F-Service always covers every part.
type Excluded = string;
type FixedChecklist = [
  category: string,
  parts: [part: string, excluded: Excluded][],
][];

const PUSH_BACK: FixedChecklist = [
  [
    'Body Work',
    [
      ['Wiper', ''],
      ['Door 4 side', ''],
      ['Body 4 side', ''],
      ['Front side mirror', ''],
      ['Tow wing bolt rear', ''],
      ['Seat left and right', ''],
      ['Tow wing bolt front', ''],
      ['Windshield', ''],
      ['Rear glass', ''],
      ['Rear side mirror', ''],
    ],
  ],
  [
    'Engine',
    [
      ['Lube filter', 'V'],
      ['Fuel filter', 'BV'],
      ['Air filter', 'BV'],
      ['Water separator', 'BV'],
      ['Engine mounting', 'BV'],
      ['Engine oil', ''],
      ['Idle engine 1,000 rpm', ''],
      ['Belting', ''],
      ['Tank diesel', 'BV'],
      ['Cleaning the radiator', 'V'],
      ['Coolant level', 'V'],
      ['Engine leaking', ''],
    ],
  ],
  [
    'Transmission',
    [
      ['Filter transmission', 'BV'],
      ['Oil transmission', ''],
      ['Transmission leaking', ''],
    ],
  ],
  [
    'Rear Axle',
    [
      ['Oil axle', 'BV'],
      ['Oil seal axle', 'BV'],
      ['Planetary gear front', 'V'],
      ['Planetary gear rear', 'V'],
      ['Axle leaking', ''],
    ],
  ],
  [
    'Brake',
    [
      ['Brake oil', ''],
      ['Brake pad', 'BV'],
      ['Brake hose', 'BV'],
      ['Brake caliper', 'BV'],
      ['Brake disc', 'BV'],
      ['Brake drum', 'BV'],
      ['Lining brake', 'BV'],
      ['Wheel cylinder', 'BV'],
      ['Test brake 25 km', ''],
      ['Parking brake cable', 'V'],
    ],
  ],
  [
    'Hydraulic',
    [
      ['Hydraulic filter', 'BV'],
      ['Hydraulic oil', ''],
      ['Main pump', 'BV'],
      ['Hose all', 'BV'],
      ['Cylinder all', 'BV'],
    ],
  ],
  [
    'Wheel',
    [
      ['Tire', ''],
      ['Wheel stud 4 side', ''],
      ['Tyre pressure 4 side', ''],
      ['Leaf spring', 'BV'],
      ['Front spring', 'BV'],
      ['U clamp', 'BV'],
    ],
  ],
  [
    'Electrical',
    [
      ['Front lamp', 'V'],
      ['Rear lamp', ''],
      ['Signal front', ''],
      ['Signal rear', ''],
      ['Horn', ''],
      ['Reverse light', ''],
      ['Brake light', ''],
      ['Battery water', ''],
      ['Beacon light', ''],
    ],
  ],
  [
    'Air Conditioning',
    [
      ['Condenser fan', ''],
      ['Blower fan', ''],
    ],
  ],
  [
    'Greasing',
    [
      ['Propeller shaft', 'V'],
      ['King pin', 'V'],
      ['Automatic greasing pump', 'V'],
      ['Steering joint', 'V'],
      ['Greasing pin spring', 'V'],
      ['Spring point', 'V'],
    ],
  ],
  [
    'Safety',
    [
      ['Fire extinguisher date expired', ''],
      ['Tyre chock', ''],
      ['Chain tyre chock', ''],
      ['Washing', 'V'],
      ['Check manual pump', 'V'],
      ['Painting', ''],
      ['Sticker', ''],
      ['Check and test all function operation', ''],
    ],
  ],
];

const BELT_LOADER: FixedChecklist = [
  [
    'Body Work',
    [
      ['Door cover left', ''],
      ['Door cover right', ''],
      ['Body 4 side', ''],
      ['Canopy conveyor', ''],
      ['Rear rubber bumper', ''],
      ['Front rubber bumper', ''],
      ['Pillow bearing bolt front and rear', ''],
      ['Seat', ''],
      ['Conveyor belt', ''],
      ['Bolt motor roller', ''],
    ],
  ],
  [
    'Engine',
    [
      ['Oil filter', ''],
      ['Fuel filter', 'BV'],
      ['Air filter', 'BV'],
      ['Water separator', 'BV'],
      ['Engine oil', 'V'],
      ['Idle engine 1,000 rpm', ''],
      ['Belting', ''],
      ['Cleaning the radiator', 'V'],
      ['Coolant level', ''],
      ['Tank diesel', 'BV'],
      ['Engine leaking', ''],
    ],
  ],
  [
    'Transmission',
    [
      ['Transmission filter', 'BV'],
      ['Transmission oil', 'V'],
    ],
  ],
  [
    'Rear Axle',
    [
      ['Oil axle', 'BV'],
      ['Oil seal axle', 'BV'],
    ],
  ],
  [
    'Brake',
    [
      ['Brake oil', 'V'],
      ['Brake pad', 'BV'],
      ['Brake hose', 'BV'],
      ['Brake caliper', 'BV'],
      ['Brake disc', 'BV'],
      ['Brake drum', 'BV'],
      ['Lining brake', 'BV'],
      ['Wheel cylinder', 'BV'],
      ['Test brake 25 km', ''],
      ['Parking brake cable', 'V'],
    ],
  ],
  [
    'Hydraulic',
    [
      ['Hydraulic filter', 'BV'],
      ['Hydraulic oil', 'V'],
      ['Main pump', 'BV'],
      ['Hose all', 'BV'],
      ['Cylinder all', 'BV'],
    ],
  ],
  [
    'Wheel',
    [
      ['Tire', ''],
      ['Wheel stud 4 side', ''],
      ['Tyre pressure 4 side', ''],
      ['Leaf spring', 'BV'],
      ['Front spring', 'BV'],
      ['U clamp', 'BV'],
    ],
  ],
  [
    'Electrical',
    [
      ['Front lamp', ''],
      ['Rear lamp', ''],
      ['Horn', ''],
      ['Signal front', ''],
      ['Signal rear', ''],
      ['Reverse light', ''],
      ['Brake light', ''],
      ['Battery water', ''],
      ['Beacon light', ''],
    ],
  ],
  [
    'Greasing',
    [
      ['Propeller shaft', 'V'],
      ['King pin', 'V'],
      ['Steering joint', 'V'],
      ['Spring point', 'V'],
    ],
  ],
  [
    'Safety',
    [
      ['Fire extinguisher date expired', ''],
      ['Tyre chock', ''],
      ['Chain tyre chock', ''],
      ['Washing', ''],
      ['Painting', ''],
      ['Sticker', ''],
      ['Check and test all function operation', ''],
    ],
  ],
];

const ACU: FixedChecklist = [
  [
    'Body Work',
    [
      ['Door 4 side', ''],
      ['Towbar front', ''],
      ['Body 4 side', ''],
    ],
  ],
  [
    'Engine',
    [
      ['Oil filter', 'V'],
      ['Fuel filter', 'BV'],
      ['Air filter', 'BV'],
      ['Water separator', 'BV'],
      ['Engine oil', ''],
      ['Idle engine 1,000 rpm', ''],
      ['Cleaning the radiator', 'V'],
      ['Cleaning the condenser coil', 'V'],
      ['Ball valve hose', 'V'],
      ['Coolant level', ''],
      ['Belting', ''],
      ['Timing belt', 'BCDV'],
      ['Tank diesel', 'BV'],
      ['Engine leaking', 'V'],
    ],
  ],
  [
    'Compressor',
    [
      ['Compressor oil', ''],
      ['Compressor filter', 'BV'],
      ['Compressor filter gasket', 'BV'],
      ['Refrigerant filter/drier', 'BV'],
      ['Oil seal axle', 'BV'],
      ['Filter/drier cover gasket', 'BV'],
    ],
  ],
  [
    'Wheel',
    [
      ['Parking brake cable', 'V'],
      ['Tire', ''],
      ['Wheel stud 4 side', ''],
    ],
  ],
  [
    'Electrical',
    [
      ['Electrical charging', ''],
      ['Carbon brush', 'BV'],
      ['Beacon light', ''],
      ['Battery water', ''],
    ],
  ],
  [
    'Safety',
    [
      ['Fire extinguisher date expired', ''],
      ['Tyre chock', ''],
      ['Chain tyre chock', ''],
      ['Washing', 'V'],
      ['Painting', 'V'],
      ['Socket connector hose', ''],
      ['Hose', ''],
      ['Sticker', ''],
      ['Check and test all function operation', ''],
    ],
  ],
];

const GPU: FixedChecklist = [
  ['Body Work', [['Tow wing', '']]],
  [
    'Engine',
    [
      ['Oil filter', 'V'],
      ['Fuel filter', 'BV'],
      ['Air filter', 'BV'],
      ['Water separator', 'BV'],
      ['Engine oil', ''],
      ['Idle engine 1,000 rpm', ''],
      ['Belting', ''],
      ['Tank diesel', 'B'],
      ['Engine leaking', ''],
    ],
  ],
  [
    'Wheel',
    [
      ['Tire', ''],
      ['Wheel stud 4 side', ''],
    ],
  ],
  [
    'Electrical',
    [
      ['Cable ground power unit', ''],
      ['Socket connector cable', ''],
      ['Beacon light', ''],
    ],
  ],
  [
    'Safety',
    [
      ['Fire extinguisher date expired', ''],
      ['Tyre chock', ''],
      ['Chain tyre chock', ''],
      ['Washing', ''],
      ['Painting', ''],
      ['Sticker', ''],
      ['Check and test all function operation', ''],
    ],
  ],
];

const CPT_TF7: FixedChecklist = [
  [
    'Body Work',
    [
      ['Wiper', ''],
      ['Door 4 side', ''],
      ['Body 4 side', ''],
      ['Front side mirror', ''],
      ['Windshield', ''],
      ['Rear rubber bumper', ''],
      ['Seat', ''],
      ['Front rubber bumper', ''],
      ['Rear glass', ''],
    ],
  ],
  [
    'Engine',
    [
      ['Lube filter', 'V'],
      ['Fuel filter', 'BV'],
      ['Air filter', 'BV'],
      ['Water separator', 'BV'],
      ['Engine oil', ''],
      ['Idle engine 1,000 rpm', ''],
      ['Belting', ''],
      ['Tank diesel', 'BV'],
      ['Cleaning the radiator', 'V'],
      ['Coolant level', ''],
      ['Engine leaking', ''],
    ],
  ],
  [
    'Hydrostatic Brake',
    [
      ['Hydrostatic hose', 'BV'],
      ['Hydrostatic rear test', ''],
      ['Brake pad', 'BV'],
      ['Brake hose', 'BV'],
      ['Brake caliper', 'BV'],
      ['Brake disc', 'BV'],
      ['Parking brake system', ''],
    ],
  ],
  [
    'Hydraulic',
    [
      ['Hydraulic filter', 'BV'],
      ['Hydraulic oil', ''],
      ['Main pump', 'BV'],
      ['Hose all', 'BV'],
      ['Cylinder all', 'BV'],
    ],
  ],
  [
    'Wheel',
    [
      ['Tire', ''],
      ['Wheel stud 4 side', ''],
      ['Tyre pressure 4 side', ''],
      ['U clamp', 'BV'],
    ],
  ],
  [
    'Electrical',
    [
      ['Front lamp', ''],
      ['Rear lamp', ''],
      ['Signal front', ''],
      ['Signal rear', ''],
      ['Reverse light', ''],
      ['Brake light', ''],
      ['Battery water', ''],
      ['Beacon light', ''],
    ],
  ],
  [
    'Greasing',
    [
      ['King pin', 'V'],
      ['Steering joint', 'V'],
      ['Spring point', 'V'],
    ],
  ],
  [
    'Safety',
    [
      ['Fire extinguisher date expired', ''],
      ['Washing', 'V'],
      ['Painting', 'V'],
      ['Sticker', ''],
      ['Check and test all function operation', ''],
    ],
  ],
];

const PASSENGER_STEPS: FixedChecklist = [
  [
    'Body Work',
    [
      ['Wiper', ''],
      ['Door 2 side', ''],
      ['Body 4 side', ''],
      ['Front side mirror', ''],
      ['Windshield', ''],
      ['Lock stairs', ''],
      ['Upper bumper', ''],
      ['Rear glass', ''],
    ],
  ],
  [
    'Engine',
    [
      ['Lube filter', 'V'],
      ['Fuel filter', 'BV'],
      ['Air filter', 'BV'],
      ['Water separator', 'BV'],
      ['Engine oil', ''],
      ['Idle engine 1,000 rpm', ''],
      ['Belting', ''],
      ['Tank diesel', 'B'],
      ['Cleaning the radiator', ''],
      ['Coolant level', ''],
      ['Engine leaking', ''],
    ],
  ],
  [
    'Transmission',
    [
      ['Filter transmission', 'BV'],
      ['Oil transmission', ''],
      ['Transmission leaking', ''],
    ],
  ],
  [
    'Rear Axle',
    [
      ['Oil axle', 'B'],
      ['Oil seal axle', 'BV'],
    ],
  ],
  [
    'Brake',
    [
      ['Brake oil', 'V'],
      ['Brake pad', 'B'],
      ['Brake hose', 'BV'],
      ['Brake caliper', 'BV'],
      ['Brake disc', 'BV'],
      ['Brake drum', 'BV'],
      ['Lining brake', 'BV'],
      ['Wheel cylinder', 'BV'],
      ['Parking brake cable', ''],
    ],
  ],
  [
    'Hydraulic',
    [
      ['Hydraulic filter', 'BV'],
      ['Hydraulic oil', ''],
      ['Main pump', 'BV'],
      ['Hose all', 'BV'],
      ['Cylinder all', 'BV'],
    ],
  ],
  [
    'Wheel',
    [
      ['Tire', ''],
      ['Wheel stud 4 side', ''],
      ['Tyre pressure 4 side', ''],
      ['Leaf spring', 'BV'],
      ['Front spring', 'BV'],
      ['U clamp', 'BV'],
    ],
  ],
  [
    'Electrical',
    [
      ['Front lamp', ''],
      ['Rear lamp', ''],
      ['Signal front', ''],
      ['Signal rear', ''],
      ['Reverse light', ''],
      ['Brake light', ''],
      ['Battery water', ''],
      ['Beacon light', ''],
    ],
  ],
  [
    'Greasing',
    [
      ['Propeller shaft', 'V'],
      ['King pin', 'V'],
      ['Steering joint', 'V'],
      ['Spring point', 'V'],
    ],
  ],
  [
    'Safety',
    [
      ['Fire extinguisher date expired', ''],
      ['Tyre chock', ''],
      ['Chain tyre chock', ''],
      ['Washing', ''],
      ['Painting', ''],
      ['Sticker', ''],
      ['Check and test all function operation', ''],
    ],
  ],
];

// Keys are equipment type names lower-cased with non-letters removed.
const FIXED_CHECKLISTS: Record<string, FixedChecklist> = {
  pushback: PUSH_BACK,
  pushbacktractor: PUSH_BACK,
  beltloader: BELT_LOADER,
  acu: ACU,
  airconditioningunit: ACU,
  gpu: GPU,
  groundpowerunit: GPU,
  cpt: CPT_TF7,
  cpttf: CPT_TF7,
  passengersteps: PASSENGER_STEPS,
  passengerstep: PASSENGER_STEPS,
  passengerstairs: PASSENGER_STEPS,
};

export const FIXED_CHECKLIST_EQUIPMENT_TYPES = [
  'Push Back',
  'Belt Loader',
  'ACU',
  'GPU',
  'CPT TF-7',
  'Passenger Steps',
] as const;

const EXCLUSION_CODE: Partial<Record<ServiceKind, string>> = {
  [ServiceKind.B_SERVICE]: 'B',
  [ServiceKind.C_SERVICE]: 'C',
  [ServiceKind.D_SERVICE]: 'D',
  [ServiceKind.E_SERVICE]: 'E',
  [ServiceKind.V_SERVICE]: 'V',
};

export type ChecklistTemplate = {
  category: string;
  label: string;
  sortOrder: number;
  applicable?: boolean;
};

/**
 * Returns the full fixed inspection checklist for an equipment type, with
 * parts not performed in the given service marked `applicable: false`, or
 * null when the equipment type has no fixed checklist.
 */
export function fixedChecklistFor(
  equipmentTypeName: string,
  serviceKind: ServiceKind,
): ChecklistTemplate[] | null {
  const checklist =
    FIXED_CHECKLISTS[equipmentTypeName.toLowerCase().replace(/[^a-z]/g, '')];
  if (!checklist) return null;
  const code = EXCLUSION_CODE[serviceKind];
  return checklist
    .flatMap(([category, parts]) =>
      parts.map(([label, excluded]) => ({ category, label, excluded })),
    )
    .map(({ category, label, excluded }, sortOrder) => ({
      category,
      label,
      sortOrder,
      applicable: !code || !excluded.includes(code),
    }));
}

export const toChecklistItems = (templates: ChecklistTemplate[]) =>
  templates.map(({ category, label, sortOrder, applicable = true }) => ({
    category,
    label,
    sortOrder,
    applicable,
  }));
