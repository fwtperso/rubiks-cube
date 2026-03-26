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
// Three.js rotation angle = sign * direction * (π/2)
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

// swipeToMove: given a rotAxis (cross of faceNormal × swipeDir), the dominant
// world axis determines which layer moves. [Face, signMultiplier]:
//   direction = axisSign * signMultiplier
// Derived from: for each face, what Three.js rotation angle corresponds to dir=1.
const SLICE_MAP: Record<'x' | 'y' | 'z', [Face, 1 | -1][]> = {
  //                     slice=-1          slice=0    slice=+1
  x: [[Face.LEFT, -1],  [Face.LEFT, -1],  [Face.RIGHT, 1]],
  y: [[Face.DOWN, -1],  [Face.DOWN, -1],  [Face.UP,    1]],
  z: [[Face.BACK,  1],  [Face.BACK,  1],  [Face.FRONT,-1]],
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
  private renderRafId = 0;
  private animRafId = 0;

  init(container: HTMLElement): void {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e1e2e);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
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

  isAnimating(): boolean {
    return this.animating;
  }

  // Call after init(). Intercepts touch/mouse on cube faces; orbits otherwise.
  setupGestures(onMove: (move: Move) => void): void {
    const canvas = this.renderer.domElement;
    const raycaster = new THREE.Raycaster();
    let dragStart: { x: number; y: number } | null = null;
    let hitMesh: THREE.Mesh | null = null;
    let hitNormal: THREE.Vector3 | null = null;

    const ndc = (clientX: number, clientY: number): THREE.Vector2 => {
      const r = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      );
    };

    const raycast = (clientX: number, clientY: number) => {
      raycaster.setFromCamera(ndc(clientX, clientY), this.camera);
      const hits = raycaster.intersectObjects(this.cubeMeshes);
      if (!hits.length || !hits[0].face) return null;
      // Transform face normal to world space and snap to nearest axis
      const n = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld);
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      if (ax > ay && ax > az)      n.set(Math.sign(n.x), 0, 0);
      else if (ay > az)            n.set(0, Math.sign(n.y), 0);
      else                         n.set(0, 0, Math.sign(n.z));
      return { mesh: hits[0].object as THREE.Mesh, normal: n };
    };

    const pointerDown = (clientX: number, clientY: number) => {
      dragStart = { x: clientX, y: clientY };
      const hit = raycast(clientX, clientY);
      if (hit) {
        hitMesh = hit.mesh;
        hitNormal = hit.normal;
        this.controls.enabled = false;
      }
    };

    const pointerUp = (clientX: number, clientY: number) => {
      this.controls.enabled = true;
      if (!dragStart || !hitMesh || !hitNormal) {
        dragStart = null; hitMesh = null; hitNormal = null;
        return;
      }
      const dx = clientX - dragStart.x;
      const dy = clientY - dragStart.y;
      const mesh = hitMesh;
      const normal = hitNormal;
      dragStart = null; hitMesh = null; hitNormal = null;

      if (Math.hypot(dx, dy) < 8) return;
      const move = this.computeMove(normal, mesh, dx, dy);
      if (move) onMove(move);
    };

    canvas.addEventListener('mousedown', e => pointerDown(e.clientX, e.clientY));
    window.addEventListener('mouseup',   e => pointerUp(e.clientX, e.clientY));

    canvas.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      // Raycast first so we know whether to prevent default
      dragStart = { x: t.clientX, y: t.clientY };
      const hit = raycast(t.clientX, t.clientY);
      if (hit) {
        e.preventDefault();
        hitMesh = hit.mesh;
        hitNormal = hit.normal;
        this.controls.enabled = false;
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      if (!dragStart || !hitMesh || !hitNormal) {
        this.controls.enabled = true;
        dragStart = null; hitMesh = null; hitNormal = null;
        return;
      }
      e.preventDefault();
      const t = e.changedTouches[0];
      pointerUp(t.clientX, t.clientY);
    }, { passive: false });
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

    for (const mesh of affected) group.attach(mesh);

    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / ANIM_MS, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      group.setRotationFromAxisAngle(axis, targetAngle * eased);

      if (t < 1) {
        this.animRafId = requestAnimationFrame(tick);
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

    this.animRafId = requestAnimationFrame(tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.renderRafId);
    cancelAnimationFrame(this.animRafId);
    this.controls.dispose();
    for (const mesh of this.cubeMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.MeshPhongMaterial[]).forEach(m => m.dispose());
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.cubeMeshes = [];
  }

  // Converts a screen-space swipe on a known face into a Move.
  //
  // Math: rotAxis = cross(faceNormal, swipeWorld)
  //   → dominant world axis of rotAxis = which layer rotates
  //   → sign of rotAxis along that axis = CW vs CCW
  private computeMove(faceNormal: THREE.Vector3, mesh: THREE.Mesh, screenDx: number, screenDy: number): Move | null {
    // Camera right/up vectors from matrixWorld columns
    const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const camUp    = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);

    // Screen delta → world direction (screen Y is inverted)
    const swipe = camRight.clone().multiplyScalar(screenDx)
      .addScaledVector(camUp, -screenDy);

    // Project onto face plane (remove component along normal)
    swipe.addScaledVector(faceNormal, -swipe.dot(faceNormal));
    if (swipe.lengthSq() < 1e-6) return null;
    swipe.normalize();

    // Rotation axis perpendicular to both face normal and swipe
    const rotAxis = new THREE.Vector3().crossVectors(faceNormal, swipe);

    // Dominant world axis
    const ax = Math.abs(rotAxis.x), ay = Math.abs(rotAxis.y), az = Math.abs(rotAxis.z);
    let axis: 'x' | 'y' | 'z', axisSign: number;
    if (ax >= ay && ax >= az) { axis = 'x'; axisSign = Math.sign(rotAxis.x); }
    else if (ay >= az)        { axis = 'y'; axisSign = Math.sign(rotAxis.y); }
    else                      { axis = 'z'; axisSign = Math.sign(rotAxis.z); }

    // Which slice (−1, 0, +1) → array index 0, 1, 2
    const sliceRaw = Math.round(mesh.position[axis] / SPACING); // −1, 0, or +1
    const idx = sliceRaw + 1; // 0, 1, or 2
    const entry = SLICE_MAP[axis][idx];
    if (!entry) return null;

    const [face, mult] = entry;
    const direction = (axisSign * mult) as 1 | -1;
    return { face, direction };
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
      this.renderRafId = requestAnimationFrame(loop);
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
