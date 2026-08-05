// Motion primitives shared across the application.

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function rubber(distance: number, limit: number): number {
  const sign = Math.sign(distance);
  const magnitude = Math.abs(distance);
  return sign * limit * (1 - Math.exp(-magnitude / limit));
}

export interface SpringOptions {
  readonly stiffness?: number;
  readonly damping?: number;
  readonly precision?: number;
}

export class Spring {
  public v: number;
  public target: number;
  public vel = 0;
  public readonly stiffness: number;
  public readonly damping: number;
  public readonly precision: number;

  public constructor(value: number, options: SpringOptions = {}) {
    this.v = value;
    this.target = value;
    this.stiffness = options.stiffness ?? 190;
    this.damping = options.damping ?? 26;
    this.precision = options.precision ?? 0.01;
  }

  public set(target: number): void {
    if (reduced.matches) {
      this.jump(target);
      return;
    }
    this.target = target;
  }

  public jump(value: number): void {
    this.v = value;
    this.target = value;
    this.vel = 0;
  }

  public get settled(): boolean {
    return Math.abs(this.vel) < this.precision
      && Math.abs(this.target - this.v) < this.precision;
  }

  public step(dt: number): boolean {
    if (this.settled) {
      this.v = this.target;
      this.vel = 0;
      return false;
    }
    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let index = 0; index < steps; index += 1) {
      const acceleration = this.stiffness * (this.target - this.v) - this.damping * this.vel;
      this.vel += acceleration * h;
      this.v += this.vel * h;
    }
    return true;
  }
}

export class Pulse {
  private readonly duration: number;
  private elapsed: number;

  public constructor(duration = 0.45) {
    this.duration = duration;
    this.elapsed = duration;
  }

  public fire(): void {
    this.elapsed = 0;
  }

  public get value(): number {
    if (this.elapsed >= this.duration) return 0;
    const progress = this.elapsed / this.duration;
    return (1 - progress) * Math.cos(progress * Math.PI * 2.5) ** 2;
  }

  public get active(): boolean {
    return this.elapsed < this.duration;
  }

  public step(dt: number): boolean {
    if (!this.active) return false;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    return true;
  }
}

export interface AnimationLoop {
  kick(): void;
  stop(): void;
}

export function createLoop(step: (dt: number) => boolean): AnimationLoop {
  let raf = 0;
  let last = 0;

  const tick = (now: number): void => {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    raf = step(dt) ? requestAnimationFrame(tick) : 0;
  };

  return {
    kick(): void {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    stop(): void {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

export const prefersReducedMotion = (): boolean => reduced.matches;
