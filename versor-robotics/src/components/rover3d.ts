import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { C } from "@/lib/palette";
import { COS_E, DIST, FOV, SIN_E, TARGET_Y, VIEW_H, VIEW_W, WHEEL_R } from "./rover3d.config";

/** Everything the page tells the model each frame */
export interface RoverPose {
  /** heading on the ground, radians (0 = facing screen-right, +π/2 = driving toward the viewer) */
  heading: number;
  /** front-wheel steering angle (radians, + = toward the right side of the rover) */
  steer: number;
  /** lean around the driving axis (radians) */
  roll: number;
  /** nose up (+) / down (-) (radians) */
  pitch: number;
  /** accumulated wheel rotation (radians) for the left and right wheel pairs */
  spinL: number;
  spinR: number;
  /** 0 = on the ground, 1 = held up in the air; can go slightly negative for the landing squash */
  lift: number;
  /** extra sway while being carried (radians) */
  sway: number;
  /** how far the rover moved over the ground since the last frame (world units) */
  moveX: number;
  moveZ: number;
  /** 0..1 how hard it is driving (drives the spray) */
  drive: number;
}

export interface Rover3D {
  render(pose: RoverPose, dt: number, t: number): void;
  dispose(): void;
}

const mat = (hex: string, rough = 0.5, metal = 0.1) =>
  new MeshStandardMaterial({ color: new Color(hex), roughness: rough, metalness: metal });

function softSprite(inner: string, outer: string, size = 64): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.45, inner.replace(/[\d.]+\)$/, "0.45)"));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** One wheel: chunky lugged tyre + a hub that visibly turns */
function makeWheel(tyre: MeshStandardMaterial, hub: MeshStandardMaterial, cap: MeshStandardMaterial) {
  const R = WHEEL_R;
  const Wd = 0.21;
  const spin = new Group();

  const parts: BufferGeometry[] = [];
  const body = new CylinderGeometry(R, R, Wd, 30, 1);
  body.rotateX(Math.PI / 2);
  parts.push(body);
  const lugs = 12;
  for (let i = 0; i < lugs; i++) {
    const lug = new BoxGeometry(0.1, 0.055, Wd * 1.03);
    lug.translate(0, R + 0.012, 0);
    lug.rotateZ((i / lugs) * Math.PI * 2);
    parts.push(lug);
  }
  spin.add(new Mesh(mergeGeometries(parts, false), tyre));

  const hubParts: BufferGeometry[] = [];
  const disc = new CylinderGeometry(R * 0.62, R * 0.62, Wd + 0.025, 24);
  disc.rotateX(Math.PI / 2);
  hubParts.push(disc);
  spin.add(new Mesh(mergeGeometries(hubParts, false), hub));

  // spokes + cap (these make the rotation readable)
  const spokes: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const s = new BoxGeometry(R * 1.05, 0.045, Wd + 0.04);
    s.rotateZ((i / 4) * Math.PI);
    spokes.push(s);
  }
  const spokeMat = mat(C.ink, 0.6, 0.2);
  spin.add(new Mesh(mergeGeometries(spokes, false), spokeMat));
  const capGeo = new CylinderGeometry(0.06, 0.06, Wd + 0.07, 16);
  capGeo.rotateX(Math.PI / 2);
  spin.add(new Mesh(capGeo, cap));

  return spin;
}

export function createRover3D(canvas: HTMLCanvasElement): Rover3D | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(VIEW_W, VIEW_H, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, VIEW_W / VIEW_H, 0.1, 60);
  camera.position.set(0, TARGET_Y + DIST * SIN_E, DIST * COS_E);
  camera.lookAt(0, TARGET_Y, 0);

  // light: warm sky, cool ground bounce, a sun from the upper left and a cool rim from behind
  scene.add(new HemisphereLight(0xfff1dc, 0x35504c, 1.35));
  const sun = new DirectionalLight(0xffffff, 2.6);
  sun.position.set(-2.5, 5, 3.2);
  scene.add(sun);
  const rim = new DirectionalLight(0xa9cdd8, 1.0);
  rim.position.set(3, 2, -3.5);
  scene.add(rim);

  // ── materials ──
  const mBody = mat(C.tomato, 0.42, 0.12);
  const mBodyDark = mat(C.tomatoDark, 0.5, 0.1);
  const mCream = mat(C.cream, 0.5, 0.05);
  const mInk = mat(C.ink, 0.55, 0.25);
  const mSteel = mat(C.steel, 0.35, 0.45);
  const mAmber = mat(C.amber, 0.4, 0.15);
  const mTank = mat(C.sprout, 0.45, 0.1);
  const mTyre = mat("#0d1514", 0.92, 0.0);
  const mEye = new MeshStandardMaterial({ color: new Color(C.cream), emissive: new Color(C.cream), emissiveIntensity: 0.9, roughness: 0.4 });
  const mBeacon = new MeshStandardMaterial({ color: new Color(C.amber), emissive: new Color(C.amber), emissiveIntensity: 0.6, roughness: 0.3 });
  const mTail = new MeshStandardMaterial({ color: new Color("#ff6a45"), emissive: new Color("#ff3a1a"), emissiveIntensity: 0.7, roughness: 0.4 });

  // ── rig: root (heading + lift) > lean (roll/pitch) > parts ──
  const root = new Group();
  const lean = new Group();
  root.add(lean);
  scene.add(root);

  const add = (parent: Object3D, geo: BufferGeometry, m: MeshStandardMaterial, x = 0, y = 0, z = 0) => {
    const mesh = new Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // chassis + cube body
  add(lean, new RoundedBoxGeometry(1.2, 0.16, 0.8, 3, 0.05), mInk, 0, 0.31, 0);
  add(lean, new RoundedBoxGeometry(1.3, 0.78, 0.92, 5, 0.13), mBody, 0, 0.68, 0);
  // amber belt line + darker lower skirt
  add(lean, new RoundedBoxGeometry(1.33, 0.06, 0.95, 3, 0.025), mAmber, 0, 0.54, 0);
  add(lean, new RoundedBoxGeometry(1.32, 0.12, 0.94, 3, 0.05), mBodyDark, 0, 0.44, 0);
  // roof lid
  add(lean, new RoundedBoxGeometry(1.2, 0.1, 0.82, 4, 0.045), mCream, 0, 1.1, 0);

  // face: bumper, sensor panel, two glowing eyes
  add(lean, new RoundedBoxGeometry(0.1, 0.13, 0.82, 3, 0.04), mInk, 0.68, 0.37, 0);
  add(lean, new RoundedBoxGeometry(0.07, 0.36, 0.66, 3, 0.03), mInk, 0.655, 0.78, 0);
  for (const z of [-0.17, 0.17]) {
    const eye = new CylinderGeometry(0.075, 0.075, 0.03, 20);
    eye.rotateZ(Math.PI / 2);
    add(lean, eye, mEye, 0.695, 0.8, z);
  }
  // rear: vent panel + tail lamps
  add(lean, new RoundedBoxGeometry(0.06, 0.3, 0.58, 3, 0.025), mInk, -0.655, 0.74, 0);
  for (const z of [-0.36, 0.36]) add(lean, new RoundedBoxGeometry(0.05, 0.08, 0.1, 2, 0.02), mTail, -0.66, 0.9, z);

  // roof: little tank, beacon, antenna
  const tankGeo = new CapsuleGeometry(0.17, 0.46, 6, 16);
  tankGeo.rotateX(Math.PI / 2);
  add(lean, tankGeo, mTank, -0.26, 1.33, -0.02);
  const strapGeo = new CylinderGeometry(0.18, 0.18, 0.05, 20);
  strapGeo.rotateX(Math.PI / 2);
  add(lean, strapGeo, mInk, -0.26, 1.33, 0.12);
  add(lean, strapGeo, mInk, -0.26, 1.33, -0.16);
  const ant = new CylinderGeometry(0.014, 0.014, 0.4, 8);
  add(lean, ant, mInk, 0.4, 1.35, -0.27);
  add(lean, new SphereGeometry(0.055, 14, 10), mBeacon, 0.4, 1.58, -0.27);
  add(lean, new CylinderGeometry(0.07, 0.09, 0.07, 14), mInk, 0.4, 1.17, -0.27);

  // ── wheels: 2 front, 2 rear ──
  const wheelSpec = [
    { x: 0.42, z: -0.64, front: true, left: true },
    { x: 0.42, z: 0.64, front: true, left: false },
    { x: -0.42, z: -0.64, front: false, left: true },
    { x: -0.42, z: 0.64, front: false, left: false },
  ];
  const pivots: Group[] = [];
  const spinners: { g: Group; left: boolean }[] = [];
  for (const w of wheelSpec) {
    const pivot = new Group();
    pivot.position.set(w.x, WHEEL_R, w.z);
    const spin = makeWheel(mTyre, mSteel, mAmber);
    pivot.add(spin);
    lean.add(pivot);
    if (w.front) pivots.push(pivot);
    spinners.push({ g: spin, left: w.left });
    // suspension arm
    const arm = new BoxGeometry(0.1, 0.07, 0.14);
    add(lean, arm, mInk, w.x, WHEEL_R + 0.05, w.z > 0 ? 0.5 : -0.5);
  }

  // ── spray mast on the rover's right-hand side (+z) ──
  const MAST_Z = 0.6;
  const mast = new Group();
  lean.add(mast);
  const pole = new CylinderGeometry(0.042, 0.042, 1.5, 14);
  add(mast, pole, mSteel, 0, 0.93, MAST_Z);
  for (const y of [0.52, 0.98]) add(mast, new RoundedBoxGeometry(0.15, 0.1, 0.22, 3, 0.03), mInk, 0, y, 0.53);
  add(mast, new SphereGeometry(0.06, 12, 10), mAmber, 0, 1.69, MAST_Z);
  add(mast, new CylinderGeometry(0.06, 0.06, 0.05, 14), mInk, 0, 0.19, MAST_Z);

  const nozzleTips: Object3D[] = [];
  const NOZZLE_Y = [0.42, 0.7, 0.98, 1.26, 1.54];
  for (const y of NOZZLE_Y) {
    const armG = new CylinderGeometry(0.022, 0.022, 0.13, 8);
    armG.rotateX(Math.PI / 2);
    add(mast, armG, mSteel, 0, y, MAST_Z + 0.08);
    const head = new CylinderGeometry(0.03, 0.058, 0.12, 14);
    head.rotateX(Math.PI / 2); // narrow end toward +z
    add(mast, head, mAmber, 0, y, MAST_Z + 0.2);
    const tip = new CylinderGeometry(0.04, 0.04, 0.025, 12);
    tip.rotateX(Math.PI / 2);
    add(mast, tip, mInk, 0, y, MAST_Z + 0.27);
    const o = new Object3D();
    o.position.set(0, y, MAST_Z + 0.3);
    mast.add(o);
    nozzleTips.push(o);
  }
  // feed hose from the tank down the pole
  const hose = new CylinderGeometry(0.018, 0.018, 0.9, 8);
  add(mast, hose, mInk, 0.07, 0.68, MAST_Z - 0.01);

  // ── soft ground shadow (stays on the floor while the rover is lifted) ──
  const shadowTex = softSprite("rgba(0,0,0,0.55)", "rgba(0,0,0,0)", 128);
  const shadow = new Mesh(
    new PlaneGeometry(2.7, 1.9),
    new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.renderOrder = -1;
  scene.add(shadow);

  // ── spray: tiny droplets that keep drifting in the ground frame, so they trail the rover ──
  const MAXP = 420;
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 4);
  const pVel = new Float32Array(MAXP * 3);
  const pAge = new Float32Array(MAXP).fill(9);
  const pTtl = new Float32Array(MAXP).fill(1);
  const geo = new BufferGeometry();
  // BufferAttribute (not Float32BufferAttribute) so it uses our arrays instead of copying them
  geo.setAttribute("position", new BufferAttribute(pPos, 3).setUsage(DynamicDrawUsage));
  geo.setAttribute("color", new BufferAttribute(pCol, 4).setUsage(DynamicDrawUsage));
  const mistTex = softSprite("rgba(255,255,255,1)", "rgba(255,255,255,0)", 64);
  const mistMat = new PointsMaterial({
    size: 0.95,
    map: mistTex,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const mist = new Points(geo, mistMat);
  mist.frustumCulled = false;
  mist.renderOrder = 5;
  scene.add(mist);

  const tmpV = new Vector3();
  const tmpQ = new Quaternion();
  const white = new Color("#ffffff");
  const blue = new Color("#6fb0c8");
  const tint = new Color();
  let emitAcc = 0;
  let cursor = 0;

  const emit = () => {
    for (let tries = 0; tries < 12; tries++) {
      const i = cursor;
      cursor = (cursor + 1) % MAXP;
      if (pAge[i] < pTtl[i]) continue;
      const tip = nozzleTips[(Math.random() * nozzleTips.length) | 0];
      tip.getWorldPosition(tmpV);
      pPos[i * 3] = tmpV.x;
      pPos[i * 3 + 1] = tmpV.y;
      pPos[i * 3 + 2] = tmpV.z;
      // fan: out of the nozzle (local +z), spread up/down and a little sideways, with a slight droop
      tip.getWorldQuaternion(tmpQ);
      const sp = 2.1 + Math.random() * 1.3;
      tmpV.set((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.5 - 0.08, 1).normalize().multiplyScalar(sp).applyQuaternion(tmpQ);
      pVel[i * 3] = tmpV.x;
      pVel[i * 3 + 1] = tmpV.y;
      pVel[i * 3 + 2] = tmpV.z;
      pAge[i] = 0;
      pTtl[i] = 0.55 + Math.random() * 0.6;
      return;
    }
  };

  let disposed = false;

  return {
    render(p, dt, t) {
      if (disposed) return;

      // heading (model faces +x; world z points toward the viewer)
      root.rotation.y = -p.heading;
      const lift = p.lift;
      root.position.y = Math.max(0, lift) * 0.5;
      root.scale.set(1 + Math.max(0, lift) * 0.1, 1 + Math.min(0, lift) * 0.55, 1 + Math.max(0, lift) * 0.1);
      lean.rotation.x = p.roll + p.sway;
      lean.rotation.z = p.pitch + Math.sin(t * 5.1) * p.sway * 0.4;
      for (const pv of pivots) pv.rotation.y = -p.steer;
      for (const s of spinners) s.g.rotation.z = -(s.left ? p.spinL : p.spinR);

      // shadow
      shadow.rotation.z = -p.heading; // the plane lies flat: its long axis follows the heading
      const sh = 1 + Math.max(0, lift) * 0.35;
      shadow.scale.set(sh, sh, 1);
      (shadow.material as MeshBasicMaterial).opacity = 0.85 - Math.max(0, lift) * 0.4;

      // beacon + eyes
      mBeacon.emissiveIntensity = 0.25 + (Math.sin(t * 6.5) > 0.1 ? 0.95 : 0);
      mEye.emissiveIntensity = 0.75 + Math.sin(t * 2.3) * 0.12;

      root.updateMatrixWorld(true);

      // spray
      emitAcc += 190 * p.drive * dt;
      while (emitAcc >= 1) {
        emitAcc -= 1;
        emit();
      }
      const drag = Math.exp(-2.6 * dt);
      for (let i = 0; i < MAXP; i++) {
        if (pAge[i] >= pTtl[i]) {
          pCol[i * 4 + 3] = 0;
          continue;
        }
        pAge[i] += dt;
        if (pAge[i] >= pTtl[i]) {
          pCol[i * 4 + 3] = 0;
          continue;
        }
        pVel[i * 3] *= drag;
        pVel[i * 3 + 2] *= drag;
        pVel[i * 3 + 1] = pVel[i * 3 + 1] * drag - 2.4 * dt;
        pPos[i * 3] += pVel[i * 3] * dt - p.moveX;
        pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
        pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt - p.moveZ;
        if (pPos[i * 3 + 1] < 0.02) {
          pAge[i] = pTtl[i];
          pCol[i * 4 + 3] = 0;
          continue;
        }
        const k = pAge[i] / pTtl[i];
        tint.copy(white).lerp(blue, k);
        pCol[i * 4] = tint.r;
        pCol[i * 4 + 1] = tint.g;
        pCol[i * 4 + 2] = tint.b;
        pCol[i * 4 + 3] = Math.pow(1 - k, 1.0) * 0.95;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
    },

    dispose() {
      disposed = true;
      scene.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mm = m.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else if (mm) mm.dispose();
      });
      shadowTex.dispose();
      mistTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
