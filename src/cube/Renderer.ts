import type { CubeState, Move } from './types';

export interface IRenderer {
  /** Mount the Three.js canvas into `container` and set up the scene. */
  init(container: HTMLElement): void;

  /** Synchronously update all cubie meshes to reflect `state`. */
  render(state: CubeState): void;

  /**
   * Play the rotation animation for `move`.
   * Calls `onComplete` when the animation finishes so the caller can
   * update logical state and re-render.
   */
  animateMove(move: Move, onComplete: () => void): void;

  /** Tear down the renderer, cancel animation loops, and free GPU resources. */
  dispose(): void;
}
