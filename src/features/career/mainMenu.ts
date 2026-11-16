import {
  APPEARANCE_PRESETS, EQUIPMENT_PRESETS, VEHICLE_LABEL, type AppearancePreset, type CareerId, type EquipmentPresetId, type VehicleKind,
} from '../../core/career/careers';
import { ActivationError, mainScreen, type CareerCard, type CareerChoice, type MenuModel } from '../../core/career/careerMenu';
import type { GraphicsChoice, GraphicsProfile } from '../../config/graphics';
import { careerLook } from './characterPresets';
import { CAREER_IDS, CHARACTERS } from '../../core/career/careers';
import type { CareerStore } from '../../core/career/careerStore';
import type { GameLock } from './tabLock';

/**
 * B1-01 F3.5/F3.5.1: the main menu, shown BEFORE the 3D engine and the city exist. Main screen
 * (Continuar / Novo jogo / Carregar jogo / Opções), then four career cards
 * (from the read-only menu model), then the chosen career's basic presets and — only when none is
 * saved — the one-time vehicle choice. It renders and collects choices; persisting is done by the
 * caller (`enterCareer`), whose errors are shown here and keep the menu open.
 */
export type MenuActions = {
  /** Persists the choice and loads the career; throws on any write error. */
  enter: (careerId: CareerId, choice: CareerChoice) => void;
  /** One-time vehicle choice (the existing F2 dialog). */
  askVehicle: (name: string) => Promise<VehicleKind>;
  /** Re-reads the four saves (read only) after a failed entry. */
  refresh: () => MenuModel;
  /** The real graphics profile setting (src/config/graphics.ts), applied before the engine exists. */
  graphics: { choice: () => GraphicsChoice; save: (name: GraphicsProfile['name']) => boolean };
  /** B1-01 F6: the single-writer tab lock; without it the menu is read-only. */
  lock?: GameLock;
  /** B1-01 F6: save management (export/import backup, delete) through the real store. */
  saves?: CareerStore;
};

const OTHER_TAB = 'O jogo já está aberto em outra aba deste navegador: feche-a e toque em "Tentar novamente". Enquanto isso, nada pode ser gravado aqui.';

const APPEARANCE_LABEL: Readonly<Record<AppearancePreset, string>> = { masculino: 'Masculino', feminino: 'Feminino' };
const money = (cents: number): string => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = doc.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e;
};

/** Small front view of the character with the SAME colours the 3D rider uses (characterPresets). */
export function avatarSvg(appearance: AppearancePreset, equipment: EquipmentPresetId): string {
  const l = careerLook(appearance, equipment); const fem = appearance === 'feminino';
  const torso = l.vest ?? l.jacket; const sw = fem ? 30 : 36; const hip = fem ? 30 : 27;
  return `<svg viewBox="0 0 80 120" role="img" aria-label="${APPEARANCE_LABEL[appearance]}, ${EQUIPMENT_PRESETS.find((e) => e.id === equipment)!.label}" data-figure="${appearance}" data-kit="${equipment}">`
    + (fem ? `<path d="M40 18 q16 6 10 34 q-4 -6 -10 -8 z" fill="${l.hair ?? '#3b2618'}" data-part="rabo"/>` : '')
    + `<rect x="${40 - hip / 2}" y="70" width="${hip}" height="12" rx="5" fill="${l.jeans}"/>`
    + `<rect x="${40 - hip / 2 + 2}" y="80" width="10" height="34" rx="4" fill="${l.jeans}"/><rect x="${40 + hip / 2 - 12}" y="80" width="10" height="34" rx="4" fill="${l.jeans}"/>`
    + `<rect x="${40 - sw / 2 - 8}" y="38" width="8" height="34" rx="4" fill="${l.jacket}"/><rect x="${40 + sw / 2}" y="38" width="8" height="34" rx="4" fill="${l.jacket}"/>`
    + `<rect x="${40 - sw / 2}" y="36" width="${sw}" height="38" rx="9" fill="${torso}" data-part="tronco"/>`
    + `<rect x="${40 - sw / 2}" y="50" width="${sw}" height="4" fill="${l.trim}"/><rect x="${40 - sw / 2}" y="62" width="${sw}" height="4" fill="${l.trim}"/>`
    + `<circle cx="40" cy="22" r="15" fill="${l.helmet}" data-part="capacete"/><rect x="37" y="7" width="6" height="30" fill="${l.helmetStripe}" opacity=".9"/>`
    + `<rect x="30" y="20" width="20" height="8" rx="3" fill="#121619"/></svg>`;
}

export function runMainMenu(doc: Document, initial: MenuModel, actions: MenuActions): Promise<CareerId> {
  const root = doc.querySelector<HTMLElement>('#main-menu');
  if (!root) return Promise.reject(new Error('Menu principal ausente'));
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const home = q<HTMLElement>('#menu-home');
  const list = q<HTMLElement>('#menu-list');
  const grid = q<HTMLElement>('#career-cards');
  const detail = q<HTMLElement>('#career-detail');
  const options = q<HTMLElement>('#menu-options');
  const notice = q<HTMLElement>('#menu-notice');
  const savesScreen = q<HTMLElement>('#menu-saves');
  const lockBox = q<HTMLElement>('#menu-lock');
  const writable = (): boolean => actions.lock?.held ?? true;
  let model = initial;
  let screen: 'home' | 'list' | 'detail' | 'options' | 'saves' = 'home';
  let listMode: 'novo' | 'carregar' = 'novo';
  doc.body.classList.add('in-menu');
  root.hidden = false;
  /** Notice line: storage problems and the result of a failed entry (never hidden behind a success). */
  const say = (text: string | null): void => {
    const base = model.durable ? '' : 'Armazenamento do navegador indisponível: o progresso desta sessão NÃO será salvo.';
    const msg = [base, text ?? ''].filter(Boolean).join(' · ');
    notice.textContent = msg; notice.hidden = msg === '';
  };
  const show = (next: typeof screen): void => {
    screen = next; root.dataset.screen = next;
    home.hidden = next !== 'home'; list.hidden = next !== 'list'; detail.hidden = next !== 'detail'; options.hidden = next !== 'options'; savesScreen.hidden = next !== 'saves';
    lockBox.hidden = writable();
  };

  return new Promise((resolve) => {
    /** Writes through `actions.enter`; on failure re-reads the saves and reports exactly what happened. */
    const enter = async (c: CareerCard, appearance: AppearancePreset, equipment: EquipmentPresetId, error: HTMLElement | null): Promise<boolean> => {
      try {
        if (!writable()) throw new Error(OTHER_TAB);
        let kind: VehicleKind | null = c.vehicle;
        if (kind === null) { root.hidden = true; kind = await actions.askVehicle(c.name); root.hidden = false; }
        actions.enter(c.careerId, { appearance, equipment, vehicle: kind });
        root.hidden = true; doc.body.classList.remove('in-menu');
        resolve(c.careerId);
        return true;
      } catch (e) {
        root.hidden = false;
        model = actions.refresh();
        const text = e instanceof ActivationError ? e.message : `A escolha NÃO foi gravada: ${(e as Error).message}`;
        if (error) { error.textContent = text; error.hidden = false; } else say(text);
        return false;
      }
    };
    const showHome = (): void => {
      const m = mainScreen(model);
      const cont = q<HTMLButtonElement>('[data-menu-home="continuar"]');
      cont.disabled = m.continueCard === null;
      q<HTMLElement>('#menu-continue-info').textContent = m.continueCard
        ? `${m.continueCard.name} · Setor ${m.continueCard.sector} · ${m.continueCard.dayLabel}${m.continueCard.activeShiftId ? ' · expediente aberto' : ''}`
        : m.continueReason ?? '';
      const nw = q<HTMLButtonElement>('[data-menu-home="novo"]');
      nw.disabled = m.newGameReason !== null && m.newGame.every((c) => c.blocked !== null);
      q<HTMLElement>('#menu-new-info').textContent = m.newGameReason ?? `${m.newGame.length} ${m.newGame.length === 1 ? 'personagem livre' : 'personagens livres'}`;
      show('home');
      (home.querySelector<HTMLButtonElement>('button:not([disabled])'))?.focus();
    };
    const showList = (mode: 'novo' | 'carregar'): void => {
      listMode = mode; say(null);
      const m = mainScreen(model);
      q<HTMLElement>('#menu-list-title').textContent = mode === 'novo' ? 'Novo jogo — escolha um personagem livre' : 'Carregar jogo — as quatro carreiras';
      const reason = q<HTMLElement>('#menu-list-reason');
      reason.textContent = mode === 'novo' ? m.newGameReason ?? '' : model.lockedBy ? `Expediente aberto de ${model.cards.find((c) => c.careerId === model.lockedBy)!.name}: só ela pode ser carregada até finalizar o expediente.` : '';
      reason.hidden = reason.textContent === '';
      grid.replaceChildren();
      const entries = mode === 'novo' ? m.newGame.map((card) => ({ card, reason: card.blocked })) : m.load;
      for (const e of entries) grid.append(cardButton(e.card, e.reason));
      show('list');
      (grid.querySelector<HTMLButtonElement>('button:not([disabled])') ?? q<HTMLButtonElement>('#menu-list [data-menu="voltar-inicio"]')).focus();
    };
    const cardButton = (c: CareerCard, reason: string | null): HTMLButtonElement => {
      const b = el(doc, 'button', 'career-card'); b.type = 'button';
      b.dataset.career = c.careerId; b.disabled = reason !== null;
      if (c.isActive && c.saved) b.classList.add('is-current');
      const head = el(doc, 'span', 'career-head');
      head.innerHTML = avatarSvg(c.appearance, c.equipment);
      const title = el(doc, 'span', 'career-title');
      title.append(el(doc, 'strong', 'career-name', c.name), el(doc, 'small', 'career-sector', `Setor ${c.sector}`));
      head.append(title);
      const lines = el(doc, 'span', 'career-lines');
      const status = c.problem && !c.saved ? 'Save corrompido' : c.source === 'anterior' ? 'Cópia anterior utilizável' : c.saved ? 'Carreira salva' : c.source === 'legado' ? 'Calendário antigo (Oeste)' : 'Carreira nova';
      lines.append(
        el(doc, 'span', 'career-status', status),
        el(doc, 'span', 'career-home', `Casa: ${c.homeStreet}`),
        el(doc, 'span', 'career-vehicle', c.vehicle ? `${VEHICLE_LABEL[c.vehicle]} (próprio)` : 'Veículo: a escolher'),
        el(doc, 'span', 'career-progress', c.saved ? `${c.dayLabel} · checkpoint ${c.checkpoint}` : `${c.source === 'legado' ? 'Dia salvo' : 'Começa'} · ${c.dayLabel}`),
      );
      if (c.balanceCents !== null) lines.append(el(doc, 'span', 'career-balance', `Saldo ${money(c.balanceCents)}`));
      if (c.activeShiftId) lines.append(el(doc, 'span', 'career-shift', 'Expediente aberto — continuar'));
      if (c.problem) lines.append(el(doc, 'span', 'career-problem', c.saved ? `Aviso: ${c.problem} (usando a cópia anterior íntegra)` : c.problem));
      if (reason && !c.problem) lines.append(el(doc, 'span', 'career-blocked', reason));
      b.append(head, lines);
      b.addEventListener('click', () => { if (!b.disabled) showDetail(c); });
      return b;
    };
    const showDetail = (c: CareerCard): void => {
      let appearance = c.appearance; let equipment = c.equipment;
      detail.replaceChildren(); detail.dataset.career = c.careerId;
      const preview = el(doc, 'div', 'career-preview');
      const side = el(doc, 'div', 'career-options');
      const title = el(doc, 'h2', undefined, `${c.name} · Setor ${c.sector}`);
      const group = (label: string, name: string, opts: readonly { id: string; label: string }[], set: (v: string) => void): HTMLElement => {
        const g = el(doc, 'div', 'option-group'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', label);
        g.append(el(doc, 'span', 'option-label', label));
        for (const o of opts) {
          const ob = el(doc, 'button', 'option', o.label); ob.type = 'button'; ob.dataset[name] = o.id; ob.setAttribute('role', 'radio');
          ob.addEventListener('click', () => { set(o.id); refresh(); });
          g.append(ob);
        }
        g.dataset.group = name;
        return g;
      };
      const looks = group('Aparência', 'appearance', APPEARANCE_PRESETS.map((a) => ({ id: a, label: APPEARANCE_LABEL[a] })), (v) => { appearance = v as AppearancePreset; });
      const kits = group('Equipamento', 'equipment', EQUIPMENT_PRESETS, (v) => { equipment = v as EquipmentPresetId; });
      const vehicle = el(doc, 'p', 'career-vehicle-line', c.vehicle ? `Veículo: ${VEHICLE_LABEL[c.vehicle]} — próprio, quitado e fixo` : 'Veículo: escolha única no próximo passo (moto antiga ou carro popular antigo)');
      const error = el(doc, 'p', 'menu-error'); error.setAttribute('role', 'alert'); error.hidden = true;
      const back = el(doc, 'button', 'menu-back', 'Voltar'); back.type = 'button'; back.dataset.menu = 'voltar';
      const go = el(doc, 'button', 'primary menu-start', c.saved || c.source === 'legado' ? 'Continuar carreira' : 'Iniciar carreira'); go.type = 'button'; go.dataset.menu = 'iniciar';
      const row = el(doc, 'div', 'menu-actions'); row.append(back, go);
      side.append(title, looks, kits, vehicle, error, row);
      detail.append(preview, side);
      const refresh = (): void => {
        preview.innerHTML = avatarSvg(appearance, equipment);
        for (const b of detail.querySelectorAll<HTMLButtonElement>('[data-appearance]')) b.setAttribute('aria-checked', String(b.dataset.appearance === appearance));
        for (const b of detail.querySelectorAll<HTMLButtonElement>('[data-equipment]')) b.setAttribute('aria-checked', String(b.dataset.equipment === equipment));
      };
      refresh();
      back.addEventListener('click', () => showList(listMode));
      go.addEventListener('click', async () => {
        if (go.disabled) return;
        go.disabled = true; error.hidden = true;
        if (!(await enter(c, appearance, equipment, error))) go.disabled = false;
      });
      show('detail');
      go.focus();
    };
    const showOptions = (): void => {
      const paint = (): void => {
        const g = actions.graphics.choice();
        for (const b of options.querySelectorAll<HTMLButtonElement>('[data-gfx]')) b.setAttribute('aria-checked', String(b.dataset.gfx === g.name));
        q<HTMLElement>('#menu-gfx-info').textContent = g.source === 'url' ? 'Definido pelo endereço da página (?gfx=…); vale nesta sessão.'
          : g.source === 'salvo' ? 'Escolha salva neste navegador; vale ao iniciar a carreira.' : 'Automático pelo tipo de aparelho.';
      };
      paint();
      show('options');
      q<HTMLButtonElement>('#menu-options [data-menu="voltar-inicio"]').focus();
      options.onclick = (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-gfx]');
        if (!b) return;
        if (!actions.graphics.save(b.dataset.gfx as 'mobile' | 'desktop')) say('Não foi possível salvar a opção de gráficos neste navegador');
        paint();
      };
    };
    /**
     * B1-01 F6: save management. Every action goes through `CareerStore` (validation before any
     * write); deleting needs an explicit second confirmation and offers the export first; nothing
     * is offered while a shift is open; the other careers are never touched.
     */
    const money2 = money;
    const download = (name: string, text: string): void => {
      const blob = new Blob([text], { type: 'application/json' });
      const a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      doc.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const showSaves = (message: string | null = null): void => {
      const store = actions.saves;
      model = actions.refresh();
      const rows = q<HTMLElement>('#saves-rows'); rows.replaceChildren();
      const msg = q<HTMLElement>('#saves-message'); msg.textContent = message ?? ''; msg.hidden = !message;
      const confirmBox = q<HTMLElement>('#saves-confirm'); confirmBox.hidden = true; confirmBox.replaceChildren();
      for (const c of model.cards) {
        const row = el(doc, 'div', 'save-row'); row.dataset.career = c.careerId;
        const status = c.problem && !c.saved ? `Save ilegível: ${c.problem}` : c.saved ? `${c.source === 'anterior' ? 'Cópia anterior utilizável' : 'Carreira salva'} · ${c.dayLabel} · checkpoint ${c.checkpoint}${c.balanceCents !== null ? ` · saldo ${money2(c.balanceCents)}` : ''}${c.activeShiftId ? ' · expediente aberto' : ''}` : c.source === 'legado' ? `Calendário antigo (Oeste) · ${c.dayLabel}` : 'Sem save';
        const info = el(doc, 'span', 'save-info'); info.append(el(doc, 'strong', undefined, `${c.name} · ${c.sector}`), el(doc, 'small', undefined, status));
        const btns = el(doc, 'span', 'save-actions');
        const mk = (label: string, act: string, disabled: string | null) => { const b = el(doc, 'button', undefined, label); b.type = 'button'; b.dataset.save = act; b.disabled = disabled !== null || !writable() || !store; if (disabled) b.title = disabled; btns.append(b); return b; };
        const open = c.activeShiftId ? 'Expediente aberto: termine-o antes' : null;
        const exp = mk('Exportar backup', 'exportar', !c.saved ? 'Sem save gravado' : open);
        const imp = mk('Importar backup', 'importar', open);
        const del = mk('Apagar carreira', 'apagar', !c.saved && !c.problem && c.source !== 'legado' ? 'Sem save gravado' : open);
        exp.onclick = () => { try { const text = store!.exportBackup(c.careerId); download(`brejo-alegre-${c.careerId}-checkpoint-${c.checkpoint}.json`, text); showSaves(`Backup de ${c.name} exportado (checkpoint ${c.checkpoint}).`); } catch (e) { showSaves(`Backup NÃO exportado: ${(e as Error).message}`); } };
        imp.onclick = () => {
          const input = q<HTMLInputElement>('#saves-file'); input.value = '';
          input.onchange = async () => {
            const file = input.files?.[0]; if (!file) return;
            const text = await file.text();
            try {
              const pre = store!.previewBackup(text, c.careerId);
              const p = pre.save.profile;
              confirmBox.replaceChildren(el(doc, 'p', undefined, `Restaurar o backup de ${CHARACTERS[pre.save.careerId].name}: checkpoint ${pre.save.checkpointSequence}, dia ${p.calendarIndex}, saldo ${money2(p.balanceCents)}, veículo ${p.vehicle ? VEHICLE_LABEL[p.vehicle.kind] : 'a escolher'}.${pre.replaces ? ' ATENÇÃO: substitui OUTRA carreira deste personagem neste navegador (ela fica como cópia anterior).' : pre.unreadable ? ' O save atual está ilegível e será substituído.' : ''}`));
              const ok = el(doc, 'button', 'primary', pre.replaces || pre.unreadable ? 'Substituir e restaurar' : 'Restaurar backup'); ok.type = 'button'; ok.dataset.save = 'confirmar-importar';
              const cancel = el(doc, 'button', undefined, 'Cancelar'); cancel.type = 'button'; cancel.dataset.save = 'cancelar';
              ok.onclick = () => { try { const r = store!.importBackup(text, c.careerId, { replace: pre.replaces !== null || pre.unreadable }); showSaves(`Backup restaurado: ${CHARACTERS[r.careerId].name}, checkpoint ${r.checkpointSequence}.`); } catch (e) { showSaves(`Backup NÃO restaurado: ${(e as Error).message}`); } };
              cancel.onclick = () => showSaves('Importação cancelada: nada foi gravado.');
              confirmBox.append(ok, cancel); confirmBox.hidden = false; ok.focus();
            } catch (e) { showSaves(`Backup recusado (nada foi gravado): ${(e as Error).message}`); }
          };
          input.click();
        };
        del.onclick = () => {
          confirmBox.replaceChildren(el(doc, 'p', undefined, `Apagar a carreira de ${c.name}? Remove o save principal e a cópia anterior DESTE navegador. As outras três carreiras não mudam. Exporte um backup antes se quiser guardá-la.`));
          const ex = el(doc, 'button', undefined, 'Exportar backup antes'); ex.type = 'button'; ex.dataset.save = 'exportar-antes'; ex.disabled = !c.saved;
          ex.onclick = () => { try { download(`brejo-alegre-${c.careerId}-checkpoint-${c.checkpoint}.json`, store!.exportBackup(c.careerId)); ex.textContent = 'Backup exportado'; } catch (e) { ex.textContent = (e as Error).message; } };
          const ok = el(doc, 'button', 'danger', `Apagar ${c.name} definitivamente`); ok.type = 'button'; ok.dataset.save = 'confirmar-apagar';
          const cancel = el(doc, 'button', undefined, 'Cancelar'); cancel.type = 'button'; cancel.dataset.save = 'cancelar';
          ok.onclick = () => { try { store!.deleteCareer(c.careerId, c.name); showSaves(`Carreira de ${c.name} apagada. O personagem está livre em Novo jogo.`); } catch (e) { showSaves(`Nada foi apagado: ${(e as Error).message}`); } };
          cancel.onclick = () => showSaves('Nada foi apagado.');
          confirmBox.append(ex, ok, cancel); confirmBox.hidden = false; cancel.focus();
        };
        row.append(info, btns); rows.append(row);
      }
      show('saves');
    };
    void CAREER_IDS;
    q<HTMLButtonElement>('[data-menu="gerenciar-saves"]').addEventListener('click', () => showSaves(writable() ? null : OTHER_TAB));
    q<HTMLButtonElement>('#menu-saves [data-menu="voltar-opcoes"]').addEventListener('click', () => { model = actions.refresh(); showOptions(); });
    q<HTMLButtonElement>('[data-menu="tentar-novamente"]').addEventListener('click', async () => {
      if (actions.lock) await actions.lock.retry();
      model = actions.refresh();
      say(writable() ? null : OTHER_TAB);
      if (screen === 'saves') showSaves(); else showHome();
    });
    q<HTMLButtonElement>('[data-menu-home="continuar"]').addEventListener('click', async () => {
      const m = mainScreen(model);
      if (!m.continueCard) return;
      const c = m.continueCard;
      // Continue = the active career exactly as saved (same presets, same vehicle): no new choice.
      if (!(await enter(c, c.appearance, c.equipment, null))) showHome();
    });
    q<HTMLButtonElement>('[data-menu-home="novo"]').addEventListener('click', () => showList('novo'));
    q<HTMLButtonElement>('[data-menu-home="carregar"]').addEventListener('click', () => showList('carregar'));
    q<HTMLButtonElement>('[data-menu-home="opcoes"]').addEventListener('click', showOptions);
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-menu="voltar-inicio"]')) b.addEventListener('click', () => { say(null); showHome(); });
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (screen === 'detail') showList(listMode); else if (screen === 'saves') showOptions(); else if (screen !== 'home') { say(null); showHome(); }
    });
    say(writable() ? null : OTHER_TAB);
    showHome();
  });
}
