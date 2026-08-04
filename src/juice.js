// Motion primitives. Everything that moves in cropwizard moves through here, so
// the whole app shares one feel and one reduced-motion switch.

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// iOS-style resistance: the further you pull past the edge, the less it gives,
// asymptotically approaching `limit`. Never hard-stops, never runs away.
export function rubber(distance, limit) {
  const sign = Math.sign(distance);
  const d = Math.abs(distance);
  return sign * limit * (1 - Math.exp(-d / limit));
}

// Critically-damped-ish spring. `stiffness`/`damping` are tuned per use site;
// the defaults land at roughly 350ms of settle with no visible overshoot.
export class Spring {
  constructor(value, { stiffness = 190, damping = 26, precision = 0.01 } = {}) {
    this.v = value;
    this.target = value;
    this.vel = 0;
    this.stiffness = stiffness;
    this.damping = damping;
    this.precision = precision;
  }

  // Move toward a new resting value with motion.
  set(target) {
    if (reduced.matches) return this.jump(target);
    this.target = target;
  }

  // Teleport: used while a pointer is down, where the finger *is* the animation.
  jump(value) {
    this.v = value;
    this.target = value;
    this.vel = 0;
  }

  get settled() {
    return Math.abs(this.vel) < this.precision &&
           Math.abs(this.target - this.v) < this.precision;
  }

  // Returns true while still in motion. Substepped so a dropped frame can't
  // blow the integrator up.
  step(dt) {
    if (this.settled) {
      this.v = this.target;
      this.vel = 0;
      return false;
    }
    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const accel = this.stiffness * (this.target - this.v) - this.damping * this.vel;
      this.vel += accel * h;
      this.v += this.vel * h;
    }
    return true;
  }
}

// A one-shot 0→1 decaying pulse, for flashes and thumps.
export class Pulse {
  constructor(duration = 0.45) {
    this.duration = duration;
    this.t = duration;
  }
  fire() { this.t = 0; }
  get value() {
    if (this.t >= this.duration) return 0;
    const p = this.t / this.duration;
    return (1 - p) * Math.cos(p * Math.PI * 2.5) ** 2;
  }
  get active() { return this.t < this.duration; }
  step(dt) {
    if (!this.active) return false;
    this.t = Math.min(this.duration, this.t + dt);
    return true;
  }
}

// Render loop that sleeps when nothing is moving. `step(dt)` returns true to
// keep going. Cheap to `kick()` repeatedly — it no-ops if already running.
export function createLoop(step) {
  let raf = 0;
  let last = 0;
  const tick = (now) => {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    raf = step(dt) ? requestAnimationFrame(tick) : 0;
  };
  return {
    kick() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

export const prefersReducedMotion = () => reduced.matches;
