import { z } from 'zod';

// Zod schema for SystemDoc v1 (SPEC §4.1). No `.default()`: absent optional fields stay absent so
// that exporting returns the document as it was imported; defaults are applied only when rendering.

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
export const NAME_MAX = 80;
export const EDGE_LABEL_MAX = 40;
export const SCHEMA_VERSION = 1;

export const IdSchema = z.string().regex(ID_PATTERN);
const NameSchema = z.string().min(1).max(NAME_MAX);
const StringMapSchema = z.record(z.string(), z.string());

export const NODE_TYPES = [
  'system',
  'application',
  'frontend',
  'api',
  'worker',
  'consumer',
  'component',
  'cdn',
  'gateway',
  'ingress',
  'broker',
  'exchange',
  'queue',
  'topic',
  'database',
  'table',
  'cache',
  'storage',
  'external',
  'user',
  'other',
] as const;
export const NodeTypeSchema = z.enum(NODE_TYPES);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const HOSTING_PLATFORMS = [
  'kubernetes',
  'vm',
  'serverless',
  'paas',
  'saas',
  'on-premise',
  'other',
] as const;
export const HostingPlatformSchema = z.enum(HOSTING_PLATFORMS);
export type HostingPlatform = z.infer<typeof HostingPlatformSchema>;

export const ConfidenceSchema = z.enum(['confirmed', 'assumed']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const EdgeModeSchema = z.enum(['sync', 'async']);
export type EdgeMode = z.infer<typeof EdgeModeSchema>;

export const HostingSchema = z.object({
  platform: HostingPlatformSchema,
  cluster: z.string().optional(),
  namespace: z.string().optional(),
  details: z.string().optional(),
});
export type Hosting = z.infer<typeof HostingSchema>;

export const LinkSchema = z.object({
  label: z.string(),
  url: z.string().min(1),
});
export type Link = z.infer<typeof LinkSchema>;

export const SysNodeSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  type: NodeTypeSchema,
  description: z.string().optional(),
  technology: z.string().optional(),
  hosting: HostingSchema.optional(),
  owner: z.string().optional(),
  links: z.array(LinkSchema).optional(),
  metadata: StringMapSchema.optional(),
  confidence: ConfidenceSchema.optional(),
  get children() {
    return z.array(SysNodeSchema).optional();
  },
});
export type SysNode = z.infer<typeof SysNodeSchema>;

export const SysEdgeSchema = z.object({
  id: IdSchema,
  source: z.string(),
  target: z.string(),
  protocol: z.string().optional(),
  mode: EdgeModeSchema.optional(),
  label: z.string().max(EDGE_LABEL_MAX).optional(),
  description: z.string().optional(),
  metadata: StringMapSchema.optional(),
  confidence: ConfidenceSchema.optional(),
});
export type SysEdge = z.infer<typeof SysEdgeSchema>;

export const FlowStepSchema = z.object({
  edgeId: z.string(),
  note: z.string().optional(),
});
export type FlowStep = z.infer<typeof FlowStepSchema>;

export const FlowSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  description: z.string().optional(),
  steps: z.array(FlowStepSchema).min(1),
});
export type Flow = z.infer<typeof FlowSchema>;

export const PositionSchema = z.object({ x: z.number(), y: z.number() });
export type Position = z.infer<typeof PositionSchema>;

export const LayoutSchema = z.object({
  positions: z.record(z.string(), PositionSchema).optional(),
});
export type Layout = z.infer<typeof LayoutSchema>;

export const SystemDocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: IdSchema,
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(SysNodeSchema).min(1),
  edges: z.array(SysEdgeSchema),
  flows: z.array(FlowSchema).optional(),
  layout: LayoutSchema.optional(),
});
export type SystemDoc = z.infer<typeof SystemDocSchema>;
