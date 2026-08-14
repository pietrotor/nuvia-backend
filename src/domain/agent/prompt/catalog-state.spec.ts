import { Catalog, renderCatalog } from './catalog-state';

const CAMILA_ID = '2f6ba7e0-5c1a-4a5e-9a3f-1c0f7c9d2b11';
const DANIELA_ID = '8c3d1b42-7e90-4f21-8a6d-55b0e4a1c7f2';
const HIDRAFACIAL_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function buildCatalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    professionals: [
      {
        id: CAMILA_ID,
        name: 'Camila Rojas',
        workingDays: ['lunes 09:00 a 18:00', 'martes 09:00 a 18:00'],
      },
    ],
    services: [
      {
        id: HIDRAFACIAL_ID,
        name: 'Hidrafacial',
        durationMinutes: 75,
        professionalNames: ['Camila Rojas'],
        clientChoosesProfessional: true,
      },
    ],
    ...overrides,
  };
}

describe('renderCatalog', () => {
  it('states the identifier the tools expect next to every name', () => {
    const rendered = renderCatalog(buildCatalog());

    expect(rendered).toContain(`Camila Rojas — id ${CAMILA_ID}`);
    expect(rendered).toContain(`Hidrafacial — id ${HIDRAFACIAL_ID}`);
  });

  it('states the days a professional works so no one is offered on a day off', () => {
    const rendered = renderCatalog(buildCatalog());

    expect(rendered).toContain(
      'trabaja lunes 09:00 a 18:00, martes 09:00 a 18:00',
    );
    expect(rendered).not.toContain('domingo');
  });

  it('says who performs each service', () => {
    const rendered = renderCatalog(
      buildCatalog({
        services: [
          {
            id: HIDRAFACIAL_ID,
            name: 'Hidrafacial',
            durationMinutes: 75,
            professionalNames: ['Camila Rojas', 'Daniela Soto'],
            clientChoosesProfessional: true,
          },
        ],
      }),
    );

    expect(rendered).toContain('lo hacen Camila Rojas y Daniela Soto');
  });

  it('says a service has nobody rather than leaving it looking bookable', () => {
    const rendered = renderCatalog(
      buildCatalog({
        services: [
          {
            id: HIDRAFACIAL_ID,
            name: 'Hidrafacial',
            durationMinutes: 75,
            professionalNames: [],
            clientChoosesProfessional: true,
          },
        ],
      }),
    );

    expect(rendered).toContain('sin nadie habilitado por ahora');
  });

  it('drops a section the business has nothing in', () => {
    const rendered = renderCatalog(
      buildCatalog({
        professionals: [
          { id: DANIELA_ID, name: 'Daniela Soto', workingDays: [] },
        ],
        services: [],
      }),
    );

    expect(rendered).toContain('Daniela Soto');
    expect(rendered).not.toContain('Servicios:');
  });

  // Empty renders empty so the prompt builder drops the whole fragment: an empty heading
  // would read as "this business has nothing", which is never what we mean.
  it('renders nothing at all for a business with no catalog yet', () => {
    expect(renderCatalog({ professionals: [], services: [] })).toBe('');
  });

  it('includes the effective price when the catalog is branch-scoped', () => {
    const rendered = renderCatalog(
      buildCatalog({
        branch: { name: 'Sede Centro', address: 'Calle 1' },
        services: [
          {
            id: HIDRAFACIAL_ID,
            name: 'Hidrafacial',
            durationMinutes: 75,
            price: 'Bs 280',
            professionalNames: ['Camila Rojas'],
            clientChoosesProfessional: true,
          },
        ],
      }),
    );

    expect(rendered).toContain('Sucursal: Sede Centro — Calle 1');
    expect(rendered).toContain('Bs 280');
  });

  it('lists only branches when the location is still unresolved', () => {
    const rendered = renderCatalog({
      branches: [
        { id: 'branch-a', name: 'Centro', address: 'Calle 1' },
        { id: 'branch-b', name: 'Sur', address: null },
      ],
      professionals: [],
      services: [],
    });

    expect(rendered).toContain('Sucursales');
    expect(rendered).toContain(`Centro — id branch-a — Calle 1`);
    expect(rendered).toContain('set_branch');
    expect(rendered).not.toContain('Profesionales');
  });
});
