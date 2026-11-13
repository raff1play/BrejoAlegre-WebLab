import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { loadPatchPilotAsset } from '../../world/externalAssets';
import type { Vehicle, VehicleKind } from '../../core/city/traffic';

/** Experimental comparison of actual Patch.gg GLBs with the existing procedural city actors.
 * No AI, collisions, speed, vehicle routes, pedestrian logic or workday state is changed.
 * Enabled only with ?assets=patch; safe fallback if an external file or animation fails.
 */
export type PatchPilotState = {
  requested: boolean; bus: 'loading' | 'ready' | 'failed'; pedestrian: 'loading' | 'ready' | 'failed';
  visibleBuses: number; visiblePedestrians: number;
};

type BusInstance = { root: TransformNode };
type PedInstance = { root: TransformNode; clips: AnimationGroup[]; current: 'Idle' | 'Walk' | null };

function copyInstance(scene: Scene, container: AssetContainer, name: string): { root: TransformNode; clips: AnimationGroup[] } {
  const entries = container.instantiateModelsToScene((source) => `${name}-${source}`, false);
  const root = new TransformNode(name, scene);
  for (const node of entries.rootNodes) node.parent = root;
  root.setEnabled(false);
  return { root, clips: entries.animationGroups };
}

export class PatchPilot {
  private busSource: AssetContainer | null = null;
  private pedestrianSource: AssetContainer | null = null;
  private readonly buses: BusInstance[] = [];
  private pedestrian: PedInstance | null = null;
  private busState: PatchPilotState['bus'] = 'loading';
  private pedState: PatchPilotState['pedestrian'] = 'loading';
  private activeBuses = 0;
  private activePed = 0;

  constructor(private readonly scene: Scene) {}

  /** Downloads only when the query flag requests this experiment. Models load independently. */
  async load(): Promise<void> {
    await Promise.all([
      this.loadBus(),
      this.loadPedestrian(),
    ]);
  }

  private async loadBus(): Promise<void> {
    try {
      const model = await loadPatchPilotAsset(this.scene, 'city-bus-49fd97');
      this.busSource = model;
      for (let i = 0; i < 2; i++) {
        this.buses.push(copyInstance(this.scene, model, `patch-onibus-${i}`));
      }
      this.busState = 'ready';
    } catch (error) {
      this.busState = 'failed';
      console.warn('Teste Patch: ônibus GLB indisponível; mantendo o modelo CORE-014.', error);
    }
  }

  private async loadPedestrian(): Promise<void> {
    try {
      const model = await loadPatchPilotAsset(this.scene, 'woman');
      this.pedestrianSource = model;
      const copy = copyInstance(this.scene, model, 'patch-transeunte-animada');
      // The Patch anymove model has in-place Idle/Walk clips and is measured at 1.70m.
      // Root-motion variants are deliberately not played: simulation coordinates remain authoritative.
      if (!copy.clips.some((clip) => clip.name === 'Walk') || !copy.clips.some((clip) => clip.name === 'Idle')) {
        copy.root.dispose(false, false);
        throw new Error('Expected in-place Walk and Idle animation clips');
      }
      this.pedestrian = { ...copy, current: null };
      this.pedState = 'ready';
    } catch (error) {
      this.pedState = 'failed';
      console.warn('Teste Patch: NPC animada GLB indisponível; mantendo a personagem CORE-014.', error);
    }
  }

  get busReady(): boolean { return this.busState === 'ready'; }
  get pedestrianReady(): boolean { return this.pedState === 'ready'; }

  /** Existing traffic decides where the buses are. Patch changes only their render mesh. */
  syncBuses(vehicles: readonly Vehicle[], player: { x: number; z: number }, ground: (x: number, z: number) => number): void {
    if (!this.busReady) return;
    const visible = vehicles.filter((v) => v.active && v.kind === ('bus' as VehicleKind) &&
      Math.hypot(v.x - player.x, v.z - player.z) < 190).slice(0, this.buses.length);
    this.activeBuses = visible.length;
    this.buses.forEach((bus, i) => {
      const v = visible[i];
      bus.root.setEnabled(!!v);
      if (!v) return;
      bus.root.position.set(v.x, ground(v.x, v.z), v.z);
      bus.root.rotation.y = v.yaw;
    });
  }

  /** One nearest on-foot NPC is substituted; all other NPCs retain the original model and AI. */
  showPedestrian(p: { x: number; z: number; yaw: number; state: string }, groundY: number): void {
    if (!this.pedestrian) return;
    const actor = this.pedestrian;
    actor.root.setEnabled(true);
    actor.root.position.set(p.x, groundY, p.z);
    actor.root.rotation.y = p.yaw;
    this.activePed = 1;
    const desired = p.state === 'walk' || p.state === 'cross' ? 'Walk' : 'Idle';
    if (actor.current === desired) return;
    for (const clip of actor.clips) clip.stop();
    const clip = actor.clips.find((c) => c.name === desired);
    clip?.start(true);
    actor.current = desired;
  }

  hidePedestrian(): void {
    if (!this.pedestrian) return;
    this.pedestrian.root.setEnabled(false);
    this.activePed = 0;
  }

  /** Cleanup hook if the game scene is ever rebuilt during a preview session. */
  dispose(): void {
    this.buses.forEach(({ root }) => root.dispose(false, false));
    this.pedestrian?.root.dispose(false, false);
    this.busSource?.dispose();
    this.pedestrianSource?.dispose();
  }

  status(): PatchPilotState {
    return { requested: true, bus: this.busState, pedestrian: this.pedState,
      visibleBuses: this.activeBuses, visiblePedestrians: this.activePed };
  }
}
