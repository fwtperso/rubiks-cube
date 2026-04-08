import { create } from 'zustand';
import type { CubeState, MoveKey } from '../logic/cubeState';
import { MOVES, isSolved, scrambleCube, solvedCube } from '../logic/cubeState';

export type Difficulty = 'easy' | 'medium' | 'hard';

const DIFF_MOVES: Record<Difficulty, number> = {
  easy:   5,
  medium: 20,
  hard:   35,
};

interface CubeStore {
  cube: CubeState;
  history: MoveKey[];
  moveCount: number;
  solved: boolean;
  scrambling: boolean;
  difficulty: Difficulty;
  timerSeconds: number;
  timerRunning: boolean;
  pendingMove: MoveKey | null;
  applyMove: (move: MoveKey) => void;
  commitMove: () => void;
  scramble: () => void;
  reset: () => void;
  setDifficulty: (d: Difficulty) => void;
  tickTimer: () => void;
}

export const useCubeStore = create<CubeStore>((set, get) => ({
  cube: solvedCube(),
  history: [],
  moveCount: 0,
  solved: true,
  scrambling: false,
  difficulty: 'medium',
  timerSeconds: 0,
  timerRunning: false,
  pendingMove: null,

  applyMove: (move) => {
    if (get().pendingMove) return; // drop while animating
    set({ pendingMove: move });
  },

  commitMove: () => {
    const state = get();
    const { pendingMove, cube } = state;
    if (!pendingMove) return;
    const next = MOVES[pendingMove](cube);
    const nowSolved = isSolved(next);
    const newMoveCount = state.moveCount + 1;
    const startTimer = !state.timerRunning && newMoveCount === 1 && !state.solved;
    set({
      cube: next,
      history: [...state.history, pendingMove],
      moveCount: newMoveCount,
      solved: nowSolved,
      timerRunning: nowSolved ? false : (state.timerRunning || startTimer),
      pendingMove: null,
    });
  },

  scramble: () => {
    const { difficulty } = get();
    const { cube, moves } = scrambleCube(solvedCube(), DIFF_MOVES[difficulty]);
    set({
      cube,
      history: moves,
      moveCount: 0,
      solved: false,
      scrambling: false,
      timerSeconds: 0,
      timerRunning: false,
      pendingMove: null,
    });
  },

  reset: () =>
    set({
      cube: solvedCube(),
      history: [],
      moveCount: 0,
      solved: true,
      scrambling: false,
      timerSeconds: 0,
      timerRunning: false,
      pendingMove: null,
    }),

  setDifficulty: (d) => set({ difficulty: d }),

  tickTimer: () => set((state) => ({ timerSeconds: state.timerSeconds + 1 })),
}));
