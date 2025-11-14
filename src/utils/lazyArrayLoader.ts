/**
 * Lazy Array Loader
 *
 * Implementa lazy loading para arrays grandes (items[], payments[], etc.)
 * Reduce drásticamente el tamaño de respuestas iniciales al reemplazar
 * arrays completos con referencias + preview pequeño.
 *
 * Caso de Uso Principal:
 * - Estimates con 50+ items (de 25 KB a 2 KB)
 * - Invoices con múltiples payments/sections
 * - Jobs con muchos tags/related entities
 *
 * Funcionamiento:
 * 1. Detectar arrays grandes (> threshold)
 * 2. Crear referencia lazy con preview (primeros N elementos)
 * 3. Almacenar array completo en handle storage
 * 4. Cliente puede cargar completo cuando lo necesite
 *
 * @example
 * // Antes (50 items, ~25 KB):
 * {
 *   jnid: "est123",
 *   items: [ ...50 items completos... ]
 * }
 *
 * // Después (lazy loading, ~2 KB):
 * {
 *   jnid: "est123",
 *   items: {
 *     _type: "lazy_array",
 *     count: 50,
 *     summary: [ ...3 primeros items compactos... ],
 *     load_url: "/api/estimate_items?parent_id=est123",
 *     handle: "jn:estimate_items:est123:..."
 *   }
 * }
 */

import { handleStorage } from '../services/handleStorage.js';
import { VerbosityLevel } from '../types/index.js';
import { NestedFieldSelector } from './nestedFieldSelector.js';

/**
 * Referencia lazy para array grande
 */
export interface LazyArrayReference {
  _type: 'lazy_array';
  entity: string;              // Tipo de entidad (estimate_items, invoice_payments, etc.)
  parent_id: string;           // ID del padre (estimate, invoice, etc.)
  count: number;               // Total de elementos en el array
  summary?: any[];             // Preview: primeros N elementos compactados
  summary_verbosity?: VerbosityLevel; // Verbosidad del summary
  load_url: string;            // URL para cargar array completo
  handle?: string;             // Handle en storage (si está guardado)
  fields_available?: string[]; // Campos disponibles en cada elemento
  estimated_size_kb?: number;  // Tamaño estimado del array completo
}

/**
 * Opciones para crear referencia lazy
 */
export interface LazyArrayOptions {
  previewCount?: number;       // Cantidad de elementos en summary (default: 3)
  verbosity?: VerbosityLevel;  // Verbosidad del summary (default: 'summary')
  storeHandle?: boolean;       // Guardar en handle storage (default: true)
  instance?: string;           // Instancia para handle storage
  toolName?: string;           // Nombre del tool que crea el handle
}

/**
 * Configuración de compactación por tipo de array
 */
interface ArrayCompactionConfig {
  summary_fields: string[];    // Campos para summary mode
  compact_fields: string[];    // Campos para compact mode
  detailed_fields: string[];   // Campos para detailed mode
}

/**
 * Configuraciones predefinidas por tipo de entidad
 */
const ARRAY_COMPACTION_CONFIGS: Record<string, ArrayCompactionConfig> = {
  estimate_items: {
    summary_fields: ['jnid', 'name', 'quantity', 'price'],
    compact_fields: ['jnid', 'name', 'quantity', 'uom', 'price', 'cost', 'total'],
    detailed_fields: [
      'jnid', 'name', 'description', 'quantity', 'uom',
      'price', 'cost', 'category', 'color', 'total'
    ],
  },
  invoice_items: {
    summary_fields: ['jnid', 'name', 'quantity', 'price'],
    compact_fields: ['jnid', 'name', 'quantity', 'uom', 'price', 'total'],
    detailed_fields: [
      'jnid', 'name', 'description', 'quantity', 'uom',
      'price', 'tax', 'total'
    ],
  },
  invoice_payments: {
    summary_fields: ['jnid', 'amount', 'date', 'method'],
    compact_fields: ['jnid', 'amount', 'date', 'method', 'status', 'reference'],
    detailed_fields: [
      'jnid', 'amount', 'date', 'method', 'status',
      'reference', 'notes', 'processed_by'
    ],
  },
  job_tags: {
    summary_fields: ['id', 'name'],
    compact_fields: ['id', 'name', 'color'],
    detailed_fields: ['id', 'name', 'color', 'description'],
  },
  job_related: {
    summary_fields: ['id', 'type', 'name'],
    compact_fields: ['id', 'type', 'name', 'number'],
    detailed_fields: ['id', 'type', 'name', 'number', 'status'],
  },
};

export class LazyArrayLoader {
  /**
   * Threshold por defecto: arrays con más de 10 elementos
   */
  private static DEFAULT_THRESHOLD = 10;

  /**
   * Preview count por defecto: 3 elementos
   */
  private static DEFAULT_PREVIEW_COUNT = 3;

  /**
   * Crear referencia lazy para array grande
   *
   * @param entity - Tipo de entidad del array (estimate_items, invoice_payments, etc.)
   * @param parentId - ID del padre (JNID del estimate, invoice, etc.)
   * @param items - Array completo de elementos
   * @param options - Opciones de configuración
   * @returns Referencia lazy o array original si es pequeño
   */
  public static async createReference(
    entity: string,
    parentId: string,
    items: any[],
    options: LazyArrayOptions = {}
  ): Promise<LazyArrayReference | any[]> {
    // Si el array es pequeño, retornar directamente
    if (!this.shouldBeLazy(items)) {
      return items;
    }

    const {
      previewCount = this.DEFAULT_PREVIEW_COUNT,
      verbosity = 'summary',
      storeHandle = true,
      instance,
      toolName = 'lazy_array_loader',
    } = options;

    // Crear summary compacto
    const summary = this.createSummary(items, entity, previewCount, verbosity);

    // Construir URL de carga
    const loadUrl = `/api/${entity}?parent_id=${parentId}`;

    // Calcular tamaño estimado
    const estimatedSizeKb = this.estimateArraySize(items);

    // Construir referencia base
    const reference: LazyArrayReference = {
      _type: 'lazy_array',
      entity,
      parent_id: parentId,
      count: items.length,
      summary,
      summary_verbosity: verbosity,
      load_url: loadUrl,
      fields_available: this.getAvailableFields(items),
      estimated_size_kb: estimatedSizeKb,
    };

    // Guardar en handle storage si está habilitado
    if (storeHandle && instance) {
      try {
        const handle = await handleStorage.store(
          entity,
          items,
          toolName,
          'raw', // Guardar completo
          instance
        );

        reference.handle = handle;

        console.log(
          `[LazyArrayLoader] Created handle for ${entity}: ${handle} ` +
          `(${items.length} items, ~${estimatedSizeKb} KB)`
        );
      } catch (error) {
        console.warn(
          `[LazyArrayLoader] Failed to create handle for ${entity}:`,
          error
        );
        // Continuar sin handle
      }
    }

    return reference;
  }

  /**
   * Crear summary compacto del array
   */
  private static createSummary(
    items: any[],
    entity: string,
    count: number,
    verbosity: VerbosityLevel
  ): any[] {
    // Obtener configuración de compactación
    const config = ARRAY_COMPACTION_CONFIGS[entity];

    if (!config) {
      // Sin configuración: usar primeros N elementos sin modificar
      return items.slice(0, count);
    }

    // Seleccionar campos según verbosidad
    const fields = this.getFieldsForVerbosity(config, verbosity);

    // Crear preview con campos seleccionados
    return items.slice(0, count).map(item =>
      NestedFieldSelector.selectNestedFields(item, fields)
    );
  }

  /**
   * Obtener campos según verbosidad
   */
  private static getFieldsForVerbosity(
    config: ArrayCompactionConfig,
    verbosity: VerbosityLevel
  ): string[] {
    switch (verbosity) {
      case 'summary':
        return config.summary_fields;
      case 'compact':
        return config.compact_fields;
      case 'detailed':
        return config.detailed_fields;
      case 'raw':
        return ['*']; // Todos los campos
      default:
        return config.summary_fields;
    }
  }

  /**
   * Determinar si array debe usar lazy loading
   */
  public static shouldBeLazy(
    items: any[],
    threshold: number = this.DEFAULT_THRESHOLD
  ): boolean {
    if (!Array.isArray(items)) return false;
    return items.length > threshold;
  }

  /**
   * Obtener campos disponibles en elementos del array
   */
  private static getAvailableFields(items: any[]): string[] {
    if (items.length === 0) return [];

    const firstItem = items[0];
    if (typeof firstItem !== 'object' || firstItem === null) {
      return [];
    }

    return Object.keys(firstItem);
  }

  /**
   * Estimar tamaño del array en KB
   */
  private static estimateArraySize(items: any[]): number {
    if (items.length === 0) return 0;

    try {
      const json = JSON.stringify(items);
      const sizeBytes = Buffer.byteLength(json, 'utf8');
      return parseFloat((sizeBytes / 1024).toFixed(2));
    } catch {
      return 0;
    }
  }

  /**
   * Verificar si un objeto es una referencia lazy
   */
  public static isLazyReference(obj: any): obj is LazyArrayReference {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      obj._type === 'lazy_array'
    );
  }

  /**
   * Procesar objeto recursivamente para crear referencias lazy
   *
   * Busca arrays grandes en el objeto y los convierte en referencias lazy
   */
  public static async processObject(
    obj: any,
    parentId: string,
    options: LazyArrayOptions = {}
  ): Promise<any> {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      // No procesar arrays directamente, solo cuando están como propiedades
      return obj;
    }

    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        // Determinar entity name del array
        const entityName = this.inferEntityName(parentId, key);

        // Crear referencia lazy si es necesario
        result[key] = await this.createReference(
          entityName,
          parentId,
          value,
          options
        );
      } else if (typeof value === 'object' && value !== null) {
        // Procesar objetos anidados recursivamente
        result[key] = await this.processObject(value, parentId, options);
      } else {
        // Copiar valores primitivos
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Inferir nombre de entidad desde parent ID y nombre del campo
   *
   * @example
   * inferEntityName('est123', 'items') -> 'estimate_items'
   * inferEntityName('inv456', 'payments') -> 'invoice_payments'
   */
  private static inferEntityName(parentId: string, arrayKey: string): string {
    // Determinar tipo de parent por prefijo del ID
    const parentType = this.inferParentType(parentId);

    // Construir entity name
    return `${parentType}_${arrayKey}`;
  }

  /**
   * Inferir tipo de entidad padre desde su ID
   */
  private static inferParentType(parentId: string): string {
    // Patrones comunes de IDs en JobNimbus
    if (parentId.startsWith('est')) return 'estimate';
    if (parentId.startsWith('inv')) return 'invoice';
    if (parentId.startsWith('job')) return 'job';
    if (parentId.startsWith('con')) return 'contact';

    // Por defecto, usar el ID como tipo
    return 'entity';
  }

  /**
   * Cargar array completo desde referencia lazy
   *
   * @param reference - Referencia lazy
   * @param instance - Instance name (stamford/guilford) required for handle retrieval
   * @returns Array completo
   */
  public static async loadFull(
    reference: LazyArrayReference,
    instance: 'stamford' | 'guilford'
  ): Promise<any[]> {
    // Si tiene handle, cargar desde storage
    if (reference.handle) {
      try {
        const stored = await handleStorage.retrieve(reference.handle, instance);
        return stored?.data || [];
      } catch (error) {
        console.error(
          `[LazyArrayLoader] Failed to load from handle: ${reference.handle}`,
          error
        );
        // Continuar con fallback
      }
    }

    // Sin handle: retornar summary (mejor que nada)
    console.warn(
      `[LazyArrayLoader] No handle available for ${reference.entity}, ` +
      `returning summary only`
    );

    return reference.summary || [];
  }

  /**
   * Obtener estadísticas de reducción de tamaño
   */
  public static getReductionStats(
    items: any[],
    reference: LazyArrayReference
  ): {
    original_count: number;
    summary_count: number;
    original_size_kb: number;
    reference_size_kb: number;
    reduction_percent: number;
  } {
    const originalSize = this.estimateArraySize(items);
    const referenceSize = this.estimateArraySize([reference]);

    return {
      original_count: items.length,
      summary_count: reference.summary?.length || 0,
      original_size_kb: originalSize,
      reference_size_kb: referenceSize,
      reduction_percent: parseFloat(
        (((originalSize - referenceSize) / originalSize) * 100).toFixed(1)
      ),
    };
  }
}

/**
 * Helper function para aplicar lazy loading a una respuesta completa
 */
export async function applyLazyLoading(
  data: any,
  parentId: string,
  options: LazyArrayOptions = {}
): Promise<any> {
  return LazyArrayLoader.processObject(data, parentId, options);
}
