import { create } from 'zustand';

export type ViewType = 'now' | 'history' | 'settings';
export type ModalType =
  | 'startWork'
  | 'thought'
  | 'step'
  | 'rename'
  | 'delete'
  | 'abandon'
  | 'resumeContinuation'
  | null;

interface UiState {
  currentView: ViewType;
  selectedNodeId: string | null;
  selectedHistoryTreeId: string | null;
  activeModal: ModalType;
  modalTargetNodeId: string | null;
  modalTargetTreeId: string | null;
  isAccessibleListView: boolean;
  historyViewMode: 'graph' | 'timeline';
  toastMessage: string | null;

  setCurrentView: (view: ViewType) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedHistoryTreeId: (id: string | null) => void;
  openModal: (type: ModalType, targetNodeId?: string | null, targetTreeId?: string | null) => void;
  closeModal: () => void;
  toggleAccessibleListView: () => void;
  setHistoryViewMode: (mode: 'graph' | 'timeline') => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentView: 'now',
  selectedNodeId: null,
  selectedHistoryTreeId: null,
  activeModal: null,
  modalTargetNodeId: null,
  modalTargetTreeId: null,
  isAccessibleListView: false,
  historyViewMode: 'graph',
  toastMessage: null,

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedHistoryTreeId: (id) => set({ selectedHistoryTreeId: id }),
  openModal: (type, targetNodeId = null, targetTreeId = null) =>
    set({
      activeModal: type,
      modalTargetNodeId: targetNodeId,
      modalTargetTreeId: targetTreeId
    }),
  closeModal: () =>
    set({
      activeModal: null,
      modalTargetNodeId: null,
      modalTargetTreeId: null
    }),
  toggleAccessibleListView: () =>
    set((state) => ({ isAccessibleListView: !state.isAccessibleListView })),
  setHistoryViewMode: (mode) => set({ historyViewMode: mode }),
  showToast: (message) => set({ toastMessage: message }),
  clearToast: () => set({ toastMessage: null })
}));
