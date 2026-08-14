// The identifiers the tools demand, restated on every turn. A tool result lives only inside
// the round that produced it: the next inbound message rebuilds the conversation from the
// messages we sent the client, where the identifiers were deliberately left out. Without
// this block the model reaches the booking turn with no identifier at all and makes one up.
export interface CatalogProfessional {
  id: string;
  name: string;
  workingDays: string[];
}

export interface CatalogService {
  id: string;
  name: string;
  durationMinutes: number;
  // Effective branch price when known; omitted when the catalog is not branch-scoped.
  price?: string;
  professionalNames: string[];
  clientChoosesProfessional: boolean;
}

export interface CatalogBranch {
  id: string;
  name: string;
  address: string | null;
}

export interface Catalog {
  // When set, the catalog is for one location; when absent on a multi-branch tenant,
  // only `branches` is filled and prices/availability must wait for set_branch.
  branch?: { name: string; address: string | null };
  branches?: CatalogBranch[];
  professionals: CatalogProfessional[];
  services: CatalogService[];
}

export function renderCatalog(catalog: Catalog): string {
  if (catalog.branches && catalog.branches.length > 0) {
    return [
      'Sucursales (elegir una antes de precios u horarios):',
      ...catalog.branches.map(branchLine),
      'Antes de cotizar o buscar horarios: llamar a set_branch con el id que elija la clienta.',
    ].join('\n');
  }

  const header = catalog.branch
    ? [
        `Sucursal: ${catalog.branch.name}${
          catalog.branch.address ? ` — ${catalog.branch.address}` : ''
        }`,
      ]
    : [];

  const sections = [
    ...header,
    ...section('Profesionales', catalog.professionals.map(professionalLine)),
    ...section('Servicios', catalog.services.map(serviceLine)),
  ].filter((line) => line.length > 0);

  return sections.join('\n');
}

function section(title: string, lines: string[]): string[] {
  return lines.length === 0 ? [] : [`${title}:`, ...lines];
}

function branchLine(branch: CatalogBranch): string {
  const address = branch.address ? ` — ${branch.address}` : '';
  return `- ${branch.name} — id ${branch.id}${address}`;
}

function professionalLine(professional: CatalogProfessional): string {
  const days = professional.workingDays.length
    ? `trabaja ${professional.workingDays.join(', ')}`
    : 'sin días de trabajo cargados';

  return `- ${professional.name} — id ${professional.id} — ${days}`;
}

function serviceLine(service: CatalogService): string {
  const professionals = service.professionalNames.length
    ? `lo hacen ${enumerate(service.professionalNames)}`
    : 'sin nadie habilitado por ahora';
  const choice = service.clientChoosesProfessional
    ? 'se puede elegir con quién'
    : 'no se elige con quién';
  const price = service.price ? ` — ${service.price}` : '';

  return `- ${service.name} — id ${service.id} — ${service.durationMinutes} min${price} — ${professionals} — ${choice}`;
}

function enumerate(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
