import type { StoreKind } from '../../world/city/cityPlan.ts';

/**
 * CORE-014 store operations: opening hours, the roll-up door, the employee's routine and a
 * customer queue served at the counter. Pure state machines driven by the virtual clock.
 */
export type StoreHours = Readonly<{ open: number; close: number }>;
export const STORE_HOURS: Readonly<Record<StoreKind, StoreHours>> = {
  mercearia: { open: 7, close: 20 },
  farmacia: { open: 8, close: 22 },
  papelaria: { open: 8.5, close: 18.5 },
  supermercado: { open: 7.5, close: 21 },
  padaria: { open: 6, close: 20 },
  variedades: { open: 9, close: 18 },
  construcao: { open: 7, close: 17.5 },
  hortifruti: { open: 6.5, close: 19 },
};

/** Employee look and name per store: no two stores share the same worker. */
export const STORE_STAFF: Readonly<Record<StoreKind, { name: string; shirt: string; trousers: string; hair: string; skin: string; apron?: string; cap?: string }>> = {
  mercearia: { name: 'Seu Jair', shirt: '#2f6688', trousers: '#2d3a55', hair: '#d8d4cc', skin: '#c99a76', apron: '#f2efe6' },
  farmacia: { name: 'Lúcia', shirt: '#f4f6f4', trousers: '#2f3640', hair: '#2a1d16', skin: '#8f5f42', apron: '#1f8a5b' },
  papelaria: { name: 'Renato', shirt: '#2b5aa8', trousers: '#3b3f46', hair: '#3b2a1e', skin: '#e0b48e' },
  supermercado: { name: 'Camila', shirt: '#c9302c', trousers: '#23272d', hair: '#5a3a24', skin: '#d6a37b', cap: '#c9302c' },
  padaria: { name: 'Dona Cida', shirt: '#f6efe2', trousers: '#5a4a3c', hair: '#8a8580', skin: '#b67f5a', apron: '#a4622e', cap: '#f6efe2' },
  variedades: { name: 'Márcio', shirt: '#7a3f8f', trousers: '#2a2c31', hair: '#151311', skin: '#6e4529' },
  construcao: { name: 'Toninho', shirt: '#d0761f', trousers: '#3d4552', hair: '#2b2622', skin: '#a8714a', cap: '#f2c230' },
  hortifruti: { name: 'Bia', shirt: '#4f8a2f', trousers: '#384050', hair: '#a5642c', skin: '#e9c19c', apron: '#7a5a3a' },
};

export type EmployeeState = 'fora' | 'abrindo' | 'atendendo' | 'buscando' | 'conferindo' | 'fechando';
export type StoreOps = {
  readonly kind: StoreKind;
  /** 0 = shutter down, 1 = fully up. */
  shutter: number;
  employee: EmployeeState;
  /** Seconds left in the current employee task. */
  task: number;
  /** Customer ids in arrival order; queue[0] is at the counter. */
  readonly queue: number[];
  served: number;
  serving: boolean;
  /** The player is at the counter for a pickup. */
  pickup: boolean;
};

export function createStoreOps(kind: StoreKind): StoreOps {
  return { kind, shutter: 0, employee: 'fora', task: 0, queue: [], served: 0, serving: false, pickup: false };
}

export const isOpen = (kind: StoreKind, hour: number): boolean => {
  const h = STORE_HOURS[kind];
  const t = ((hour % 24) + 24) % 24;
  return t >= h.open && t < h.close;
};

const SHUTTER_SPEED = 0.35; // fraction per real second

/** Advances one store by `dt` real seconds at virtual `hour`. */
export function stepStore(s: StoreOps, hour: number, dt: number): void {
  const open = isOpen(s.kind, hour);
  const h = STORE_HOURS[s.kind];
  const t = ((hour % 24) + 24) % 24;
  const nearOpen = t >= h.open - 0.25 && t < h.close + 0.25;
  if (open) s.shutter = Math.min(1, s.shutter + SHUTTER_SPEED * dt);
  else s.shutter = Math.max(0, s.shutter - SHUTTER_SPEED * dt);
  if (!nearOpen && s.shutter === 0) { s.employee = 'fora'; s.queue.length = 0; s.serving = false; return; }
  if (open && s.shutter < 1) { s.employee = 'abrindo'; return; }
  if (!open) { s.employee = 'fechando'; return; }
  if (s.pickup) { s.employee = 'conferindo'; return; }
  // Serving cycle: fetch the item from the stock area, then ring it up at the counter.
  if (s.serving) {
    s.task -= dt;
    if (s.task > 0) return;
    if (s.employee === 'buscando') { s.employee = 'atendendo'; s.task = 3; return; }
    s.queue.shift();
    s.served++;
    s.serving = false;
  }
  if (s.queue.length) { s.serving = true; s.employee = 'buscando'; s.task = 4 + (s.served * 7) % 5; }
  else s.employee = 'atendendo';
}

/** A customer joins the queue (once). Returns its position. */
export function joinQueue(s: StoreOps, customer: number): number {
  if (!s.queue.includes(customer)) s.queue.push(customer);
  return s.queue.indexOf(customer);
}

export const queuePosition = (s: StoreOps, customer: number): number => s.queue.indexOf(customer);
