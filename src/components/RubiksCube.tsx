import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { FaceColor, CubeState, MoveKey } from '../logic/cubeState';
import { CubieFace } from './CubieFace';
import { useCubeStore } from '../store/useCubeStore';

// Each cubie sits at a grid position (cx, cy, cz) in [-1, 0, 1]^3
//
// Face index / axis mapping:
//   U(0) → y= 1  row-major: face[row][col], col=x, row=-z  (top-down view)
//   D(1) → y=-1  col=x, row= z
//   F(2) → z= 1  row=y (inverted), col=x
//   B(3) → z=-1  row=y (inverted), col=-x (mirrored)
//   L(4) → x=-1  row=y (inverted), col=-z (mirrored from outside)
//   R(5) → x= 1  row=y (inverted), col= z

const CUBIE_SIZE = 1;
const GAP        = 0.05;
const OFFSET     = CUBIE_SIZE + GAP;

// ─── Sticker lookup ──────────────────────────────────────────────────────────

function getStickerColor(
  cube: CubeState,
  face: number,
  cx: number, cy: number, cz: number,
): FaceColor | null {
  if (!cube || !cube[face]) return null;
  const gx = cx + 1;
  const gy = cy + 1;
  const gz = cz + 1;

  switch (face) {
    case 0: if (cy !== 1)  return null; return cube[0][gz][gx] as FaceColor;
    case 1: if (cy !== -1) return null; return cube[1][gz][gx] as FaceColor;
    case 2: if (cz !== 1)  return null; return cube[2][2 - gy][gx] as FaceColor;
    case 3: if (cz !== -1) return null; return cube[3][2 - gy][2 - gx] as FaceColor;
    case 4: if (cx !== -1) return null; return cube[4][2 - gy][gz] as FaceColor;
    case 5: if (cx !== 1)  return null; return cube[5][2 - gy][2 - gz] as FaceColor;
    default: return null;
  }
}

const FACE_NORMALS: [number, number, number][] = [
  [ 0,  1,  0],  // U
  [ 0, -1,  0],  // D
  [ 0,  0,  1],  // F
  [ 0,  0, -1],  // B
  [-1,  0,  0],  // L
  [ 1,  0,  0],  // R
];

// ─── Animation config per move ───────────────────────────────────────────────
//
// Rotation axis/angle verified against cubeState.ts cycle effects:
//   U  = +Y +90°  (front→right = CW from above)
//   D  = +Y -90°  (front→left  = CCW from above)
//   F  = +Z -90°  (CW from front)
//   B  = +Z +90°  (CW from back)
//   R  = +X +90°  (CW from right)
//   L  = +X -90°  (CW from left)

const MOVE_ANIM: Record<MoveKey, {
  axisKey: 'x' | 'y' | 'z';
  angle: number;
  layer: (cx: number, cy: number, cz: number) => boolean;
}> = {
  'U':  { axisKey: 'y', angle:  Math.PI / 2, layer: (_, cy) => cy === 1  },
  "U'": { axisKey: 'y', angle: -Math.PI / 2, layer: (_, cy) => cy === 1  },
  'D':  { axisKey: 'y', angle: -Math.PI / 2, layer: (_, cy) => cy === -1 },
  "D'": { axisKey: 'y', angle:  Math.PI / 2, layer: (_, cy) => cy === -1 },
  'F':  { axisKey: 'z', angle: -Math.PI / 2, layer: (_, __, cz) => cz === 1  },
  "F'": { axisKey: 'z', angle:  Math.PI / 2, layer: (_, __, cz) => cz === 1  },
  'B':  { axisKey: 'z', angle:  Math.PI / 2, layer: (_, __, cz) => cz === -1 },
  "B'": { axisKey: 'z', angle: -Math.PI / 2, layer: (_, __, cz) => cz === -1 },
  'R':  { axisKey: 'x', angle:  Math.PI / 2, layer: (cx) => cx === 1  },
  "R'": { axisKey: 'x', angle: -Math.PI / 2, layer: (cx) => cx === 1  },
  'L':  { axisKey: 'x', angle: -Math.PI / 2, layer: (cx) => cx === -1 },
  "L'": { axisKey: 'x', angle:  Math.PI / 2, layer: (cx) => cx === -1 },
};

// ─── Swipe → move lookup ─────────────────────────────────────────────────────
//
// Directions are in WORLD space (from 3D raycasting — camera-independent).
// swipeSign > 0 means movement along the positive world axis.
//
// Verified by tracing sticker cycles in cubeState.ts.

function lookupSwipeMove(
  faceNormal: [number, number, number],
  swipeAxis: 'x' | 'y' | 'z',
  swipeSign: number,
  { cx, cy, cz }: { cx: number; cy: number; cz: number }
): MoveKey | null {
  const [nx, ny, nz] = faceNormal;
  const pos = swipeSign > 0;

  if (nz > 0) { // Face F
    if (swipeAxis === 'x') {
      if (cy === 1)  return pos ? 'U'  : "U'";
      if (cy === -1) return pos ? "D'" : 'D';
    } else if (swipeAxis === 'y') {
      if (cx === 1)  return pos ? "R'" : 'R';
      if (cx === -1) return pos ? 'L'  : "L'";
    }
  }

  if (nz < 0) { // Face B (X mirrored from outside viewer)
    if (swipeAxis === 'x') {
      if (cy === 1)  return pos ? "U'" : 'U';
      if (cy === -1) return pos ? 'D'  : "D'";
    } else if (swipeAxis === 'y') {
      if (cx === 1)  return pos ? 'R'  : "R'";
      if (cx === -1) return pos ? "L'" : 'L';
    }
  }

  if (nx > 0) { // Face R (-Z = screen-right from R viewer)
    if (swipeAxis === 'z') {
      if (cy === 1)  return pos ? "U'" : 'U';
      if (cy === -1) return pos ? 'D'  : "D'";
    } else if (swipeAxis === 'y') {
      if (cz === 1)  return pos ? "R'" : 'R';
      if (cz === -1) return pos ? 'R'  : "R'";
    }
  }

  if (nx < 0) { // Face L (+Z = screen-right from L viewer)
    if (swipeAxis === 'z') {
      if (cy === 1)  return pos ? 'U'  : "U'";
      if (cy === -1) return pos ? "D'" : 'D';
    } else if (swipeAxis === 'y') {
      if (cz === 1)  return pos ? 'L'  : "L'";
      if (cz === -1) return pos ? "L'" : 'L';
    }
  }

  if (ny > 0) { // Face U
    if (swipeAxis === 'x') {
      if (cz === 1)  return pos ? 'U'  : "U'";
      if (cz === -1) return pos ? "U'" : 'U';
    } else if (swipeAxis === 'z') {
      if (cx === 1)  return pos ? "U'" : 'U';
      if (cx === -1) return pos ? 'U'  : "U'";
    }
  }

  if (ny < 0) { // Face D
    if (swipeAxis === 'x') {
      if (cz === 1)  return pos ? "D'" : 'D';
      if (cz === -1) return pos ? 'D'  : "D'";
    } else if (swipeAxis === 'z') {
      if (cx === 1)  return pos ? 'D'  : "D'";
      if (cx === -1) return pos ? "D'" : 'D';
    }
  }

  return null; // middle slice — no supported move
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: React.MutableRefObject<any>;
}

export function RubiksCube({ orbitRef }: Props) {
  const cube        = useCubeStore((s) => s.cube);
  const pendingMove = useCubeStore((s) => s.pendingMove);
  const applyMove   = useCubeStore((s) => s.applyMove);
  const commitMove  = useCubeStore((s) => s.commitMove);

  const { camera, raycaster, gl } = useThree();

  // Animation state — mutated directly in useFrame (no React re-renders mid-animation)
  const animGroupRef = useRef<THREE.Group>(null);
  const animRef = useRef<{
    currentAngle: number;
    targetAngle: number;
    axisKey: 'x' | 'y' | 'z';
  } | null>(null);

  // Drag / swipe state
  const dragRef = useRef<{
    startX: number;
    startY: number;
    hitPoint: THREE.Vector3;
    faceNormal: [number, number, number];
    cubie: { cx: number; cy: number; cz: number };
  } | null>(null);

  // Stable ref mirror so event handlers always see current pendingMove
  const pendingMoveRef = useRef(pendingMove);
  pendingMoveRef.current = pendingMove;

  // ── Start animation when a new move is queued ──
  useEffect(() => {
    if (!pendingMove) return;
    const cfg = MOVE_ANIM[pendingMove];
    if (animGroupRef.current) animGroupRef.current.rotation.set(0, 0, 0);
    animRef.current = { currentAngle: 0, targetAngle: cfg.angle, axisKey: cfg.axisKey };
  }, [pendingMove]);

  // ── Drive rotation every frame ──
  useFrame((_, delta) => {
    const anim = animRef.current;
    if (!anim || !animGroupRef.current) return;

    const SPEED = Math.PI * 3.5; // ≈ 260 ms for 90°
    anim.currentAngle += delta * SPEED * Math.sign(anim.targetAngle);

    const done =
      anim.targetAngle > 0
        ? anim.currentAngle >= anim.targetAngle
        : anim.currentAngle <= anim.targetAngle;

    if (done) {
      animGroupRef.current.rotation[anim.axisKey] = anim.targetAngle;
      animRef.current = null;
      commitMove();
      return;
    }

    animGroupRef.current.rotation[anim.axisKey] = anim.currentAngle;
  });

  // ── Global pointerup: resolve swipe gesture ──
  useEffect(() => {
    const resolve = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (orbitRef.current) orbitRef.current.enabled = true;

      const rect = gl.domElement.getBoundingClientRect();
      const endNDC = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
       -((e.clientY - rect.top)  / rect.height) * 2 + 1,
      );

      // Project end position onto the face plane to get 3D world movement
      const faceNorm = new THREE.Vector3(...drag.faceNormal);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(faceNorm, drag.hitPoint);
      raycaster.setFromCamera(endNDC, camera);
      const endPt = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, endPt)) return;

      // Tangential (in-plane) 3D displacement
      const movement = endPt.sub(drag.hitPoint);
      movement.addScaledVector(faceNorm, -movement.dot(faceNorm));
      if (movement.length() < 0.12) return;

      const ax = Math.abs(movement.x);
      const ay = Math.abs(movement.y);
      const az = Math.abs(movement.z);

      let swipeAxis: 'x' | 'y' | 'z';
      let swipeSign: number;
      if (ax >= ay && ax >= az)      { swipeAxis = 'x'; swipeSign = Math.sign(movement.x); }
      else if (ay >= ax && ay >= az) { swipeAxis = 'y'; swipeSign = Math.sign(movement.y); }
      else                           { swipeAxis = 'z'; swipeSign = Math.sign(movement.z); }

      const move = lookupSwipeMove(drag.faceNormal, swipeAxis, swipeSign, drag.cubie);
      if (move) applyMove(move);
    };

    const cancel = () => {
      dragRef.current = null;
      if (orbitRef.current) orbitRef.current.enabled = true;
    };

    window.addEventListener('pointerup', resolve);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointerup', resolve);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [camera, raycaster, gl, orbitRef, applyMove]);

  // ── Build cubie JSX, splitting into static and animated groups ──
  const { staticCubies, animatedCubies } = useMemo(() => {
    if (!cube) return { staticCubies: [], animatedCubies: [] };

    const isAffected = pendingMove
      ? (cx: number, cy: number, cz: number) => MOVE_ANIM[pendingMove].layer(cx, cy, cz)
      : () => false;

    // Inline handler — reads pendingMoveRef (always current) and orbitRef (stable ref)
    const handleDown = (e: ThreeEvent<PointerEvent>, cx: number, cy: number, cz: number) => {
      if (pendingMoveRef.current) return;
      if (!e.face) return;
      e.stopPropagation();
      // Stop DOM propagation so OrbitControls (registered after R3F) doesn't start orbiting
      e.nativeEvent.stopImmediatePropagation();

      e.object.updateWorldMatrix(true, false);
      const hitNormal = e.face.normal.clone().transformDirection(e.object.matrixWorld);

      let bestFace = 0, bestDot = -Infinity;
      FACE_NORMALS.forEach(([nx, ny, nz], i) => {
        const dot = hitNormal.x * nx + hitNormal.y * ny + hitNormal.z * nz;
        if (dot > bestDot) { bestDot = dot; bestFace = i; }
      });

      dragRef.current = {
        startX: e.nativeEvent.clientX,
        startY: e.nativeEvent.clientY,
        hitPoint: e.point.clone(),
        faceNormal: FACE_NORMALS[bestFace],
        cubie: { cx, cy, cz },
      };

      if (orbitRef.current) orbitRef.current.enabled = false;
    };

    const staticResult: React.ReactElement[] = [];
    const animatedResult: React.ReactElement[] = [];

    for (let cx = -1; cx <= 1; cx++) {
      for (let cy = -1; cy <= 1; cy++) {
        for (let cz = -1; cz <= 1; cz++) {
          const px = cx * OFFSET;
          const py = cy * OFFSET;
          const pz = cz * OFFSET;

          const stickers = FACE_NORMALS.map(([nx, ny, nz], faceIdx) => {
            const color = getStickerColor(cube, faceIdx, cx, cy, cz);
            if (color === null) return null;
            return (
              <CubieFace
                key={faceIdx}
                color={color}
                position={[nx * 0.501, ny * 0.501, nz * 0.501]}
                normal={[nx, ny, nz]}
              />
            );
          }).filter(Boolean);

          const cubie = (
            <group
              key={`${cx}-${cy}-${cz}`}
              position={[px, py, pz]}
              onPointerDown={(e) => handleDown(e, cx, cy, cz)}
            >
              <mesh>
                <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
                <meshStandardMaterial color="#111111" />
              </mesh>
              {stickers}
            </group>
          );

          if (isAffected(cx, cy, cz)) {
            animatedResult.push(cubie);
          } else {
            staticResult.push(cubie);
          }
        }
      }
    }

    return { staticCubies: staticResult, animatedCubies: animatedResult };
  // orbitRef and pendingMoveRef are stable refs — intentionally not in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cube, pendingMove]);

  return (
    <group>
      {staticCubies}
      <group ref={animGroupRef}>
        {animatedCubies}
      </group>
    </group>
  );
}
