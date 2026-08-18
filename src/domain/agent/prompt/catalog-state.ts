// The identifiers the tools demand, restated on every turn. A tool result lives only inside
// the round that produced it: the next inbound message rebuilds the conversation from the
// messages we sent the client, where the identifiers were deliberately left out. Without
// this block the model reaches the booking turn with no identifier at all and makes one up.
export interface CatalogProfessional {
  id: string;
  name: string;
  // Day names only (no clock times): free slots come from find_availability.
  workingDays: string[];
  branchNames?: string[];
}

export interface CatalogService {
  id: string;
  name: string;
  durationMinutes: number;
  // Effective branch price when known; omitted when the catalog is not branch-scoped.
  price?: string;
  professionalNames: string[];
  clientChoosesProfessional: boolean;
  // Where the service is offered when the catalog spans more than one branch.
  branchNames?: string[];
  keywords?: string[];
}

export interface CatalogBranch {
  id: string;
  name: string;
  address: string | null;
}

export interface Catalog {
  // When set, the catalog is for one location.
  branch?: { name: string; address: string | null };
  // Multi-branch tenants always list every active branch (with ids) alongside the services.
  branches?: CatalogBranch[];
  // True when the business has exactly one active branch — stops invented second locations.
  singleBranch?: boolean;
  professionals: CatalogProfessional[];
  services: CatalogService[];
}

export function renderCatalog(catalog: Catalog): string {
  const sections: string[] = [];

  if (catalog.branches && catalog.branches.length > 0) {
    if (catalog.singleBranch && catalog.branches.length === 1) {
      const only = catalog.branches[0];
      const address = only.address ? ` — ${only.address}` : '';
      sections.push(
        `El negocio tiene una sola sucursal: ${only.name} — id ${only.id}${address}. No existe ninguna otra.`,
      );
    } else {
      sections.push(
        'Sucursales:',
        ...catalog.branches.map(branchLine),
        'No inventes sucursales que no estén en esta lista.',
        'Esta lista es para nombrar sucursales y ubicar servicios y profesionales, no para hacer elegir una: buscá horarios en todas las que ofrecen el tratamiento y preguntá dónde recién al reservar.',
      );
    }
  } else if (catalog.branch) {
    sections.push(
      `Sucursal: ${catalog.branch.name}${
        catalog.branch.address ? ` — ${catalog.branch.address}` : ''
      }`,
    );
  }

  sections.push(
    ...section('Profesionales', catalog.professionals.map(professionalLine)),
    ...section('Servicios', catalog.services.map(serviceLine)),
  );

  return sections.filter((line) => line.length > 0).join('\n');
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
  const branches =
    professional.branchNames && professional.branchNames.length > 0
      ? ` — en ${enumerate(professional.branchNames)}`
      : '';

  return `- ${professional.name} — id ${professional.id} — ${days}${branches}`;
}

function serviceLine(service: CatalogService): string {
  const professionals = service.professionalNames.length
    ? `lo hacen ${enumerate(service.professionalNames)}`
    : 'sin nadie habilitado por ahora';
  const choice = service.clientChoosesProfessional
    ? 'se puede elegir con quién'
    : 'no se elige con quién';
  const price = service.price ? ` — ${service.price}` : '';
  const branches = describeServiceBranches(service.branchNames);
  const keywords =
    service.keywords && service.keywords.length > 0
      ? ` — también: ${service.keywords.join(', ')}`
      : '';

  return `- ${service.name} — id ${service.id} — ${service.durationMinutes} min${price} — ${professionals} — ${choice}${branches}${keywords}`;
}

function describeServiceBranches(branchNames: string[] | undefined): string {
  if (!branchNames || branchNames.length === 0) return '';
  if (branchNames.length === 1) return ` — solo en ${branchNames[0]}`;
  return ` — en ${enumerate(branchNames)}`;
}

function enumerate(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
