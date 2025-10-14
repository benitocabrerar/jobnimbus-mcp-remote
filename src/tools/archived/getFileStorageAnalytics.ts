/**
 * Get File Storage Analytics
 * File and attachment analytics with storage usage, type distribution, and organization recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface StorageMetrics {
  total_files: number;
  total_size_mb: number;
  avg_file_size_mb: number;
  files_by_type: Record<string, number>;
  largest_files: { name: string; size_mb: number; type: string }[];
}

interface FileDistribution {
  file_type: string;
  count: number;
  total_size_mb: number;
  percentage_of_storage: number;
}

interface UploadTrends {
  period: string;
  files_uploaded: number;
  total_size_mb: number;
}

export class GetFileStorageAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_file_storage_analytics',
      description: 'File and attachment analytics with storage usage tracking, type distribution, upload trends, and optimization recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          include_trends: {
            type: 'boolean',
            default: true,
            description: 'Include upload trend analysis',
          },
          min_size_mb: {
            type: 'number',
            default: 0,
            description: 'Minimum file size to include (MB)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const includeTrends = input.include_trends !== false;
      const minSizeMB = input.min_size_mb || 0;

      const attachmentsResponse = await this.client.get(context.apiKey, 'attachments', { size: 100 });
      const attachments = attachmentsResponse.data?.results || attachmentsResponse.data?.attachments || [];

      if (attachments.length === 0) {
        return {
          data_source: 'Live JobNimbus API data',
          message: 'No attachments found',
          metrics: { total_files: 0, total_size_mb: 0 },
        };
      }

      let totalSize = 0;
      const typeMap = new Map<string, { count: number; size: number }>();
      const largestFiles: { name: string; size_mb: number; type: string }[] = [];
      const monthlyUploads = new Map<string, { count: number; size: number }>();

      for (const file of attachments) {
        const fileSize = (file.size || file.file_size || 0) / (1024 * 1024); // Convert to MB
        if (fileSize < minSizeMB) continue;

        totalSize += fileSize;

        // File type distribution
        const fileName = file.name || file.filename || 'unknown';
        const fileType = this.getFileType(fileName);

        if (!typeMap.has(fileType)) {
          typeMap.set(fileType, { count: 0, size: 0 });
        }
        const typeData = typeMap.get(fileType)!;
        typeData.count++;
        typeData.size += fileSize;

        // Track largest files
        largestFiles.push({
          name: fileName,
          size_mb: fileSize,
          type: fileType,
        });

        // Monthly trends
        if (includeTrends) {
          const uploadDate = file.date_created || file.created_at || 0;
          if (uploadDate > 0) {
            const monthKey = new Date(uploadDate).toISOString().substring(0, 7); // YYYY-MM
            if (!monthlyUploads.has(monthKey)) {
              monthlyUploads.set(monthKey, { count: 0, size: 0 });
            }
            const monthData = monthlyUploads.get(monthKey)!;
            monthData.count++;
            monthData.size += fileSize;
          }
        }
      }

      // Sort largest files
      largestFiles.sort((a, b) => b.size_mb - a.size_mb);

      // Metrics
      const metrics: StorageMetrics = {
        total_files: attachments.length,
        total_size_mb: totalSize,
        avg_file_size_mb: attachments.length > 0 ? totalSize / attachments.length : 0,
        files_by_type: Object.fromEntries(
          Array.from(typeMap.entries()).map(([type, data]) => [type, data.count])
        ),
        largest_files: largestFiles.slice(0, 10),
      };

      // File distribution
      const fileDistribution: FileDistribution[] = [];
      for (const [type, data] of typeMap.entries()) {
        fileDistribution.push({
          file_type: type,
          count: data.count,
          total_size_mb: data.size,
          percentage_of_storage: totalSize > 0 ? (data.size / totalSize) * 100 : 0,
        });
      }
      fileDistribution.sort((a, b) => b.total_size_mb - a.total_size_mb);

      // Upload trends
      const uploadTrends: UploadTrends[] = [];
      if (includeTrends) {
        const sortedMonths = Array.from(monthlyUploads.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [month, data] of sortedMonths) {
          uploadTrends.push({
            period: month,
            files_uploaded: data.count,
            total_size_mb: data.size,
          });
        }
      }

      // Recommendations
      const recommendations: string[] = [];

      if (totalSize > 1000) { // > 1GB
        recommendations.push(`💾 High storage usage (${totalSize.toFixed(0)}MB) - consider archiving old files`);
      }

      const largeFiles = largestFiles.filter(f => f.size_mb > 10).length;
      if (largeFiles > 5) {
        recommendations.push(`📦 ${largeFiles} files over 10MB - compress or optimize large files`);
      }

      const topType = fileDistribution[0];
      if (topType && topType.percentage_of_storage > 50) {
        recommendations.push(`📊 ${topType.file_type} files account for ${topType.percentage_of_storage.toFixed(1)}% of storage`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        metrics: metrics,
        file_distribution: fileDistribution,
        upload_trends: includeTrends ? uploadTrends : undefined,
        recommendations: recommendations,
        key_insights: [
          `Total storage: ${totalSize.toFixed(2)}MB across ${attachments.length} files`,
          `Most common type: ${topType?.file_type || 'N/A'} (${topType?.count || 0} files)`,
          `Average file size: ${metrics.avg_file_size_mb.toFixed(2)}MB`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private getFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'unknown';
    const typeMap: Record<string, string> = {
      'pdf': 'PDF',
      'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'webp': 'Image',
      'doc': 'Document', 'docx': 'Document', 'txt': 'Document',
      'xls': 'Spreadsheet', 'xlsx': 'Spreadsheet', 'csv': 'Spreadsheet',
      'zip': 'Archive', 'rar': 'Archive', '7z': 'Archive',
      'mp4': 'Video', 'mov': 'Video', 'avi': 'Video',
    };
    return typeMap[ext] || ext.toUpperCase();
  }
}
