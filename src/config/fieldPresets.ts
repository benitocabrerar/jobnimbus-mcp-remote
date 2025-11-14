/**
 * Field Presets - Conjuntos Predefinidos de Campos
 *
 * Define configuraciones comunes de campos para reducir la complejidad
 * de queries del usuario. En lugar de especificar 15 campos individuales,
 * el usuario puede usar un preset como "financial" o "scheduling".
 *
 * Uso:
 * - GET /jobs?preset=financial
 * - GET /estimates?preset=items_summary
 * - GET /invoices?preset=payments_only
 *
 * Beneficios:
 * 1. Simplifica la API para usuarios
 * 2. Estandariza las consultas comunes
 * 3. Reduce errores de sintaxis en field selection
 * 4. Permite optimizaciones específicas por preset
 */

export interface FieldPreset {
  name: string;
  description: string;
  fields: string[];
  estimated_reduction: number; // Porcentaje de reducción vs response completo
}

export interface EntityPresets {
  [presetName: string]: FieldPreset;
}

/**
 * Presets para Jobs
 */
export const JOB_PRESETS: EntityPresets = {
  // Ultra-minimal: Solo identificadores críticos
  minimal: {
    name: 'minimal',
    description: 'Solo identificadores y estado (jnid, number, status)',
    fields: ['jnid', 'number', 'status_name'],
    estimated_reduction: 97, // De 6 KB a 0.2 KB
  },

  // Básico: Información principal para listados
  basic: {
    name: 'basic',
    description: 'Información básica para listados (identificación, ubicación, estado)',
    fields: [
      'jnid',
      'number',
      'name',
      'status_name',
      'address_line1',
      'city',
      'state_text',
      'zip',
      'date_created',
      'sales_rep_name',
      'primary.name',
    ],
    estimated_reduction: 90, // De 6 KB a 0.6 KB
  },

  // Financiero: Métricas financieras y ventas
  financial: {
    name: 'financial',
    description: 'Información financiera (totales, estimados, facturas, ventas)',
    fields: [
      'jnid',
      'number',
      'name',
      'status_name',
      'approved_estimate_total',
      'approved_invoice_total',
      'last_estimate',
      'last_invoice',
      'work_order_total',
      'sales_rep_name',
      'sales_rep',
      'date_created',
      'primary.name',
    ],
    estimated_reduction: 88, // De 6 KB a 0.7 KB
  },

  // Scheduling: Información de programación y fechas
  scheduling: {
    name: 'scheduling',
    description: 'Información de scheduling (fechas, ubicación, estado)',
    fields: [
      'jnid',
      'number',
      'name',
      'status_name',
      'date_start',
      'date_end',
      'date_created',
      'date_updated',
      'address_line1',
      'city',
      'state_text',
      'zip',
      'geo.lat',
      'geo.lon',
      'primary.name',
      'primary.id',
    ],
    estimated_reduction: 87, // De 6 KB a 0.8 KB
  },

  // Address: Solo información de dirección y contacto
  address: {
    name: 'address',
    description: 'Información de dirección y contacto',
    fields: [
      'jnid',
      'number',
      'name',
      'address_line1',
      'address_line2',
      'city',
      'state_text',
      'zip',
      'country_name',
      'geo.lat',
      'geo.lon',
      'primary.name',
      'primary.id',
    ],
    estimated_reduction: 89, // De 6 KB a 0.65 KB
  },

  // Status tracking: Para dashboards de estado
  status: {
    name: 'status',
    description: 'Tracking de estado y progreso',
    fields: [
      'jnid',
      'number',
      'name',
      'status',
      'status_name',
      'source_name',
      'date_created',
      'date_updated',
      'date_status_change',
      'sales_rep_name',
      'owners[].id',
      'tags[].name',
    ],
    estimated_reduction: 85, // De 6 KB a 0.9 KB
  },

  // Complete: Todos los campos principales (sin custom_fields)
  complete: {
    name: 'complete',
    description: 'Todos los campos principales (excluye custom_fields)',
    fields: ['*'], // Wildcard especial
    estimated_reduction: 20, // De 6 KB a 4.8 KB (solo excluye custom_fields)
  },
};

/**
 * Presets para Estimates
 */
export const ESTIMATE_PRESETS: EntityPresets = {
  // Minimal: Solo totales y estado
  minimal: {
    name: 'minimal',
    description: 'Solo identificación y total',
    fields: ['jnid', 'number', 'total', 'status_name', 'date_created'],
    estimated_reduction: 96, // De 8 KB a 0.3 KB
  },

  // Basic: Información principal
  basic: {
    name: 'basic',
    description: 'Información principal sin items',
    fields: [
      'jnid',
      'number',
      'name',
      'total',
      'subtotal',
      'tax',
      'status_name',
      'date_created',
      'date_sent',
      'date_approved',
      'customer.name',
      'sales_rep_name',
      'primary.name',
      'primary.number',
    ],
    estimated_reduction: 92, // De 8 KB a 0.6 KB
  },

  // Items summary: Lista de items compacta
  items_summary: {
    name: 'items_summary',
    description: 'Estimate con items resumidos (solo name, quantity, price)',
    fields: [
      'jnid',
      'number',
      'name',
      'total',
      'status_name',
      'date_created',
      'items[].jnid',
      'items[].name',
      'items[].quantity',
      'items[].uom',
      'items[].price',
    ],
    estimated_reduction: 80, // De 8 KB a 1.6 KB
  },

  // Items detailed: Items con más información
  items_detailed: {
    name: 'items_detailed',
    description: 'Estimate con items detallados (incluye cost y margins)',
    fields: [
      'jnid',
      'number',
      'name',
      'total',
      'subtotal',
      'tax',
      'margin',
      'status_name',
      'items[].jnid',
      'items[].name',
      'items[].description',
      'items[].quantity',
      'items[].uom',
      'items[].price',
      'items[].cost',
      'items[].category',
    ],
    estimated_reduction: 65, // De 8 KB a 2.8 KB
  },

  // Financial: Enfoque en números financieros
  financial: {
    name: 'financial',
    description: 'Métricas financieras detalladas',
    fields: [
      'jnid',
      'number',
      'total',
      'subtotal',
      'tax',
      'cost',
      'margin',
      'status_name',
      'date_created',
      'date_approved',
      'sales_rep_name',
      'customer.name',
    ],
    estimated_reduction: 90, // De 8 KB a 0.8 KB
  },

  // Complete: Todo sin límites
  complete: {
    name: 'complete',
    description: 'Estimate completo con todos los items',
    fields: ['*'],
    estimated_reduction: 0,
  },
};

/**
 * Presets para Invoices
 */
export const INVOICE_PRESETS: EntityPresets = {
  // Minimal: Solo totales
  minimal: {
    name: 'minimal',
    description: 'Solo identificación y total',
    fields: ['jnid', 'number', 'total', 'status_name', 'date_created'],
    estimated_reduction: 97, // De 10 KB a 0.3 KB
  },

  // Basic: Sin items ni payments
  basic: {
    name: 'basic',
    description: 'Información principal sin items ni payments',
    fields: [
      'jnid',
      'number',
      'name',
      'total',
      'subtotal',
      'tax',
      'balance',
      'status_name',
      'date_created',
      'date_due',
      'customer.name',
      'sales_rep_name',
    ],
    estimated_reduction: 93, // De 10 KB a 0.7 KB
  },

  // Payments only: Solo información de pagos
  payments_only: {
    name: 'payments_only',
    description: 'Invoice con solo información de pagos',
    fields: [
      'jnid',
      'number',
      'total',
      'balance',
      'status_name',
      'date_created',
      'payments[].jnid',
      'payments[].amount',
      'payments[].date',
      'payments[].method',
      'payments[].status',
    ],
    estimated_reduction: 85, // De 10 KB a 1.5 KB
  },

  // Financial: Métricas financieras
  financial: {
    name: 'financial',
    description: 'Métricas financieras completas',
    fields: [
      'jnid',
      'number',
      'total',
      'subtotal',
      'tax',
      'balance',
      'amount_paid',
      'status_name',
      'date_created',
      'date_due',
      'date_paid',
      'sales_rep_name',
      'customer.name',
    ],
    estimated_reduction: 91, // De 10 KB a 0.9 KB
  },

  // Complete: Todo
  complete: {
    name: 'complete',
    description: 'Invoice completo con items y payments',
    fields: ['*'],
    estimated_reduction: 0,
  },
};

/**
 * Presets para Contacts
 */
export const CONTACT_PRESETS: EntityPresets = {
  // Minimal: Solo identificación
  minimal: {
    name: 'minimal',
    description: 'Solo identificación básica',
    fields: ['jnid', 'number', 'name', 'email'],
    estimated_reduction: 95, // De 3 KB a 0.15 KB
  },

  // Basic: Información de contacto principal
  basic: {
    name: 'basic',
    description: 'Información de contacto principal',
    fields: [
      'jnid',
      'number',
      'name',
      'display_name',
      'email',
      'mobile_phone',
      'home_phone',
      'company_name',
      'record_type_name',
      'date_created',
    ],
    estimated_reduction: 88, // De 3 KB a 0.35 KB
  },

  // Address: Información de dirección
  address: {
    name: 'address',
    description: 'Información de dirección completa',
    fields: [
      'jnid',
      'number',
      'name',
      'address_line1',
      'address_line2',
      'city',
      'state_text',
      'zip',
      'country_name',
    ],
    estimated_reduction: 90, // De 3 KB a 0.3 KB
  },

  // Complete: Todo
  complete: {
    name: 'complete',
    description: 'Información completa del contacto',
    fields: ['*'],
    estimated_reduction: 0,
  },
};

/**
 * Mapa de todos los presets por entidad
 */
export const FIELD_PRESETS = {
  jobs: JOB_PRESETS,
  estimates: ESTIMATE_PRESETS,
  invoices: INVOICE_PRESETS,
  contacts: CONTACT_PRESETS,
} as const;

/**
 * Obtener preset por entidad y nombre
 */
export function getPreset(entity: string, presetName: string): FieldPreset | null {
  const entityPresets = FIELD_PRESETS[entity as keyof typeof FIELD_PRESETS];
  if (!entityPresets) return null;

  return entityPresets[presetName] || null;
}

/**
 * Listar presets disponibles para una entidad
 */
export function listPresets(entity: string): FieldPreset[] {
  const entityPresets = FIELD_PRESETS[entity as keyof typeof FIELD_PRESETS];
  if (!entityPresets) return [];

  return Object.values(entityPresets);
}

/**
 * Expandir preset a lista de campos
 */
export function expandPreset(entity: string, presetName: string): string[] | null {
  const preset = getPreset(entity, presetName);
  if (!preset) return null;

  return preset.fields;
}

/**
 * Verificar si un preset es wildcard (*)
 */
export function isWildcardPreset(fields: string[]): boolean {
  return fields.length === 1 && fields[0] === '*';
}

/**
 * Obtener preset recomendado según use case
 */
export function getRecommendedPreset(
  entity: string,
  useCase: 'list' | 'detail' | 'export' | 'financial' | 'scheduling'
): string {
  const recommendations: Record<string, Record<string, string>> = {
    jobs: {
      list: 'basic',
      detail: 'complete',
      export: 'complete',
      financial: 'financial',
      scheduling: 'scheduling',
    },
    estimates: {
      list: 'basic',
      detail: 'items_detailed',
      export: 'complete',
      financial: 'financial',
      scheduling: 'basic',
    },
    invoices: {
      list: 'basic',
      detail: 'complete',
      export: 'complete',
      financial: 'financial',
      scheduling: 'basic',
    },
    contacts: {
      list: 'basic',
      detail: 'complete',
      export: 'complete',
      financial: 'basic',
      scheduling: 'basic',
    },
  };

  return recommendations[entity]?.[useCase] || 'basic';
}
