import { CubeStateImpl } from './cube/CubeStateImpl';
import { ThreeRenderer } from './cube/ThreeRenderer';
import { Face } from './cube/types';

const cube = new CubeStateImpl();
const renderer = new ThreeRenderer();

renderer.init(document.body);
renderer.render(cube.getState());

// Scramble button
const btn = document.createElement('button');
btn.textContent = 'Scramble';
Object.assign(btn.style, {
  position: 'fixed',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '12px 28px',
  fontSize: '16px',
  fontFamily: 'system-ui, sans-serif',
  background: '#0046ad',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  zIndex: '10',
});
document.body.appendChild(btn);

btn.addEventListener('click', () => {
  if (btn.disabled) return;
  btn.disabled = true;
  cube.reset();
  const moves = cube.scramble(20);
  // Play scramble moves as rapid animation sequence
  let idx = 0;
  const playNext = () => {
    if (idx >= moves.length) {
      renderer.render(cube.getState());
      btn.disabled = false;
      return;
    }
    const move = moves[idx++];
    renderer.animateMove(move, playNext);
  };
  // Re-render immediately at scrambled state, then animate
  renderer.render(cube.getState());
  playNext();
});

// Demo: keyboard shortcuts for manual moves (useful for testing)
const KEY_MOVES: Record<string, { face: Face; direction: 1 | -1 }> = {
  u: { face: Face.UP,    direction:  1 },
  U: { face: Face.UP,    direction: -1 },
  d: { face: Face.DOWN,  direction:  1 },
  D: { face: Face.DOWN,  direction: -1 },
  r: { face: Face.RIGHT, direction:  1 },
  R: { face: Face.RIGHT, direction: -1 },
  l: { face: Face.LEFT,  direction:  1 },
  L: { face: Face.LEFT,  direction: -1 },
  f: { face: Face.FRONT, direction:  1 },
  F: { face: Face.FRONT, direction: -1 },
  b: { face: Face.BACK,  direction:  1 },
  B: { face: Face.BACK,  direction: -1 },
};

window.addEventListener('keydown', e => {
  const move = KEY_MOVES[e.key];
  if (!move) return;
  cube.applyMove(move);
  renderer.animateMove(move, () => renderer.render(cube.getState()));
});
