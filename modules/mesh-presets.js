// Shared mesh quality presets for replicad tessellation.
// Used by both the Three.js viewer (client) and the API route (server).

export const MESH_QUALITY_PRESETS = {
  draft:  { tolerance: 0.5, angularTolerance: 10 },
  medium: { tolerance: 0.1, angularTolerance: 2 },
  high:   { tolerance: 0.02, angularTolerance: 0.5 },
};
