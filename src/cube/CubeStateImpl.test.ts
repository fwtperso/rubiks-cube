import { describe, it, expect, beforeEach } from 'vitest';
import { CubeStateImpl } from './CubeStateImpl';
import { Face, Color } from './types';

describe('CubeStateImpl', () => {
  let cube: CubeStateImpl;

  beforeEach(() => {
    cube = new CubeStateImpl();
  });

  describe('initial state', () => {
    it('is solved on creation', () => {
      expect(cube.isSolved()).toBe(true);
    });

    it('has 27 cubies', () => {
      expect(cube.getState().cubies).toHaveLength(27);
    });

    it('UP face is all WHITE', () => {
      const { cubies } = cube.getState();
      const upCubies = cubies.filter(c => c.position.y === 1);
      expect(upCubies).toHaveLength(9);
      for (const c of upCubies) {
        expect(c.colors[Face.UP]).toBe(Color.WHITE);
      }
    });

    it('DOWN face is all YELLOW', () => {
      const { cubies } = cube.getState();
      for (const c of cubies.filter(cu => cu.position.y === -1)) {
        expect(c.colors[Face.DOWN]).toBe(Color.YELLOW);
      }
    });

    it('RIGHT face is all RED', () => {
      const { cubies } = cube.getState();
      for (const c of cubies.filter(cu => cu.position.x === 1)) {
        expect(c.colors[Face.RIGHT]).toBe(Color.RED);
      }
    });

    it('LEFT face is all ORANGE', () => {
      const { cubies } = cube.getState();
      for (const c of cubies.filter(cu => cu.position.x === -1)) {
        expect(c.colors[Face.LEFT]).toBe(Color.ORANGE);
      }
    });

    it('FRONT face is all BLUE', () => {
      const { cubies } = cube.getState();
      for (const c of cubies.filter(cu => cu.position.z === 1)) {
        expect(c.colors[Face.FRONT]).toBe(Color.BLUE);
      }
    });

    it('BACK face is all GREEN', () => {
      const { cubies } = cube.getState();
      for (const c of cubies.filter(cu => cu.position.z === -1)) {
        expect(c.colors[Face.BACK]).toBe(Color.GREEN);
      }
    });
  });

  describe('single move then inverse = identity', () => {
    const faces = Object.values(Face);
    for (const face of faces) {
      it(`${face} CW + CCW = solved`, () => {
        cube.applyMove({ face, direction: 1 });
        cube.applyMove({ face, direction: -1 });
        expect(cube.isSolved()).toBe(true);
      });

      it(`${face} CCW + CW = solved`, () => {
        cube.applyMove({ face, direction: -1 });
        cube.applyMove({ face, direction: 1 });
        expect(cube.isSolved()).toBe(true);
      });

      it(`${face} CW × 4 = solved`, () => {
        for (let i = 0; i < 4; i++) cube.applyMove({ face, direction: 1 });
        expect(cube.isSolved()).toBe(true);
      });
    }
  });

  describe('U move color propagation', () => {
    it('U CW: top row of FRONT face becomes top row of RIGHT face', () => {
      // After U CW, FRONT stickers on top layer should appear on RIGHT face
      cube.applyMove({ face: Face.UP, direction: 1 });
      const { cubies } = cube.getState();
      // Cubie at x=1,y=1,z=0 should now show: RIGHT = BLUE (was FRONT at that cubie's original slot)
      // Original (0,1,1) was top-center-front with FRONT=BLUE → moved to (1,1,0) after U CW
      const moved = cubies.find(c => c.position.x === 1 && c.position.y === 1 && c.position.z === 0);
      expect(moved).toBeDefined();
      expect(moved!.colors[Face.RIGHT]).toBe(Color.BLUE);
    });

    it('U CW: top row of RIGHT face becomes top row of BACK face', () => {
      cube.applyMove({ face: Face.UP, direction: 1 });
      const { cubies } = cube.getState();
      // Original (1,1,0) top-right-middle with RIGHT=RED → moved to (0,1,-1)
      const moved = cubies.find(c => c.position.x === 0 && c.position.y === 1 && c.position.z === -1);
      expect(moved).toBeDefined();
      expect(moved!.colors[Face.BACK]).toBe(Color.RED);
    });
  });

  describe('R move color propagation', () => {
    it('R CW: UP stickers move to FRONT face', () => {
      cube.applyMove({ face: Face.RIGHT, direction: 1 });
      const { cubies } = cube.getState();
      // Original (1,1,0) top-right-middle with UP=WHITE → after R CW: (x,-z,y)=(1,0,1)
      const moved = cubies.find(c => c.position.x === 1 && c.position.y === 0 && c.position.z === 1);
      expect(moved).toBeDefined();
      expect(moved!.colors[Face.FRONT]).toBe(Color.WHITE);
    });
  });

  describe('inverseMove', () => {
    it('returns move with flipped direction', () => {
      expect(cube.inverseMove({ face: Face.UP, direction: 1 })).toEqual({ face: Face.UP, direction: -1 });
      expect(cube.inverseMove({ face: Face.RIGHT, direction: -1 })).toEqual({ face: Face.RIGHT, direction: 1 });
    });
  });

  describe('applyMoves', () => {
    it('applies a sequence of moves', () => {
      const moves = [
        { face: Face.UP, direction: 1 as const },
        { face: Face.RIGHT, direction: 1 as const },
      ];
      cube.applyMoves(moves);
      expect(cube.isSolved()).toBe(false);
    });

    it('applying a sequence and its inverse restores solved state', () => {
      const moves = [
        { face: Face.UP, direction: 1 as const },
        { face: Face.RIGHT, direction: 1 as const },
        { face: Face.FRONT, direction: -1 as const },
      ];
      cube.applyMoves(moves);
      const inverse = [...moves].reverse().map(m => cube.inverseMove(m));
      cube.applyMoves(inverse);
      expect(cube.isSolved()).toBe(true);
    });
  });

  describe('scramble', () => {
    it('returns the requested number of moves', () => {
      const moves = cube.scramble(20);
      expect(moves).toHaveLength(20);
    });

    it('leaves cube in non-solved state (with high probability)', () => {
      cube.scramble(20);
      // Statistically impossible to be solved after 20 random moves
      expect(cube.isSolved()).toBe(false);
    });
  });

  describe('reset', () => {
    it('restores solved state after scramble', () => {
      cube.scramble(20);
      expect(cube.isSolved()).toBe(false);
      cube.reset();
      expect(cube.isSolved()).toBe(true);
    });
  });

  describe('getState returns a deep copy', () => {
    it('mutating returned state does not affect cube', () => {
      const state = cube.getState();
      state.cubies[0].colors[Face.UP] = Color.RED;
      expect(cube.getState().cubies[0].colors[Face.UP]).toBe(Color.WHITE);
    });
  });
});
