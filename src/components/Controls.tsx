import { useCubeStore } from '../store/useCubeStore';
import type { Difficulty } from '../store/useCubeStore';

const DIFFICULTIES: { key: Difficulty; emoji: string; label: string; moves: number }[] = [
  { key: 'easy',   emoji: '😊', label: 'Easy',   moves: 5  },
  { key: 'medium', emoji: '🤔', label: 'Medium', moves: 20 },
  { key: 'hard',   emoji: '🔥', label: 'Hard',   moves: 35 },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function Sidebar() {
  const {
    difficulty, setDifficulty,
    moveCount, timerSeconds, timerRunning, solved,
    reset,
  } = useCubeStore();

  const showTimer = timerRunning || timerSeconds > 0;

  return (
    <aside className="sidebar">

      {/* 1 — SCRAMBLE DIFFICULTY */}
      <section className="sidebar-section">
        <p className="section-label">1 — Scramble Difficulty</p>
        <div className="diff-grid">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              className={`diff-card${difficulty === d.key ? ' active' : ''}`}
              onClick={() => setDifficulty(d.key)}
              aria-pressed={difficulty === d.key}
            >
              <span className="diff-emoji">{d.emoji}</span>
              <span className="diff-label">{d.label}</span>
              <span className="diff-moves">{d.moves} moves</span>
            </button>
          ))}
        </div>
      </section>

      {/* 2 — STATS */}
      <section className="sidebar-section">
        <p className="section-label">2 — Stats</p>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{moveCount}</span>
            <span className="stat-label">Moves</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{showTimer ? formatTime(timerSeconds) : '—'}</span>
            <span className="stat-label">Timer</span>
          </div>
        </div>
      </section>

      {/* 3 — CONTROLS */}
      <section className="sidebar-section">
        <p className="section-label">3 — Controls</p>
        <ul className="controls-hints">
          <li>
            <span className="hint-icon">👆</span>
            <span>Swipe a face to rotate that layer</span>
          </li>
          <li>
            <span className="hint-icon">✌️</span>
            <span>2 fingers to orbit &amp; zoom</span>
          </li>
          <li>
            <span className="hint-icon hint-mouse" aria-hidden="true" />
            <span>Left-drag on face · right-drag to orbit</span>
          </li>
          <li className="hint-keyboard-row">
            <div className="key-row">
              {['U','D','R','L','F','B'].map((k) => (
                <kbd key={k} className="key-badge">{k}</kbd>
              ))}
              <span className="hint-sub">· shift = CCW</span>
            </div>
          </li>
        </ul>
      </section>

      {/* Solved banner — only after user actually solves it */}
      {solved && moveCount > 0 && (
        <div className="solved-banner">
          Solved! 🎉 in {moveCount} move{moveCount === 1 ? '' : 's'}
        </div>
      )}

      {/* Reset */}
      <div className="sidebar-footer">
        <button className="reset-btn" onClick={reset}>
          ↺ Reset cube
        </button>
      </div>

    </aside>
  );
}
