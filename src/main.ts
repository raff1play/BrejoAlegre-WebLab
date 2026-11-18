import { LogisticsPanel } from './features/hud/logisticsPanel';
import { calendarDay,nextWorkday } from './core/delivery/operatingCalendar';
import type { CareerBoot } from './core/career/careerBoot';
import { enterCareer, menuModel } from './core/career/careerMenu';
import { runMainMenu } from './features/career/mainMenu';
import { careerLook } from './features/career/characterPresets';
import { CareerStore, browserStorage } from './core/career/careerStore';
import { acquireGameLock, type GameLock } from './features/career/tabLock';
import { ShiftCheckpointer, closeShiftAtHome, closureState, homeClosureCheck, restoreShift, type ShiftCapture } from './core/career/shiftCheckpoint';
import { formatCents, ledgerTotal } from './core/career/ledger';
import { CHARACTERS, CAREER_IDS, careerHome } from './core/career/careers';
import { isVehicleKind, type VehicleKind } from './core/career/careers';
import { CAR, carFits, carToWorld, isCarStopped } from './core/carPhysics';
import { PlayerCar } from './features/driving/playerCar';
import { CarCargoView } from './features/driving/carCargo';
import { CarTrunk, type Arrangement } from './core/delivery/carTrunk';
import { canonicalJson, parseSave, sealSave, vehicleIdOf } from './core/career/snapshot';
import { captureShift } from './core/career/shiftCheckpoint';
import { carVehicle, motoVehicle, type PlayerVehicle } from './features/driving/playerVehicle';
import { askVehicle } from './features/career/vehicleChoice';
import { DEPOT_SPOTS, HANDS_MAX, depotVisitAllowed } from './core/delivery/workday';
import { depotPath, DEPOT_POINTS, depotFixtures, MOTO_PARKING, CAR_PARKING, depotCarBay } from './world/city/depotPlan';
import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { currentEnvironment } from './config/environment';
import { graphicsChoice, resolveGraphicsProfile, saveGraphicsPreference, switchGraphicsProfile } from './config/graphics';
import type { MotionGuard } from './core/collision';
import { MOTO } from './core/motorcyclePhysics';
import { heightAt } from './core/terrain';
import { IsometricCameraRig } from './features/camera/isometricCamera';
import { OcclusionFader } from './features/camera/occlusionFader';
import { GameInput, type Action } from './features/controls/input';
import { enableLandscapeButton } from './features/display/landscape';
import { disableWebLabPwa } from './features/display/disablePwa';
import { Motorcycle, PLAYER_LOOK } from './features/driving/motorcycle';
import { Hud, type HudMode } from './features/hud/hud';
import { baseSummary, hudContext, inDepotLot, progressSummary } from './features/hud/hudContext';
import { Pedestrian } from './features/walking/pedestrian';
import { setupEnvironment } from './world/environment';
import { yawOf } from './world/layout';
import { STORES, depotWorld, depotYaw, depotLocal } from './world/city/cityPlan';
import { buildProbe, parkNear } from './world/city/testProbe';
import { HouseStreamer } from './features/city/houseStreamer';
import { buildTemporaryWorld } from './world/temporaryWorld';
import { cameraObstacles } from './world/cameraObstacles';
import { courierTrafficObstacles } from './core/delivery/couriers';
import { applyRoofTexture, populateExternalAssets, type ExternalStatus } from './world/externalAssets';
import { buildStreetFurniture } from './world/props';
import { BatchSet } from './world/geometry';
import { VirtualClock } from './core/city/clock';
import { lightingAt } from './core/city/dayNight';
import { buildCityLife } from './features/city/cityLife';
import { KIT_ASSETS } from './config/kitAssets';
import { populateKitProps, type KitStatus } from './world/kitAssets';
import { buildStreetLights } from './world/city/cityBuild';
import { Minimap } from './features/hud/minimap';
import { DeliveryGame, trunkSpot, type BikeSpot } from './features/delivery/deliveryGame';

/** Composition root: wires input → simulation → presentation. Game rules live in core/ and features/. */
type BrowserCareer = { career: CareerBoot; storage: ReturnType<typeof browserStorage>; vehicle: VehicleKind; note: string | null; lock: GameLock };

/**
 * B1-01 F3.5: the main menu comes FIRST, before any engine, city, traffic or clock exists. Reading
 * the four cards never writes; the chosen career is written once, on confirmation (presets and —
 * only when none is saved — the one-time vehicle, decisions 5–6). The world is then built with
 * the vehicle and the presets that are actually in that career's save.
 * `?veiculo=moto-antiga|carro-antigo` still preselects the one-time vehicle, in development only.
 */
async function bootBrowserCareer(): Promise<BrowserCareer> {
  const params = new URLSearchParams(window.location.search);
  const devTime = import.meta.env.DEV || params.get('devtime') === '1';
  const storage = browserStorage();
  // B1-01 F6: one game tab writes the saves; a second tab opens the menu read-only.
  const lock = await acquireGameLock(window, storage.storage, storage.durable);
  let entered: CareerBoot | null = null;
  const requested = params.get('veiculo');
  await runMainMenu(document, menuModel(storage.storage, storage.durable), {
    askVehicle: (name) => (devTime && isVehicleKind(requested) ? Promise.resolve(requested) : askVehicle(document, name)),
    enter: (careerId, choice) => { entered = enterCareer(storage.storage, careerId, choice); },
    refresh: () => menuModel(storage.storage, storage.durable),
    graphics: { choice: graphicsChoice, save: saveGraphicsPreference },
    lock,
    saves: new CareerStore(storage.storage),
  });
  const career = entered as CareerBoot | null;
  if (!career) throw new Error('Carreira não carregada');
  const vehicle = career.session.profile.vehicle?.kind;
  if (!vehicle) throw new Error('Carreira sem veículo gravado');
  return { career, storage, vehicle, lock, note: storage.durable ? null : 'Armazenamento indisponível: progresso desta sessão não será salvo' };
}

function start(canvas: HTMLCanvasElement, boot: BrowserCareer): void {
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
  const carSpawn = (): { x: number; z: number; yaw: number } => {
    // B1-01 F2: the car starts in a painted car bay of the depot, nose towards the vehicle gate.
    const gate = depotWorld(106, -92.3);
    for (const r of [CAR_PARKING[1]!, CAR_PARKING[0]!, CAR_PARKING[2]!]) {
      const c = depotWorld((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2);
      const yaws = [depotYaw(0), depotYaw(Math.PI)].sort((a, b) =>
        Math.hypot(c.x + Math.sin(a) - gate.x, c.z + Math.cos(a) - gate.z) - Math.hypot(c.x + Math.sin(b) - gate.x, c.z + Math.cos(b) - gate.z));
      for (const yaw of yaws) if (carFits(world.guard, c.x, c.z, yaw)) return { ...c, yaw };
    }
    return { x: bay.x, z: bay.z, yaw: depotYaw(0) };
  };
  // B1-01 F6: an open shift with a saved world resumes at its last safe point (vehicle pose included).
  const openShift = boot.career.session.save.shift;
  const savedWorld = openShift?.world ?? null;
  const savedPose = savedWorld?.player.vehicle ?? null;
  const poseFits = (p: { x: number; z: number; yaw: number }): boolean => boot.vehicle === 'carro-antigo'
    ? carFits(world.guard, p.x, p.z, p.yaw)
    : world.guard(p.x + Math.sin(p.yaw) * MOTO.bodyOffset, p.z + Math.cos(p.yaw) * MOTO.bodyOffset, MOTO.bodyRadius) && world.guard(p.x - Math.sin(p.yaw) * MOTO.bodyOffset, p.z - Math.cos(p.yaw) * MOTO.bodyOffset, MOTO.bodyRadius);
  const restoredPoseOk = savedPose !== null && poseFits(savedPose);
  const SPAWN = restoredPoseOk ? { ...savedPose! } : boot.vehicle === 'carro-antigo' ? carSpawn() : { x: bay.x, z: bay.z, yaw: depotYaw(0) };

  // B1-01 F2: only the career's own vehicle exists in the world (no spare motorcycle beside a car).
  // B1-01 F3.5: the career's saved presets dress the player on the bike, on foot and in the car.
  const look = careerLook(boot.career.session.profile.appearance, boot.career.session.profile.equipment);
  const moto = boot.vehicle === 'moto-antiga' ? new Motorcycle(scene, world.materials, PLAYER_LOOK, SPAWN.x, SPAWN.z, SPAWN.yaw, ground(SPAWN.x, SPAWN.z), { riderLook: look }) : null;
  const car = moto ? null : new PlayerCar(scene, world.materials, SPAWN.x, SPAWN.z, SPAWN.yaw, ground(SPAWN.x, SPAWN.z), undefined, look);
  car?.setDriven(true);
  const vehicle: PlayerVehicle = moto ? motoVehicle(moto) : carVehicle(car!);
  // B1-01 F3: the car's boot works on the shared parcel list; its 3D boxes only mirror that list.
  const trunk = car ? new CarTrunk(boot.career.session.profile.vehicle?.vehicleId ?? vehicleIdOf(boot.career.session.careerId)) : null;
  const cargoView = car && trunk ? new CarCargoView(scene, car.cargoParent, trunk.vehicleId) : null;
  // CORE-015: detailed houses are streamed by sector around the player; far lots stay low-poly.
  const houses = new HouseStreamer(scene, world.materials, profile, profile.name === 'desktop' ? environment.shadows : null);
  houses.update(SPAWN.x, SPAWN.z, true);

  const walker = new Pedestrian(scene, world.materials, look.helmet, look);
  for (const mesh of [...world.shadowCasters, ...vehicle.meshes,  ...walker.meshes]) {
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
  // EXPERIMENTO kit (branch isolada): postes e placas de PARE da Kenney; carros GLB ficam em cityLife.
  let kit: KitStatus | 'loading' | 'off' = KIT_ASSETS ? 'loading' : 'off';
  if (KIT_ASSETS) {
    void populateKitProps(scene, environment.shadows, profile.detailShadows, cityLife.stopSigns, () => {
      const set = new BatchSet();
      buildStreetLights(set, world.materials, scene);
      for (const mesh of set.build('fallback-postes', scene)) environment.shadows.addShadowCaster(mesh, false);
    }).then((s) => { kit = s; }).catch((error: unknown) => { console.error(error); kit = { loaded: [], failed: ['kit'], instances: 0 }; });
  }
  const params = new URLSearchParams(window.location.search);
  const devTime = import.meta.env.DEV || params.get('devtime') === '1';
  const clock = new VirtualClock();
  const requestedHour = Number(params.get('hora'));
  if (devTime && params.has('hora') && Number.isFinite(requestedHour) && !openShift) clock.setHour(requestedHour);
  // The shift clock never goes back (also for an open shift saved before its world existed).
  if (openShift) clock.setShiftHour(openShift.shiftHour);
  let lighting = lightingAt(clock.hour);
  environment.applyLighting(lighting);
  let lightTimer = 0;
  let devSpeed = 1;
  // The game calendar is independent from the phone's local clock. An explicit dev seed
  // preserves the LOG-003 regression scenario unless a test also selects ?dia=N.
  // B1-01 F1: the day comes from the ACTIVE career's own save (legacy index migrated, never deleted).
  const careerStorage=boot.storage;
  const career=boot.career;
  for(const note of career.notes)console.info(`[carreira] ${note}`);
  if(!careerStorage.durable)console.warn('[carreira] armazenamento local indisponível: progresso não será persistido');
  const savedDay=career.calendarIndex;
  const queryDay=Number(params.get('dia'));
  // B1-01 F6: an open shift is always resumed on ITS day (development ?dia/?seed are ignored then).
  const dayIndex=openShift?openShift.calendarIndex:import.meta.env.DEV&&params.has('seed')&&!params.has('dia')?undefined:
   devTime&&params.has('dia')&&Number.isSafeInteger(queryDay)&&queryDay>=0&&queryDay<=36500?queryDay:savedDay;
  /** Checkpoints only for the career's real day (a development day/seed override is never saved). */
  const persistent=careerStorage.durable&&dayIndex===career.session.profile.calendarIndex;
  const day=dayIndex===undefined?null:calendarDay(dayIndex);
  /** Development only: a fixed overview camera for map comparisons (see __debug.view). */
  let freeView = false;
  const delivery = new DeliveryGame(scene, world.materials, profile, environment.shadows, world.shutters, (x, z) => world.guard(x, z, 0.45), !openShift&&import.meta.env.DEV&&params.has('seed')?Number(params.get('seed')):undefined, import.meta.env.DEV && params.get('depotTest')==='partial'?3:2,dayIndex,career.roster);
  const resumed = openShift ? restoreShift(delivery.workday, openShift) : false;
  if (resumed) delivery.restoreStores(clock.shiftHour);
  /** B1-01 F6 (AC-20): the couriers' states right after the restore (before the world moves on). */
  const resumedCouriers = resumed ? delivery.workday.couriers.map((c) => ({ id: c.id, state: c.state, bike: { ...c.bike } })) : null;
  const home = careerHome(career.session.careerId);
  delivery.workday.homeTarget = { x: home.door.x, z: home.door.z, label: home.street };
  let simTime = 0;
  // NPC vehicles are solid for the player; if one already overlaps (e.g. it was spawned there),
  // only the static world blocks so the player can always move away.
  let insideVehicle = false;
  const baseGuard: MotionGuard = (x, z, r) => world.guard(x, z, r) && (insideVehicle || !cityLife.blocks(x, z, r));
  /** B1-01 F6: after the shift was closed at home, back to the main menu (next day or another career). */
  const toMenu=():void=>{
    const url=new URL(window.location.href);
    for(const key of ['seed','dia','hora','devtime','trafego','veiculo'])url.searchParams.delete(key);
    window.location.assign(url.toString());
  };
  const logisticsPanel=new LogisticsPanel(document,delivery.workday,()=>clock.shiftHour,()=>{hud.setPaused(false);input.reset()},day,()=>{
    if(delivery.workday.closedAtHome!==null)toMenu();
  });
  const rideGuard: MotionGuard = (x, z, r) => baseGuard(x, z, r) && !delivery.doorBlocked(x, z, r, true, vehicle.view);

  // On foot, the parked vehicle is solid too (bike circles; car oriented rectangle).
  const walkerGuard: MotionGuard = (x, z, r) => {
    if (!baseGuard(x, z, r) || delivery.doorBlocked(x, z, r, false, walker.state)) return false;
    return !vehicle.blocksPerson(x, z, r);
  };

  const hud = new Hud(document);
  hud.setVersion(currentEnvironment.version, currentEnvironment.name);
  hud.setGraphics(profile.name);
  hud.setVehicle(vehicle.kind, vehicle.words.driving, vehicle.words.tip);
  const minimap = new Minimap(document);
  minimap.playerSector = delivery.workday.playerSector;
  let mode: HudMode = 'riding';
  if (devTime) {
    const panel = document.querySelector<HTMLElement>('#devtime');
    const speedButton = panel?.querySelector<HTMLElement>('[data-devtime="speed"]');
    if (panel) panel.hidden = false;
    const apply = (key: string) => {
      if (key === '+1') clock.setShiftHour(Math.floor(clock.shiftHour) + 1);
      else if (key === 'speed') { devSpeed = devSpeed === 1 ? 30 : 1; if (speedButton) speedButton.textContent = `×${devSpeed}`; }
      else clock.setHour(Number(key));
      lightTimer = 0;
    };
    panel?.addEventListener('click', (e) => { const k = (e.target as HTMLElement).dataset.devtime; if (k) apply(k); });
    document.addEventListener('keydown', (e) => { if (e.code === 'KeyT' && !e.repeat) apply('+1'); });
  }

  let stopsKey = '';
  /** Development only: show the player's real stops on the map before the delivery phase. */
  let stopsPreview = false;
  const bikeSpot = (): BikeSpot => ({ x: vehicle.view.x, z: vehicle.view.z, yaw: vehicle.view.yaw, moving: !vehicle.stopped(), kind: car ? 'carro' : 'moto' });
  // B1-01 F4: the delivery domain words its objectives for the career's own vehicle.
  delivery.workday.vehicleKind = vehicle.kind;
  /** B1-01 F2: depot car bay the parked car occupies (its four corners inside the paint), or null. */
  const carBay = (): number | null => {
    if (!car) return null;
    const s = car.state; const hw = CAR.width / 2; const hl = CAR.length / 2;
    const corners = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([r, f]) => { const p = carToWorld(s, r!, f!); return depotLocal(p.x, p.z); });
    return depotCarBay(corners, !isCarStopped(s));
  };
  const canEnter = (): boolean => vehicle.enterSide(walker.state) !== null;
  /** B1-01 F3: standing right behind the car (within reach of the boot opening). */
  const atCarRear = (p: { x: number; z: number }): boolean => {
    if (!car) return false;
    const s = car.state; const dx = p.x - s.x; const dz = p.z - s.z; const c = Math.cos(s.yaw); const n = Math.sin(s.yaw);
    const right = dx * c - dz * n; const forward = dx * n + dz * c;
    return Math.abs(right) < 0.95 && forward < -CAR.length / 2 + 0.05 && forward > -CAR.length / 2 - 1.5;
  };
  const trunkParked = (): boolean => !!car && car.state.parked && isCarStopped(car.state);
  /** Dry run of the automatic arrangement for the parcels in the hands (cached: labels ask every frame). */
  let planKey = ''; let planCache: Arrangement | null = null;
  const trunkPlan = (): Arrangement => {
    const wd = delivery.workday;
    const key = [...wd.inHands().map((p) => p.id), '|', ...wd.inCarBoot().map((p) => `${p.id}@${p.stowage!.x},${p.stowage!.y},${p.stowage!.z}`)].join(' ');
    if (key !== planKey || !planCache) { planKey = key; planCache = trunk!.plan(wd.parcels); }
    return planCache;
  };
  const closeTrunk = (): string => { trunk!.setOpen(false); car!.setTrunkOpen(false); return 'Porta-malas fechado'; };
  /**
   * B1-01 F3: the boot of the parked car. Open/close, and put what is in the hands inside with the
   * automatic arrangement; a volume with no room is refused and stays in the hands.
   */
  const trunkJob = (here: { x: number; z: number; riding: boolean }) => {
    if (!car || !trunk || here.riding || !atCarRear(here)) return null;
    if (!trunkParked()) return { label: 'Estacione o carro para abrir o porta-malas', available: false, run: null };
    const hands = delivery.workday.inHands().length;
    if (!trunk.open) return { label: 'Abrir porta-malas', available: true, run: () => { trunk.setOpen(true); car.setTrunkOpen(true); return null; } };
    const wd = delivery.workday;
    if (!hands) {
      // B1-01 F4 (AC-09): at the base, collected volumes come out of the boot towards the desk.
      const visit = { player: { x: here.x, z: here.z, riding: false }, bike: { ...bikeSpot() }, car: true };
      const forDepot = wd.carForDepot().length;
      // A failed attempt may stay in the boot while the OTHER addresses are still on the route.
      // Only offer depot-specific parking guidance inside the base. Outside, keep the normal
      // route action below available (AC-10/11: never block later deliveries).
      const dp = depotLocal(car.state.x, car.state.z);
      const insideDepot = dp.x > 76.4 && dp.x < 139.6 && dp.z < -92.5 && dp.z > -149.8;
      if (forDepot && insideDepot && !wd.sackInHands) {
        // Do not silently fall through to "Fechar porta-malas" outside a valid car bay.
        if (carBay() === null) return { label: 'Vaga inválida: pare o carro inteiro na vaga amarela', available: false, run: null };
        if (!depotVisitAllowed(visit, 'parking')) return { label: 'Fique atrás do carro na vaga de descarga', available: false, run: null };
        return { label: `Retirar do porta-malas (${Math.min(forDepot, HANDS_MAX)})`, available: true, trunk: true, run: () => `${wd.unloadCarForDepot(trunk, clock.shiftHour, visit)} nas mãos — leve ao recebimento` };
      }
      // B1-01 F4 (AC-10): on the route, the parcels of the nearest stop come out of the boot.
      if (wd.released && wd.carForRoute().length) {
        const stop = delivery.nearestStop(car.state, wd.carForRoute());
        if (stop && stop.d < 60) {
          const a = stop.address;
          return { label: `Retirar pacote · nº ${a.number}`, available: true, trunk: true, run: () => (wd.takeFromCarForAddress(trunk, a.id, clock.shiftHour, trunkParked()) ? `Pacote de ${a.street}, ${a.number} nas mãos` : 'Pacote não retirado') };
        }
      }
      return { label: 'Fechar porta-malas', available: true, run: closeTrunk };
    }
    const fit = trunkPlan().accepted.length;
    if (!fit) return { label: 'Fechar porta-malas (cheio)', available: true, run: () => `${closeTrunk()} · sem espaço: ${hands} ${hands === 1 ? 'volume continua' : 'volumes continuam'} nas mãos` };
    return {
      label: `Guardar no porta-malas (${fit})`, available: true, trunk: true,
      run: () => {
        const r = trunk.stow(delivery.workday.parcels, clock.shiftHour, { parked: trunkParked() });
        if (r.refused) return r.refused;
        // Same as the motorcycle top box: once the hands are empty, no sack is being carried.
        if (!delivery.workday.inHands().length) delivery.workday.sackInHands = false;
        const kept = r.rejected.length ? ` · sem espaço: ${r.rejected.length} ${r.rejected.length === 1 ? 'continua' : 'continuam'} nas mãos` : '';
        return `${r.stowed.length} ${r.stowed.length === 1 ? 'volume guardado' : 'volumes guardados'} no porta-malas${kept}`;
      },
    };
  };
  /** B1-01 F6: what a checkpoint records of the running world right now. */
  const captureNow = (): ShiftCapture => ({
    day: delivery.workday, shiftHour: clock.shiftHour, vehicle: vehicle.kind,
    player: { mode: mode === 'riding' ? 'riding' : 'walking', walker: { x: walker.state.x, z: walker.state.z, yaw: walker.state.yaw }, vehicle: { x: vehicle.view.x, z: vehicle.view.z, yaw: vehicle.view.yaw } },
  });
  const checkpoints = new ShiftCheckpointer(career.session, captureNow, { enabled: persistent });
  let saveWarned = false;
  checkpoints.onResult = (ok, st) => {
    if (ok) { saveWarned = false; return; }
    if (!saveWarned) { saveWarned = true; hud.toast(st.stale ? 'Save alterado por outra aba: este jogo não grava mais — recarregue' : `Checkpoint NÃO gravado (${st.error}) — nova tentativa em instantes`); }
  };
  if (resumed && openShift) checkpoints.resumedFrom(openShift, delivery.workday, career.session.save.checkpointSequence);
  /**
   * B1-01 F6 (contract C4): once every parcel of the four couriers is resolved, the shift is closed
   * by a minimum interaction at the door of the career's OWN home, with the vehicle parked nearby
   * (B1-09 expands it). Neither 21h nor the last delivery closes anything.
   */
  const homeJob = (here: { x: number; z: number; riding: boolean }) => {
    const wd = delivery.workday;
    if (here.riding || !wd.allResolved || wd.closedAtHome !== null) return null;
    const other = CAREER_IDS.find((c) => c !== career.session.careerId && Math.hypot(careerHome(c).door.x - here.x, careerHome(c).door.z - here.z) < 2.4);
    if (other) return { label: `Casa de ${CHARACTERS[other].name}: encerre na sua casa`, available: false, run: null };
    if (Math.hypot(home.door.x - here.x, home.door.z - here.z) > 2.4) return null;
    if (!persistent) return { label: 'Cenário de desenvolvimento: o expediente não é gravado', available: false, run: null };
    const check = homeClosureCheck(wd, home, here, { x: vehicle.view.x, z: vehicle.view.z, stopped: vehicle.stopped() });
    if (!check.ok) return { label: check.reason, available: false, run: null };
    return { label: 'Encerrar o expediente em casa', available: true, run: () => {
      try {
        const saved = closeShiftAtHome(career.session, captureNow(), nextWorkday(career.session.profile.calendarIndex).index, { vehicleStopped: vehicle.stopped() });
        wd.closedAtHome = clock.shiftHour;
        showShiftEnd(saved.profile.lastClosedShift!, saved.profile.balanceCents);
        return 'Expediente encerrado e salvo — troca de carreira liberada';
      } catch (e) { return `Expediente NÃO encerrado: ${(e as Error).message}`; }
    } };
  };
  /** End-of-shift card: summary of the closed day and the way to the main menu. */
  const showShiftEnd = (sum: { delivered: number; returned: number; earnedCents: number; payments: number }, balance: number): void => {
    const box = document.querySelector<HTMLElement>('#shift-end');
    if (!box) return;
    box.querySelector<HTMLElement>('#shift-end-summary')!.textContent = `${sum.delivered} entregues · ${sum.returned} devolvidos e conferidos · ganhos do dia ${formatCents(sum.earnedCents)} (${sum.payments} lançamentos) · saldo ${formatCents(balance)}`;
    box.hidden = false;
    box.querySelector<HTMLButtonElement>('[data-shift-end="menu"]')!.onclick = toMenu;
    box.querySelector<HTMLButtonElement>('[data-shift-end="ficar"]')!.onclick = () => { box.hidden = true; };
  };
  /**
   * B1-01 F4: the car does the whole cycle through the SAME delivery domain as the motorcycle
   * (store counter, depot desks, sector dock, customer's gate); only its compartment differs (the
   * boot at the tailgate, above, instead of the top box).
   */
  const jobAt = (here: { x: number; z: number; riding: boolean }) => {
    const atHome = homeJob(here);
    if (atHome) return atHome;
    const atBoot = trunkJob(here);
    if (atBoot) return atBoot;
    return delivery.action(clock.shiftHour, here, bikeSpot());
  };
  const toggleMount = (): void => {
    if (mode === 'riding') {
      const out = vehicle.exit(baseGuard);
      if (!out.ok) { hud.toast(out.reason); return; }
      walker.place(out.x, out.z, vehicle.view.yaw, ground(out.x, out.z), out.from);
      walker.root.setEnabled(true);
      mode = 'walking';
      if (car) { const b = carBay(); hud.toast(b === null ? 'Carro estacionado (freio de mão puxado)' : `Carro estacionado na vaga ${b + 1} da base`); }
    } else {
      if (!canEnter()) { hud.toast(vehicle.words.tooFar); return; }
      // CORE-015.1: nobody rides with parcels in the hands — they go in the top box first.
      if (delivery.workday.inHands().length) { hud.toast(moto ? 'Guarde os volumes no baú antes de montar' : 'Guarde os volumes no porta-malas antes de entrar'); return; }
      // B1-01 F3: nobody drives off with the tailgate up; getting in closes it.
      if (trunk?.open) hud.toast(closeTrunk());
      walker.root.setEnabled(false);
      vehicle.enter(walker.state);
      mode = 'riding';
    }
    // Held keys never carry over from one body to the other.
    input.reset();
  };
  /** The one contextual button: a job interaction when one is at hand, otherwise mount/dismount. */
  const contextAction = (): void => {
    const here = mode === 'riding' ? { x: vehicle.view.x, z: vehicle.view.z, riding: true } : { x: walker.state.x, z: walker.state.z, riding: false };
    const job = jobAt(here);
    if (job?.available && job.run) {
      const msg = job.run();
      if (msg) hud.toast(msg);
      // B1-01 F6 (decision 11): a custody action is checkpointed right away.
      checkpoints.afterAction(job.label);
      // Top box: the lid opens and the rider reaches in; the hands change halfway through.
      if ('trunk' in job && job.trunk) { moto?.openTrunk(); walker.reachTrunk(); }
      // GFX-001C: every hand-over (counter, checker, customer's gate) plays the reach gesture.
      else walker.reachTrunk(0.5);
      return;
    }
    if (job && !job.available && mode === 'walking' && !canEnter()) { hud.toast(job.label); return; }
    toggleMount();
  };
  const onAction = (action: Action): void => {
    if (action === 'pause') {
      hud.setPaused(!hud.paused); input.reset();
      // B1-01 F6 (decision 11): pausing writes a checkpoint.
      if (hud.paused) checkpoints.checkpoint('pausa');
      return;
    }
    if (hud.paused && action !== 'graphics') return;
    if (action === 'mount') contextAction();
    else if (action === 'graphics') switchGraphicsProfile(profile);
    else if (action === 'wait') {
      const w = delivery.waitOption(clock.shiftHour);
      const still = mode === 'walking' || vehicle.stopped();
      if (w && still) { delivery.startWait(w.until); hud.toast(`${w.label}…`); }
      else if (w) hud.toast(moto ? 'Pare a moto para aguardar' : 'Pare o carro para aguardar');
    }
  };
  const input = new GameInput(document, onAction);

  // B1-01 F6: resume on foot where the checkpoint left the player (vehicle parked as it was).
  if (resumed && savedWorld?.player.mode === 'walking') {
    const out = vehicle.exit(baseGuard);
    const w = savedWorld.player.walker;
    const ok = world.guard(w.x, w.z, 0.3) && !vehicle.blocksPerson(w.x, w.z, 0.3);
    const at = ok ? w : out.ok ? { x: out.x, z: out.z, yaw: vehicle.view.yaw } : { x: SPAWN.x + 2, z: SPAWN.z, yaw: SPAWN.yaw };
    walker.place(at.x, at.z, at.yaw, ground(at.x, at.z));
    walker.root.setEnabled(true);
    mode = 'walking';
  }
  if (resumed) window.setTimeout(() => hud.toast(`Expediente retomado do último ponto seguro (checkpoint ${career.session.save.checkpointSequence}, ${clock.label}${clock.daysCrossed ? ' (+1)' : ''})${restoredPoseOk ? '' : ' · veículo na vaga da base'}`), 600);
  // Another attempt when the page is hidden or closed (never relied upon).
  const flushOnExit = (): void => { checkpoints.onExit(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushOnExit(); });
  window.addEventListener('pagehide', flushOnExit);
  logisticsPanel.extra = () => {
    const sh = career.session.save.shift; const pay = sh?.payments ?? [];
    const st = checkpoints.status;
    const fmtH = (h: number) => `${String(Math.floor(h % 24)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}${h >= 24 ? ' (+1)' : ''}`;
    return [
      `Ganhos gravados no expediente: ${formatCents(ledgerTotal(pay))} (${pay.filter((q) => q.kind === 'ENTREGA').length} entregas · ${pay.filter((q) => q.kind === 'COLETA').length} coletas · tabela D07) · saldo ${formatCents(career.session.profile.balanceCents)}`,
      !persistent ? 'Checkpoints desligados neste cenário (armazenamento indisponível ou dia de desenvolvimento)'
        : st.error ? `ÚLTIMO CHECKPOINT FALHOU: ${st.error}` : st.lastSequence !== null ? `Salvo: checkpoint ${st.lastSequence} · ${st.lastShiftHour !== null ? fmtH(st.lastShiftHour) : ''} · ${st.lastReason ?? ''}` : 'Ainda sem checkpoint deste expediente',
      `Fim do expediente: ${({ operacoes_pendentes: 'operações pendentes', retorno_pendente: `tudo resolvido — volte para casa (${home.street})`, expediente_encerrado: 'encerrado em casa' } as const)[closureState(delivery.workday)]}`,
    ];
  };
  const startFocus = new Vector3(SPAWN.x, 1, SPAWN.z);
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 520;
  const rig = new IsometricCameraRig(scene, canvas, startFocus, narrow ? 15 : 18, cameraObstacles());
  rig.setDriveFraming(vehicle.camera.radius, vehicle.camera.beta);
  rig.resetBehind(SPAWN.yaw, true);
  if (car) window.setTimeout(() => hud.toast('Carro próprio: colete nas lojas, guarde no porta-malas e descarregue numa vaga de carro da base'), 1200);
  if (boot.note) window.setTimeout(() => hud.toast(boot.note!), 4200);
  const fader = new OcclusionFader(world.occluders);
  const cameraTarget = new Vector3();
  const playerCentre = new Vector3();
  const idle = { throttle: 0, brake: 0, steer: 0 };
  let lastSteer = 0;
  let summaryTimer = 0;
  let summary = progressSummary([], 'ANTES');

  scene.onBeforeRenderObservable.add(() => {
    // Clamp the step so a hitch or a background tab cannot teleport anything.
    // Paused: nothing advances (the scene keeps rendering behind the pause card).
    const dt = hud.paused ? 0 : Math.min(0.05, engine.getDeltaTime() / 1000);
    const m = vehicle.view;
    insideVehicle = mode === 'riding'
      ? (moto ? cityLife.blocks(m.x, m.z, MOTO.bodyRadius) : !carFits((x, z, r) => !cityLife.blocks(x, z, r), m.x, m.z, m.yaw))
      : cityLife.blocks(walker.state.x, walker.state.z, 0.3);
    if (mode === 'riding') {
      // CTRL-002 bike curve untouched; the car has its own steering-wheel curve (F2).
      lastSteer = moto ? input.steer(m.speed) : input.carSteer();
      vehicle.step(dt, {
        throttle: input.isDown('accelerate') ? 1 : 0,
        brake: input.isDown('brake') ? 1 : 0,
        steer: lastSteer,
      }, rideGuard, ground(m.x, m.z));
      const lead = Math.min(0.5, Math.max(0, m.speed) * 0.07);
      cameraTarget.set(m.x + Math.sin(m.yaw) * lead, vehicle.root.position.y + vehicle.camera.height, m.z + Math.cos(m.yaw) * lead);
      playerCentre.set(m.x, vehicle.root.position.y + 1.0, m.z);
    } else {
      vehicle.step(dt, idle, world.guard, ground(m.x, m.z));
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
    const player = mode === 'riding' ? { x: m.x, z: m.z, radius: vehicle.trafficRadius } : { x: walker.state.x, z: walker.state.z, radius: 0.45 };
    cityLife.courierObstacles.splice(0,cityLife.courierObstacles.length,...courierTrafficObstacles(delivery.workday.couriers));
    cityLife.update(dt, simTime, clock.hour, lighting.night, player, ground);
    houses.update(player.x, player.z);
    hud.setClock(clock.daysCrossed ? `${clock.label} (+1)` : clock.label, clock.isWorkday, lighting.night > 0.5);
    minimap.update(player.x, player.z, mode === 'riding' ? m.yaw : walker.state.yaw, performance.now(), mode === 'riding', mode === 'riding' ? m.speed : 0);
    // HUD-001: riding / on foot / at the base (inside the depot lot, riding or not).
    const context = hudContext(mode, inDepotLot(depotLocal(player.x, player.z)) ? 'base' : 'street');
    hud.setContext(context, mode);
    // Delivery job: shops, depot staff, customers, objective marker and contextual action.
    const here = mode === 'riding' ? { x: m.x, z: m.z, riding: true } : { x: walker.state.x, z: walker.state.z, riding: false };
    delivery.update(dt, clock.shiftHour, cityLife.crowd, here, ground, (x,z,r)=>cityLife.blocks(x,z,r)||Math.hypot(x-player.x,z-player.z)<r+player.radius, bikeSpot());
    for (const msg of delivery.workday.events.splice(0)) hud.toast(msg);
    // B1-01 F6: background custody events (NPCs, depot), periodic refresh and retries.
    if (!hud.paused) checkpoints.tick();
    cityLife.spawnAvoid.splice(0, cityLife.spawnAvoid.length, ...delivery.workday.couriers.map((c) => ({ x: c.bike.x, z: c.bike.z, radius: 1.2 })), { x: vehicle.view.x, z: vehicle.view.z, radius: 2.5 });
    logisticsPanel.update(delivery.workday,clock.shiftHour,performance.now()/1000);
    const objective = delivery.workday.objective(clock.shiftHour, vehicle.view);
    const wait = delivery.waiting === null ? delivery.waitOption(clock.shiftHour) : null;
    // Progress texts (mine vs team) and the base lines change slowly: 4 Hz is plenty.
    summaryTimer -= dt || 0.016;
    if (summaryTimer <= 0) {
      summaryTimer = 0.25;
      summary = progressSummary(delivery.workday.parcels, delivery.workday.phase, delivery.workday.playerSector);
      if (context === 'base') hud.setBase(baseSummary(delivery.workday.parcels, day?.depotTarget ?? 15, delivery.workday.allSortedAt, delivery.workday.playerSector));
    }
    hud.setObjective(objective.title, objective.detail, summary.mine, summary.team,
      delivery.waiting !== null ? 'Aguardando…' : wait?.label ?? null);
    minimap.setTarget(objective.target);
    minimap.setBike(mode === 'walking' ? m : null, moto ? 'M' : 'C');
    const wd = delivery.workday;
    if (wd.phase === 'ENTREGAS') {
      if (stopsKey !== wd.route.join('|')) { stopsKey = wd.route.join('|'); minimap.setStops(wd.route.map((id, i) => ({ ...wd.byAddress.get(id)!.door, next: i === 0 }))); }
    } else if (stopsKey !== '' && !stopsPreview) { stopsKey = ''; minimap.setStops([]); }
    hud.setCargo(wd.cargoLabel(), wd.inHands().length > 0);
    const far = objective.target ? Math.hypot(objective.target.x - player.x, objective.target.z - player.z) : 0;
    hud.setDistance(objective.target && far > 12 ? minimap.targetDistance() : null);
    walker.setLoad(delivery.workday.inHands().length, delivery.workday.sackInHands);
    vehicle.setLights(mode === 'riding' && input.isDown('brake') && m.speed > 0.2, lighting.night, dt);
    moto?.setTrunkCargo(delivery.workday.inTrunk().length);
    cargoView?.update(delivery.workday.parcels);
    const found = jobAt(here);
    // A blocked job hint never hides "Montar" when the rider can simply get on the bike.
    const enterable = canEnter();
    const job = found && (found.available || mode === 'riding' || !enterable || delivery.workday.inHands().length > 0) ? found : null;
    const label = job ? job.label : mode === 'riding' ? vehicle.words.exit : vehicle.words.enter;
    const available = job ? job.available : mode === 'riding' ? vehicle.stopped() : enterable;
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
        teleport: (x: number, z: number, yaw: number) => Object.assign(vehicle.view as { x: number; z: number; yaw: number; speed: number }, { x, z, yaw, speed: 0 }),
        camera: (alpha: number, beta: number, radius: number) => rig.debugSet(alpha, beta, radius),
        setHour: (hour: number) => { clock.setHour(hour); lightTimer = 0; },
        /** B1-01 F5: jump to a SHIFT hour (≥ 24 = after midnight, same shift). Development only. */
        setShiftHour: (hour: number) => { clock.setShiftHour(hour); lightTimer = 0; },
        /** Puts the rider on foot at a spot (the bike stays where it is). */
        placeWalker: (x: number, z: number, yaw = 0) => {
          if (mode === 'riding') {
            if (moto) { moto.state.speed = 0; moto.setRidden(false); } else car!.setDriven(false);
            walker.root.setEnabled(true); mode = 'walking';
          }
          walker.place(x, z, yaw, ground(x, z));
        },
        act: () => contextAction(),
        /** EXPERIMENTO kit: pontos para inspecionar placas, postes e carros GLB. */
        kitSpots: () => ({
          stopSigns: cityLife.stopSigns.map((p) => ({ x: p.x, z: p.z, yaw: p.yaw })),
          cars: cityLife.traffic.vehicles.filter((v) => v.active && v.kind === 'car').map((v) => ({ x: v.x, z: v.z, yaw: v.yaw })),
          meshes: scene.meshes.filter((m) => m.name.startsWith('npc-carro') || m.name.startsWith('kit-light')).slice(0, 12).map((m) => ({
            name: m.name, enabled: m.isEnabled(), visible: m.isVisible, verts: m.getTotalVertices(),
            n: (m as { thinInstanceCount?: number }).thinInstanceCount ?? -1, box: m.getBoundingInfo().boundingBox.extendSize.asArray().map((v) => +v.toFixed(2)),
          })),
        }),
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
        depotPath:(from:{x:number;z:number},to:{x:number;z:number})=>{
          const p=depotLocal(vehicle.view.x,vehicle.view.z),yaw=vehicle.view.yaw-depotYaw(0),rx=Math.abs(Math.sin(yaw))*.55+.34,rz=Math.abs(Math.cos(yaw))*.55+.34;
          return depotPath(from,to,[{minX:p.x-rx,maxX:p.x+rx,minZ:p.z-rz,maxZ:p.z+rz}]);
        },
        depotGate:(open:boolean|null)=>{delivery.gateManual=open},
        canStand:(x:number,z:number,r=.35,riding=false)=>world.guard(x,z,r)&&!delivery.doorBlocked(x,z,r,riding,{x,z}),
        /** Deterministic test clock: executes real work in bounded steps, never edits parcels. */
        processDepot:(seconds:number)=>{for(let t=0;t<Math.min(seconds,1);t+=.05)delivery.workday.update(clock.shiftHour,.05)},
        logisticsStep:(seconds:number)=>{for(let t=0;t<Math.min(seconds,1);t+=.05){clock.advance(.05);delivery.workday.update(clock.shiftHour,.05)}},
        /**
         * B1-01 F4 TIME FIXTURE (development only): advances the WHOLE simulated world — clock, traffic,
         * pedestrians, NPC couriers, depot and stores — with the exact calls of the render loop, in
         * 0.05 s steps, without drawing. Unlike `logisticsStep`, ambient traffic moves with the couriers.
         * The player stands still (on foot or parked); no parcel is edited by the fixture itself.
         */
        worldStep:(seconds:number)=>{
          for(let t=0;t<Math.min(seconds,5);t+=.05){
            const m=vehicle.view;
            clock.advance(.05);simTime+=.05;
            const player=mode==='riding'?{x:m.x,z:m.z,radius:vehicle.trafficRadius}:{x:walker.state.x,z:walker.state.z,radius:0.45};
            cityLife.courierObstacles.splice(0,cityLife.courierObstacles.length,...courierTrafficObstacles(delivery.workday.couriers));
            cityLife.update(.05,simTime,clock.hour,lighting.night,player,ground);
            const here=mode==='riding'?{x:m.x,z:m.z,riding:true}:{x:walker.state.x,z:walker.state.z,riding:false};
            delivery.update(.05,clock.shiftHour,cityLife.crowd,here,ground,(x,z,r)=>cityLife.blocks(x,z,r)||Math.hypot(x-player.x,z-player.z)<r+player.radius,bikeSpot());
          }
          delivery.workday.events.splice(0);
        },
        minimapBase: () => minimap.baseImage(),
        /** MAP-001 fixture: draws the player's (Oeste) delivery addresses as map stops. Display only. */
        previewStops: () => {
          const wd = delivery.workday;
          const ids = [...new Set(wd.load('jogador').map((p) => p.destination))];
          stopsPreview = true; stopsKey = 'preview';
          minimap.setStops(ids.map((id, i) => ({ ...wd.byAddress.get(id)!.door, next: i === 0 })));
          return ids.length;
        },
        /** CORE-015.1: parks the bike at the kerb nearest to a spot (the rider stays where it is). */
        parkNear: (x: number, z: number) => { const p = parkNear(x, z); Object.assign(vehicle.view as object, { ...p, speed: 0, steer: 0 }); return p; },
        parkAt: (x: number, z: number, yaw: number) => Object.assign(vehicle.view as object, { x, z, yaw, speed: 0, steer: 0 }),
        /** B1-01 F2: the car's whole footprint stands on free static ground (no clipping into the world). */
        vehicleClear: () => vehicle.fitsAt(world.guard, vehicle.view.x, vehicle.view.z, vehicle.view.yaw),
        /** B1-01 F2: car bay centres in world space (depot CAR_PARKING) and the bay heading. */
        carBays: () => CAR_PARKING.map((r) => ({ ...depotWorld((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2), yaw: depotYaw(0) })),
        /** B1-01 F2: would the vehicle fit at this pose on the static world? */
        fitsAt: (x: number, z: number, yaw: number) => vehicle.fitsAt(world.guard, x, z, yaw),
        /**
         * B1-01 F3 TEST FIXTURE (development only, not a game feature): the player's own store
         * parcels handed over by the domain's real `collect` (NA_LOJA → COLETADO, loja → mãos, with
         * history), skipping only the walk to the counter. Store pickup BY CAR is F4 and stays off in play.
         */
        fixtureCollect: () => { const w = delivery.workday; const kind = w.assigned.find((k) => w.readyAt(k).length > 0); return kind ? w.collect(kind, clock.shiftHour) : 0; },
        /**
         * B1-01 F4 TRAVEL FIXTURE (development only): parks the player's vehicle at the kerb near a
         * spot, on a pose where the whole body fits the static world. It moves the vehicle only;
         * no parcel changes. Stands in for driving across the city in the browser test.
         */
        parkCarNear: (x: number, z: number) => {
          const p = parkNear(x, z);
          for (const along of [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6]) for (const side of [0, 0.5, -0.5, 1]) for (const yaw of [p.yaw, p.yaw + Math.PI]) {
            const q = { x: p.x + Math.sin(p.yaw) * along + Math.cos(p.yaw) * side, z: p.z + Math.cos(p.yaw) * along - Math.sin(p.yaw) * side };
            if (vehicle.fitsAt(world.guard, q.x, q.z, yaw)) { Object.assign(vehicle.view as object, { ...q, yaw, speed: 0, steer: 0 }); return { ...q, yaw }; }
          }
          return null;
        },
        /** B1-01 F4: read-only spots of the delivery domain (address door, player's sector counter). */
        addressDoor: (id: string) => { const a = delivery.workday.byAddress.get(id); return a ? { ...a.door, number: a.number } : null; },
        dispatchSpot: () => ({ ...delivery.workday.playerDispatch }),
        /**
         * B1-01 F5 SCENARIO FIXTURE (development only): nobody will be at home at this address today.
         * It sets who answers the door (the day's absence schedule), never a parcel state.
         */
        markAbsent: (id: string) => { delivery.workday.absentAddresses.add(id); return delivery.workday.recipientAbsent(id); },
        /** B1-01 F6 (AC-20): does any street vehicle overlap the player's vehicle or a courier's bike right now? */
        overlaps: () => ({ player: cityLife.blocks(vehicle.view.x, vehicle.view.z, 1.0), couriers: delivery.workday.couriers.filter((c) => c.riding && cityLife.blocks(c.bike.x, c.bike.z, 0.8)).map((c) => c.id), vehicles: cityLife.stats().vehicles }),
        /** B1-01 F6: writes a checkpoint now (same path as the pause). */
        checkpoint: () => checkpoints.checkpoint('teste'),
        /** B1-01 F6: the career's own home anchors (door on the pavement, stop on the street). */
        homeSpot: () => ({ door: { ...home.door }, stop: { ...home.stop }, street: home.street }),
        /** B1-01 F3: a parked car's boot spot (behind the tailgate), in world coordinates. */
        trunkSpot: () => (car ? carToWorld(car.state, 0, -CAR.length / 2 - 0.55) : null),
        /**
         * B1-01 F3/F6: seals the live world (boot slots included) into a career save IN MEMORY with
         * the real checkpoint capture and parses it back. Nothing is written.
         */
        cargoRoundTrip: () => {
          const id = career.session.careerId;
          const next = captureShift(career.session.profile, career.session.save.shift, captureNow());
          const text = canonicalJson(sealSave({ careerId: id, checkpointSequence: career.session.save.checkpointSequence + 1, ...next }));
          const back = parseSave(JSON.parse(text), id);
          const inBoot = (list: readonly { id: string; place: string; stowage: unknown }[]) => list.filter((p) => p.place === 'porta-malas').map((p) => ({ id: p.id, stowage: p.stowage }));
          return { schemaVersion: back.schemaVersion, bytes: text.length, live: inBoot(delivery.workday.parcels), restored: inBoot(back.shift!.parcels) };
        },
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
        moto: moto ? { ...moto.state, y: moto.root.position.y } : null,
        vehicle: { kind: vehicle.kind, ...vehicle.view, y: vehicle.root.position.y, driven: vehicle.driven, stopped: vehicle.stopped(), parked: car ? car.state.parked : !vehicle.driven, bay: carBay(), doors: car ? car.doors01 : null, owned: career.session.profile.vehicle ? { ...career.session.profile.vehicle } : null },
        walker: { ...walker.state, y: walker.root.position.y },
        camera: { framing: rig.driveFraming, mode: rig.mode, alpha: rig.camera.alpha, beta: rig.camera.beta, radius: rig.camera.radius, target: rig.camera.target.asArray() },
        fadedBuildings: fader.fadedCount,
        clock: { label: clock.label, hour: clock.hour, shiftHour: clock.shiftHour, daysCrossed: clock.daysCrossed, workday: clock.isWorkday, night: lighting.night, devTime, speed: clock.speedFactor },
        /** B1-01 F3.5: presets saved in the career and the looks the player's 3D bodies were built with. */
        avatar: { appearance: career.session.profile.appearance, equipment: career.session.profile.equipment, walker: { ...walker.body.look }, rider: moto?.rider ? { ...moto.rider.look } : null, driver: car ? { ...car.driver.look } : null },
        /** B1-01 F6: persistence of the running shift (checkpoint status, ledger, end of shift). */
        save: { persistent, resumed, resumedCouriers, restoredPose: restoredPoseOk, status: { ...checkpoints.status }, closure: closureState(delivery.workday), closedAtHome: delivery.workday.closedAtHome, shiftId: career.session.save.shift?.shiftId ?? null, activeShiftId: career.session.profile.activeShiftId, balanceCents: career.session.profile.balanceCents, payments: (career.session.save.shift?.payments ?? []).map((q) => ({ ...q })), lastClosedShift: career.session.profile.lastClosedShift ? { ...career.session.profile.lastClosedShift } : null, lock: boot.lock.mode },
        career: { id: career.session.careerId, name: career.session.character.name, sector: delivery.workday.playerSector, home: career.home.id, roster: { ...career.roster }, calendarIndex: career.session.profile.calendarIndex, checkpoint: career.session.save.checkpointSequence, durable: careerStorage.durable, source: career.session.loadSource },
        delivery: {
          depot:{gateOpen:delivery.gateOpen,gateManual:delivery.gateManual,visibleIds:[...delivery.parcelViews.visibleIds],workers:delivery.workday.depot.workers.map(w=>({...w,task:w.task?{id:w.task.id,kind:w.task.kind,stage:w.task.stage}:null})),errors:[...delivery.workday.depot.errors]},
          phase: delivery.workday.phase,
          logistics:{playerReady:delivery.workday.playerReady,report:delivery.workday.report(clock.shiftHour),allResolved:delivery.workday.allResolved,absent:[...delivery.workday.absentAddresses],seed:delivery.workday.options.seed??day?.seed??2026,calendar:day?{date:day.date,index:day.index,tier:day.tier,target:day.depotTarget}:null,sortedAt:delivery.workday.allSortedAt,assignments:delivery.workday.assignments,teamReady:delivery.workday.teamReady,released:delivery.workday.released,releaseHour:delivery.workday.releaseHour,van:{state:delivery.workday.van.state,door:delivery.workday.van.door,approach:'assisted-D05'},couriers:delivery.workday.couriers.map(c=>({id:c.id,name:c.name,sector:c.sector,state:c.state,bike:{...c.bike},person:{...c.person},riding:c.riding,error:c.error,stops:[...c.stops],route:c.route.map(p=>({...p})),trunk:c.trunk(delivery.workday).map(p=>p.id),hands:c.hands(delivery.workday).map(p=>p.id)}))},
          objective: delivery.workday.objective(clock.shiftHour, vehicle.view),
          cargo: { visualHands:walker.displayedLoad, hands: delivery.workday.inHands().length, trunk: delivery.workday.inTrunk().length, sack: delivery.workday.sackInHands, label: delivery.workday.cargoLabel(), trunkOpen: moto?.trunkOpen ?? 0, trunkSpot: moto ? trunkSpot(bikeSpot()) : null,
            /** B1-01 F3: the car boot — domain (open flag, parcels with slots) and what is drawn. */
            carBoot: car && trunk && cargoView ? { open: trunk.open, lid: car.trunk01, vehicleId: trunk.vehicleId, problem: trunk.problem(delivery.workday.parcels), parcels: trunk.contents(delivery.workday.parcels).map((p) => ({ id: p.id, state: p.state, holder: p.holder, stowage: { ...p.stowage! } })), drawn: cargoView.drawn() } : null },
          progress: delivery.workday.progress(),
          assigned: [...delivery.workday.assigned],
          route: [...delivery.workday.route],
          parcels: delivery.workday.parcels.map((p) => ({ id: p.id, state: p.state, place: p.place, holder: p.holder, origin: p.origin, destination: p.destination, platform: p.platform, region: p.region, collector:p.collector,sector:p.sector, position:p.position?{...p.position}:null,dock:p.dock,load:p.load,history:p.history.map(e=>({...e})) })),
          staff: delivery.workday.staff.map((st) => ({ role: st.role, state: st.state })),
          stores: [...delivery.stores].map(([id, st]) => ({ id, employee: st.ops.employee, shutter: st.ops.shutter, queue: st.ops.queue.length, served: st.ops.served, pickup: st.layout.pickup, facing: yawOf(STORES.find((q) => q.id === id)!.frame) })),
          addresses: delivery.workday.addresses.length,
          action: jobAt(mode === 'riding' ? { x: vehicle.view.x, z: vehicle.view.z, riding: true } : { x: walker.state.x, z: walker.state.z, riding: false })?.label ?? null,
          waiting: delivery.waiting,
        },
        paused: hud.paused,
        hud: { context: hud.context, steer: lastSteer, stick: input.joystick.debug(), accelerate: input.isDown('accelerate'), brake: input.isDown('brake') },
        city: cityLife.stats(),
        houses: houses.stats(),
        minimap: { expanded: minimap.isExpanded, arrow: minimap.arrowAt(), ...minimap.state(), distance: minimap.targetDistance() },
        externalAssets: external,
        kitAssets: kit === 'loading' || kit === 'off' ? kit : { ...kit, cars: cityLife.kitCars(), stopSigns: cityLife.stopSigns.length },
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
bootBrowserCareer().then((boot) => {
  try {
    start(canvas, boot);
  } catch (error) {
    console.error(error);
    fail('Não foi possível iniciar o gráfico 3D (WebGL) neste navegador. Atualize o navegador ou tente outro aparelho.');
  }
}).catch((error: unknown) => {
  console.error(error);
  fail('Não foi possível carregar a carreira salva neste navegador.');
});
