/**
 * HTTP Compression Middleware
 *
 * Comprime respuestas HTTP usando gzip para reducir ancho de banda.
 * Extremadamente efectivo en JSON debido a campos repetidos.
 *
 * Resultados Típicos:
 * - JSON estructurado: 85-88% reducción
 * - JSON con texto largo: 88-92% reducción
 * - Listas grandes: 86-90% reducción
 *
 * Configuración:
 * - threshold: Tamaño mínimo para comprimir (default: 1 KB)
 * - level: Nivel de compresión 0-9 (default: 6 = balance)
 * - memLevel: Uso de memoria 1-9 (default: 8 = balance)
 *
 * @example
 * // Antes: 600 KB (100 jobs)
 * // Después: 85 KB (86% reducción)
 *
 * Headers de respuesta:
 * Content-Encoding: gzip
 * X-Original-Size: 614400
 * X-Compressed-Size: 86016
 * X-Compression-Ratio: 86.0%
 */

import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(zlib.gzip);

/**
 * Opciones de compresión
 */
export interface CompressionOptions {
  threshold: number;        // Mínimo tamaño para comprimir (bytes)
  level: number;            // Nivel de compresión (0-9)
  memLevel: number;         // Nivel de memoria (1-9)
  filter?: (req: Request, res: Response) => boolean; // Filtro custom
}

/**
 * Estadísticas de compresión
 */
export interface CompressionStats {
  compressed_count: number;
  uncompressed_count: number;
  total_original_bytes: number;
  total_compressed_bytes: number;
  average_ratio: number;
}

export class CompressionMiddleware {
  /**
   * Configuración por defecto
   */
  private static DEFAULT_OPTIONS: CompressionOptions = {
    threshold: 1024,          // Comprimir responses > 1 KB
    level: 6,                 // Balance entre velocidad y ratio (0=rápido, 9=máximo)
    memLevel: 8,              // Balance memoria/velocidad
  };

  /**
   * Estadísticas globales
   */
  private static stats: CompressionStats = {
    compressed_count: 0,
    uncompressed_count: 0,
    total_original_bytes: 0,
    total_compressed_bytes: 0,
    average_ratio: 0,
  };

  /**
   * Middleware de compresión HTTP
   *
   * @param options - Opciones de configuración (opcional)
   * @returns Express middleware function
   */
  public static compress(options: Partial<CompressionOptions> = {}) {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    return (req: Request, res: Response, next: NextFunction) => {
      // Verificar si cliente acepta compresión
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const supportsGzip = acceptEncoding.includes('gzip');

      if (!supportsGzip) {
        this.stats.uncompressed_count++;
        return next();
      }

      // Verificar filtro custom
      if (opts.filter && !opts.filter(req, res)) {
        this.stats.uncompressed_count++;
        return next();
      }

      // Interceptar res.json para comprimir
      const originalJson = res.json.bind(res);

      res.json = function (data: any) {
        // Serializar a JSON
        const json = JSON.stringify(data);
        const sizeBytes = Buffer.byteLength(json, 'utf8');

        // No comprimir si es muy pequeño
        if (sizeBytes < opts.threshold) {
          CompressionMiddleware.stats.uncompressed_count++;
          CompressionMiddleware.stats.total_original_bytes += sizeBytes;
          return originalJson(data);
        }

        // Comprimir con gzip (async)
        gzipAsync(
          Buffer.from(json, 'utf8'),
          {
            level: opts.level,
            memLevel: opts.memLevel,
          }
        )
          .then(compressed => {
            const compressedSize = compressed.length;
            const compressionRatio = ((1 - (compressedSize / sizeBytes)) * 100);

            // Actualizar estadísticas
            CompressionMiddleware.updateStats(sizeBytes, compressedSize);

            // Headers de respuesta
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Length', compressedSize.toString());
            res.setHeader('X-Original-Size', sizeBytes.toString());
            res.setHeader('X-Compressed-Size', compressedSize.toString());
            res.setHeader('X-Compression-Ratio', `${compressionRatio.toFixed(1)}%`);
            res.setHeader('Vary', 'Accept-Encoding');

            // Log de compresión (solo en desarrollo)
            if (process.env.NODE_ENV !== 'production') {
              console.log(
                `[Compression] ${CompressionMiddleware.formatBytes(sizeBytes)} → ` +
                `${CompressionMiddleware.formatBytes(compressedSize)} ` +
                `(${compressionRatio.toFixed(1)}% reduction) - ${req.path}`
              );
            }

            res.send(compressed);
          })
          .catch(err => {
            console.error('[Compression] Failed to compress:', err);
            CompressionMiddleware.stats.uncompressed_count++;
            originalJson(data);
          });

        return res;
      };

      // Interceptar res.send para otros tipos de contenido
      const originalSend = res.send.bind(res);

      res.send = function (data: any): any {
        // Solo comprimir si es string y parece JSON
        if (typeof data === 'string' && data.trim().startsWith('{')) {
          const sizeBytes = Buffer.byteLength(data, 'utf8');

          if (sizeBytes >= opts.threshold) {
            return gzipAsync(
              Buffer.from(data, 'utf8'),
              {
                level: opts.level,
                memLevel: opts.memLevel,
              }
            )
              .then(compressed => {
                const compressionRatio = ((1 - (compressed.length / sizeBytes)) * 100);

                CompressionMiddleware.updateStats(sizeBytes, compressed.length);

                res.setHeader('Content-Encoding', 'gzip');
                res.setHeader('Content-Length', compressed.length.toString());
                res.setHeader('X-Original-Size', sizeBytes.toString());
                res.setHeader('X-Compressed-Size', compressed.length.toString());
                res.setHeader('X-Compression-Ratio', `${compressionRatio.toFixed(1)}%`);

                return originalSend(compressed);
              })
              .catch(err => {
                console.error('[Compression] Failed to compress send:', err);
                return originalSend(data);
              });
          }
        }

        return originalSend(data);
      };

      next();
    };
  }

  /**
   * Actualizar estadísticas de compresión
   */
  private static updateStats(originalSize: number, compressedSize: number): void {
    this.stats.compressed_count++;
    this.stats.total_original_bytes += originalSize;
    this.stats.total_compressed_bytes += compressedSize;

    // Calcular ratio promedio
    if (this.stats.total_original_bytes > 0) {
      this.stats.average_ratio = (
        (1 - (this.stats.total_compressed_bytes / this.stats.total_original_bytes)) * 100
      );
    }
  }

  /**
   * Obtener estadísticas de compresión
   */
  public static getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Resetear estadísticas
   */
  public static resetStats(): void {
    this.stats = {
      compressed_count: 0,
      uncompressed_count: 0,
      total_original_bytes: 0,
      total_compressed_bytes: 0,
      average_ratio: 0,
    };
  }

  /**
   * Formatear bytes en unidades legibles
   */
  private static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  /**
   * Middleware para mostrar estadísticas
   */
  public static statsEndpoint() {
    return (req: Request, res: Response) => {
      const stats = this.getStats();

      res.json({
        compression_stats: {
          ...stats,
          total_requests: stats.compressed_count + stats.uncompressed_count,
          compression_rate: (
            (stats.compressed_count / (stats.compressed_count + stats.uncompressed_count)) * 100
          ).toFixed(1) + '%',
          total_saved_bytes: stats.total_original_bytes - stats.total_compressed_bytes,
          total_saved_mb: (
            (stats.total_original_bytes - stats.total_compressed_bytes) / (1024 * 1024)
          ).toFixed(2),
        },
      });
    };
  }

  /**
   * Configuraciones predefinidas
   */
  public static presets = {
    /**
     * Fast: Compresión rápida con ratio menor
     */
    fast: (): Partial<CompressionOptions> => ({
      threshold: 1024,
      level: 1,
      memLevel: 6,
    }),

    /**
     * Balanced: Balance entre velocidad y ratio (DEFAULT)
     */
    balanced: (): Partial<CompressionOptions> => ({
      threshold: 1024,
      level: 6,
      memLevel: 8,
    }),

    /**
     * Best: Máxima compresión (más lento)
     */
    best: (): Partial<CompressionOptions> => ({
      threshold: 1024,
      level: 9,
      memLevel: 9,
    }),

    /**
     * Aggressive: Solo para respuestas muy grandes
     */
    aggressive: (): Partial<CompressionOptions> => ({
      threshold: 10 * 1024, // 10 KB
      level: 9,
      memLevel: 9,
      filter: (req, res) => {
        // Solo comprimir endpoints específicos
        return req.path.includes('/jobs') ||
               req.path.includes('/estimates') ||
               req.path.includes('/invoices');
      },
    }),
  };
}

/**
 * Helper para aplicar compresión directa a datos
 */
export async function compressData(
  data: any,
  options: Partial<CompressionOptions> = {}
): Promise<Buffer> {
  const opts = { ...CompressionMiddleware['DEFAULT_OPTIONS'], ...options };

  const json = typeof data === 'string' ? data : JSON.stringify(data);

  return gzipAsync(Buffer.from(json, 'utf8'), {
    level: opts.level,
    memLevel: opts.memLevel,
  });
}

/**
 * Helper para calcular ratio de compresión sin comprimir
 */
export function estimateCompressionRatio(data: any): number {
  const json = JSON.stringify(data);

  // Estimación heurística basada en patrones comunes
  // JSON estructurado típicamente comprime 85-90%
  let estimatedRatio = 0.85;

  // Texto largo comprime mejor
  if (json.length > 100000) {
    estimatedRatio = 0.88;
  }

  // JSON con muchos campos repetidos comprime mejor
  const uniqueKeys = new Set(json.match(/"(\w+)":/g) || []);
  const totalKeys = (json.match(/"(\w+)":/g) || []).length;

  if (totalKeys > uniqueKeys.size * 5) {
    // Muchos campos repetidos
    estimatedRatio = 0.90;
  }

  return estimatedRatio;
}

/**
 * Exportar middleware por defecto
 */
export default CompressionMiddleware.compress;
