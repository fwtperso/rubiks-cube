import type { CubeState, Move } from './types';

export interface ICubeLogic {
  /** Return a snapshot of the current cube state. */
  getState(): CubeState;

  /** Apply a single move and return the resulting state. */
  applyMove(move: Move): CubeState;

  /** Apply a sequence of moves in order and return the resulting state. */
  applyMoves(moves: Move[]): CubeState;

  /** Return true when every face has nine stickers of the same color. */
  isSolved(): boolean;

  /** Return the move that undoes the given move (same face, opposite direction). */
  inverseMove(move: Move): Move;

  /**
   * Apply `numMoves` random moves, return the list of moves applied.
   * Useful for generating a reproducible scramble sequence.
   */
  scramble(numMoves: number): Move[];

  /** Restore the cube to the solved state. */
  reset(): void;
}
