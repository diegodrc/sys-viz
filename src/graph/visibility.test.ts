import { describe, expect, it } from 'vitest';
import { exampleDoc } from '../test/fixtures';
import { buildTree } from './tree';
import {
  expandAll,
  expandAncestors,
  expandToLevel,
  isExpandedGroup,
  pruneExpanded,
  visibleAncestor,
  visibleNodeIds,
} from './visibility';

const tree = buildTree(exampleDoc());
const none = new Set<string>();

describe('buildTree', () => {
  it('indexes all 27 nodes with parents and levels', () => {
    expect(tree.order).toHaveLength(27);
    expect(tree.rootIds).toHaveLength(9);
    expect(tree.parentOf.get('fila-pedidos')).toBe('db-pedidos');
    expect(tree.levelOf.get('fila-pedidos')).toBe(3);
    expect(tree.maxLevel).toBe(3);
    expect(tree.ancestorsOf('fila-pedidos')).toEqual(['sistema-pedidos', 'db-pedidos']);
    expect(tree.descendantsOf('sistema-pedidos')).toEqual([
      'ingress-pedidos',
      'api-pedidos',
      'worker-pedidos',
      'db-pedidos',
      'fila-pedidos',
    ]);
    expect(tree.isGroup('db-pedidos')).toBe(true);
    expect(tree.isGroup('apigee')).toBe(false);
  });
});

describe('visibility', () => {
  it('A2: macro view shows the 9 root nodes', () => {
    expect(visibleNodeIds(tree, none)).toEqual([
      'usuario',
      'akamai',
      'portal-web',
      'apigee',
      'sistema-pedidos',
      'ca-gateway',
      'sistema-validacao',
      'rabbitmq',
      'sistema-externo',
    ]);
  });

  it('A3: expanding sistema-pedidos shows 13 nodes (container included)', () => {
    const visible = visibleNodeIds(tree, new Set(['sistema-pedidos']));
    expect(visible).toHaveLength(13);
    expect(visible).toContain('db-pedidos');
    expect(visible).not.toContain('fila-pedidos');
  });

  it('A4: expand all shows all 27 nodes', () => {
    expect(visibleNodeIds(tree, expandAll(tree))).toHaveLength(27);
  });

  it('visibleAncestor returns the outermost collapsed ancestor', () => {
    expect(visibleAncestor('fila-pedidos', tree, none)).toBe('sistema-pedidos');
    expect(visibleAncestor('fila-pedidos', tree, new Set(['sistema-pedidos']))).toBe('db-pedidos');
    // an expanded inner group under a collapsed outer group stays hidden
    expect(visibleAncestor('fila-pedidos', tree, new Set(['db-pedidos']))).toBe('sistema-pedidos');
    expect(visibleAncestor('apigee', tree, none)).toBe('apigee');
  });

  it('isExpandedGroup requires the group to be visible', () => {
    expect(isExpandedGroup('db-pedidos', tree, new Set(['db-pedidos']))).toBe(false);
    expect(isExpandedGroup('db-pedidos', tree, new Set(['db-pedidos', 'sistema-pedidos']))).toBe(
      true,
    );
    expect(isExpandedGroup('apigee', tree, new Set(['apigee']))).toBe(false);
  });

  it('expandToLevel: level 1 = roots only, level 2 expands roots, max level = all', () => {
    expect(expandToLevel(tree, 1).size).toBe(0);
    expect([...expandToLevel(tree, 2)].sort()).toEqual([
      'portal-web',
      'rabbitmq',
      'sistema-pedidos',
      'sistema-validacao',
    ]);
    expect(visibleNodeIds(tree, expandToLevel(tree, tree.maxLevel))).toHaveLength(27);
  });

  it('expandAncestors and pruneExpanded', () => {
    expect([...expandAncestors('fila-pedidos', tree, none)]).toEqual([
      'sistema-pedidos',
      'db-pedidos',
    ]);
    expect([...pruneExpanded(tree, ['rabbitmq', 'apigee', 'ghost'])]).toEqual(['rabbitmq']);
  });
});
