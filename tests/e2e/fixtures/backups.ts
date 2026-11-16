/**
 * B1-01 F6 E2E fixture: VALID saves built with the real domain functions (nothing hand-written),
 * for the save-management screen. Rosa (Norte) has a closed career in two checkpoints of the SAME
 * incarnation (the browser holds the newer one); Davi (Sul) has one in the browser and an export of
 * ANOTHER incarnation. Prints JSON: { storage, olderRosa, otherDavi, rosaName }.
 */
import { CareerStore, MemoryStorage, saveKey, marksKey, ACTIVE_CAREER_KEY } from '../../../src/core/career/careerStore.ts';
import { chooseStartingVehicle, defaultProfile, emptyShift } from '../../../src/core/career/snapshot.ts';

const storage = new MemoryStorage();
const store = new CareerStore(storage);
const rosa = chooseStartingVehicle(defaultProfile('personagem-norte', 2, 'personagem-norte:e2e-rosa'), 'moto-antiga');
store.commit('personagem-norte', rosa, null, -1);
const olderRosa = store.exportBackup('personagem-norte');
store.commit('personagem-norte', { ...rosa, calendarIndex: 3 }, null, 0);
const davi = chooseStartingVehicle(defaultProfile('personagem-sul', 1, 'personagem-sul:e2e-davi'), 'carro-antigo');
store.commit('personagem-sul', davi, null, -1);
const elsewhere = new CareerStore(new MemoryStorage());
elsewhere.commit('personagem-sul', chooseStartingVehicle(defaultProfile('personagem-sul', 5, 'personagem-sul:e2e-outra'), 'moto-antiga'), null, -1);
const otherDavi = elsewhere.exportBackup('personagem-sul');
store.setActiveCareer('personagem-norte');
const keys = [saveKey('personagem-norte'), `${saveKey('personagem-norte')}:anterior`, marksKey('personagem-norte'), saveKey('personagem-sul'), marksKey('personagem-sul'), ACTIVE_CAREER_KEY];
// F6 audit (block 2): the same storage plus Lia (Oeste) with an OPEN shift as the active career.
const lia = { ...chooseStartingVehicle(defaultProfile('personagem-oeste', 0, 'personagem-oeste:e2e-lia'), 'moto-antiga'), activeShiftId: 'personagem-oeste/dia-0' };
store.commit('personagem-oeste', lia, emptyShift('personagem-oeste', 0), -1);
const withOpenLia = { ...Object.fromEntries(keys.map((k) => [k, storage.getItem(k)]).filter(([, v]) => v !== null)), [saveKey('personagem-oeste')]: storage.getItem(saveKey('personagem-oeste')), [marksKey('personagem-oeste')]: storage.getItem(marksKey('personagem-oeste')), [ACTIVE_CAREER_KEY]: 'personagem-oeste' };
const closedStorage = Object.fromEntries(keys.map((k) => [k, k === ACTIVE_CAREER_KEY ? 'personagem-norte' : storage.getItem(k)]).filter(([, v]) => v !== null));
process.stdout.write(JSON.stringify({ storage: closedStorage, withOpenLia, olderRosa, otherDavi }));
