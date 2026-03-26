import type { Move } from '../cube/types';

export interface IGestureHandler {
  /** Begin listening for pointer/touch events on the given canvas element. */
  attach(canvas: HTMLCanvasElement): void;

  /** Remove all event listeners previously added by `attach`. */
  detach(): void;

  /**
   * Register a callback that fires when the user swipes across a face.
   * The implementation is responsible for converting screen-space swipe
   * direction + hit-face into the appropriate `Move`.
   */
  onFaceSwipe(callback: (move: Move) => void): void;

  /**
   * Register a callback that fires when the user drags outside of a face
   * (i.e., orbiting the camera).
   * `deltaX` and `deltaY` are in screen pixels.
   */
  onOrbit(callback: (deltaX: number, deltaY: number) => void): void;
}
