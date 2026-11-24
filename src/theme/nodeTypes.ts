import {
  Box,
  Cog,
  Database,
  ExternalLink,
  Globe,
  Inbox,
  ListOrdered,
  Monitor,
  Network,
  Server,
  Shield,
  Shuffle,
  Split,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { NodeType } from '../schema/system';

// Single source of icon and color per node type (SPEC §5.2). Colors are mid-tone so they read on
// both the light and the dark surface; they are used for the icon and the card accent.

export interface NodeTypeStyle {
  icon: LucideIcon;
  color: string;
}

export const NODE_TYPE_STYLES: Readonly<Record<NodeType, NodeTypeStyle>> = {
  system: { icon: Box, color: '#6366f1' },
  application: { icon: Box, color: '#3b82f6' },
  frontend: { icon: Monitor, color: '#0891b2' },
  api: { icon: Server, color: '#059669' },
  worker: { icon: Cog, color: '#d97706' },
  consumer: { icon: Inbox, color: '#ca8a04' },
  component: { icon: Box, color: '#64748b' },
  cdn: { icon: Globe, color: '#0ea5e9' },
  gateway: { icon: Shield, color: '#8b5cf6' },
  ingress: { icon: Split, color: '#a855f7' },
  broker: { icon: Network, color: '#db2777' },
  exchange: { icon: Shuffle, color: '#e11d48' },
  queue: { icon: ListOrdered, color: '#ea580c' },
  topic: { icon: Box, color: '#f97316' },
  database: { icon: Database, color: '#16a34a' },
  table: { icon: Box, color: '#15803d' },
  cache: { icon: Box, color: '#dc2626' },
  storage: { icon: Box, color: '#a16207' },
  external: { icon: ExternalLink, color: '#64748b' },
  user: { icon: User, color: '#0f766e' },
  other: { icon: Box, color: '#6b7280' },
};
