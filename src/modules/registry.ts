/**
 * Module registry. FROZEN: owned by the lead (graph.md → N1).
 *
 * Modules are discovered at build time and loaded on demand, so the navigation can be drawn
 * from MODULE_META before any feature code is downloaded.
 */
import { MODULE_IDS, type ModuleDef, type ModuleId } from '@/contract';

const loaders = import.meta.glob<{ default: ModuleDef }>('./*/index.tsx');
const keyOf = (id: ModuleId): string => `./${id}/index.tsx`;

/** Ids from MODULE_IDS that are actually present in this build, in menu order. */
export const AVAILABLE_MODULES: readonly ModuleId[] = MODULE_IDS.filter((id) => keyOf(id) in loaders);

export async function loadModule(id: ModuleId): Promise<ModuleDef> {
  const load = loaders[keyOf(id)];
  if (!load) throw new Error(`module not installed: ${id}`);
  const def = (await load()).default;
  if (!def || def.id !== id || typeof def.Component !== 'function') {
    throw new Error(`src/modules/${id}/index.tsx must default-export { id: '${id}', Component }`);
  }
  return def;
}
