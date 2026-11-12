import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { currentEnvironment } from './config/environment';
import { resolveGraphicsProfile, switchGraphicsProfile } from './config/graphics';
import type { MotionGuard } from './core/collision';
import { canMount, findDismountSpot } from './core/mounting';
import { MOTO, isMotoStopped } from './core/motorcyclePhysics';
import { heightAt } from './core/terrain';
import { IsometricCameraRig } from './features/camera/isometricCamera';
import { OcclusionFader } from './features/camera/occlusionFader';
import { GameInput, type Action } from './features/controls/input';
import { enableLandscapeButton } from './features/display/landscape';
import { disableWebLabPwa } from './features/display/disablePwa';
import { Motorcycle, PLAYER_LOOK } from './features/driving/motorcycle';
import { Hud, type HudMode } from './features/hud/hud';
import { Pedestrian } from './features/walking/pedestrian';
import { setupEnvironment } from './world/environment';
import { CURB_H, PARKED_PROP, SPAWN } from './world/layout';
import { buildTemporaryWorld } from './world/temporaryWorld';

/** Composition root: wires input → simulation → presentation. Game rules live in core/ and features/. */
function start(canvas: HTMLCanvasElement): void {
  const profile = resolveGraphicsProfile();
  const engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance' }, false);
  const applyResolution = () => {
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio));
    engine.resize();
  };
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  const environment = setupEnvironment(scene, profile);
  const world = buildTemporaryWorld(scene, profile);
  const ground = (x: number, z: number) => heightAt(x, z, world.raised);

  const moto = new Motorcycle(scene, world.materials, PLAYER_LOOK, SPAWN.x, SPAWN.z, SPAWN.yaw, ground(SPAWN.x, SPAWN.z));
  const parkedProp = new Motorcycle(scene, world.materials, { paint: '#1f6a45', box: '#d2cdbf', helmet: '#222' },
    PARKED_PROP.x, PARKED_PROP.z, PARKED_PROP.yaw, CURB_H, { withRider: false, static: true });
  const walker = new Pedestrian(scene, world.materials, PLAYER_LOOK.helmet);
  for (const mesh of [...world.shadowCasters, ...moto.meshes, ...parkedProp.meshes, ...walker.meshes]) {
    environment.shadows.addShadowCaster(mesh, false);
  }

  // On foot, the parked bike is solid too.
  const walkerGuard: MotionGuard = (x, z, r) => {
    if (!world.guard(x, z, r)) return false;
    const s = moto.state;
    const ox = Math.sin(s.yaw) * MOTO.bodyOffset;
    const oz = Math.cos(s.yaw) * MOTO.bodyOffset;
    const reach = r + MOTO.bodyRadius - 0.08;
    return Math.hypot(x - s.x - ox, z - s.z - oz) > reach && Math.hypot(x - s.x + ox, z - s.z + oz) > reach
      && Math.hypot(x - s.x, z - s.z) > reach;
  };

  const hud = new Hud(document);
  hud.setVersion(currentEnvironment.version, currentEnvironment.name);
  hud.setGraphics(profile.name);
  let mode: HudMode = 'riding';

  const toggleMount = (): void => {
    if (mode === 'riding') {
      if (!isMotoStopped(moto.state)) { hud.toast('Pare a moto para descer'); return; }
      const spot = findDismountSpot(moto.state, world.guard);
      if (!spot) { hud.toast('Sem espaço para descer aqui'); return; }
      moto.state.speed = 0;
      moto.state.steer = 0;
      const seat = moto.seatPosition();
      moto.setRidden(false);
      walker.place(spot.x, spot.z, moto.state.yaw, ground(spot.x, spot.z), seat);
      walker.root.setEnabled(true);
      mode = 'walking';
    } else {
      if (!canMount(walker.state, moto.state)) { hud.toast('Chegue mais perto da moto'); return; }
      walker.root.setEnabled(false);
      // Which side of the bike the rider gets on from (visual only).
      const m = moto.state;
      const side = (walker.state.x - m.x) * Math.cos(m.yaw) - (walker.state.z - m.z) * Math.sin(m.yaw) < 0 ? -1 : 1;
      moto.setRidden(true, side);
      mode = 'riding';
    }
    // Held keys never carry over from one body to the other.
    input.reset();
  };
  const onAction = (action: Action): void => {
    if (action === 'mount') toggleMount();
    else switchGraphicsProfile(profile);
  };
  const input = new GameInput(document, onAction);

  const startFocus = new Vector3(SPAWN.x, 1, SPAWN.z);
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 520;
  const rig = new IsometricCameraRig(scene, canvas, startFocus, narrow ? 15 : 18);
  const fader = new OcclusionFader(world.occluders);
  const cameraTarget = new Vector3();
  const playerCentre = new Vector3();
  const idle = { throttle: 0, brake: 0, steer: 0 };

  scene.onBeforeRenderObservable.add(() => {
    // Clamp the step so a hitch or a background tab cannot teleport anything.
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    const m = moto.state;
    if (mode === 'riding') {
      moto.update(dt, {
        throttle: input.isDown('accelerate') ? 1 : 0,
        brake: input.isDown('brake') ? 1 : 0,
        steer: input.steer(),
      }, world.guard, ground(m.x, m.z));
      const lead = m.speed * 0.28;
      cameraTarget.set(m.x + Math.sin(m.yaw) * lead, moto.root.position.y + 0.95, m.z + Math.cos(m.yaw) * lead);
      playerCentre.set(m.x, moto.root.position.y + 1.0, m.z);
    } else {
      moto.update(dt, idle, world.guard, ground(m.x, m.z));
      const w = walker.state;
      walker.update(dt, input.walkingAxes(),
        rig.viewYaw, walkerGuard, ground(w.x, w.z));
      cameraTarget.set(w.x, walker.root.position.y + 1.05, w.z);
      playerCentre.copyFrom(cameraTarget);
    }
    rig.update(dt, cameraTarget, input.axis('camera-right', 'camera-left'), input.axis('zoom-out', 'zoom-in'));
    fader.update(dt, rig.camera.position, playerCentre);
    environment.focusShadows(playerCentre.x, playerCentre.z);
    const available = mode === 'riding' ? isMotoStopped(m) : canMount(walker.state, m);
    hud.update(mode, mode === 'riding' ? Math.abs(m.speed) * 3.6 : 0, engine.getFps(), available);
  });

  applyResolution();
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', applyResolution);
  window.addEventListener('orientationchange', applyResolution);
  new ResizeObserver(() => engine.resize()).observe(canvas);

  if (import.meta.env.DEV) {
    // Development-only aids for inspecting the scene; stripped from staging/production builds.
    Object.defineProperty(window, '__scene', { value: scene });
    Object.defineProperty(window, '__debug', {
      value: {
        teleport: (x: number, z: number, yaw: number) => Object.assign(moto.state, { x, z, yaw, speed: 0 }),
        camera: (alpha: number, beta: number, radius: number) => rig.debugSet(alpha, beta, radius),
      },
    });
  }

  // Read-only probe used by the browser smoke test (tests/e2e) and for manual debugging.
  Object.defineProperty(window, '__weblab', {
    value: Object.freeze({
      snapshot: () => ({
        version: currentEnvironment.version,
        environment: currentEnvironment.name,
        graphics: profile.name,
        mode,
        moto: { ...moto.state, y: moto.root.position.y },
        walker: { ...walker.state, y: walker.root.position.y },
        camera: { alpha: rig.camera.alpha, beta: rig.camera.beta, radius: rig.camera.radius, target: rig.camera.target.asArray() },
        fadedBuildings: fader.fadedCount,
        fps: engine.getFps(),
        drawCalls: scene.getEngine()._drawCalls?.current ?? null,
        activeMeshes: scene.getActiveMeshes().length,
        renderSize: [engine.getRenderWidth(), engine.getRenderHeight()],
      }),
    }),
  });
}

function fail(message: string): void {
  const box = document.querySelector<HTMLElement>('#fatal');
  if (box) { box.textContent = message; box.hidden = false; }
}

// Deactivate the previous installation experiment without affecting other sites.
void disableWebLabPwa(window, import.meta.env.BASE_URL);
// Browser-only fullscreen/orientation is still optional and user initiated.
enableLandscapeButton(document, window.screen);

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
if (!canvas) throw new Error('Canvas #renderCanvas não encontrado');
try {
  start(canvas);
} catch (error) {
  console.error(error);
  fail('Não foi possível iniciar o gráfico 3D (WebGL) neste navegador. Atualize o navegador ou tente outro aparelho.');
}
