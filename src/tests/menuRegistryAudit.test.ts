import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import { MENU_STRUCTURE as SIDEBAR_MENU } from '../components/Sidebar';
import { MENU_STRUCTURE as CONTEXT_MENU } from '../components/ContextMenu';

/**
 * Audyt menu i rejestru nodów:
 * - każdy wpis menu istnieje w NODE_REGISTRY (żadnych literówek/martwych wpisów),
 * - nowe nody są dostępne w obu menu,
 * - wewnętrzne adaptery (split_vecN/combine_vecN) NIE dublują się w menu —
 *   użytkownik widzi tylko wersje Auto,
 * - nazewnictwo spójne: "Combine (Auto)" zamiast osobnego "Compose".
 */

const sidebarIds = Object.values(SIDEBAR_MENU).flat();
const contextIds = Object.values(CONTEXT_MENU).flat();
const registryIds = Object.values(NODE_REGISTRY).map(def => def.id);

const NEW_NODE_IDS = ['mono', 'math_fract', 'math_tan', 'math_cot', 'math_atan', 'color_preview', 'code_glsl'];
const INTERNAL_ADAPTER_IDS = ['split_vec2', 'split_vec3', 'split_vec4', 'combine_vec2', 'combine_vec3', 'combine_vec4'];

describe('Menu & registry audit', () => {
  it('every sidebar menu id exists in NODE_REGISTRY', () => {
    sidebarIds.forEach(id => {
      expect(registryIds, `sidebar id "${id}" missing in registry`).toContain(id);
    });
  });

  it('every context menu id exists in NODE_REGISTRY', () => {
    contextIds.forEach(id => {
      expect(registryIds, `context menu id "${id}" missing in registry`).toContain(id);
    });
  });

  it('new nodes are registered and available in both menus', () => {
    NEW_NODE_IDS.forEach(id => {
      expect(registryIds, `"${id}" missing in registry`).toContain(id);
      expect(sidebarIds, `"${id}" missing in sidebar menu`).toContain(id);
      expect(contextIds, `"${id}" missing in context menu`).toContain(id);
    });
  });

  it('internal fixed adapters are NOT duplicated in user menus (Auto versions only)', () => {
    INTERNAL_ADAPTER_IDS.forEach(id => {
      expect(sidebarIds, `"${id}" should not be in sidebar`).not.toContain(id);
      expect(contextIds, `"${id}" should not be in context menu`).not.toContain(id);
    });
    // Wersje Auto są dostępne dla użytkownika
    expect(sidebarIds).toContain('smart_split');
    expect(sidebarIds).toContain('smart_compose');
  });

  it('naming is unified: "Combine (Auto)" — no separate "Compose" concept', () => {
    expect(NODE_REGISTRY.smart_compose.label).toBe('Combine (Auto)');
    const labels = Object.values(NODE_REGISTRY).map(def => def.label);
    expect(labels.some(l => l.includes('Compose'))).toBe(false);
  });

  it('internal adapters stay registered (auto-adapter depends on them)', () => {
    INTERNAL_ADAPTER_IDS.forEach(id => {
      expect(registryIds, `adapter "${id}" must stay in registry`).toContain(id);
    });
  });

  it('new node GLSL templates are sane', () => {
    expect(NODE_REGISTRY.mono.outputs[0].type).toBe('vec3');
    expect(NODE_REGISTRY.mono.inputs[0].type).toBe('float');
    expect(NODE_REGISTRY.math_fract.glslTemplate({ in: '0.5' })).toBe('fract(0.5)');
    expect(NODE_REGISTRY.math_tan.glslTemplate({ in: '0.5' })).toBe('tan(0.5)');
    expect(NODE_REGISTRY.code_glsl.controls?.type).toBe('text');
    expect(NODE_REGISTRY.color_preview.inputs[0].id).toBe('in');
  });
});
