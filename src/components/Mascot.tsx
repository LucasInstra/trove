import { useEffect, useRef } from "react";
import {
  centerBias,
  clampAnchor,
  deformInto,
  followTarget,
  gripPhysics,
  deformPoint,
  pullTarget,
  type Point,
} from "../lib/grab";
import { featureDepth, pitchFor, pitchScale, projectFeature, yawFor } from "../lib/head";
import type { KeeperLook } from "../lib/keeper";

export type Mood = "idle" | "happy" | "worried" | "sleepy" | "celebrate";

const TAU = Math.PI * 2;

/** Mixes a hex color towards black or white, keeping the flat look of the body. */
function shade(hex: string, factor: number, alpha: number): string {
  if (typeof hex !== "string") return `rgba(26, 25, 23, ${alpha})`;
  const value = hex.replace("#", "");
  if (value.length !== 6) return `rgba(20, 22, 26, ${alpha})`;
  const channel = (slice: string) =>
    Math.min(255, Math.round(Number.parseInt(slice, 16) * factor));
  return `rgba(${channel(value.slice(0, 2))}, ${channel(value.slice(2, 4))}, ${channel(
    value.slice(4, 6),
  )}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
  if (typeof hex !== "string") return "#ffffff";
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#ffffff";
  const mix = (slice: string) => {
    const base = Number.parseInt(slice, 16);
    return Math.round(base + (255 - base) * amount);
  };
  return `rgb(${mix(value.slice(0, 2))}, ${mix(value.slice(2, 4))}, ${mix(value.slice(4, 6))})`;
}

/** Perceived brightness, used to pick a readable eye colour automatically. */
function brightness(hex: string): number {
  if (typeof hex !== "string") return 0.5;
  const value = hex.replace("#", "");
  if (value.length !== 6) return 0.5;
  const linear = (slice: string) => {
    const channel = Number.parseInt(slice, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(value.slice(0, 2)) +
    0.7152 * linear(value.slice(2, 4)) +
    0.0722 * linear(value.slice(4, 6))
  );
}

function sparklePath(context: CanvasRenderingContext2D, width: number, height: number) {
  const outerX = width / 2;
  const outerY = height / 2;
  const innerX = outerX * 0.26;
  const innerY = outerY * 0.26;
  context.beginPath();
  context.moveTo(0, -outerY);
  context.quadraticCurveTo(innerX, -innerY, outerX, 0);
  context.quadraticCurveTo(innerX, innerY, 0, outerY);
  context.quadraticCurveTo(-innerX, innerY, -outerX, 0);
  context.quadraticCurveTo(-innerX, -innerY, 0, -outerY);
  context.closePath();
}

function heartPath(context: CanvasRenderingContext2D, width: number, height: number) {
  context.beginPath();
  context.moveTo(0, height * 0.38);
  context.bezierCurveTo(
    -width * 0.6,
    -height * 0.08,
    -width * 0.28,
    -height * 0.52,
    0,
    -height * 0.2,
  );
  context.bezierCurveTo(width * 0.28, -height * 0.52, width * 0.6, -height * 0.08, 0, height * 0.38);
  context.closePath();
}

/** Hex plus alpha, with a safe fallback when the colour is not a valid hex. */
function withAlpha(hex: string, alpha: number): string {
  if (typeof hex !== "string") return `rgba(26, 25, 23, ${alpha})`;
  const value = hex.replace("#", "");
  if (value.length !== 6) return `rgba(26, 25, 23, ${alpha})`;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function eyeShape(style: string, radius: number, scale: number) {
  switch (style) {
    case "dots": {
      const width = radius * 0.3 * scale;
      return { width, height: width };
    }
    case "sleepy":
      return { width: radius * 0.34 * scale, height: radius * 0.13 * scale };
    case "sparkle":
      return { width: radius * 0.46 * scale, height: radius * 0.58 * scale };
    case "heart":
      return { width: radius * 0.48 * scale, height: radius * 0.46 * scale };
    case "ring": {
      const width = radius * 0.4 * scale;
      return { width, height: width };
    }
    default:
      return { width: radius * 0.225 * scale, height: radius * 0.52 * scale };
  }
}

function superellipse(path: Path2D, radius: number, power: number) {
  const steps = 72;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * TAU;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = radius * Math.sign(cos) * Math.abs(cos) ** (2 / power);
    const y = radius * Math.sign(sin) * Math.abs(sin) ** (2 / power);
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
}

function roundedPolygon(path: Path2D, points: number[][], corner: number) {
  const count = points.length;
  const at = (index: number) => points[(index + count) % count];
  const distance = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const towards = (from: number[], to: number[], amount: number) => {
    const length = distance(from, to) || 1;
    const ratio = Math.min(0.45, amount / length);
    return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
  };

  for (let index = 0; index < count; index += 1) {
    const previous = at(index - 1);
    const current = at(index);
    const next = at(index + 1);
    const start = towards(current, previous, corner);
    const end = towards(current, next, corner);
    if (index === 0) path.moveTo(start[0], start[1]);
    else path.lineTo(start[0], start[1]);
    path.quadraticCurveTo(current[0], current[1], end[0], end[1]);
  }
  path.closePath();
}

function bodyPath(shape: string, radius: number): Path2D {
  const path = new Path2D();

  switch (shape) {
    case "oval":
      path.ellipse(0, 0, radius * 1.12, radius * 0.78, 0, 0, TAU);
      break;
    case "egg":
      path.ellipse(0, radius * 0.06, radius * 0.82, radius * 1.02, 0, 0, TAU);
      break;
    case "pill":
      path.roundRect(-radius * 1.1, -radius * 0.62, radius * 2.2, radius * 1.24, radius * 0.62);
      break;
    case "square":
      path.roundRect(-radius * 0.88, -radius * 0.88, radius * 1.76, radius * 1.76, radius * 0.32);
      break;
    case "blob":
      superellipse(path, radius * 0.98, 3.1);
      break;
    case "cloud":
      path.arc(-radius * 0.38, radius * 0.1, radius * 0.5, 0, TAU);
      path.moveTo(radius * 0.84, radius * 0.02);
      path.arc(radius * 0.36, radius * 0.04, radius * 0.54, 0, TAU);
      path.moveTo(radius * 0.56, -radius * 0.24);
      path.arc(0, -radius * 0.34, radius * 0.52, 0, TAU);
      path.roundRect(-radius * 0.74, radius * 0.04, radius * 1.48, radius * 0.52, radius * 0.22);
      break;
    case "hexagon":
      roundedPolygon(
        path,
        Array.from({ length: 6 }, (_, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI) / 3;
          return [Math.cos(angle) * radius * 0.92, Math.sin(angle) * radius * 0.92];
        }),
        radius * 0.2,
      );
      break;
    case "drop":
      path.moveTo(0, -radius * 1.08);
      path.bezierCurveTo(
        radius * 0.55,
        -radius * 0.42,
        radius * 0.86,
        radius * 0.18,
        radius * 0.7,
        radius * 0.52,
      );
      path.bezierCurveTo(
        radius * 0.54,
        radius * 0.94,
        -radius * 0.54,
        radius * 0.94,
        -radius * 0.7,
        radius * 0.52,
      );
      path.bezierCurveTo(
        -radius * 0.86,
        radius * 0.18,
        -radius * 0.55,
        -radius * 0.42,
        0,
        -radius * 1.08,
      );
      path.closePath();
      break;
    case "star": {
      const points: number[][] = [];
      for (let index = 0; index < 10; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        const distance = index % 2 === 0 ? radius * 1.02 : radius * 0.46;
        points.push([Math.cos(angle) * distance, Math.sin(angle) * distance]);
      }
      roundedPolygon(path, points, radius * 0.1);
      break;
    }
    case "round":
    default:
      path.arc(0, 0, radius * 0.95, 0, TAU);
      break;
  }

  return path;
}

let outlineSampler: CanvasRenderingContext2D | null = null;
const outlineCache = new Map<string, Point[]>();

function samplerContext(): CanvasRenderingContext2D | null {
  if (outlineSampler) return outlineSampler;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  outlineSampler = canvas.getContext("2d");
  return outlineSampler;
}

/**
 * Turns a body silhouette into a ring of points by casting rays from the
 * center. Points are what allow a local, Gaussian deformation; a Path2D alone
 * can only take global transforms.
 */
function bodyOutline(shape: string, radius: number): Point[] {
  const key = `${shape}:${radius.toFixed(2)}`;
  const cached = outlineCache.get(key);
  if (cached) return cached;

  const context = samplerContext();
  if (!context) return [];

  const path = bodyPath(shape, radius);
  const count = 256;
  const max = radius * 1.7;
  const points: Point[] = [];

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TAU;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let low = 0;
    let high = max;
    for (let step = 0; step < 16; step += 1) {
      const middle = (low + high) / 2;
      if (context.isPointInPath(path, cos * middle, sin * middle)) low = middle;
      else high = middle;
    }
    points.push({ x: cos * low, y: sin * low });
  }

  outlineCache.set(key, points);
  return points;
}

function pathFromPoints(points: Point[], shear = 0): Path2D {
  const path = new Path2D();
  if (points.length === 0) return path;
  path.moveTo(points[0].x + shear * points[0].y, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    // A one line shear is what makes a flat silhouette lean with the yaw.
    path.lineTo(points[index].x + shear * points[index].y, points[index].y);
  }
  path.closePath();
  return path;
}

export interface MascotProps {
  look: KeeperLook;
  mood?: Mood;
  size?: number;
  boopable?: boolean;
  animate?: boolean;
  onBoop?: () => void;
  label?: string;
}

/**
 * The keeper: a piggy bank with a face. Canvas, because the body has to
 * deform locally when grabbed; the snout, ears and tail are what
 * make it read as a vault animal instead of a generic blob.
 */
export function Mascot({
  look,
  mood = "idle",
  size = 72,
  boopable = true,
  animate = true,
  onBoop,
  label,
}: MascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<Mood>(mood);
  const lookRef = useRef(look);
  const boopableRef = useRef(boopable);
  const boopCallback = useRef(onBoop);
  const canvasPadding = 0.4;
  const canvasSize = Math.round(size * (1 + canvasPadding));

  moodRef.current = mood;
  lookRef.current = look;
  boopableRef.current = boopable;
  boopCallback.current = onBoop;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const hit = hitRef.current;
    if (!canvas || !context || !hit) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    let cancelled = false;

    const gaze = { x: 0, y: 0, tx: 0, ty: 0, seen: -10 };
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const radius = size * 0.3;
    const deformed: Point[] = Array.from({ length: 256 }, () => ({ x: 0, y: 0 }));
    let lastDeformKey = "";
    let cachedBody: Path2D | null = null;
    let lastBodyShape = "";
    let colorKey = "";
    let bodyShade = "#000000";
    let snoutFill = "#ffffff";
    let earInner = "#000000";
    let auraKey = "";
    let auraGradient: CanvasGradient | null = null;
    let liveDpr = window.devicePixelRatio || 1;
    let rootMatrix = new DOMMatrix();
    let hitRect = hit.getBoundingClientRect();
    const refreshRect = () => {
      hitRect = hit.getBoundingClientRect();
    };
    const rectObserver = new ResizeObserver(refreshRect);
    rectObserver.observe(hit);
    const start = performance.now();
    let frame = 0;
    let nextBlink = 1.8;
    let blinkStart = -1;
    let nextWander = 0;
    let wonder = 0;
    let hoverSeen = -10;
    let nextLook = 6 + Math.random() * 6;
    let lookPhase = -1;
    let lookUntil = 0;
    let nextHop = 8 + Math.random() * 10;
    let hopAt = -1;
    let lastTime = 0;
    let happyUntil = -1;
    let winkUntil = -1;
    const eased = { squint: 1, sleep: 0, tiltAmp: 0.02, breatheAmp: 0.026 };

    const headX = { value: 0, velocity: 0 };
    const headY = { value: 0, velocity: 0 };
    const headRot = { value: 0, velocity: 0 };
    const dragX = { value: 0, velocity: 0, target: 0 };
    const dragY = { value: 0, velocity: 0, target: 0 };
    const pullX = { value: 0, velocity: 0, target: 0 };
    const pullY = { value: 0, velocity: 0, target: 0 };
    const drag = {
      active: false,
      startX: 0,
      startY: 0,
      moved: 0,
      anchorX: 0,
      anchorY: 0,
    };

    const spring = (
      state: { value: number; velocity: number },
      target: number,
      stiffness: number,
      damping: number,
      dt: number,
    ) => {
      const force = (target - state.value) * stiffness - state.velocity * damping;
      state.velocity += force * dt;
      state.value += state.velocity * dt;
    };


    const onPointerMove = (event: PointerEvent) => {
      const rect = hitRect;
      const halfWidth = rect.width / 2 || 1;
      const halfHeight = rect.height / 2 || 1;
      const distance = Math.hypot(
        event.clientX - (rect.left + halfWidth),
        event.clientY - (rect.top + halfHeight),
      );
      const near = distance < Math.max(rect.width * 2.5, 220);
      if (!near) return;

      // A fixed arena instead of the widget box: the same mouse distance turns
      // the 34px pill and the 148px preview by the same amount.
      const arena = Math.max(0.18 * window.innerWidth, 220);
      const pointerDx = event.clientX - (rect.left + halfWidth);
      const pointerDy = event.clientY - (rect.top + halfHeight);
      gaze.tx = Math.tanh(pointerDx / arena);
      gaze.ty = Math.tanh(pointerDy / arena);
      gaze.seen = (performance.now() - start) / 1000;
      hoverSeen = gaze.seen;

      if (!drag.active) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      const bias = centerBias(drag.anchorX, drag.anchorY, radius);
      const follow = followTarget(dx, dy, radius, bias);
      dragX.target = follow.x;
      dragY.target = follow.y;
      const pull = pullTarget(dx, dy, radius);
      pullX.target = pull.x;
      pullY.target = pull.y;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!boopableRef.current || event.button !== 0) return;
      refreshRect();
      drag.active = true;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.moved = 0;
      // The drawing is translated, rotated and scaled, so the pointer has to be
      // mapped through the inverse of the root matrix to land on the material
      // point the user actually grabbed.
      const canvasRect = canvas.getBoundingClientRect();
      const scale = canvasSize / (canvasRect.width || canvasSize);
      const pointer = new DOMPoint(
        (event.clientX - canvasRect.left) * scale,
        (event.clientY - canvasRect.top) * scale,
      );
      const local = rootMatrix.inverse().transformPoint(pointer);
      const anchor = clampAnchor(local.x, local.y, radius);
      drag.anchorX = anchor.x;
      drag.anchorY = anchor.y;
      try {
        hit.setPointerCapture(event.pointerId);
      } catch {
        // the pointer can already be gone on very fast clicks
      }
      hit.style.cursor = "grabbing";
    };

    const onPointerUp = () => {
      if (!drag.active) return;
      drag.active = false;
      dragX.target = 0;
      dragY.target = 0;
      pullX.target = 0;
      pullY.target = 0;
      hit.style.cursor = boopableRef.current ? "grab" : "inherit";
      if (drag.moved < 4) {
        const now = (performance.now() - start) / 1000;
        happyUntil = now + 1.2;
        winkUntil = now + 0.32;
        boopCallback.current?.();
      }
    };

    if (animate) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("blur", onPointerUp);
      hit.addEventListener("pointerdown", onPointerDown);
      hit.addEventListener("pointercancel", onPointerUp);
    }

    const draw = (now: number) => {
      if (cancelled) return;
      // Each frame owns its transform, so a second effect instance that resized
      // the canvas cannot leave this one drawing at the wrong scale.
      // A monitor change alters the device pixel ratio; the backing store has
      // to follow or the mascot goes blurry.
      liveDpr = window.devicePixelRatio || 1;
      if (liveDpr !== dpr) {
        canvas.width = canvasSize * liveDpr;
        canvas.height = canvasSize * liveDpr;
      }
      context.setTransform(liveDpr, 0, 0, liveDpr, 0, 0);
      const {
        shape,
        color,
        eyeStyle,
        eyeSize,
        eyeSpacing,
        eyeTilt,
        eyeColor,
        snout,
        ears,
        tail,
        blush,
      } = lookRef.current;
      const outline = bodyOutline(shape, radius);
      const time = (now - start) / 1000;
      const delta = Math.min(0.05, Math.max(0.008, time - lastTime || 0.016));
      lastTime = time;

      const feeling = moodRef.current;
      const moodHappy = feeling === "happy" || feeling === "celebrate";
      const moodSad = feeling === "worried";
      const moodSleepy = feeling === "sleepy";
      const center = canvasSize / 2;

      wonder *= 0.96;

      const easeRate = Math.min(1, 0.045 * (delta * 60));
      eased.squint += ((moodSad ? 0.62 : 1) - eased.squint) * easeRate;
      eased.sleep += ((moodSleepy ? 1 : 0) - eased.sleep) * easeRate;
      eased.tiltAmp += ((moodSad ? 0.012 : moodHappy ? 0.03 : 0.02) - eased.tiltAmp) * easeRate;
      eased.breatheAmp += ((moodSleepy ? 0.034 : 0.026) - eased.breatheAmp) * easeRate;

      const dragging = drag.active;
      const squish = Math.sin(time * (moodHappy ? 2.6 : 1.9));
      const breathe = reduceMotion ? 1 : 1 + squish * eased.breatheAmp;
      const sway = reduceMotion || dragging ? 0 : Math.sin(time * 0.9) * radius * 0.022;
      const tilt = reduceMotion ? 0 : Math.sin(time * 2.1) * eased.tiltAmp;
      const moodBob =
        moodHappy && !reduceMotion && !dragging
          ? Math.abs(Math.sin(time * 5.5)) * radius * 0.035
          : 0;
      // Only the boop squints the eyes; the chosen eye style always wins.
      const happy = Math.max(0, Math.min(1, (happyUntil - time) / 0.5));
      const winking = winkUntil > time;
      const seesPointer = time - gaze.seen < 2.5;
      // A flat mascot reads as a head turning when the face slides with the
      // gaze, the eyes slide further than the snout, and the far eye shrinks.

      const turn = reduceMotion ? 0 : gaze.x;
      const yaw = yawFor(turn);
      const pitch = pitchFor(reduceMotion ? 0 : gaze.y);
      const bodyWidth = Math.cos(yaw);
      const bodyHeight = pitchScale(pitch);
      const faceRadius = radius * 0.95;
      const project = (x: number, y: number) => projectFeature(x, y, faceRadius, yaw);
      const shear = Math.sin(yaw) * 0.12;

      if (!seesPointer && !moodSleepy && !reduceMotion) {
        if (lookPhase < 0 && time > nextLook) {
          lookPhase = 0;
          lookUntil = time;
        }
        if (lookPhase >= 0 && time > lookUntil) {
          const targets: Array<[number, number]> = [
            [-0.85, -0.32],
            [0.85, -0.22],
            [0.18, 0.24],
            [-0.22, 0.04],
          ];
          const [tx, ty] = targets[lookPhase];
          gaze.tx = tx;
          gaze.ty = ty;
          lookPhase += 1;
          lookUntil = time + 0.65 + Math.random() * 0.5;
          if (lookPhase >= targets.length) {
            lookPhase = -1;
            nextLook = time + 7 + Math.random() * 8;
          }
        }
      }

      if (!seesPointer && lookPhase < 0 && time > nextWander) {
        gaze.tx = (Math.random() - 0.5) * 1.5;
        gaze.ty = (Math.random() - 0.5) * 0.8 + 0.08;
        nextWander = time + 0.9 + Math.random() * 2.0;
      }

      const ease = 0.16;
      gaze.x += (gaze.tx - gaze.x) * ease * (delta * 60);
      gaze.y += (gaze.ty - gaze.y) * ease * (delta * 60);

      const halfStep = delta / 2;
      for (let step = 0; step < 2; step += 1) {
        spring(headX, dragging ? 0 : gaze.x * radius * 0.11, 95, 13, halfStep);
        spring(headY, dragging ? 0 : gaze.y * radius * 0.07, 90, 14, halfStep);
        spring(headRot, dragging ? 0 : gaze.x * 0.09, 80, 12, halfStep);
        spring(dragX, dragX.target, 150, 13, halfStep);
        spring(dragY, dragY.target, 150, 13, halfStep);
        spring(pullX, pullX.target, 210, 19.5, halfStep);
        spring(pullY, pullY.target, 210, 19.5, halfStep);
      }

      if (!reduceMotion && !moodHappy && !moodSad && time > nextHop) {
        hopAt = time;
        nextHop = time + 10 + Math.random() * 12;
      }
      if (hopAt >= 0 && time - hopAt >= 0.5) hopAt = -1;
      const hop =
        !dragging && hopAt >= 0
          ? Math.sin(((time - hopAt) / 0.5) * Math.PI) * radius * 0.06
          : 0;
      const hovering = time - hoverSeen < 0.35;

      if (blinkStart < 0 && time >= nextBlink) blinkStart = time;

      let openness = 1;
      if (blinkStart >= 0) {
        const elapsed = time - blinkStart;
        if (elapsed < 0.06) openness = 1 - elapsed / 0.06;
        else if (elapsed < 0.13) openness = (elapsed - 0.06) / 0.07;
        else {
          blinkStart = -1;
          openness = 1;
          nextBlink = time + (Math.random() < 0.28 ? 0.19 : 1.8) + Math.random() * 3.2;
        }
      }

      const eyeOpen = Math.max(0.08, openness * eased.squint) * (1 - 0.9 * eased.sleep);

      const grip = gripPhysics(drag.anchorX, drag.anchorY, pullX.value, pullY.value, radius);
      const lean = (pullX.value / (radius * 1.2)) * 0.05;
      const moodDrop = moodSad ? radius * 0.05 : 0;

      context.clearRect(0, 0, canvasSize, canvasSize);

      const rootX = center + sway + headX.value;
      const rootY = center + headY.value + moodBob + moodDrop + hop;
      const rootRotation = tilt + headRot.value + lean;
      rootMatrix = new DOMMatrix()
        .translateSelf(rootX, rootY)
        .rotateSelf((rootRotation * 180) / Math.PI)
        .scaleSelf(1 / breathe, breathe)
        .scaleSelf(bodyWidth, bodyHeight);

      context.save();
      context.translate(rootX, rootY);
      context.rotate(rootRotation);

      context.save();
      context.translate(dragX.value, dragY.value);
      const auraRadius = radius * 1.9;
      const nextAuraKey = `${color}|${hovering}`;
      if (nextAuraKey !== auraKey) {
        auraKey = nextAuraKey;
        auraGradient = context.createRadialGradient(0, 0, radius * 0.4, 0, 0, auraRadius);
        auraGradient.addColorStop(0, withAlpha(color, hovering ? 0.24 : 0.19));
        auraGradient.addColorStop(0.6, withAlpha(color, 0.07));
        auraGradient.addColorStop(1, "rgba(0,0,0,0)");
      }
      context.fillStyle = auraGradient ?? "rgba(0,0,0,0)";
      context.beginPath();
      context.arc(0, 0, auraRadius, 0, TAU);
      context.fill();
      context.restore();

      context.translate(dragX.value, dragY.value);
      if (grip.strength > 0.001) {
        context.translate(drag.anchorX, drag.anchorY);
        context.rotate(grip.axis);
        context.scale(grip.scaleAlong, grip.scaleCross);
        context.rotate(-grip.axis);
        context.translate(-drag.anchorX, -drag.anchorY);
      }
      context.scale(1 / breathe, breathe);

      // A head yaw reads as the silhouette narrowing and shifting, not as a
      // face sliding over a static body.
      context.scale(bodyWidth, bodyHeight);

      if (color !== colorKey) {
        colorKey = color;
        bodyShade = shade(color, 0.82, 1);
        snoutFill = lighten(color, 0.3);
        earInner = shade(color, 0.6, 1);
      }

      // Everything below is anchored to the deformed outline, so the whole pig
      // moves as one piece instead of leaving an ear or the snout
      // behind when the body is pulled.
      const deformKey = `${shape}|${drag.anchorX.toFixed(2)}|${drag.anchorY.toFixed(2)}|${pullX.value.toFixed(2)}|${pullY.value.toFixed(2)}|${shear.toFixed(3)}`;
      if (deformKey !== lastDeformKey || shape !== lastBodyShape) {
        deformInto(deformed, outline, drag.anchorX, drag.anchorY, pullX.value, pullY.value, radius);
        cachedBody =
          outline.length > 0 ? pathFromPoints(deformed, shear) : bodyPath(shape, radius);
        lastDeformKey = deformKey;
        lastBodyShape = shape;
      }
      const body = cachedBody ?? pathFromPoints(outline, shear);

      const at = (angle: number): Point => {
        if (deformed.length === 0) {
          return { x: Math.cos(angle) * radius * 0.92, y: Math.sin(angle) * radius * 0.92 };
        }
        const wrapped = ((angle % TAU) + TAU) % TAU;
        const index = Math.round((wrapped / TAU) * deformed.length) % deformed.length;
        const point = deformed[index];
        return { x: point.x + shear * point.y, y: point.y };
      };
      const move = (x: number, y: number) =>
        deformPoint({ x, y }, drag.anchorX, drag.anchorY, pullX.value, pullY.value, radius);
      // Rest position on the undeformed silhouette, scaled inwards, so a
      // decoration starts buried in the body and is then moved by the same
      // Gaussian the surface uses.
      const restAt = (angle: number, scale = 1): Point => {
        if (outline.length === 0) {
          return {
            x: Math.cos(angle) * radius * 0.92 * scale,
            y: Math.sin(angle) * radius * 0.92 * scale,
          };
        }
        const wrapped = ((angle % TAU) + TAU) % TAU;
        const index = Math.round((wrapped / TAU) * outline.length) % outline.length;
        const point = outline[index];
        return { x: point.x * scale + shear * point.y * scale, y: point.y * scale };
      };
      const place = (angle: number, scale = 1): Point => {
        const rest = restAt(angle, scale);
        const projected = project(rest.x, rest.y);
        return move(projected.x, projected.y);
      };
      // Outward normal of the deformed surface, so a decoration stays glued to
      // the silhouette instead of keeping the angle it had at rest.
      const normalAt = (angle: number): number => {
        if (deformed.length < 3) return angle;
        const wrapped = ((angle % TAU) + TAU) % TAU;
        const index = Math.round((wrapped / TAU) * deformed.length) % deformed.length;
        const count = deformed.length;
        const previous = deformed[(index - 1 + count) % count];
        const next = deformed[(index + 1) % count];
        const tangent = Math.atan2(next.y - previous.y, next.x - previous.x);
        return tangent - Math.PI / 2;
      };

      // Tail sits behind the body, on the right hip.
      if (tail) {
        const edge = at(0.22);
        const normal = normalAt(0.22);
        const inward = radius * 0.16;
        const anchor = {
          x: edge.x - Math.cos(normal) * inward,
          y: edge.y - Math.sin(normal) * inward,
        };
        context.save();
        context.translate(anchor.x, anchor.y);
        context.rotate(normal + Math.PI / 2);
        context.strokeStyle = bodyShade;
        context.lineWidth = Math.max(1.4, radius * 0.1);
        context.lineCap = "round";
        context.beginPath();
        context.arc(radius * 0.1, 0, radius * 0.14, -Math.PI * 0.6, Math.PI * 0.9);
        context.stroke();
        context.beginPath();
        context.arc(radius * 0.16, -radius * 0.13, radius * 0.08, Math.PI * 0.6, Math.PI * 2.1);
        context.stroke();
        context.restore();
      }

      // Ears sit behind the body too, so only the tips show.
      if (ears) {
        for (const side of [-1, 1]) {
          const angle = -Math.PI / 2 + side * 0.62;
          const rest = restAt(angle);
          const projected = project(rest.x, rest.y);
          const anchor = move(projected.x, projected.y);
          const azimuth = Math.asin(Math.max(-1, Math.min(1, rest.x / faceRadius)));
          const depth = 0.78 + 0.22 * featureDepth(azimuth, yaw);
          context.save();
          context.translate(anchor.x, anchor.y);
          context.rotate(normalAt(angle) + Math.PI / 2 + yaw * side * 0.3);
          context.scale(depth, depth);
          context.beginPath();
          context.moveTo(-radius * 0.24, radius * 0.08);
          context.quadraticCurveTo(-radius * 0.2, -radius * 0.4, 0, -radius * 0.46);
          context.quadraticCurveTo(radius * 0.2, -radius * 0.4, radius * 0.24, radius * 0.08);
          context.quadraticCurveTo(0, radius * 0.2, -radius * 0.24, radius * 0.08);
          context.closePath();
          context.fillStyle = bodyShade;
          context.fill();
          context.beginPath();
          context.moveTo(-radius * 0.13, radius * 0.03);
          context.quadraticCurveTo(-radius * 0.09, -radius * 0.26, 0, -radius * 0.3);
          context.quadraticCurveTo(radius * 0.09, -radius * 0.26, radius * 0.13, radius * 0.03);
          context.quadraticCurveTo(0, radius * 0.11, -radius * 0.13, radius * 0.03);
          context.closePath();
          context.fillStyle = earInner;
          context.fill();
          context.restore();
        }
      }

      context.fillStyle = color;
      context.fill(body);

      context.save();
      context.clip(body);
      const sheen = context.createLinearGradient(0, -radius, 0, radius * 1.1);
      sheen.addColorStop(0, "rgba(255,255,255,0.26)");
      sheen.addColorStop(0.45, "rgba(255,255,255,0.03)");
      sheen.addColorStop(1, "rgba(0,0,0,0.16)");
      context.fillStyle = sheen;
      context.fillRect(-radius * 1.4, -radius * 1.4, radius * 2.8, radius * 2.8);
      context.restore();

      context.save();

      const sizeScale =
        (eyeSize === "small" ? 0.82 : eyeSize === "large" ? 1.22 : 1) * (hovering ? 1.035 : 1);
      const spacingScale = eyeSpacing === "close" ? 0.235 : eyeSpacing === "wide" ? 0.35 : 0.285;
      const tiltAngle = eyeTilt === "straight" ? 0 : eyeTilt === "sharp" ? 0.14 : -0.16;
      const ink =
        !eyeColor || eyeColor === "auto"
          ? brightness(color) > 0.3
            ? "#241d33"
            : "#fcfcff"
          : eyeColor;

      const base = eyeShape(eyeStyle, radius, sizeScale);
      const arcLike = eyeStyle === "arcs";
      const baseHalf = arcLike ? base.width * 0.82 : base.width / 2;
      const minGap = eyeSpacing === "close" ? 0.04 : eyeSpacing === "wide" ? 0.24 : 0.13;
      const happyArcs =
        happy > 0.5 && (eyeStyle === "bars" || eyeStyle === "dots" || eyeStyle === "sleepy");
      const happySpread = happyArcs ? radius * 0.06 * Math.min(1, (happy - 0.5) / 0.5) : 0;
      const eyeOffset = Math.max(radius * spacingScale, baseHalf + radius * minGap) + happySpread;
      const eyeY = -radius * 0.06 + Math.sin(pitch) * radius * 0.2;

      for (const side of [-1, 1]) {
        const style = eyeStyle;
        const eye = eyeShape(style, radius, sizeScale);
        const eyeWidth = eye.width;
        const eyeHeight = eye.height * (style === "bars" ? 1 + wonder * 0.1 : 1);
        const eyeLift = Math.max(0, eyeHeight / 2 - radius * 0.26);
        const eyeX = side * eyeOffset;
        const closed = winking && side === -1;
        const boopArc =
          happy > 0.55 && (style === "bars" || style === "dots" || style === "sleepy");
        const drawArc = closed || boopArc || style === "arcs";
        const projected = project(eyeX, eyeY);
        const position = move(projected.x, projected.y - eyeLift);
        const azimuth = Math.asin(Math.max(-1, Math.min(1, eyeX / faceRadius)));
        const eyeDepth = 0.82 + 0.18 * featureDepth(azimuth, yaw);

        context.save();
        context.translate(position.x, position.y);
        context.rotate(side * tiltAngle);
        context.scale(eyeDepth, Math.max(0.08, eyeOpen));

        if (drawArc) {
          context.strokeStyle = ink;
          context.lineWidth = Math.max(1.4, eyeWidth * 0.72);
          context.lineCap = "round";
          context.beginPath();
          context.arc(0, eyeHeight * 0.2, eyeWidth * 0.85, Math.PI * 1.14, Math.PI * 1.86);
          context.stroke();
        } else if (style === "sparkle") {
          context.fillStyle = ink;
          sparklePath(context, eyeWidth, eyeHeight);
          context.fill();
        } else if (style === "heart") {
          context.fillStyle = ink;
          heartPath(context, eyeWidth, eyeHeight);
          context.fill();
        } else {
          context.fillStyle = ink;
          context.beginPath();
          context.roundRect(-eyeWidth / 2, -eyeHeight / 2, eyeWidth, eyeHeight, eyeWidth / 2);
          context.fill();
        }

        context.restore();
      }

      if (blush) {
        context.fillStyle = "rgba(226, 110, 138, 0.3)";
        for (const side of [-1, 1]) {
          const projected = project(side * radius * 0.52, radius * 0.2 + Math.sin(pitch) * radius * 0.08);
          const position = move(projected.x, projected.y);
          context.beginPath();
          context.ellipse(position.x, position.y, radius * 0.115, radius * 0.065, 0, 0, TAU);
          context.fill();
        }
      }

      if (snout) {
        const snoutY = radius * 0.4 + Math.sin(pitch) * radius * 0.1;
        const snoutProjected = project(0, snoutY);
        const centerPoint = move(snoutProjected.x, snoutProjected.y);
        context.fillStyle = snoutFill;
        context.beginPath();
        context.ellipse(
          centerPoint.x,
          centerPoint.y,
          radius * 0.36 * (0.9 + 0.1 * snoutProjected.depth),
          radius * 0.25,
          0,
          0,
          TAU,
        );
        context.fill();
        context.strokeStyle = shade(color, 0.7, 0.75);
        context.lineWidth = Math.max(1, radius * 0.02);
        context.stroke();

        context.fillStyle = shade(color, 0.4, 1);
        for (const side of [-1, 1]) {
          const nostrilProjected = project(side * radius * 0.1, snoutY);
          const nostril = move(nostrilProjected.x, nostrilProjected.y);
          context.beginPath();
          context.ellipse(
            nostril.x,
            nostril.y,
            radius * 0.042 * (0.9 + 0.1 * nostrilProjected.depth),
            radius * 0.055,
            0,
            0,
            TAU,
          );
          context.fill();
        }
      }

      if (feeling === "celebrate") {
        context.fillStyle = "rgba(255,255,255,0.9)";
        for (const [x, y, scale] of [
          [-0.9, -0.9, 0.14],
          [0.92, -0.66, 0.1],
        ]) {
          const position = move(radius * x, radius * y);
          context.save();
          context.translate(position.x, position.y);
          sparklePath(context, radius * scale * 2, radius * scale * 2);
          context.fill();
          context.restore();
        }
      }

      context.restore();

      // Feet come last so they sit in front of the belly.
      context.fillStyle = bodyShade;
      for (const side of [-1, 1]) {
        const anchor = place(Math.PI / 2 - side * 0.42, 0.97);
        context.beginPath();
        context.ellipse(
          anchor.x,
          anchor.y,
          radius * 0.16,
          radius * 0.085,
          0,
          0,
          TAU,
        );
        context.fill();
        context.strokeStyle = shade(color, 0.55, 0.6);
        context.lineWidth = Math.max(1, radius * 0.018);
        context.beginPath();
        context.moveTo(anchor.x - radius * 0.015, anchor.y - radius * 0.05);
        context.lineTo(anchor.x - radius * 0.015, anchor.y + radius * 0.05);
        context.stroke();
      }

      context.restore();

      if (animate) frame = requestAnimationFrame(draw);
    };

    if (animate) {
      frame = requestAnimationFrame(draw);
    } else {
      draw(performance.now());
    }

    return () => {
      cancelled = true;
      rectObserver.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
      hit.removeEventListener("pointerdown", onPointerDown);
      hit.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    size,
    canvasSize,
    animate,
  ]);

  return (
    <div
      className="mascot"
      style={{ position: "relative", width: size, height: size, flex: "none" }}
    >
      <canvas
        ref={canvasRef}
        role={label ? "img" : "presentation"}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        style={{
          position: "absolute",
          left: (size - canvasSize) / 2,
          top: (size - canvasSize) / 2,
          width: canvasSize,
          height: canvasSize,
          display: "block",
          pointerEvents: "none",
        }}
      />
      <div
        ref={hitRef}
        className="mascot-hit"
        title={boopable ? "Drag me or click for a boop" : undefined}
        style={{
          position: "absolute",
          inset: 0,
          cursor: boopable ? "grab" : "inherit",
        }}
      />
    </div>
  );
}
