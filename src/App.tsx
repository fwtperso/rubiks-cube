import { useEffect, useRef, Component } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { RubiksCube } from './components/RubiksCube';
import { Sidebar } from './components/Controls';
import { useCubeStore } from './store/useCubeStore';
import type { MoveKey } from './logic/cubeState';
import './App.css';

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('[CanvasErrorBoundary]', error); }
  render() {
    if (this.state.failed) return null; // fail silently; sidebar still works
    return this.props.children;
  }
}

const KEY_MAP: Record<string, MoveKey> = {
  u: 'U',  U: "U'",
  d: 'D',  D: "D'",
  r: 'R',  R: "R'",
  l: 'L',  L: "L'",
  f: 'F',  F: "F'",
  b: 'B',  B: "B'",
};

export default function App() {
  const { timerRunning, tickTimer, scramble, applyMove } = useCubeStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orbitRef = useRef<OrbitControlsImpl>(null);

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(tickTimer, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, tickTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase();
      const move = KEY_MAP[key];
      if (move) {
        e.preventDefault();
        applyMove(move);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyMove]);

  return (
    <div className="app">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="header">
        <a className="header-brand" href="https://fwt-gamelab.com" aria-label="FWT Game Lab">
          <span className="header-dot" aria-hidden="true" />
          <span className="header-fwt">FWT</span>
        </a>
        <span className="header-badge">Experiment</span>
        <div className="header-sep" aria-hidden="true" />
        <h1 className="header-title">Rubik's Lab</h1>
        <div className="header-right">
          <p className="header-hint">Scramble, solve and master the classic 3×3 Rubik's cube</p>
          <button className="header-menu-btn" aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <div className="main">

        {/* Sidebar */}
        <Sidebar />

        {/* Canvas area */}
        <div className="canvas-area">
          <button className="scramble-fab" onClick={scramble} aria-label="Scramble cube">
            ✦ Scramble
          </button>
          <CanvasErrorBoundary>
            <Canvas camera={{ position: [4, 3, 4], fov: 45 }}>
              <ambientLight intensity={0.8} />
              <directionalLight position={[6, 8, 6]} intensity={1.0} />
              <Environment preset="city" />
              <RubiksCube orbitRef={orbitRef} />
              <OrbitControls ref={orbitRef} enablePan={false} minDistance={5} maxDistance={10} />
            </Canvas>
          </CanvasErrorBoundary>
        </div>

      </div>
    </div>
  );
}
