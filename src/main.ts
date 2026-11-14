import { DEPOT_SPOTS } from './core/delivery/workday';
import { depotPath, DEPOT_POINTS, depotFixtures, MOTO_PARKING } from './world/city/depotPlan';
import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
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
import { CURB_H, yawOf } from './world/layout';
import { STORES, depotWorld, depotYaw } from './world/city/cityPlan';
import { buildProbe, parkNear } from './world/city/testProbe';
import { HouseStreamer } from './features/city/houseStreamer';
import { buildTemporaryWorld } from './world/temporaryWorld';
import { cameraObstacles } from './world/cameraObstacles';
import { applyRoofTexture, populateExternalAssets, type ExternalStatus } from './world/externalAssets';
import { buildStreetFurniture } from './world/props';
import { BatchSet } from './world/geometry';
import { VirtualClock } from './core/city/clock';
import { lightingAt } from './core/city/dayNight';
import { buildCityLife } from './features/city/cityLife';
import { Minimap } from './features/hud/minimap';
import { DeliveryGame, trunkSpot, type BikeSpot } from './features/delivery/deliveryGame';

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
  // CORE-015: the shift starts at the motorcycle bays of the depot, on its real block.
  const bay = depotWorld(84, -111);
  const SPAWN = { x: bay.x, z: bay.z, yaw: depotYaw(0) };
  const propBay = depotWorld(87, -111);
  const PARKED_PROP = { x: propBay.x, z: propBay.z, yaw: depotYaw(0) };

  const moto = new Motorcycle(scene, world.materials, PLAYER_LOOK, SPAWN.x, SPAWN.z, SPAWN.yaw, ground(SPAWN.x, SPAWN.z));
  // CORE-015: detailed houses are streamed by sector around the player; far lots stay low-poly.
  const houses = new HouseStreamer(scene, world.materials, profile, profile.name === 'desktop' ? environment.shadows : null);
  houses.update(SPAWN.x, SPAWN.z, true);
  const parkedProp = new Motorcycle(scene, world.materials, { paint: '#1f6a45', box: '#d2cdbf', helmet: '#222' },
    PARKED_PROP.x, PARKED_PROP.z, PARKED_PROP.yaw, CURB_H, { withRider: false, static: true });
  const walker = new Pedestrian(scene, world.materials, PLAYER_LOOK.helmet);
  for (const mesh of [...world.shadowCasters, ...moto.meshes, ...parkedProp.meshes, ...walker.meshes]) {
    environment.shadows.addShadowCaster(mesh, false);
  }

  // CORE-011: real external models load in the background; a failed one falls back to procedural.
  let external: ExternalStatus | 'loading' = 'loading';
  const fallback = (id: string): void => {
    const set = new BatchSet();
    buildStreetFurniture(scene, set, world.materials, {
      planterBoxes: id === 'planter_box_02', lamps: id === 'street_lamp_01', flowers: false,
    });
    for (const mesh of set.build(`fallback-${id}`, scene)) environment.shadows.addShadowCaster(mesh, false);
  };
  const roof = applyRoofTexture(world.materials.roofTiles.material, profile.name === 'desktop', world.materials.roofTiles.tileU);
  void Promise.all([populateExternalAssets(scene, environment.shadows, profile.detailShadows, fallback), roof])
    .then(([status, roofApplied]) => { external = { ...status, roofTexture: roofApplied }; })
    .catch((error: unknown) => { console.error(error); external = { loaded: [], failed: [], instances: 0, triangles: 0 }; });

  // CORE-013: living city (traffic, pedestrians, signals) and the virtual clock driving the light.
  const cityLife = buildCityLife(scene, world.materials, profile, environment.shadows, (x, z) => world.guard(x, z, 0.3),
    new URLSearchParams(window.location.search).get('trafego') !== '0');
  const params = new URLSearchParams(window.location.search);
  const devTime = import.meta.env.DEV || params.get('devtime') === '1';
  const clock = new VirtualClock();
  const requestedHour = Number(params.get('hora'));
  if (devTime && params.has('hora') && Number.isFinite(requestedHour)) clock.setHour(requestedHour);
  let lighting = lightingAt(clock.hour);
  environment.applyLighting(lighting);
  let lightTimer = 0;
  let devSpeed = 1;
  /** Development only: a fixed overview camera for map comparisons (see __debug.view). */
  let freeView = false;
  const delivery = new DeliveryGame(scene, world.materials, profile, environment.shadows, world.shutters, (x, z) => world.guard(x, z, 0.45), undefined, import.meta.env.DEV && params.get('depotTest')==='partial'?3:2);
  let simTime = 0;
  // NPC vehicles are solid for the player; if one already overlaps (e.g. it was spawned there),
  // only the static world blocks so the player can always move away.
  let insideVehicle = false;
  const baseGuard: MotionGuard = (x, z, r) => world.guard(x, z, r) && (insideVehicle || !cityLife.blocks(x, z, r));
  const rideGuard: MotionGuard = (x, z, r) => baseGuard(x, z, r) && !delivery.doorBlocked(x, z, r, true, moto.state);

  // On foot, the parked bike is solid too.
  const walkerGuard: MotionGuard = (x, z, r) => {
    if (!baseGuard(x, z, r) || delivery.doorBlocked(x, z, r, false, walker.state)) return false;
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
  const minimap = new Minimap(document);
  let mode: HudMode = 'riding';
  if (devTime) {
    const panel = document.querySelector<HTMLElement>('#devtime');
    const speedButton = panel?.querySelector<HTMLElement>('[data-devtime="speed"]');
    if (panel) panel.hidden = false;
    const apply = (key: string) => {
      if (key === '+1') clock.setHour(Math.floor(clock.hour) + 1);
      else if (key === 'speed') { devSpeed = devSpeed === 1 ? 30 : 1; if (speedButton) speedButton.textContent = `×${devSpeed}`; }
      else clock.setHour(Number(key));
      lightTimer = 0;
    };
    panel?.addEventListener('click', (e) => { const k = (e.target as HTMLElement).dataset.devtime; if (k) apply(k); });
    document.addEventListener('keydown', (e) => { if (e.code === 'KeyT' && !e.repeat) apply('+1'); });
  }

  let stopsKey = '';
  const bikeSpot = (): BikeSpot => ({ x: moto.state.x, z: moto.state.z, yaw: moto.state.yaw, moving: !isMotoStopped(moto.state) });
  const toggleMount = (): void => {
    if (mode === 'riding') {
      if (!isMotoStopped(moto.state)) { hud.toast('Pare a moto para descer'); return; }
      const spot = findDismountSpot(moto.state, baseGuard);
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
      // CORE-015.1: nobody rides with parcels in the hands — they go in the top box first.
      if (delivery.workday.inHands().length) { hud.toast('Guarde os volumes no baú antes de montar'); return; }
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
  /** The one contextual button: a job interaction when one is at hand, otherwise mount/dismount. */
  const contextAction = (): void => {
    const here = mode === 'riding' ? { x: moto.state.x, z: moto.state.z, riding: true } : { x: walker.state.x, z: walker.state.z, riding: false };
    const job = delivery.action(clock.hour, here, bikeSpot());
    if (job?.available && job.run) {
      const msg = job.run();
      if (msg) hud.toast(msg);
      // Top box: the lid opens and the rider reaches in; the hands change halfway through.
      if (job.trunk) { moto.openTrunk(); walker.reachTrunk(); }
      // GFX-001C: every hand-over (counter, checker, customer's gate) plays the reach gesture.
      else walker.reachTrunk(0.5);
      return;
    }
    if (job && !job.available && mode === 'walking' && !canMount(walker.state, moto.state)) { hud.toast(job.label); return; }
    toggleMount();
  };
  const onAction = (action: Action): void => {
    if (action === 'pause') { hud.setPaused(!hud.paused); input.reset(); return; }
    if (hud.paused && action !== 'graphics') return;
    if (action === 'mount') contextAction();
    else if (action === 'graphics') switchGraphicsProfile(profile);
    else if (action === 'wait') {
      const w = delivery.waitOption(clock.hour);
      const still = mode === 'walking' || isMotoStopped(moto.state);
      if (w && still) { delivery.startWait(w.until); hud.toast(`${w.label}…`); }
      else if (w) hud.toast('Pare a moto para aguardar');
    }
  };
  const input = new GameInput(document, onAction);

  const startFocus = new Vector3(SPAWN.x, 1, SPAWN.z);
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 520;
  const rig = new IsometricCameraRig(scene, canvas, startFocus, narrow ? 15 : 18, cameraObstacles());
  rig.resetBehind(SPAWN.yaw, true);
  const fader = new OcclusionFader(world.occluders);
  const cameraTarget = new Vector3();
  const playerCentre = new Vector3();
  const idle = { throttle: 0, brake: 0, steer: 0 };

  scene.onBeforeRenderObservable.add(() => {
    // Clamp the step so a hitch or a background tab cannot teleport anything.
    // Paused: nothing advances (the scene keeps rendering behind the pause card).
    const dt = hud.paused ? 0 : Math.min(0.05, engine.getDeltaTime() / 1000);
    const m = moto.state;
    insideVehicle = mode === 'riding' ? cityLife.blocks(m.x, m.z, MOTO.bodyRadius) : cityLife.blocks(walker.state.x, walker.state.z, 0.3);
    if (mode === 'riding') {
      moto.update(dt, {
        throttle: input.isDown('accelerate') ? 1 : 0,
        brake: input.isDown('brake') ? 1 : 0,
        steer: input.steer(),
      }, rideGuard, ground(m.x, m.z));
      const lead = Math.min(0.5, Math.max(0, m.speed) * 0.07);
      cameraTarget.set(m.x + Math.sin(m.yaw) * lead, moto.root.position.y + 0.95, m.z + Math.cos(m.yaw) * lead);
      playerCentre.set(m.x, moto.root.position.y + 1.0, m.z);
    } else {
      moto.update(dt, idle, world.guard, ground(m.x, m.z));
      const w = walker.state;
      walker.update(dt, input.walkingAxes(),
        rig.viewYaw, walkerGuard, ground(w.x, w.z));
      // Over-the-shoulder: the target sits right of the character, relative to the view.
      const yaw = rig.viewYaw;
      playerCentre.set(w.x, walker.root.position.y + 1.35, w.z);
      cameraTarget.set(w.x + Math.cos(yaw) * 0.42, walker.root.position.y + 1.45, w.z - Math.sin(yaw) * 0.42);
    }
    if (!freeView) rig.update(dt, cameraTarget, input.axis('camera-right', 'camera-left'), input.axis('zoom-out', 'zoom-in'),
      mode === 'riding' ? m.yaw : walker.state.yaw, mode === 'riding');
    fader.update(dt, rig.camera.position, playerCentre);
    environment.focusShadows(playerCentre.x, playerCentre.z);
    // Virtual clock, light (twice a second, the sun moves slowly), city simulation, minimap.
    // Waiting for the routine (e.g. pickups at 12h) runs the clock faster; the scale is unchanged.
    clock.speedFactor = delivery.waiting !== null ? 24 : devSpeed;
    clock.advance(dt);
    simTime += dt;
    lightTimer -= dt;
    if (lightTimer <= 0) { lighting = lightingAt(clock.hour); environment.applyLighting(lighting); lightTimer = 0.5; }
    const player = mode === 'riding' ? { x: m.x, z: m.z, radius: 1.1 } : { x: walker.state.x, z: walker.state.z, radius: 0.45 };
    cityLife.update(dt, simTime, clock.hour, lighting.night, player, ground);
    houses.update(player.x, player.z);
    hud.setClock(clock.label, clock.isWorkday, lighting.night > 0.5);
    minimap.update(player.x, player.z, mode === 'riding' ? m.yaw : walker.state.yaw, performance.now());
    // Delivery job: shops, depot staff, customers, objective marker and contextual action.
    const here = mode === 'riding' ? { x: m.x, z: m.z, riding: true } : { x: walker.state.x, z: walker.state.z, riding: false };
    delivery.update(dt, clock.hour, cityLife.crowd, here, ground, () => false, bikeSpot());
    for (const msg of delivery.workday.events.splice(0)) hud.toast(msg);
    const objective = delivery.workday.objective(clock.hour, m);
    const progress = delivery.workday.progress();
    const wait = delivery.waiting === null ? delivery.waitOption(clock.hour) : null;
    hud.setObjective(objective.title, objective.detail,
      `Coletados ${progress.collected}/${delivery.workday.parcels.filter((p) => p.platform === 'LOJA').length} · Entregues ${progress.delivered}/${progress.total}`,
      delivery.waiting !== null ? 'Aguardando…' : wait?.label ?? null);
    minimap.setTarget(objective.target);
    minimap.setBike(mode === 'walking' ? m : null);
    const wd = delivery.workday;
    if (wd.phase === 'ENTREGAS') {
      if (stopsKey !== wd.route.join('|')) { stopsKey = wd.route.join('|'); minimap.setStops(wd.route.map((id, i) => ({ ...wd.byAddress.get(id)!.door, next: i === 0 }))); }
    } else if (stopsKey !== '') { stopsKey = ''; minimap.setStops([]); }
    hud.setCargo(wd.cargoLabel(), wd.inHands().length > 0);
    const far = objective.target ? Math.hypot(objective.target.x - player.x, objective.target.z - player.z) : 0;
    hud.setDistance(objective.target && far > 12 ? minimap.targetDistance() : null);
    walker.setLoad(delivery.workday.inHands().length, delivery.workday.sackInHands);
    moto.setLights(mode === 'riding' && input.isDown('brake') && m.speed > 0.2, lighting.night, dt);
    moto.setTrunkCargo(delivery.workday.inTrunk().length);
    const found = delivery.action(clock.hour, here, bikeSpot());
    // A blocked job hint never hides "Montar" when the rider can simply get on the bike.
    const job = found && (found.available || mode === 'riding' || !canMount(walker.state, m) || delivery.workday.inHands().length > 0) ? found : null;
    const label = job ? job.label : mode === 'riding' ? 'Descer' : 'Montar';
    const available = job ? job.available : mode === 'riding' ? isMotoStopped(m) : canMount(walker.state, m);
    hud.update(mode, mode === 'riding' ? Math.abs(m.speed) * 3.6 : 0, engine.getFps(), label, available);
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
        setHour: (hour: number) => { clock.setHour(hour); lightTimer = 0; },
        /** Puts the rider on foot at a spot (the bike stays where it is). */
        placeWalker: (x: number, z: number, yaw = 0) => {
          if (mode === 'riding') { moto.state.speed = 0; moto.setRidden(false); walker.root.setEnabled(true); mode = 'walking'; }
          walker.place(x, z, yaw, ground(x, z));
        },
        act: () => contextAction(),
        view: (alpha: number, beta: number, radius: number, x: number, z: number) => {
          freeView = true;
          Object.assign(rig.camera, { alpha, beta, radius });
          rig.camera.target.set(x, 0, z);
          rig.camera.maxZ = 5000;
          scene.fogEnabled = false;
          scene.getMeshByName('ceu-domo')?.setEnabled(false);
        },
        endView: () => { freeView = false; rig.camera.maxZ = 2000; scene.fogEnabled = true; scene.getMeshByName('ceu-domo')?.setEnabled(true); },
        wait: () => onAction('wait'),
        /** CORE-015 fixtures for tests/e2e on the real map (depot transform, a junction, a lot). */
        probe: () => { const p = buildProbe(); return { junction: p.junction, lot: p.lot }; },
        depot: (x: number, z: number) => depotWorld(x, z),
        depotLocal: (x: number, z: number) => buildProbe().depotLocal(x, z),
        depotYaw: (yaw: number) => depotYaw(yaw),
        depotPlan:()=>({spots:DEPOT_SPOTS,local:DEPOT_POINTS,fixtures:depotFixtures(),parking:MOTO_PARKING}),
        depotPath:(from:{x:number;z:number},to:{x:number;z:number})=>depotPath(from,to),
        depotGate:(open:boolean|null)=>{delivery.gateManual=open},
        canStand:(x:number,z:number,r=.35,riding=false)=>world.guard(x,z,r)&&!delivery.doorBlocked(x,z,r,riding,{x,z}),
        /** Deterministic test clock: executes real work in bounded steps, never edits parcels. */
        processDepot:(seconds:number)=>{for(let t=0;t<Math.min(seconds,1);t+=.05)delivery.workday.update(clock.hour,.05)},
        minimapBase: () => minimap.baseImage(),
        /** CORE-015.1: parks the bike at the kerb nearest to a spot (the rider stays where it is). */
        parkNear: (x: number, z: number) => { const p = parkNear(x, z); Object.assign(moto.state, { ...p, speed: 0, steer: 0 }); return p; },
        parkAt: (x: number, z: number, yaw: number) => Object.assign(moto.state, { x, z, yaw, speed: 0, steer: 0 }),
      },
    });
  }

  // GFX-001 scene metrics (draw calls, frame/render time): only in development or with ?perf=1.
  const instrumentation = import.meta.env.DEV || new URLSearchParams(window.location.search).get('perf') === '1' ? new SceneInstrumentation(scene) : null;
  if (instrumentation) { instrumentation.captureFrameTime = true; instrumentation.captureRenderTime = true; }

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
        camera: { mode: rig.mode, alpha: rig.camera.alpha, beta: rig.camera.beta, radius: rig.camera.radius, target: rig.camera.target.asArray() },
        fadedBuildings: fader.fadedCount,
        clock: { label: clock.label, hour: clock.hour, workday: clock.isWorkday, night: lighting.night, devTime, speed: clock.speedFactor },
        delivery: {
          depot:{gateOpen:delivery.gateOpen,gateManual:delivery.gateManual,visibleIds:[...delivery.parcelViews.visibleIds],workers:delivery.workday.depot.workers.map(w=>({...w,task:w.task?{id:w.task.id,kind:w.task.kind,stage:w.task.stage}:null})),errors:[...delivery.workday.depot.errors]},
          phase: delivery.workday.phase,
          objective: delivery.workday.objective(clock.hour, moto.state),
          cargo: { hands: delivery.workday.inHands().length, trunk: delivery.workday.inTrunk().length, sack: delivery.workday.sackInHands, label: delivery.workday.cargoLabel(), trunkOpen: moto.trunkOpen, trunkSpot: trunkSpot(bikeSpot()) },
          progress: delivery.workday.progress(),
          assigned: [...delivery.workday.assigned],
          route: [...delivery.workday.route],
          parcels: delivery.workday.parcels.map((p) => ({ id: p.id, state: p.state, place: p.place, holder: p.holder, origin: p.origin, destination: p.destination, platform: p.platform, region: p.region, position:p.position?{...p.position}:null,dock:p.dock,load:p.load,history:p.history.map(e=>({...e})) })),
          staff: delivery.workday.staff.map((st) => ({ role: st.role, state: st.state })),
          stores: [...delivery.stores].map(([id, st]) => ({ id, employee: st.ops.employee, shutter: st.ops.shutter, queue: st.ops.queue.length, served: st.ops.served, pickup: st.layout.pickup, facing: yawOf(STORES.find((q) => q.id === id)!.frame) })),
          addresses: delivery.workday.addresses.length,
          action: delivery.action(clock.hour, mode === 'riding' ? { x: moto.state.x, z: moto.state.z, riding: true } : { x: walker.state.x, z: walker.state.z, riding: false }, bikeSpot())?.label ?? null,
          waiting: delivery.waiting,
        },
        paused: hud.paused,
        city: cityLife.stats(),
        houses: houses.stats(),
        minimap: { expanded: minimap.isExpanded, arrow: minimap.arrowAt(), ...minimap.state(), distance: minimap.targetDistance() },
        externalAssets: external,
        fps: engine.getFps(),
        perf: instrumentation ? {
          drawCalls: instrumentation.drawCallsCounter.current,
          frameMs: Math.round(instrumentation.frameTimeCounter.lastSecAverage * 10) / 10,
          renderMs: Math.round(instrumentation.renderTimeCounter.lastSecAverage * 10) / 10,
          triangles: Math.round(scene.getActiveIndices() / 3),
          memoryMb: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory ? Math.round((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1048576) : null,
        } : null,
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
