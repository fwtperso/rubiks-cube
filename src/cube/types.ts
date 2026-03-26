export enum Face {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  FRONT = 'FRONT',
  BACK = 'BACK',
}

export enum Color {
  WHITE = 'WHITE',
  YELLOW = 'YELLOW',
  RED = 'RED',
  ORANGE = 'ORANGE',
  BLUE = 'BLUE',
  GREEN = 'GREEN',
}

export type Axis = 'x' | 'y' | 'z';

/** 1 = clockwise (when looking at face straight-on), -1 = counter-clockwise */
export type Direction = 1 | -1;

export type Move = {
  face: Face;
  direction: Direction;
};

export type CubiePosition = {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  z: -1 | 0 | 1;
};

/** The 6 sticker colors on a single cubie (null-like faces use a sentinel color) */
export type FaceColors = Record<Face, Color>;

export type Cubie = {
  position: CubiePosition;
  colors: FaceColors;
};

/** Full cube state: exactly 27 cubies (3×3×3 grid) */
export type CubeState = {
  cubies: Cubie[];
};
