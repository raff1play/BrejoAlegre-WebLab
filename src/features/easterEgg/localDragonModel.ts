import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';

/**
 * Loads an owned GLB from the player's local file picker. No upload, URL,
 * third-party CDN or public-repository redistribution of copyrighted assets.
 *
 * Only constructed by the ?dragon=1 dynamic chunk. The original procedural
 * dragon remains an automatic fallback until the local GLB loads successfully.
 */
export class LocalDragonModel {
  private readonly button: HTMLButtonElement;
  private readonly picker: HTMLInputElement;
  private readonly notice: HTMLSpanElement;
  private container: AssetContainer | null = null;
  private root: TransformNode | null = null;
  private socket: TransformNode | null = null;
  private flight: AnimationGroup | null = null;
  private roarAnimation: AnimationGroup | null = null;
  private activeAnimation: AnimationGroup | null = null;
  private playing = false;
  private loading = false;
  private disposed = false;

  constructor(private readonly scene: Scene, private readonly hasStarted: () => boolean) {
    const wrapper = document.createElement('div');
    wrapper.id = 'dragon-model-picker';
    Object.assign(wrapper.style, {
      position: 'fixed', zIndex: '151',
      top: 'max(96px, calc(env(safe-area-inset-top) + 96px))',
      right: 'max(12px, env(safe-area-inset-right))',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
      gap: '4px', maxWidth: 'min(56vw, 290px)', pointerEvents: 'none',
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Carregar dragão realista (.glb)';
    button.setAttribute('aria-label', 'Selecionar modelo GLB no celular sem enviar arquivos');
    Object.assign(button.style, {
      color: '#fff', background: 'rgba(23,29,37,.92)', padding: '9px 12px',
      border: '1px solid rgba(240,179,70,.85)', borderRadius: '12px',
      fontSize: '12px', fontWeight: '700', cursor: 'pointer',
      touchAction: 'manipulation', pointerEvents: 'auto',
    });
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    status.textContent = 'Arquivo permanece no aparelho';
    Object.assign(status.style, {
      fontSize: '11px', color: '#f3e6ce', textAlign: 'right',
      lineHeight: '1.3', textShadow: '0 1px 3px #000',
    });
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,model/gltf-binary';
    input.hidden = true;
    wrapper.append(button, status, input);
    document.body.appendChild(wrapper);
    this.button = button;
    this.picker = input;
    this.notice = status;

    button.addEventListener('click', () => {
      if (this.loading || this.disposed) return;
      if (this.hasStarted()) {
        this.notice.textContent = 'Reabra ?dragon=1 e carregue o GLB antes de 45 km/h.';
        return;
      }
      input.click();
    });
    input.addEventListener('change', () => {
      const file = input.files?.item(0);
      if (file) void this.load(file);
      input.value = '';
    });
  }

  get ready(): boolean { return this.root !== null && !this.disposed; }

  private async load(file: File): Promise<void> {
    if (this.loading || this.hasStarted() || this.disposed) return;
    if (!file.name.toLowerCase().endsWith('.glb')) {
      this.notice.textContent = 'Selecione o arquivo .glb extraído do ZIP.';
      return;
    }
    // Prevent accidental huge uploads. The supplied Ashwing model is around 11 MB.
    if (file.size < 1000 || file.size > 60 * 1024 * 1024) {
      this.notice.textContent = 'Arquivo inválido ou maior que 60 MB.';
      return;
    }
    this.loading = true;
    this.button.disabled = true;
    this.notice.textContent = 'Importando modelo e animações no aparelho…';
    let incoming: AssetContainer | null = null;
    let anchor: TransformNode | null = null;
    try {
      // Keep heavy GLB importer completely absent from the standard game bundle.
      await import('@babylonjs/loaders/glTF/2.0');
      const { LoadAssetContainerAsync } = await import('@babylonjs/core/Loading/sceneLoader');
      incoming = await LoadAssetContainerAsync(file, this.scene, { pluginExtension: '.glb' });
      const mesh = incoming.meshes.find((m) => m.name === 'Ashwing_Drake_Lite');
      const flight = incoming.animationGroups.find((a) => a.name.toLowerCase() === 'fly_loop');
      if (!mesh || !flight) throw new Error('GLB não contém a malha ou a animação fly_loop esperada.');
      anchor = new TransformNode('surpresa-ashwing-local', this.scene);
      incoming.addAllToScene();
      for (const node of incoming.rootNodes) node.parent = anchor;
      for (const animation of incoming.animationGroups) animation.stop();
      anchor.setEnabled(false);
      const mouth = incoming.transformNodes.find((n) => n.name === 'breath_socket') ?? null;

      // A second selection disposes the old preview before replacing it.
      this.releaseModel();
      this.container = incoming;
      this.root = anchor;
      this.socket = mouth;
      this.flight = flight;
      this.roarAnimation = incoming.animationGroups.find((a) => a.name.toLowerCase() === 'roar') ?? null;
      incoming = null;
      anchor = null;
      this.notice.textContent = 'Ashwing pronto! Acelere até 45 km/h.';
      this.button.textContent = 'Trocar modelo GLB';
    } catch (error) {
      console.warn('Falha ao importar Ashwing GLB; dragão original preservado', error);
      this.notice.textContent = 'Não foi possível importar. O dragão original continua disponível.';
      incoming?.dispose();
      anchor?.dispose();
    } finally {
      this.loading = false;
      this.button.disabled = false;
    }
  }

  /** Called once when the 45 km/h sequence actually begins. */
  begin(): TransformNode | null {
    if (!this.root || this.disposed) return null;
    this.playing = true;
    this.root.setEnabled(true);
    this.play(this.flight, true);
    this.button.hidden = true;
    this.notice.hidden = true;
    return this.root;
  }

  /** The roar clip is used during the fire breath; the Lite pack has no fire-breath clip. */
  update(time: number): void {
    if (!this.playing) return;
    const wanted = time >= 2.2 && time < 4.1 ? (this.roarAnimation ?? this.flight) : this.flight;
    if (wanted !== this.activeAnimation) this.play(wanted, wanted === this.flight);
  }

  /** Animated rig socket is preferable to the old hardcoded procedural mouth. */
  mouthWorldPosition(): ReturnType<TransformNode['getAbsolutePosition']> | null {
    return this.playing && this.socket ? this.socket.getAbsolutePosition() : null;
  }

  private play(next: AnimationGroup | null, loop: boolean): void {
    if (!next || this.activeAnimation === next) return;
    this.activeAnimation?.stop();
    next.start(loop, 1);
    this.activeAnimation = next;
  }

  private releaseModel(): void {
    this.activeAnimation?.stop();
    this.activeAnimation = null;
    this.flight = null;
    this.roarAnimation = null;
    this.socket = null;
    this.root?.dispose();
    this.root = null;
    this.container?.dispose();
    this.container = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseModel();
    this.button.parentElement?.remove();
  }
}
