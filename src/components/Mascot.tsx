import { useEffect, useRef } from "react";
import {
  centerBias,
  clampAnchor,
  deformOutline,
  followTarget,
  gripPhysics,
  deformPoint,
  pullTarget,
  type Point,
} from "../lib/grab";
import type { KeeperLook } from "../lib/keeper";

export type Mood = "idle" | "happy" | "worried" | "sleepy" | "celebrate";

const TAU = Math.PI * 2;

/** Mixes a hex color towards black or white, keeping the flat look of the body. */
function shade(hex: string, factor: number, alpha: number): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return `rgba(20, 22, 26, ${alpha})`;
  const channel = (slice: string) =>
    Math.min(255, Math.round(Number.parseInt(slice, 16) * factor));
  return `rgba(${channel(value.slice(0, 2))}, ${channel(value.slice(2, 4))}, ${channel(
    value.slice(4, 6),
  )}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
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

function pathFromPoints(points: Point[]): Path2D {
  const path = new Path2D();
  if (points.length === 0) return path;
  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
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
  const boopCallback = useRef(onBoop);
  const canvasPadding = 0.4;
  const canvasSize = Math.round(size * (1 + canvasPadding));

  moodRef.current = mood;
  boopCallback.current = onBoop;

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
  } = look;

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
    const outline = bodyOutline(shape, radius);
    // Decorations anchor to the real silhouette, so a pill or a star does not
    // leave the ears, the tail or the feet floating in empty space.
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
    const eased = { squint: 1, tiltAmp: 0.02, breatheAmp: 0.026 };

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
      const rect = hit.getBoundingClientRect();
      const halfWidth = rect.width / 2 || 1;
      const halfHeight = rect.height / 2 || 1;
      gaze.tx = Math.max(-1, Math.min(1, (event.clientX - (rect.left + halfWidth)) / halfWidth));
      gaze.ty = Math.max(-1, Math.min(1, (event.clientY - (rect.top + halfHeight)) / halfHeight));
      gaze.seen = (performance.now() - start) / 1000;
      const distance = Math.hypot(
        event.clientX - (rect.left + halfWidth),
        event.clientY - (rect.top + halfHeight),
      );
      if (distance < rect.width * 0.85) hoverSeen = gaze.seen;

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
      if (!boopable) return;
      drag.active = true;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.moved = 0;
      const rect = hit.getBoundingClientRect();
      const offsetX = event.clientX - (rect.left + rect.width / 2);
      const offsetY = event.clientY - (rect.top + rect.height / 2);
      const anchor = clampAnchor(offsetX, offsetY, radius);
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
      hit.style.cursor = boopable ? "grab" : "default";
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
      if (boopable) hit.style.cursor = "grab";
    }

    const draw = (now: number) => {
      if (cancelled) return;
      // Each frame owns its transform, so a second effect instance that resized
      // the canvas cannot leave this one drawing at the wrong scale.
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
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
      eased.tiltAmp += ((moodSad ? 0.012 : moodHappy ? 0.03 : 0.02) - eased.tiltAmp) * easeRate;
      eased.breatheAmp += ((moodSleepy ? 0.034 : 0.026) - eased.breatheAmp) * easeRate;

      const squish = Math.sin(time * (moodHappy ? 2.6 : 1.9));
      const breathe = reduceMotion ? 1 : 1 + squish * eased.breatheAmp;
      const sway = reduceMotion ? 0 : Math.sin(time * 0.9) * radius * 0.022;
      const tilt = reduceMotion ? 0 : Math.sin(time * 2.1) * eased.tiltAmp;
      const moodBob =
        moodHappy && !reduceMotion ? Math.abs(Math.sin(time * 5.5)) * radius * 0.035 : 0;
      // Only the boop squints the eyes; the chosen eye style always wins.
      const happy = Math.max(0, Math.min(1, (happyUntil - time) / 0.5));
      const winking = winkUntil > time;
      const seesPointer = time - gaze.seen < 2.5;
      // A flat mascot reads as a head turning when the face slides with the
      // gaze, the eyes slide further than the snout, and the far eye shrinks.

      const turn = gaze.x;
      // The whole body yaws; the face adds a small extra slide on top of it.
      const bodyYaw = turn * radius * 0.06;
      const bodySquash = 1 - 0.06 * Math.abs(turn);
      const turnShift = turn * radius * 0.05;
      const turnRise = gaze.y * radius * 0.05;
      const turnSquash = 1 - 0.03 * Math.abs(turn);

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
        spring(headX, gaze.x * radius * 0.11, 95, 13, halfStep);
        spring(headY, gaze.y * radius * 0.07, 90, 14, halfStep);
        spring(headRot, gaze.x * 0.09, 80, 12, halfStep);
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
      const hop = hopAt >= 0 ? Math.sin(((time - hopAt) / 0.5) * Math.PI) * radius * 0.06 : 0;
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

      let eyeOpen = Math.max(0.08, openness * eased.squint);
      if (moodSleepy) eyeOpen = 0.1;
      const sadEyes = moodSad;

      const grip = gripPhysics(drag.anchorX, drag.anchorY, pullX.value, pullY.value, radius);
      const lean = (pullX.value / (radius * 1.2)) * 0.05;
      const moodDrop = moodSad ? radius * 0.05 : 0;

      context.clearRect(0, 0, canvasSize, canvasSize);

      context.save();
      context.translate(
        center + sway + headX.value,
        center + headY.value + moodBob + moodDrop + hop,
      );
      context.rotate(tilt + headRot.value + lean);

      context.save();
      context.translate(dragX.value, dragY.value);
      const auraRadius = radius * 1.9;
      const aura = context.createRadialGradient(0, 0, radius * 0.4, 0, 0, auraRadius);
      aura.addColorStop(0, `${color}${hovering ? "3d" : "30"}`);
      aura.addColorStop(0.6, `${color}12`);
      aura.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = aura;
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
      context.translate(bodyYaw, turnRise);
      context.scale(bodySquash, 1);

      const bodyShade = shade(color, 0.82, 1);

      // Everything below is anchored to the deformed outline, so the whole pig
      // moves as one piece instead of leaving an ear or the snout
      // behind when the body is pulled.
      const deformed = deformOutline(
        outline,
        drag.anchorX,
        drag.anchorY,
        pullX.value,
        pullY.value,
        radius,
      );
      const body = outline.length > 0 ? pathFromPoints(deformed) : bodyPath(shape, radius);

      const at = (angle: number): Point => {
        if (deformed.length === 0) {
          return { x: Math.cos(angle) * radius * 0.92, y: Math.sin(angle) * radius * 0.92 };
        }
        const wrapped = ((angle % TAU) + TAU) % TAU;
        const index = Math.round((wrapped / TAU) * deformed.length) % deformed.length;
        return deformed[index];
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
        return { x: point.x * scale, y: point.y * scale };
      };
      const place = (angle: number, scale = 1): Point => {
        const rest = restAt(angle, scale);
        return move(rest.x, rest.y);
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
          const edge = at(angle);
          const anchor = { x: edge.x + turnShift, y: edge.y };
          // The ear on the far side loses size, which is what sells the turn.
          const depth = 1 - 0.22 * Math.max(0, -side * turn);
          context.save();
          context.translate(anchor.x, anchor.y);
          context.rotate(normalAt(angle) + Math.PI / 2 + turn * side * 0.12);
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
          context.fillStyle = shade(color, 0.6, 1);
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
      context.translate(turnShift, 0);
      context.scale(turnSquash, 1);

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
      const eyeY = -radius * 0.06 + (sadEyes ? radius * 0.02 : 0);

      for (const side of [-1, 1]) {
        const style = eyeStyle;
        const eye = eyeShape(style, radius, sizeScale);
        const eyeWidth = eye.width;
        const eyeHeight = eye.height * (style === "bars" ? 1 + wonder * 0.1 : 1);
        const eyeLift = Math.max(0, eyeHeight / 2 - radius * 0.26);
        const eyeX = side * eyeOffset;
        const closed = winking && side === -1;
        const drawArc = closed || style === "arcs";
        const position = move(eyeX, eyeY - eyeLift);

        context.save();
        context.translate(position.x, position.y);
        context.rotate(sadEyes ? side * 0.14 : side * tiltAngle);
        context.scale(1, Math.max(0.08, eyeOpen));

        if (sadEyes) {
          const half = radius * 0.23;
          context.strokeStyle = ink;
          context.lineWidth = Math.max(1.5, radius * 0.075);
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(-half, 0);
          context.lineTo(half, 0);
          context.stroke();
        } else if (drawArc) {
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
          const position = move(side * radius * 0.52, radius * 0.2);
          context.beginPath();
          context.ellipse(position.x, position.y, radius * 0.115, radius * 0.065, 0, 0, TAU);
          context.fill();
        }
      }

      if (snout) {
        const snoutY = radius * 0.4;
        const muzzleLead = turn * radius * 0.035;
        const centerPoint = move(muzzleLead, snoutY);
        context.fillStyle = lighten(color, 0.3);
        context.beginPath();
        context.ellipse(
          centerPoint.x,
          centerPoint.y,
          radius * 0.36 * (1 - 0.12 * Math.abs(turn)),
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
          const nostril = move(side * radius * 0.1 + muzzleLead, snoutY);
          context.beginPath();
          context.ellipse(
            nostril.x,
            nostril.y,
            radius * 0.042 * (1 - 0.12 * Math.abs(turn)),
            radius * 0.055,
            0,
            0,
            TAU,
          );
          context.fill();
        }
      }

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

      if (animate) frame = requestAnimationFrame(draw);
    };

    if (animate) {
      frame = requestAnimationFrame(draw);
    } else {
      draw(performance.now());
    }

    return () => {
      cancelled = true;
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
    shape,
    color,
    boopable,
    snout,
    ears,
    tail,
    blush,
    eyeStyle,
    eyeSize,
    eyeSpacing,
    eyeTilt,
    eyeColor,
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
