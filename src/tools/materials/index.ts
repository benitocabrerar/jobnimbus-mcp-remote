/**
 * Material Tracking Tools Index
 * Export all material tracking and calculation tools
 */

// Material Tracking Tools (existing)
export { default as getEstimateMaterialsTool } from './getEstimateMaterials.js';
export { default as analyzeMaterialCostsTool } from './analyzeMaterialCosts.js';
export { default as getMaterialUsageReportTool } from './getMaterialUsageReport.js';
export { default as getSupplierComparisonTool } from './getSupplierComparison.js';
export { default as getMaterialInventoryInsightsTool } from './getMaterialInventoryInsights.js';

// Material Calculation Tools (new)
export { default as calculateRoofingMaterialsTool } from './calculateRoofingMaterials.js';
export { default as calculateSidingMaterialsTool } from './calculateSidingMaterials.js';
export { default as estimateMaterialsFromJobTool } from './estimateMaterialsFromJob.js';
export { default as calculateWasteFactorsTool } from './calculateWasteFactors.js';
export { default as optimizeMaterialOrdersTool } from './optimizeMaterialOrders.js';
export { default as getMaterialSpecificationsTool } from './getMaterialSpecifications.js';
export { default as compareMaterialAlternativesTool } from './compareMaterialAlternatives.js';

// Re-export tool classes for type checking
export { GetEstimateMaterialsTool } from './getEstimateMaterials.js';
export { AnalyzeMaterialCostsTool } from './analyzeMaterialCosts.js';
export { GetMaterialUsageReportTool } from './getMaterialUsageReport.js';
export { GetSupplierComparisonTool } from './getSupplierComparison.js';
export { GetMaterialInventoryInsightsTool } from './getMaterialInventoryInsights.js';
export { CalculateRoofingMaterialsTool } from './calculateRoofingMaterials.js';
export { CalculateSidingMaterialsTool } from './calculateSidingMaterials.js';
export { EstimateMaterialsFromJobTool } from './estimateMaterialsFromJob.js';
export { CalculateWasteFactorsTool } from './calculateWasteFactors.js';
export { OptimizeMaterialOrdersTool } from './optimizeMaterialOrders.js';
export { GetMaterialSpecificationsTool } from './getMaterialSpecifications.js';
export { CompareMaterialAlternativesTool } from './compareMaterialAlternatives.js';
