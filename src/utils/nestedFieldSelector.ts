/**
 * Nested Field Selector
 *
 * Soporta selección de campos anidados con notación de punto y arrays
 * Sintaxis: 'primary.name', 'items[].name', 'items[].price'
 *
 * @example
 * // Input data:
 * {
 *   jnid: "est123",
 *   name: "Estimate",
 *   primary: { id: "123", name: "John Doe", email: "john@example.com" },
 *   items: [
 *     { jnid: "item1", name: "Shingles", price: 100, cost: 65, description: "..." },
 *     { jnid: "item2", name: "Labor", price: 200, cost: 150, description: "..." }
 *   ]
 * }
 *
 * // Field selection: ['jnid', 'name', 'primary.name', 'items[].name', 'items[].price']
 * // Output:
 * {
 *   jnid: "est123",
 *   name: "Estimate",
 *   primary: { name: "John Doe" },
 *   items: [
 *     { name: "Shingles", price: 100 },
 *     { name: "Labor", price: 200 }
 *   ]
 * }
 *
 * Reducción: ~85% (de ~5 KB a ~0.8 KB)
 */

export interface FieldSchema {
  fields: Record<string, any>;    // Campos simples y objetos anidados
  arrays: Record<string, string[]>; // Arrays con sus campos
}

export interface FieldPath {
  parts: string[];
  isArray: boolean;
  arrayField?: string;
  remainingPath?: string[];
}

export class NestedFieldSelector {
  /**
   * Seleccionar campos con notación de punto y arrays
   *
   * @param data - Datos a filtrar (objeto o array)
   * @param fieldPaths - Array de rutas de campos (ej: ['primary.name', 'items[].price'])
   * @returns Datos filtrados con solo los campos seleccionados
   */
  public static selectNestedFields(data: any, fieldPaths: string[]): any {
    if (!fieldPaths || fieldPaths.length === 0) {
      return data;
    }

    // Construir schema de campos
    const schema = this.buildFieldSchema(fieldPaths);

    // Extraer datos según schema
    return this.extractData(data, schema);
  }

  /**
   * Construir schema de campos desde array de rutas
   *
   * Convierte ['primary.name', 'items[].price'] en estructura jerárquica
   */
  private static buildFieldSchema(fieldPaths: string[]): FieldSchema {
    const schema: FieldSchema = {
      fields: {},
      arrays: {}
    };

    for (const path of fieldPaths) {
      this.addPathToSchema(schema, path);
    }

    return schema;
  }

  /**
   * Agregar ruta individual al schema
   */
  private static addPathToSchema(schema: FieldSchema, path: string): void {
    const pathInfo = this.parsePath(path);

    if (pathInfo.isArray) {
      // Manejar array: items[].price
      const arrayField = pathInfo.arrayField!;

      if (!schema.arrays[arrayField]) {
        schema.arrays[arrayField] = [];
      }

      if (pathInfo.remainingPath && pathInfo.remainingPath.length > 0) {
        // Hay sub-campos del array
        const subPath = pathInfo.remainingPath.join('.');

        // Evitar duplicados
        if (!schema.arrays[arrayField].includes(subPath)) {
          schema.arrays[arrayField].push(subPath);
        }
      }
    } else {
      // Manejar campo simple o anidado: name, primary.name
      this.addNestedField(schema.fields, pathInfo.parts);
    }
  }

  /**
   * Parsear ruta de campo
   *
   * @example
   * 'items[].price' -> { parts: ['items', 'price'], isArray: true, arrayField: 'items' }
   * 'primary.name' -> { parts: ['primary', 'name'], isArray: false }
   */
  private static parsePath(path: string): FieldPath {
    const parts = path.split('.');

    // Buscar notación de array []
    const arrayIndex = parts.findIndex(p => p.endsWith('[]'));

    if (arrayIndex !== -1) {
      // Es un array
      const arrayField = parts[arrayIndex].slice(0, -2); // Quitar []
      const remainingPath = parts.slice(arrayIndex + 1);

      return {
        parts,
        isArray: true,
        arrayField,
        remainingPath,
      };
    }

    // No es array
    return {
      parts,
      isArray: false,
    };
  }

  /**
   * Agregar campo anidado al schema
   *
   * Convierte ['primary', 'name'] en { primary: { name: true } }
   */
  private static addNestedField(fields: Record<string, any>, parts: string[]): void {
    if (parts.length === 0) return;

    if (parts.length === 1) {
      // Campo final
      fields[parts[0]] = true;
      return;
    }

    // Campo anidado
    const [first, ...rest] = parts;

    if (!fields[first]) {
      fields[first] = {};
    }

    if (typeof fields[first] === 'object') {
      this.addNestedField(fields[first], rest);
    }
  }

  /**
   * Extraer datos según schema
   */
  private static extractData(data: any, schema: FieldSchema): any {
    if (Array.isArray(data)) {
      // Array de objetos
      return data.map(item => this.extractData(item, schema));
    }

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const result: any = {};

    // Extraer campos simples y anidados
    for (const [key, value] of Object.entries(schema.fields)) {
      if (!(key in data)) continue;

      if (value === true) {
        // Campo simple
        result[key] = data[key];
      } else if (typeof value === 'object') {
        // Objeto anidado
        result[key] = this.extractNestedObject(data[key], value);
      }
    }

    // Extraer arrays con campos seleccionados
    for (const [arrayKey, arrayFieldPaths] of Object.entries(schema.arrays)) {
      if (!(arrayKey in data) || !Array.isArray(data[arrayKey])) {
        continue;
      }

      if (arrayFieldPaths.length === 0) {
        // Array completo
        result[arrayKey] = data[arrayKey];
      } else {
        // Campos seleccionados del array
        result[arrayKey] = this.extractArrayFields(
          data[arrayKey],
          arrayFieldPaths
        );
      }
    }

    return result;
  }

  /**
   * Extraer objeto anidado
   */
  private static extractNestedObject(obj: any, schema: Record<string, any>): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const result: any = {};

    for (const [key, value] of Object.entries(schema)) {
      if (!(key in obj)) continue;

      if (value === true) {
        result[key] = obj[key];
      } else if (typeof value === 'object') {
        result[key] = this.extractNestedObject(obj[key], value);
      }
    }

    return result;
  }

  /**
   * Extraer campos de array
   */
  private static extractArrayFields(
    array: any[],
    fieldPaths: string[]
  ): any[] {
    return array.map(item => {
      if (typeof item !== 'object' || item === null) {
        return item;
      }

      const result: any = {};

      for (const path of fieldPaths) {
        const value = this.getNestedValue(item, path);
        this.setNestedValue(result, path, value);
      }

      return result;
    });
  }

  /**
   * Obtener valor anidado usando notación de punto
   */
  private static getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Asignar valor anidado usando notación de punto
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      if (!(part in current)) {
        current[part] = {};
      }

      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Validar sintaxis de campo
   */
  public static validateFieldPath(path: string): boolean {
    // Sintaxis válida:
    // - Campo simple: "name"
    // - Campo anidado: "primary.name"
    // - Array: "items[]"
    // - Array con campo: "items[].price"
    // - Array anidado: "items[].details.color"

    const regex = /^[a-zA-Z_][a-zA-Z0-9_]*(\[[^\]]*\])?(\.[a-zA-Z_][a-zA-Z0-9_]*(\[[^\]]*\])?)*$/;
    return regex.test(path);
  }

  /**
   * Calcular reducción de tamaño estimada
   */
  public static estimateReduction(
    originalData: any,
    selectedFields: string[]
  ): {
    original_size_kb: number;
    selected_size_kb: number;
    reduction_percent: number;
  } {
    const originalSize = Buffer.byteLength(JSON.stringify(originalData), 'utf8');
    const selectedData = this.selectNestedFields(originalData, selectedFields);
    const selectedSize = Buffer.byteLength(JSON.stringify(selectedData), 'utf8');

    return {
      original_size_kb: parseFloat((originalSize / 1024).toFixed(2)),
      selected_size_kb: parseFloat((selectedSize / 1024).toFixed(2)),
      reduction_percent: parseFloat(
        (((originalSize - selectedSize) / originalSize) * 100).toFixed(1)
      ),
    };
  }
}

/**
 * Helper function para usar en endpoints
 */
export function selectFields(data: any, fieldsParam?: string): any {
  if (!fieldsParam) {
    return data;
  }

  const fields = fieldsParam.split(',').map(f => f.trim()).filter(Boolean);

  if (fields.length === 0) {
    return data;
  }

  return NestedFieldSelector.selectNestedFields(data, fields);
}
