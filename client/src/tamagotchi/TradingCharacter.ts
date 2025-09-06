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
    console.log('🎮 TradingCharacter: Initializing...');
    
    try {
      // Try v7 style API first
      this.app = new Application({
        width: 200,
        height: 200,
        backgroundAlpha: 0,
      });
      
      console.log('🎮 TradingCharacter: PixiJS Application created with v7 API');
      
      // Check what canvas property exists
      if (this.app.view) {
        container.appendChild(this.app.view as HTMLCanvasElement);
        console.log('🎮 TradingCharacter: Canvas added via app.view');
      } else if ((this.app as any).canvas) {
        container.appendChild((this.app as any).canvas);
        console.log('🎮 TradingCharacter: Canvas added via app.canvas');
      } else {
        throw new Error('Neither app.view nor app.canvas found');
      }
      
    } catch (v7Error) {
      console.log(
        '🎮 TradingCharacter: v7 API failed, trying v8 API:',
        (v7Error as Error).message,
      );
      
      // Try v8 style API as fallback
      this.app = new Application();
      await this.app.init({
        width: 200,
        height: 200,
        backgroundAlpha: 0,
      });
      
      console.log('🎮 TradingCharacter: PixiJS Application created with v8 API');
      container.appendChild((this.app as any).canvas);
      console.log('🎮 TradingCharacter: Canvas added via v8 canvas');
    }

    try {
      console.log('🎮 TradingCharacter: Loading tradagotchi sprite sheet...');
      const sheet = await Assets.load('/assets/tradagotchi-pixi.json');
      console.log('🎮 TradingCharacter: Tradagotchi sprite sheet loaded:', sheet);
      this.setupAnimations(sheet);
      console.log('🎮 TradingCharacter: Animations set up successfully');
    } catch (err) {
      console.error('🎮 TradingCharacter: sprite sheet could not be loaded', err);
    }
  }

  private setupAnimations(sheet: any) {
    console.log('🎮 TradingCharacter: Setting up animations...');
    const states = ['idle', 'analyzing', 'celebrating', 'worried', 'sleeping'];
    console.log('🎮 Available sheet animations:', Object.keys(sheet.animations || {}));
    
    states.forEach((state) => {
      if (sheet?.animations?.[state]) {
        const anim = new AnimatedSprite(sheet.animations[state]);
        // Set animation speed to match original 100ms per frame (10 FPS)
        anim.animationSpeed = 0.167; 
        anim.loop = true;
        anim.anchor.set(0.5, 0.5);
        anim.x = 100;
        anim.y = 100;
        // Scale down from 512x512 to fit in 200x200 container
        anim.scale.set(0.35);
        this.animations.set(state, anim);
        console.log(`🎮 Created tradagotchi animation for: ${state}`);
      } else {
        console.warn(`🎮 Missing tradagotchi animation for: ${state}`);
      }
    });

    console.log(`🎮 Total animations created: ${this.animations.size}`);
    const idle = this.animations.get('idle');
    if (idle && this.app) {
      this.sprite = idle;
      this.app.stage.addChild(idle);
      idle.play();
      console.log('🎮 Started tradagotchi idle breathing animation');
    } else {
      console.error('🎮 Could not start tradagotchi idle animation - missing idle or app');
    }
  }

  /**
   * Switches the currently playing animation. Falls back to "idle" if the
   * requested state is not available.
   */
  play(state: string) {
    console.log(`🎮 TradingCharacter: Playing animation '${state}'`);
    if (!this.app) {
      console.error('🎮 Cannot play animation - no app');
      return;
    }
    const next = this.animations.get(state) || this.animations.get('idle');
    if (!next) {
      console.error(`🎮 Animation '${state}' not found and no idle fallback`);
      return;
    }
    if (next === this.sprite) {
      console.log('🎮 Animation already playing, skipping');
      return;
    }

    if (this.sprite) {
      this.sprite.stop();
      this.app.stage.removeChild(this.sprite);
      console.log('🎮 Stopped and removed previous animation');
    }
    this.sprite = next;
    this.app.stage.addChild(this.sprite);
    this.sprite.play();
    console.log(`🎮 Started animation '${state}' at position (${this.sprite.x}, ${this.sprite.y})`);
  }
}

