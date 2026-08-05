export function requiredElement<T extends Element>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

export function requiredElements<T extends Element>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function canvasContext(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', options);
  if (!context) throw new Error('Canvas 2D context is unavailable');
  return context;
}

export function eventTarget<T extends EventTarget>(event: Event, ctor: abstract new (...args: never[]) => T): T {
  if (!(event.target instanceof ctor)) throw new TypeError('Unexpected event target');
  return event.target;
}
