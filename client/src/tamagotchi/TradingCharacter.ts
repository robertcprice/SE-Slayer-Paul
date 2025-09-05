import { Application, Assets, AnimatedSprite } from 'pixi.js';

/**
 * TradingCharacter handles PixiJS sprite animations for the tamagotchi
 * style companion. It loads animation frames from a sprite sheet and
 * exposes a simple API to change the current animation state.
 */
export class TradingCharacter {
  private app: Application | null = null;
  private sprite: AnimatedSprite | null = null;
  private animations: Map<string, AnimatedSprite> = new Map();

  /**
   * Initializes the PixiJS application and loads the sprite sheet. The
   * sprite sheet is expected at `public/assets/trader-character.json`.
   * Missing assets are handled gracefully so development can proceed
   * before art is finalized.
   */
  async initialize(container: HTMLElement) {
    this.app = new Application({
      width: 200,
      height: 200,
      backgroundAlpha: 0,
    });

    container.appendChild(this.app.view as HTMLCanvasElement);

    try {
      const sheet = await Assets.load('assets/trader-character.json');
      this.setupAnimations(sheet);
    } catch (err) {
      console.warn('TradingCharacter: sprite sheet could not be loaded', err);
    }
  }

  private setupAnimations(sheet: any) {
    const states = ['idle', 'analyzing', 'celebrating', 'worried', 'sleeping'];
    states.forEach((state) => {
      if (sheet?.animations?.[state]) {
        const anim = new AnimatedSprite(sheet.animations[state]);
        anim.animationSpeed = 0.167; // ~10 FPS
        anim.loop = true;
        this.animations.set(state, anim);
      }
    });

    const idle = this.animations.get('idle');
    if (idle && this.app) {
      this.sprite = idle;
      this.app.stage.addChild(idle);
      idle.play();
    }
  }

  /**
   * Switches the currently playing animation. Falls back to "idle" if the
   * requested state is not available.
   */
  play(state: string) {
    if (!this.app) return;
    const next = this.animations.get(state) || this.animations.get('idle');
    if (!next || next === this.sprite) return;

    if (this.sprite) {
      this.sprite.stop();
      this.app.stage.removeChild(this.sprite);
    }
    this.sprite = next;
    this.app.stage.addChild(this.sprite);
    this.sprite.play();
  }
}

