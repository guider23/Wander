export type TreeStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED' | 'INTERRUPTED';
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED' | 'INTERRUPTED';
export type NodeStatus = 'ONGOING' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
export type NodeKind = 'ROOT_WORK' | 'THOUGHT' | 'WORK_STEP' | 'DEPENDENCY' | 'RETURN_ANCHOR';
export type TreeRelationship = 'NEW_WORK' | 'CONTINUATION';

export interface Tree {
  id: string;
  rootNodeId: string;
  originTreeId: string | null;
  originNodeId: string | null;
  originSessionId: string | null;
  relationshipType: TreeRelationship;
  status: TreeStatus;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  deletedAt: string | null;
  schemaVersion: number;
}

export interface Session {
  id: string;
  treeId: string;
  focusNodeId: string;
  previousSessionId: string | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface Node {
  id: string;
  treeId: string;
  parentNodeId: string | null;
  title: string;
  kind: NodeKind;
  status: NodeStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
  deletedAt: string | null;
  metadataJson: string | null;
  schemaVersion: number;
}

export interface AppSettings {
  timeFormat: '12h' | '24h';
  reducedMotion: boolean;
  highContrast: boolean;
}
