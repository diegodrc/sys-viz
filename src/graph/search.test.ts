import { describe, expect, it } from 'vitest';
import { exampleDoc } from '../test/fixtures';
import { aggregateEdges } from './aggregate';
import {
  EMPTY_FILTERS,
  filterDimmedEdges,
  filterDimmedNodes,
  filterOptions,
  NO_HOSTING,
  type NodeFilters,
} from './filter';
import { normalizeText, searchNodes } from './search';
import { buildTree } from './tree';
import { expandAll, visibleNodeIds } from './visibility';

const doc = exampleDoc();
const tree = buildTree(doc);
const macro = new Set<string>();

describe('searchNodes (SPEC §6.4)', () => {
  it('A15: "worker" finds Sistema Pedidos › Worker Fila Pedidos', () => {
    expect(searchNodes(tree, 'worker')).toEqual([
      { id: 'worker-pedidos', path: ['Sistema Pedidos', 'Worker Fila Pedidos'] },
    ]);
  });

  it('is case- and accent-insensitive and searches id and technology', () => {
    expect(normalizeText('Validação')).toBe('validacao');
    expect(searchNodes(tree, 'VALIDACAO').map((r) => r.id)).toEqual([
      'sistema-validacao',
      'ingress-validacao',
      'api-validacao',
      'db-validacao',
    ]);
    expect(searchNodes(tree, 'db-destino').map((r) => r.id)).toEqual([
      'db-destino-a',
      'db-destino-b',
    ]);
    expect(searchNodes(tree, 'nginx ingress').map((r) => r.id)).toHaveLength(3);
    expect(searchNodes(tree, 'sql server (tabela)').map((r) => r.path)).toEqual([
      ['Sistema Pedidos', 'Banco Pedidos', 'Fila Pedidos'],
    ]);
  });

  it('empty queries return nothing; results are limited', () => {
    expect(searchNodes(tree, '   ')).toEqual([]);
    expect(searchNodes(tree, 'a', 3)).toHaveLength(3);
  });
});

describe('filters (SPEC §6.4)', () => {
  const dbOnly: NodeFilters = { types: new Set(['database']), platforms: new Set() };

  it('A16: type=database in the macro view lights only groups with databases', () => {
    const dimmed = filterDimmedNodes(tree, visibleNodeIds(tree, macro), dbOnly);
    const lit = visibleNodeIds(tree, macro).filter((id) => !dimmed.has(id));
    expect(lit).toEqual(['sistema-pedidos', 'sistema-validacao']);
  });

  it('expanded groups stay lit when a descendant matches; matching leaves are lit', () => {
    const all = expandAll(tree);
    const dimmed = filterDimmedNodes(tree, visibleNodeIds(tree, all), dbOnly);
    expect(dimmed.has('sistema-pedidos')).toBe(false);
    expect(dimmed.has('db-pedidos')).toBe(false);
    expect(dimmed.has('fila-pedidos')).toBe(true);
    expect(dimmed.has('api-pedidos')).toBe(true);
  });

  it('"sem hosting" and AND across categories', () => {
    const noHosting: NodeFilters = { types: new Set(), platforms: new Set([NO_HOSTING]) };
    const dimmed = filterDimmedNodes(tree, visibleNodeIds(tree, macro), noHosting);
    // usuario, ca-gateway, rabbitmq, sistema-externo have no hosting; groups with such children too
    expect(dimmed.has('usuario')).toBe(false);
    expect(dimmed.has('akamai')).toBe(true);
    expect(dimmed.has('sistema-pedidos')).toBe(false); // db-pedidos has no hosting

    const both: NodeFilters = { types: new Set(['gateway']), platforms: new Set(['saas']) };
    const lit = visibleNodeIds(tree, macro).filter(
      (id) => !filterDimmedNodes(tree, visibleNodeIds(tree, macro), both).has(id),
    );
    expect(lit).toEqual(['apigee']);
  });

  it('edges are dimmed only when both ends are dimmed; no filter dims nothing', () => {
    const rendered = aggregateEdges(doc, macro, tree);
    const dimmedNodes = filterDimmedNodes(tree, visibleNodeIds(tree, macro), dbOnly);
    const dimmedEdges = filterDimmedEdges(rendered, dimmedNodes);
    expect(dimmedEdges.has('usuario->akamai')).toBe(true);
    expect(dimmedEdges.has('sistema-pedidos->ca-gateway')).toBe(false);
    expect(filterDimmedNodes(tree, visibleNodeIds(tree, macro), EMPTY_FILTERS).size).toBe(0);
  });

  it('options list the types and hosting present in the document', () => {
    const options = filterOptions(tree);
    expect(options.types).toContain('database');
    expect(options.types).not.toContain('cache');
    expect(options.platforms.sort()).toEqual(['kubernetes', NO_HOSTING, 'saas'].sort());
  });
});
