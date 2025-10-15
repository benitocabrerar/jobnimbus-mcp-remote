/**
 * Material Tracking Tools Index
 * Export all material tracking and calculation tools
 */

// Material Tracking Tools - CONSOLIDATED (Phase 3 Part 1: 4 → 2 tools)
export { default as getEstimateMaterialsTool } from './getEstimateMaterials.js';
export { default as getMaterialsTrackingTool } from './getMaterialsTracking.js';
// ARCHIVED (Phase 3 Part 1): analyzeMaterialCostsTool, getMaterialUsageReportTool, getMaterialInventoryInsightsTool
// See: src/tools/archived/materials/tracking/README.md for migration guide

// Material Calculation Tools (new)
export { default as calculateRoofingMaterialsTool } from './calculateRoofingMaterials.js';
export { default as calculateSidingMaterialsTool } from './calculateSidingMaterials.js';
export { default as estimateMaterialsFromJobTool } from './estimateMaterialsFromJob.js';
export { default as calculateWasteFactorsTool } from './calculateWasteFactors.js';
export { default as optimizeMaterialOrdersTool } from './optimizeMaterialOrders.js';
export { default as getMaterialSpecificationsTool } from './getMaterialSpecifications.js';
export { default as compareMaterialAlternativesTool } from './compareMaterialAlternatives.js';

// Re-export tool classes for type checking - CONSOLIDATED (Phase 3 Part 1)
export { GetEstimateMaterialsTool } from './getEstimateMaterials.js';
export { GetMaterialsTrackingTool } from './getMaterialsTracking.js';
// ARCHIVED (Phase 3 Part 1): AnalyzeMaterialCostsTool, GetMaterialUsageReportTool, GetMaterialInventoryInsightsTool
export { CalculateRoofingMaterialsTool } from './calculateRoofingMaterials.js';
export { CalculateSidingMaterialsTool } from './calculateSidingMaterials.js';
export { EstimateMaterialsFromJobTool } from './estimateMaterialsFromJob.js';
export { CalculateWasteFactorsTool } from './calculateWasteFactors.js';
export { OptimizeMaterialOrdersTool } from './optimizeMaterialOrders.js';
export { GetMaterialSpecificationsTool } from './getMaterialSpecifications.js';
export { CompareMaterialAlternativesTool } from './compareMaterialAlternatives.js';
