export enum BusinessCategory {
  DEFAULT = 'default',
  ESTHETICS = 'esthetics',
  SPA = 'spa',
  BEAUTY = 'beauty',
}

// Plurals are spelled out instead of derived: "sesión" turns into "sesiones", so any
// rule that appends an "s" would write it wrong.
export interface CategoryLexicon {
  client: string;
  professional: string;
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
    professional: 'profesional',
    service: 'servicio',
    servicePlural: 'servicios',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
  [BusinessCategory.ESTHETICS]: {
    client: 'clienta',
    professional: 'profesional',
    service: 'tratamiento',
    servicePlural: 'tratamientos',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
  [BusinessCategory.SPA]: {
    client: 'clienta',
    professional: 'terapeuta',
    service: 'servicio',
    servicePlural: 'servicios',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
  [BusinessCategory.BEAUTY]: {
    client: 'clienta',
    professional: 'estilista',
    service: 'servicio',
    servicePlural: 'servicios',
    session: 'sesión',
    sessionPlural: 'sesiones',
  },
};

export const DEFAULT_BUSINESS_CATEGORY = BusinessCategory.DEFAULT;

export function categoryLexicon(category: BusinessCategory): CategoryLexicon {
  return LEXICONS[category] ?? LEXICONS[DEFAULT_BUSINESS_CATEGORY];
}
