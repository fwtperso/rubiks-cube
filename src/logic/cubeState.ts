// Rubik's Cube state model
// Each face is a 3x3 array of color indices.
// Face order: 0=U(top), 1=D(bottom), 2=F(front), 3=B(back), 4=L(left), 5=R(right)
// Colors:     0=white,  1=yellow,    2=green,     3=blue,    4=orange,  5=red

export type FaceColor = 0 | 1 | 2 | 3 | 4 | 5;
export type Face = FaceColor[][];
export type CubeState = Face[];

export const COLOR_MAP: Record<FaceColor, string> = {
  0: '#ffffff', // white  – U
  1: '#ffd500', // yellow – D
  2: '#009b48', // green  – F
  3: '#0046ad', // blue   – B
  4: '#ff5800', // orange – L
  5: '#b71234', // red    – R
};

function makeFace(color: FaceColor): Face {
  return Array.from({ length: 3 }, () => Array(3).fill(color) as FaceColor[]);
}

export function solvedCube(): CubeState {
  return [0, 1, 2, 3, 4, 5].map((c) => makeFace(c as FaceColor));
}

// Deep-clone cube state
export function cloneCube(cube: CubeState): CubeState {
  return cube.map((face) => face.map((row) => [...row] as FaceColor[]));
}

// Rotate a face's stickers 90° clockwise
function rotateFaceCW(face: Face): Face {
  return [
    [face[2][0], face[1][0], face[0][0]],
    [face[2][1], face[1][1], face[0][1]],
    [face[2][2], face[1][2], face[0][2]],
  ] as Face;
}

// ---------------------------------------------------------------------------
// Face indices
const U = 0, D = 1, F = 2, B = 3, L = 4, R = 5;

// Move implementations (each mutates a cloned cube)
// ---------------------------------------------------------------------------

function moveU(cube: CubeState): CubeState {
  const c = cloneCube(cube);
  c[U] = rotateFaceCW(c[U]);
  const tmp = [c[F][0], c[R][0], c[B][0], c[L][0]];
  c[F][0] = tmp[3]; // L → F
  c[R][0] = tmp[0]; // F → R
  c[B][0] = tmp[1]; // R → B
  c[L][0] = tmp[2]; // B → L
  return c;
}

function moveUPrime(cube: CubeState): CubeState {
  return moveU(moveU(moveU(cube)));
}

function moveD(cube: CubeState): CubeState {
  const c = cloneCube(cube);
  c[D] = rotateFaceCW(c[D]);
  const tmp = [c[F][2], c[L][2], c[B][2], c[R][2]];
  c[F][2] = tmp[3]; // R → F
  c[L][2] = tmp[0]; // F → L
  c[B][2] = tmp[1]; // L → B
  c[R][2] = tmp[2]; // B → R
  return c;
}

function moveDPrime(cube: CubeState): CubeState {
  return moveD(moveD(moveD(cube)));
}

function moveF(cube: CubeState): CubeState {
  const c = cloneCube(cube);
  c[F] = rotateFaceCW(c[F]);
  const uBottom = [c[U][2][0], c[U][2][1], c[U][2][2]];
  const rLeft   = [c[R][0][0], c[R][1][0], c[R][2][0]];
  const dTop    = [c[D][0][0], c[D][0][1], c[D][0][2]];
  const lRight  = [c[L][0][2], c[L][1][2], c[L][2][2]];
  // U bottom → R left
  c[R][0][0] = uBottom[0]; c[R][1][0] = uBottom[1]; c[R][2][0] = uBottom[2];
  // R left → D top (reversed)
  c[D][0][0] = rLeft[2]; c[D][0][1] = rLeft[1]; c[D][0][2] = rLeft[0];
  // D top → L right
  c[L][0][2] = dTop[0]; c[L][1][2] = dTop[1]; c[L][2][2] = dTop[2];
  // L right → U bottom (reversed)
  c[U][2][0] = lRight[2]; c[U][2][1] = lRight[1]; c[U][2][2] = lRight[0];
  return c;
}

function moveFPrime(cube: CubeState): CubeState {
  return moveF(moveF(moveF(cube)));
}

function moveB(cube: CubeState): CubeState {
  const c = cloneCube(cube);
  c[B] = rotateFaceCW(c[B]);
  const uTop    = [c[U][0][0], c[U][0][1], c[U][0][2]];
  const lLeft   = [c[L][0][0], c[L][1][0], c[L][2][0]];
  const dBottom = [c[D][2][0], c[D][2][1], c[D][2][2]];
  const rRight  = [c[R][0][2], c[R][1][2], c[R][2][2]];
  // U top → L left (reversed)
  c[L][0][0] = uTop[2]; c[L][1][0] = uTop[1]; c[L][2][0] = uTop[0];
  // L left → D bottom
  c[D][2][0] = lLeft[0]; c[D][2][1] = lLeft[1]; c[D][2][2] = lLeft[2];
  // D bottom → R right (reversed)
  c[R][0][2] = dBottom[2]; c[R][1][2] = dBottom[1]; c[R][2][2] = dBottom[0];
  // R right → U top
  c[U][0][0] = rRight[0]; c[U][0][1] = rRight[1]; c[U][0][2] = rRight[2];
  return c;
}

function moveBPrime(cube: CubeState): CubeState {
  return moveB(moveB(moveB(cube)));
}

function moveL(cube: CubeState): CubeState {
  const c = cloneCube(cube);
  c[L] = rotateFaceCW(c[L]);
  const uCol = [c[U][0][0], c[U][1][0], c[U][2][0]];
  const fCol = [c[F][0][0], c[F][1][0], c[F][2][0]];
  const dCol = [c[D][0][0], c[D][1][0], c[D][2][0]];
  const bCol = [c[B][0][2], c[B][1][2], c[B][2][2]];
  // F left col → U left col
  c[U][0][0] = fCol[0]; c[U][1][0] = fCol[1]; c[U][2][0] = fCol[2];
  // D left col → F left col
  c[F][0][0] = dCol[0]; c[F][1][0] = dCol[1]; c[F][2][0] = dCol[2];
  // B right col (reversed) → D left col
  c[D][0][0] = bCol[2]; c[D][1][0] = bCol[1]; c[D][2][0] = bCol[0];
  // U left col (reversed) → B right col
  c[B][0][2] = uCol[2]; c[B][1][2] = uCol[1]; c[B][2][2] = uCol[0];
  return c;
}

function moveLPrime(cube: CubeState): CubeState {
  return moveL(moveL(moveL(cube)));
}

function moveR(cube: CubeState): CubeState {
  const c = cloneCube(cube);
  c[R] = rotateFaceCW(c[R]);
  const uCol = [c[U][0][2], c[U][1][2], c[U][2][2]];
  const fCol = [c[F][0][2], c[F][1][2], c[F][2][2]];
  const dCol = [c[D][0][2], c[D][1][2], c[D][2][2]];
  const bCol = [c[B][0][0], c[B][1][0], c[B][2][0]];
  // U right col → F right col
  c[F][0][2] = uCol[0]; c[F][1][2] = uCol[1]; c[F][2][2] = uCol[2];
  // F right col → D right col
  c[D][0][2] = fCol[0]; c[D][1][2] = fCol[1]; c[D][2][2] = fCol[2];
  // D right col (reversed) → B left col
  c[B][0][0] = dCol[2]; c[B][1][0] = dCol[1]; c[B][2][0] = dCol[0];
  // B left col (reversed) → U right col
  c[U][0][2] = bCol[2]; c[U][1][2] = bCol[1]; c[U][2][2] = bCol[0];
  return c;
}

function moveRPrime(cube: CubeState): CubeState {
  return moveR(moveR(moveR(cube)));
}

// ---------------------------------------------------------------------------
export type MoveKey = 'U' | "U'" | 'D' | "D'" | 'F' | "F'" | 'B' | "B'" | 'L' | "L'" | 'R' | "R'";

export const MOVES: Record<MoveKey, (c: CubeState) => CubeState> = {
  'U':  moveU,
  "U'": moveUPrime,
  'D':  moveD,
  "D'": moveDPrime,
  'F':  moveF,
  "F'": moveFPrime,
  'B':  moveB,
  "B'": moveBPrime,
  'L':  moveL,
  "L'": moveLPrime,
  'R':  moveR,
  "R'": moveRPrime,
};

export const ALL_MOVE_KEYS = Object.keys(MOVES) as MoveKey[];

export function scrambleCube(cube: CubeState, count = 20): { cube: CubeState; moves: MoveKey[] } {
  let c = cloneCube(cube);
  const moves: MoveKey[] = [];
  for (let i = 0; i < count; i++) {
    const move = ALL_MOVE_KEYS[Math.floor(Math.random() * ALL_MOVE_KEYS.length)];
    c = MOVES[move](c);
    moves.push(move);
  }
  return { cube: c, moves };
}

export function isSolved(cube: CubeState): boolean {
  return cube.every((face) => {
    const target = face[0][0];
    return face.every((row) => row.every((cell) => cell === target));
  });
}
