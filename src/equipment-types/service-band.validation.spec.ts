import { BadRequestException } from '@nestjs/common';
import { validateServiceBands } from './service-band.validation';

describe('validateServiceBands', () => {
  it('accepts continuous ranges and a six-month calendar service', () => {
    expect(() =>
      validateServiceBands([
        { name: 'F-Service', minHours: 0, maxHours: 500 },
        { name: 'B-Service', minHours: 500, maxHours: 1000 },
        { name: 'V-Service', months: 6 },
      ]),
    ).not.toThrow();
  });

  it('rejects gaps and overlaps', () => {
    expect(() =>
      validateServiceBands([
        { name: 'F-Service', minHours: 0, maxHours: 500 },
        { name: 'B-Service', minHours: 600, maxHours: 1000 },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateServiceBands([
        { name: 'F-Service', minHours: 0, maxHours: 500 },
        { name: 'B-Service', minHours: 400, maxHours: 1000 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('only permits an open-ended final band', () => {
    expect(() =>
      validateServiceBands([
        { name: 'F-Service', minHours: 0 },
        { name: 'B-Service', minHours: 500, maxHours: 1000 },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateServiceBands([
        { name: 'F-Service', minHours: 0, maxHours: 500 },
        { name: 'High hour service', minHours: 500 },
      ]),
    ).not.toThrow();
  });
});
