export enum BusinessCategory {
  DEFAULT = 'default',
  ESTHETICS = 'esthetics',
  SPA = 'spa',
  BEAUTY = 'beauty',
  MEDICAL = 'medical',
}

// Plurals are spelled out instead of derived: "sesión" turns into "sesiones", so any
// rule that appends an "s" would write it wrong.
export interface CategoryLexicon {
  client: string;
  clientPlural: string;
  professional: string;
  professionalPlural: string;
  service: string;
  servicePlural: string;
  session: string;
  sessionPlural: string;
}

// How each trade names the people and the things it sells: a dental clinic says
// "paciente" where an esthetics center says "clienta". The agent talks with these words,
// so they are user-facing copy. Supporting a new category means adding its lexicon here
// and extending the `business_category` pg enum with a migration.
const LEXICONS: Record<BusinessCategory, CategoryLexicon> = {
  [BusinessCategory.DEFAULT]: {
    client: 'cliente',
    clientPlural: 'clientes',
    professional: 'profesional',
    professionalPlural: 'profesionales',
    service: 'servicio',
    servicePlural: 'servicios',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
  [BusinessCategory.ESTHETICS]: {
    client: 'clienta',
    clientPlural: 'clientas',
    professional: 'profesional',
    professionalPlural: 'profesionales',
    service: 'tratamiento',
    servicePlural: 'tratamientos',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
  [BusinessCategory.SPA]: {
    client: 'clienta',
    clientPlural: 'clientas',
    professional: 'terapeuta',
    professionalPlural: 'terapeutas',
    service: 'servicio',
    servicePlural: 'servicios',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
  [BusinessCategory.BEAUTY]: {
    client: 'clienta',
    clientPlural: 'clientas',
    professional: 'estilista',
    professionalPlural: 'estilistas',
    service: 'servicio',
    servicePlural: 'servicios',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
  [BusinessCategory.MEDICAL]: {
    client: 'paciente',
    clientPlural: 'pacientes',
    professional: 'médico',
    professionalPlural: 'médicos',
    service: 'consulta',
    servicePlural: 'consultas',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
};

export const DEFAULT_BUSINESS_CATEGORY = BusinessCategory.DEFAULT;

export function categoryLexicon(category: BusinessCategory): CategoryLexicon {
  return LEXICONS[category] ?? LEXICONS[DEFAULT_BUSINESS_CATEGORY];
}
