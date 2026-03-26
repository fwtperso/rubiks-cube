import type { CubeState, Move, Cubie, CubiePosition, FaceColors } from './types';
import { Face, Color } from './types';
import type { ICubeLogic } from './CubeLogic';

type Coord = -1 | 0 | 1;

const c = (n: number): Coord => n as Coord;

interface FaceRotation {
  filter: (p: CubiePosition) => boolean;
  cwPos: (p: CubiePosition) => CubiePosition;
  cwColors: [Face, Face][];
}

// cwPos: position transform for one CW rotation looking from outside that face
// cwColors: [from, to] pairs — new[to] = old[from]
const ROTATIONS: Record<Face, FaceRotation> = {
  [Face.UP]: {
    filter: p => p.y === 1,
    cwPos:  p => ({ x: c(p.z),  y: p.y,  z: c(-p.x) }),
    cwColors: [[Face.FRONT, Face.RIGHT], [Face.RIGHT, Face.BACK], [Face.BACK, Face.LEFT], [Face.LEFT, Face.FRONT]],
  },
  [Face.DOWN]: {
    filter: p => p.y === -1,
    cwPos:  p => ({ x: c(-p.z), y: p.y,  z: c(p.x) }),
    cwColors: [[Face.FRONT, Face.LEFT], [Face.LEFT, Face.BACK], [Face.BACK, Face.RIGHT], [Face.RIGHT, Face.FRONT]],
  },
  [Face.RIGHT]: {
    filter: p => p.x === 1,
    cwPos:  p => ({ x: p.x,  y: c(-p.z), z: c(p.y) }),
    cwColors: [[Face.UP, Face.FRONT], [Face.FRONT, Face.DOWN], [Face.DOWN, Face.BACK], [Face.BACK, Face.UP]],
  },
  [Face.LEFT]: {
    filter: p => p.x === -1,
    cwPos:  p => ({ x: p.x,  y: c(p.z),  z: c(-p.y) }),
    cwColors: [[Face.UP, Face.BACK], [Face.BACK, Face.DOWN], [Face.DOWN, Face.FRONT], [Face.FRONT, Face.UP]],
  },
  [Face.FRONT]: {
    filter: p => p.z === 1,
    cwPos:  p => ({ x: c(p.y),  y: c(-p.x), z: p.z }),
    cwColors: [[Face.UP, Face.RIGHT], [Face.RIGHT, Face.DOWN], [Face.DOWN, Face.LEFT], [Face.LEFT, Face.UP]],
  },
  [Face.BACK]: {
    filter: p => p.z === -1,
    cwPos:  p => ({ x: c(-p.y), y: c(p.x),  z: p.z }),
    cwColors: [[Face.UP, Face.LEFT], [Face.LEFT, Face.DOWN], [Face.DOWN, Face.RIGHT], [Face.RIGHT, Face.UP]],
  },
};

function rotateCubie(cubie: Cubie, rot: FaceRotation, times: 1 | 3): Cubie {
  let pos = cubie.position;
  let colors = { ...cubie.colors };

  for (let i = 0; i < times; i++) {
    pos = rot.cwPos(pos);
    const next = { ...colors };
    for (const [from, to] of rot.cwColors) {
      next[to] = colors[from];
    }
    colors = next;
  }

  return { position: pos, colors };
}

// Non-visible internal face stickers use WHITE as a placeholder — only outward faces matter.
function createSolvedCubies(): Cubie[] {
  const cubies: Cubie[] = [];
  for (let xi = -1; xi <= 1; xi++) {
    for (let yi = -1; yi <= 1; yi++) {
      for (let zi = -1; zi <= 1; zi++) {
        const x = xi as Coord, y = yi as Coord, z = zi as Coord;
        const colors: FaceColors = {
          [Face.UP]:    y === 1  ? Color.WHITE  : Color.WHITE,
          [Face.DOWN]:  y === -1 ? Color.YELLOW : Color.WHITE,
          [Face.RIGHT]: x === 1  ? Color.RED    : Color.WHITE,
          [Face.LEFT]:  x === -1 ? Color.ORANGE : Color.WHITE,
          [Face.FRONT]: z === 1  ? Color.BLUE   : Color.WHITE,
          [Face.BACK]:  z === -1 ? Color.GREEN  : Color.WHITE,
        };
        cubies.push({ position: { x, y, z }, colors });
      }
    }
  }
  return cubies;
}

export class CubeStateImpl implements ICubeLogic {
  private cubies: Cubie[];

  constructor() {
    this.cubies = createSolvedCubies();
  }

  getState(): CubeState {
    return {
      cubies: this.cubies.map(cubie => ({
        position: { ...cubie.position },
        colors: { ...cubie.colors },
      })),
    };
  }

  applyMove(move: Move): CubeState {
    const rot = ROTATIONS[move.face];
    const times: 1 | 3 = move.direction === 1 ? 1 : 3;
    this.cubies = this.cubies.map(cubie =>
      rot.filter(cubie.position) ? rotateCubie(cubie, rot, times) : cubie
    );
    return this.getState();
  }

  applyMoves(moves: Move[]): CubeState {
    for (const move of moves) {
      this.applyMove(move);
    }
    return this.getState();
  }

  isSolved(): boolean {
    const checks: [Face, (p: CubiePosition) => boolean, Color][] = [
      [Face.UP,    p => p.y === 1,  Color.WHITE],
      [Face.DOWN,  p => p.y === -1, Color.YELLOW],
      [Face.RIGHT, p => p.x === 1,  Color.RED],
      [Face.LEFT,  p => p.x === -1, Color.ORANGE],
      [Face.FRONT, p => p.z === 1,  Color.BLUE],
      [Face.BACK,  p => p.z === -1, Color.GREEN],
    ];
    for (const [face, filter, expected] of checks) {
      for (const cubie of this.cubies) {
        if (filter(cubie.position) && cubie.colors[face] !== expected) {
          return false;
        }
      }
    }
    return true;
  }

  inverseMove(move: Move): Move {
    return { face: move.face, direction: move.direction === 1 ? -1 : 1 };
  }

  scramble(numMoves: number): Move[] {
    const faces = Object.values(Face);
    const moves: Move[] = [];
    for (let i = 0; i < numMoves; i++) {
      const face = faces[Math.floor(Math.random() * faces.length)];
      const direction = (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
      const move: Move = { face, direction };
      moves.push(move);
      this.applyMove(move);
    }
    return moves;
  }

  reset(): void {
    this.cubies = createSolvedCubies();
  }
}
