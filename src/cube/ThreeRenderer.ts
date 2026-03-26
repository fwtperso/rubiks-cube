import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CubeState, Move } from './types';
import { Face, Color } from './types';
import type { IRenderer } from './Renderer';

const CUBIE_SIZE = 0.92;
const SPACING = 1.0;
const ANIM_MS = 280;

const COLOR_HEX: Record<Color, number> = {
  [Color.WHITE]:  0xffffff,
  [Color.YELLOW]: 0xffd500,
  [Color.RED]:    0xb71234,
  [Color.ORANGE]: 0xff5800,
  [Color.BLUE]:   0x0046ad,
  [Color.GREEN]:  0x009b48,
};

const INNER_HEX = 0x1a1a1a;

// Three.js BoxGeometry material group order: +x, -x, +y, -y, +z, -z
const FACE_MAT_IDX: Record<Face, number> = {
  [Face.RIGHT]: 0,
  [Face.LEFT]:  1,
  [Face.UP]:    2,
  [Face.DOWN]:  3,
  [Face.FRONT]: 4,
  [Face.BACK]:  5,
};

// Rotation axis (unit vector) and sign per face for CW (direction=1)
// angle = sign * direction * (π/2)
const FACE_AXIS: Record<Face, { axis: THREE.Vector3; sign: number }> = {
  [Face.UP]:    { axis: new THREE.Vector3(0, 1, 0), sign:  1 },
  [Face.DOWN]:  { axis: new THREE.Vector3(0, 1, 0), sign: -1 },
  [Face.RIGHT]: { axis: new THREE.Vector3(1, 0, 0), sign:  1 },
  [Face.LEFT]:  { axis: new THREE.Vector3(1, 0, 0), sign: -1 },
  [Face.FRONT]: { axis: new THREE.Vector3(0, 0, 1), sign: -1 },
  [Face.BACK]:  { axis: new THREE.Vector3(0, 0, 1), sign:  1 },
};

// Which axis coordinate selects a slice, and its expected value
const FACE_SLICE: Record<Face, { coord: 'x' | 'y' | 'z'; value: number }> = {
  [Face.UP]:    { coord: 'y', value:  1 },
  [Face.DOWN]:  { coord: 'y', value: -1 },
  [Face.RIGHT]: { coord: 'x', value:  1 },
  [Face.LEFT]:  { coord: 'x', value: -1 },
  [Face.FRONT]: { coord: 'z', value:  1 },
  [Face.BACK]:  { coord: 'z', value: -1 },
};

function makeMaterials(colors: Record<Face, Color>, pos: { x: number; y: number; z: number }): THREE.MeshPhongMaterial[] {
  const mats: THREE.MeshPhongMaterial[] = new Array(6);
  for (const face of Object.values(Face)) {
    const { coord, value } = FACE_SLICE[face];
    const visible = pos[coord] === value;
    const hex = visible ? COLOR_HEX[colors[face]] : INNER_HEX;
    mats[FACE_MAT_IDX[face]] = new THREE.MeshPhongMaterial({ color: hex });
  }
  return mats;
}

function updateMeshColors(mesh: THREE.Mesh, colors: Record<Face, Color>, pos: { x: number; y: number; z: number }): void {
  const mats = mesh.material as THREE.MeshPhongMaterial[];
  for (const face of Object.values(Face)) {
    const { coord, value } = FACE_SLICE[face];
    const visible = pos[coord] === value;
    const hex = visible ? COLOR_HEX[colors[face]] : INNER_HEX;
    mats[FACE_MAT_IDX[face]].color.setHex(hex);
  }
}

function snapPosition(v: THREE.Vector3): void {
  v.x = Math.round(v.x / SPACING) * SPACING;
  v.y = Math.round(v.y / SPACING) * SPACING;
  v.z = Math.round(v.z / SPACING) * SPACING;
}

export class ThreeRenderer implements IRenderer {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private cubeMeshes: THREE.Mesh[] = [];
  private animating = false;
  private rafId = 0;

  init(container: HTMLElement): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e1e2e);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(4, 3.5, 5);
    this.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 8, 5);
    this.scene.add(ambient, directional);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 12;

    window.addEventListener('resize', () => this.onResize(container));

    this.startRenderLoop();
  }

  render(state: CubeState): void {
    if (this.cubeMeshes.length === 0) {
      this.buildMeshes(state);
      return;
    }
    state.cubies.forEach((cubie, i) => {
      const mesh = this.cubeMeshes[i];
      mesh.position.set(
        cubie.position.x * SPACING,
        cubie.position.y * SPACING,
        cubie.position.z * SPACING,
      );
      updateMeshColors(mesh, cubie.colors, cubie.position);
    });
  }

  animateMove(move: Move, onComplete: () => void): void {
    if (this.animating) {
      onComplete();
      return;
    }
    this.animating = true;

    const { axis, sign } = FACE_AXIS[move.face];
    const { coord, value } = FACE_SLICE[move.face];
    const targetAngle = sign * move.direction * (Math.PI / 2);

    const group = new THREE.Group();
    this.scene.add(group);

    const affected = this.cubeMeshes.filter(m => {
      const sliceVal = Math.round(m.position[coord] / SPACING);
      return sliceVal === value;
    });

    for (const mesh of affected) {
      group.attach(mesh);
    }

    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / ANIM_MS, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const angle = targetAngle * eased;

      group.setRotationFromAxisAngle(axis, angle);

      if (t < 1) {
        this.rafId = requestAnimationFrame(tick);
        return;
      }

      group.setRotationFromAxisAngle(axis, targetAngle);

      for (const mesh of affected) {
        this.scene.attach(mesh);
        snapPosition(mesh.position);
        mesh.rotation.set(0, 0, 0);
      }
      this.scene.remove(group);
      this.animating = false;
      onComplete();
    };

    this.rafId = requestAnimationFrame(tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.controls.dispose();
    for (const mesh of this.cubeMeshes) {
      mesh.geometry.dispose();
      const mats = mesh.material as THREE.MeshPhongMaterial[];
      for (const m of mats) m.dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.cubeMeshes = [];
  }

  private buildMeshes(state: CubeState): void {
    const geo = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    state.cubies.forEach(cubie => {
      const mats = makeMaterials(cubie.colors, cubie.position);
      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(
        cubie.position.x * SPACING,
        cubie.position.y * SPACING,
        cubie.position.z * SPACING,
      );
      this.scene.add(mesh);
      this.cubeMeshes.push(mesh);
    });
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  private onResize(container: HTMLElement): void {
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }
}
