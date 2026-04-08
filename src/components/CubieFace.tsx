import type { FaceColor } from '../logic/cubeState';
import { COLOR_MAP } from '../logic/cubeState';

interface Props {
  color: FaceColor;
  position: [number, number, number];
  normal: [number, number, number];
}

export function CubieFace({ color, position, normal }: Props) {
  return (
    <mesh position={position} rotation={faceRotation(normal)}>
      <planeGeometry args={[0.85, 0.85]} />
      <meshStandardMaterial color={COLOR_MAP[color]} />
    </mesh>
  );
}

// Map a face normal to the euler rotation needed for a plane
function faceRotation(normal: [number, number, number]): [number, number, number] {
  const [x, y, z] = normal;
  if (y > 0) return [-Math.PI / 2, 0, 0];  // top
  if (y < 0) return [Math.PI / 2, 0, 0];   // bottom
  if (z > 0) return [0, 0, 0];             // front
  if (z < 0) return [0, Math.PI, 0];       // back
  if (x > 0) return [0, Math.PI / 2, 0];   // right
  return [0, -Math.PI / 2, 0];             // left
}
