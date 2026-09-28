import { NodeKind, TreeRelationship } from '../entities/types';

export type EventType =
  | 'WORK_STARTED'
  | 'THOUGHT_CAPTURED'
  | 'BRANCH_CREATED'
  | 'WORK_STEP_ADDED'
  | 'FOCUS_SWITCHED'
  | 'TREE_SWITCHED'
  | 'SESSION_PAUSED'
  | 'SESSION_RESUMED'
  | 'RETURNED_TO_NODE'
  | 'TREE_CONTINUATION_STARTED'
  | 'PATH_COMPLETED'
  | 'PATH_ABANDONED'
  | 'SESSION_INTERRUPTED'
  | 'NODE_RENAMED'
  | 'SESSION_RENAMED'
  | 'TREE_RENAMED'
  | 'NODE_DELETED'
  | 'TREE_DELETED';

export interface BaseDomainEvent<TType extends EventType = EventType, TPayload = Record<string, unknown>> {
  id: string;
  type: TType;
  treeId: string | null;
  sessionId: string | null;
  nodeId: string | null;
  occurredAt: string;
  createdAt: string;
  sequence: number;
  payload: TPayload;
  schemaVersion: number;
}

export interface WorkStartedPayload {
  title: string;
  kind?: NodeKind;
}

export interface ThoughtCapturedPayload {
  title: string;
  parentNodeId: string;
}

export interface BranchCreatedPayload {
  title: string;
  parentNodeId: string;
  kind?: NodeKind;
}

export interface WorkStepAddedPayload {
  title: string;
  parentNodeId: string;
  kind?: NodeKind;
}

export interface FocusSwitchedPayload {
  previousSessionId: string | null;
  targetNodeId: string;
  reason?: string;
}

export interface TreeSwitchedPayload {
  previousTreeId: string | null;
  targetTreeId: string;
}

export interface SessionPausedPayload {
  reason?: string;
}

export interface SessionResumedPayload {
  focusNodeId: string;
}

export interface ReturnedToNodePayload {
  targetNodeId: string;
  targetTreeId: string;
}

export interface TreeContinuationStartedPayload {
  originTreeId: string;
  originNodeId: string;
  originSessionId: string | null;
  rootTitle: string;
  relationshipType: TreeRelationship;
}

export interface PathCompletedPayload {
  nodeId: string;
  note?: string;
}

export interface PathAbandonedPayload {
  nodeId: string;
  reason?: string;
}

export interface SessionInterruptedPayload {
  reason: string;
}

export interface NodeRenamedPayload {
  oldTitle: string;
  newTitle: string;
}

export interface NodeDeletedPayload {
  reason?: string;
  deletedCount?: number;
}

export interface TreeDeletedPayload {
  reason?: string;
}

export type DomainEvent =
  | BaseDomainEvent<'WORK_STARTED', WorkStartedPayload>
  | BaseDomainEvent<'THOUGHT_CAPTURED', ThoughtCapturedPayload>
  | BaseDomainEvent<'BRANCH_CREATED', BranchCreatedPayload>
  | BaseDomainEvent<'WORK_STEP_ADDED', WorkStepAddedPayload>
  | BaseDomainEvent<'FOCUS_SWITCHED', FocusSwitchedPayload>
  | BaseDomainEvent<'TREE_SWITCHED', TreeSwitchedPayload>
  | BaseDomainEvent<'SESSION_PAUSED', SessionPausedPayload>
  | BaseDomainEvent<'SESSION_RESUMED', SessionResumedPayload>
  | BaseDomainEvent<'RETURNED_TO_NODE', ReturnedToNodePayload>
  | BaseDomainEvent<'TREE_CONTINUATION_STARTED', TreeContinuationStartedPayload>
  | BaseDomainEvent<'PATH_COMPLETED', PathCompletedPayload>
  | BaseDomainEvent<'PATH_ABANDONED', PathAbandonedPayload>
  | BaseDomainEvent<'SESSION_INTERRUPTED', SessionInterruptedPayload>
  | BaseDomainEvent<'NODE_RENAMED', NodeRenamedPayload>
  | BaseDomainEvent<'SESSION_RENAMED', { oldTitle: string; newTitle: string }>
  | BaseDomainEvent<'TREE_RENAMED', { oldTitle: string; newTitle: string }>
  | BaseDomainEvent<'NODE_DELETED', NodeDeletedPayload>
  | BaseDomainEvent<'TREE_DELETED', TreeDeletedPayload>;
