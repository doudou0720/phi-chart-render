import * as verify from '@/verify';
import Judgement from '@/judgement';
import * as TickerFunc from './ticker';
import * as CallbackFunc from './callback';
import Shader from '@/effect/shader';
import { Application, Container, Texture, Sprite, Graphics, Text, Rectangle, settings as PIXISettings } from 'pixi.js';
import type Chart from '@/chart';
import type Effect from '@/effect';
import type WAudio from '@/audio';

(PIXISettings as any).RENDER_OPTIONS.hello = true;

// ===== Extended Pixi types for this project =====

interface RenderSizer {
    shaderScreenSize: number[];
    width: number;
    height: number;
    widthPercent: number;
    widthOffset: number;
    widerScreen: boolean;
    startX: number;
    endX: number;
    startY: number;
    endY: number;
    noteSpeed: number;
    noteScale: number;
    noteWidth: number;
    lineScale: number;
    heightPercent: number;
    textureScale: number;
    [key: string]: unknown;
}

interface ProgressBarSprite extends Sprite {
    baseScaleX: number;
}

interface PauseButtonSprite extends Sprite {
    clickCount: number;
    lastClickTime: number;
    isEndRendering: boolean;
    lastRenderTime: number;
}

interface FakeJudgelineSprite extends Sprite {}

interface GameSprites {
    progressBar: ProgressBarSprite;
    pauseButton: PauseButtonSprite;
    fakeJudgeline: FakeJudgelineSprite;
    [key: string]: Sprite | ProgressBarSprite | PauseButtonSprite | FakeJudgelineSprite;
}

interface GameRender extends Application {
    parentNode: HTMLElement;
    mainContainer: Container;
    gameContainer: Container;
    UIContainer: Container;
    mainContainerMask: Graphics;
    mainContainerCover?: Sprite;
    sizer: RenderSizer;
    fpsText?: Text;
    fpsCounter?: ReturnType<typeof setInterval>;
    watermark?: Text;
}

interface GameSettings {
    resolution: number;
    noteScale: number;
    bgDim: number;
    offset: number;
    speed: number;
    showFPS: boolean;
    showInputPoint: boolean;
    multiNoteHL: boolean;
    showAPStatus: boolean;
    challengeMode: boolean;
    autoPlay: boolean;
    debug: boolean;
    shader: boolean;
}

type CallbackType = 'start' | 'tick' | 'pause' | 'end';
type TickCallback = (game: Game, currentTime: number) => void;
type GameCallback = (game: Game) => void;
type JudgelineProcessor = (judgeline: import('@/chart/judgeline').default, currentTime: number) => void;
type NoteProcessor = (note: import('@/chart/note').default, currentTime: number) => void;

interface GameFunctions {
    start: GameCallback[];
    tick: TickCallback[];
    pause: GameCallback[];
    end: GameCallback[];
    [key: string]: ((game: Game, ...args: any[]) => void)[];
}

interface GameProcessors {
    judgeline: JudgelineProcessor[];
    note: NoteProcessor[];
}

interface GameParams {
    render?: {
        width?: number;
        height?: number;
        resolution?: number;
        autoDensity?: boolean;
        antialias?: boolean;
        canvas?: HTMLCanvasElement;
        resizeTo?: HTMLElement;
    };
    chart?: Chart;
    assets?: {
        textures: Record<string, any>;
        sounds: Record<string, any>;
    };
    effects?: Effect[];
    zipFiles?: Record<string, any>;
    watermark?: string;
    settings?: {
        audioOffset?: number;
        hitsound?: boolean;
        hitsoundVolume?: number;
        speed?: number;
        noteScale?: number;
        bgDim?: number;
        multiNoteHL?: boolean;
        showInputPoint?: boolean;
        challengeMode?: boolean;
        autoPlay?: boolean;
        debug?: boolean;
        showFPS?: boolean;
        showAPStatus?: boolean;
        shader?: boolean;
    };
}

// ===== ProgressBarCache IIFE =====

const ProgressBarCache: Texture = (() =>
{
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = 1920;
    canvas.height = 12;
    ctx.clearRect(0, 0, 1920, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1920, 12);

    const result = Texture.from(canvas);
    Texture.addToCache(result, 'progressBar');

    return result;
})();

// ===== calcResizer =====

function calcResizer(width: number, height: number, noteScale: number = 8000, resolution: number = window.devicePixelRatio): RenderSizer
{
    const result = {} as RenderSizer;

    result.shaderScreenSize = [ width * resolution, height * resolution ];

    result.width  = height / 9 * 16 < width ? height / 9 * 16 : width;
    result.height = height;
    result.widthPercent = result.width * (9 / 160);
    result.widthOffset  = (width - result.width) / 2;

    result.widerScreen = result.width < width ? true : false;

    result.startX = -result.width / 12;
    result.endX   = result.width * (13 / 12);
    result.startY = -result.height / 12;
    result.endY   = result.height * (13 / 12);

    result.noteSpeed     = result.height * 0.6;
    result.noteScale     = result.width / noteScale;
    result.noteWidth     = result.width * 0.117775;
    result.lineScale     = result.width > result.height * 0.75 ? result.height / 18.75 : result.width / 14.0625;
    result.heightPercent = result.height / 1080;
    result.textureScale  = result.height / 750;

    return result;
}

// ===== Game class =====

export default class Game
{
    chart: Chart;
    assets: { textures: Record<string, any>; sounds: Record<string, any> };
    effects: Effect[];
    zipFiles: Record<string, any>;

    render!: GameRender;
    judgement!: Judgement;
    sprites!: GameSprites;
    functions!: GameFunctions;
    processors!: GameProcessors;

    _settings: GameSettings;
    _watermarkText: string;
    _audioOffset: number;
    _animateStatus!: number;
    _gameStartTime!: number;
    _gameEndTime!: number;
    _isPaused: boolean;
    _isEnded: boolean;
    _currentEffects: Effect[];

    _boundResize!: () => void;

    // Bound methods from ticker module
    _calcTick!: () => void;
    _calcGameAnimateTick!: (isStart?: boolean) => void;

    // Bound methods from callback module
    _onKeyPressCallback!: (e: KeyboardEvent) => void;
    _pauseBtnClickCallback!: () => void;
    _gameEndCallback!: () => void;
    _runCallback!: (type: string) => void;

    constructor(_params: GameParams)
    {
        const params = { ..._params } as GameParams;

        if (!params.render) params.render = {};
        if (!params.settings) params.settings = {};

        /* ===== 加载谱面基本信息 ===== */
        this.chart    = params.chart!;
        this.assets   = params.assets!;
        this.effects  = (!!params.settings.shader && params.effects instanceof Array && params.effects.length > 0) ? params.effects : [];
        this.zipFiles = params.zipFiles || {};

        if (!this.chart) throw new Error('You must select a chart to play');
        if (!this.assets) throw new Error('Render must use a texture object for creating sprites.');
        if (!this.zipFiles) this.zipFiles = {};

       /* ===== 创建 render ===== */
        this.render = new Application({
            width           : verify.number(params.render.width, document.documentElement.clientWidth, 0),
            height          : verify.number(params.render.height, document.documentElement.clientHeight, 0),
            resolution      : verify.number(params.render.resolution, window.devicePixelRatio, 1),
            autoDensity     : verify.bool(params.render.autoDensity, true),
            antialias       : verify.bool(params.render.antialias, true),
            view            : params.render.canvas ? params.render.canvas : undefined,
            backgroundAlpha : 1
        }) as unknown as GameRender;
        this.render.parentNode = params.render.resizeTo ? params.render.resizeTo : (params.render.canvas ? params.render.canvas.parentNode as HTMLElement : (this.render.view as HTMLCanvasElement).parentElement!);

        // 创建舞台主渲染区
        this.render.mainContainer = new Container();
        this.render.mainContainer.zIndex = 10;
        this.render.stage.addChild(this.render.mainContainer);

        // 创建游戏精灵容器
        this.render.gameContainer = new Container();
        this.render.gameContainer.zIndex = 20;
        this.render.mainContainer.addChild(this.render.gameContainer);

        // 创建 UI 容器
        this.render.UIContainer = new Container();
        this.render.UIContainer.zIndex = 30;
        this.render.mainContainer.addChild(this.render.UIContainer);

        // 创建舞台主渲染区可见范围
        this.render.mainContainerMask = new Graphics();
        this.render.mainContainerMask.cacheAsBitmap = true;

        /* ===== 创建判定 ===== */
        this.judgement = new Judgement({
            chart          : this.chart,
            stage          : this.render.UIContainer,
            canvas         : this.render.view as HTMLCanvasElement,
            assets         : {
                textures : { normal: this.assets.textures.clickRaw, bad: this.assets.textures.clickRaw },
                sounds   : {
                    tap   : this.assets.sounds.tap,
                    drag  : this.assets.sounds.drag,
                    flick : this.assets.sounds.flick
                },
            },
            hitsound       : verify.bool(params.settings.hitsound, true),
            hitsoundVolume : verify.number(params.settings.hitsoundVolume, 1, 0, 1),
            showAPStatus   : verify.bool(params.settings.showAPStatus, true),
            challangeMode  : verify.bool(params.settings.challengeMode, false),
            autoPlay       : verify.bool(params.settings.autoPlay, false)
        });

        this.sprites = {} as GameSprites;
        this.functions = {
            start: [],
            tick: [],
            pause: [],
            end: []
        };
        this.processors = {
            judgeline: [],
            note: []
        };

        /* ===== 用户设置暂存 ===== */
        this._settings = {
            resolution     : verify.number(params.render.resolution, window.devicePixelRatio, 1),
            noteScale      : verify.number(params.settings.noteScale, 8000),
            bgDim          : verify.number(params.settings.bgDim, 0.5, 0, 1),
            offset         : verify.number(params.settings.audioOffset, 0),
            speed          : verify.number(params.settings.speed, 1, 0, 2),
            showFPS        : verify.bool(params.settings.showFPS, true),
            showInputPoint : verify.bool(params.settings.showInputPoint, true),
            multiNoteHL    : verify.bool(params.settings.multiNoteHL, true),
            showAPStatus   : verify.bool(params.settings.showAPStatus, true),
            challengeMode  : verify.bool(params.settings.challengeMode, false),
            autoPlay       : verify.bool(params.settings.autoPlay, false),
            debug          : verify.bool(params.settings.debug, false),
            shader         : verify.bool(params.settings.shader, true)
        };

        this._watermarkText = verify.text(params.watermark, 'github/MisaLiu/phi-chart-render');

        this._audioOffset = 0;
        this._animateStatus = NaN;
        this._gameStartTime = NaN;
        this._gameEndTime   = NaN;
        this._isPaused = false;
        this._isEnded = false;
        this._currentEffects = [];

        (this as Record<string, any>)._boundResize = this.resize.bind(this);

        for (const name in TickerFunc)
        {
            (this as Record<string, any>)['_' + name] = (TickerFunc as Record<string, Function>)[name].bind(this);
        }
        for (const name in CallbackFunc)
        {
            (this as Record<string, any>)['_' + name] = (CallbackFunc as Record<string, Function>)[name].bind(this);
        }

        if (this._settings.speed < 0.25) throw new Error('Speed too slow');
        else if (this._settings.speed > 2) throw new Error('Speed too fast');

        this.resize(false);
        window.addEventListener('resize', this._boundResize);
        if (this._settings.autoPlay) window.addEventListener('keydown', this._onKeyPressCallback);
    }

    createSprites(): void
    {
        if (this.chart.bg)
        { // 创建超宽屏舞台覆盖
            (this.render as any).mainContainerCover = new Sprite(this.chart.bg);
            const bgCover = new Graphics();

            bgCover.beginFill(0x000000);
            bgCover.drawRect(0, 0, (this.render.mainContainerCover as Sprite).texture.width, (this.render.mainContainerCover as Sprite).texture.height);
            bgCover.endFill();

            bgCover.position.x = -(this.render.mainContainerCover as Sprite).width / 2;
            bgCover.position.y = -(this.render.mainContainerCover as Sprite).height / 2;
            bgCover.alpha = 0.5;

            (this.render.mainContainerCover as Sprite).zIndex = 1;
            (this.render.mainContainerCover as Sprite).addChild(bgCover);
            (this.render.mainContainerCover as Sprite).anchor.set(0.5);

            this.render.stage.addChild(this.render.mainContainerCover!);
        }

        this.chart.createSprites(
            this.render.gameContainer,
            this.render.sizer as any,
            this.assets.textures,
            this.render.UIContainer,
            this.zipFiles,
            this._settings.speed,
            this._settings.bgDim,
            this._settings.multiNoteHL,
            this._settings.debug
        );
        
        if (this._settings.showAPStatus)
        {
            for (const judgeline of this.chart.judgelines)
            {
                if (!judgeline.sprite) continue;
                (judgeline.sprite as Sprite).tint = 0xFFECA0;
            }
        }

        this.judgement.stage = this.render.UIContainer;
        this.judgement.createSprites(this._settings.showInputPoint);

        // 进度条
        this.sprites.progressBar = new Sprite(ProgressBarCache) as ProgressBarSprite;
        this.sprites.progressBar.width = 0;
        this.sprites.progressBar.alpha = 0.75;
        this.sprites.progressBar.zIndex = 99999;
        this.render.UIContainer.addChild(this.sprites.progressBar);

        // 暂停按钮
        this.sprites.pauseButton = new Sprite(this.assets.textures.pauseButton) as PauseButtonSprite;

        this.sprites.pauseButton.eventMode = 'static';
        (this.sprites.pauseButton as any).buttonMode = true;
        this.sprites.pauseButton.on('pointerdown', this._pauseBtnClickCallback);

        this.sprites.pauseButton.hitArea = new Rectangle(
            -(this.sprites.pauseButton.texture.width * 1.5),
            -(this.sprites.pauseButton.texture.height / 2),
            this.sprites.pauseButton.texture.width * 2,
            this.sprites.pauseButton.texture.height * 2
        );
        this.sprites.pauseButton.clickCount = 0;
        this.sprites.pauseButton.lastClickTime = Date.now();
        this.sprites.pauseButton.isEndRendering = false;
        this.sprites.pauseButton.lastRenderTime = Date.now();

        this.sprites.pauseButton.anchor.set(1, 0);
        this.sprites.pauseButton.alpha = 0.5;
        this.sprites.pauseButton.zIndex = 99999;
        this.render.UIContainer.addChild(this.sprites.pauseButton);

        // 假判定线，过场动画用
        this.sprites.fakeJudgeline = new Sprite(this.assets.textures.judgeline) as FakeJudgelineSprite;
        this.sprites.fakeJudgeline.anchor.set(0.5);
        this.sprites.fakeJudgeline.zIndex = 99999;
        if (this._settings.showAPStatus) this.sprites.fakeJudgeline.tint = 0xFFECA0;
        this.render.UIContainer.addChild(this.sprites.fakeJudgeline);

        if (this._settings.showFPS)
        {
            this.render.fpsText = new Text('FPS: 0', {
                fontFamily: 'MiSans',
                align: 'right',
                fill: 0xFFFFFF
            });
            this.render.fpsText.anchor.x = 1;
            this.render.fpsText.alpha = 0.5;
            this.render.fpsText.zIndex = 999999;

            this.render.UIContainer.addChild(this.render.fpsText);
        }

        this.render.watermark = new Text(this._watermarkText, {
            fontFamily: 'MiSans',
            align: 'right',
            fill: 0xFFFFFF
        });
        this.render.watermark.anchor.set(1);
        this.render.watermark.alpha = 0.5;
        this.render.watermark.zIndex = 999999;
        this.render.mainContainer.addChild(this.render.watermark);

        this.render.gameContainer.sortChildren();
        this.render.UIContainer.sortChildren();
        this.render.mainContainer.sortChildren();
        this.render.stage.sortChildren();

        // 加载 Shaders
        this.effects.forEach((effect) =>
        {
            if (effect.shader instanceof Shader) return;
            if (!effect.shader || typeof effect.shader !== 'string')
            {
                effect.shader = null;
                return;
            }

            const shaderName = effect.shader;
            let shader: Shader | null = null;

            if (shaderName.indexOf('/') === 0)
            {
                const shaderNameReal = shaderName.substr(1);
                if (this.zipFiles[shaderNameReal]) shader = this.zipFiles[shaderNameReal];
            }
            else if ((Shader as any).presets[shaderName])
            {
                shader = new Shader((Shader as any).presets[shaderName], shaderName);
            }

            effect.shader = shader;
            
            if (!effect.shader)
            {
                console.log('\'' + shaderName + '\' not found, will be ignored');
                effect.shader = null;
            }
        });
    }

    start(): void
    {
        if (!this.render) return;
        if (!this.chart.music) throw new Error('You must have a music to play');

        this.resize();
        for (const effect of this.effects) effect.reset();

        if (this.render.fpsText)
        {
            this.render.fpsCounter = setInterval(() =>
            {
                this.render.fpsText!.text = 'FPS: ' + (this.render.ticker.FPS).toFixed(0);
            }, 500);
        }

        (this.chart.music as unknown as WAudio).speed = this._settings.speed;
        (this.chart.music as unknown as WAudio).onend = this._gameEndCallback;

        this._animateStatus = 0;
        this._gameStartTime = Date.now();

        (this.chart as any).noteJudgeCallback = this.judgement.calcNote;
        this.render.ticker.add(this._calcTick);

        for (const judgeline of this.chart.judgelines)
        {
            if (!judgeline.sprite) continue;

            judgeline.sprite.alpha = 0;
            if (judgeline.debugSprite) judgeline.debugSprite.visible = false;
        }
        for (const note of this.chart.notes)
        {
            if (!note.sprite) continue;

            note.sprite.alpha = 0;
            if (note.debugSprite) note.debugSprite.visible = false;
            if (note.hitsound) (note.hitsound as any).volume = this.judgement._hitsoundVolume;
        }

        for (const name in this.judgement.sounds)
        {
            (this.judgement.sounds[name] as any).volume = this.judgement._hitsoundVolume;
        }
    }

    pause(): void
    {
        this._isPaused = !this._isPaused;
        (this.judgement.input as any)._isPaused = this._isPaused;

        if (this._isPaused)
        {
            (this.chart.music as unknown as WAudio).pause();
            this._runCallback('pause');
        }
        else
        {
            (this.chart.music as unknown as WAudio).play(true);
        }
    }

    restart(): void
    {
        this.render.ticker.remove(this._calcTick);
        (this.chart.music as unknown as WAudio).reset();

        this.chart.reset();
        this.judgement.reset();

        this.resize();
        for (const effect of this.effects) effect.reset();

        this._isPaused = false;
        this._isEnded = false;

        this._animateStatus = 0;
        this._gameStartTime = Date.now();
        this._gameEndTime   = NaN;

        this.render.ticker.add(this._calcTick);
        if (this._settings.showAPStatus) this.sprites.fakeJudgeline.tint = 0xFFECA0;
        this.sprites.fakeJudgeline.visible = true;

        for (const judgeline of this.chart.judgelines)
        {
            if (!judgeline.sprite) continue;

            judgeline.sprite.alpha = 0;
            if (this._settings.showAPStatus) (judgeline.sprite as Sprite).tint = 0xFFECA0;
            if (judgeline.debugSprite) judgeline.debugSprite.visible = false;
        }
        for (const note of this.chart.notes)
        {
            if (!note.sprite) continue;

            note.sprite.alpha = 0;
            if (note.debugSprite) note.debugSprite.visible = false;
        }
    }

    destroy(removeCanvas: boolean = false): void
    {
        const canvas = this.render.view as HTMLCanvasElement;

        this.render.ticker.remove(this._calcTick);
        (this.chart.music as unknown as WAudio).reset();

        if (this.render.fpsText) clearInterval(this.render.fpsCounter);

        this.chart.reset();
        this.chart.destroySprites();
        this.judgement.destroySprites();

        this.judgement.input.removeListenerFromCanvas(canvas);

        window.removeEventListener('resize', this._boundResize);
        window.removeEventListener('keydown', this._onKeyPressCallback);

        canvas.width = canvas.height = 0;

        this.render.destroy(removeCanvas, { children: true, texture: false, baseTexture: false });
    }

    on(type: string, callback: Function): void
    {
        if (!(this.functions as Record<string, Function[]>)[type]) return;
        if (!(callback instanceof Function)) return;
        (this.functions as Record<string, Function[]>)[type].push(callback);
    }

    addProcessor(type: string, callback: Function): void
    {
        if (!(this.processors as unknown as Record<string, Function[]>)[type]) return;
        if (!(callback instanceof Function)) return;
        (this.processors as unknown as Record<string, Function[]>)[type].push(callback);
    }

    resize(withChartSprites: boolean = true, shouldResetFakeJudgeLine: boolean = true): void
    {
        if (!this.render) return;

        this.render.renderer.resize(this.render.parentNode.clientWidth, this.render.parentNode.clientHeight);

        // 计算新尺寸相关数据
        this.render.sizer = calcResizer(this.render.screen.width, this.render.screen.height, this._settings.noteScale, this._settings.resolution);

        // 主舞台区位置重计算
        this.render.mainContainer.position.x = this.render.sizer.widthOffset;
        // 主舞台可视区域计算
        if (this.render.sizer.widerScreen && this.render.mainContainer)
        {
            this.render.mainContainer.mask = this.render.mainContainerMask;
            this.render.mainContainerMask.visible = true;

            this.render.mainContainerMask.clear()
                .beginFill(0xFFFFFF)
                .drawRect(this.render.sizer.widthOffset, 0, this.render.sizer.width, this.render.sizer.height)
                .endFill();
        }
        else
        {
            this.render.mainContainer.mask = null;
            this.render.mainContainerMask.visible = false;
        }
        // 主舞台超宽屏覆盖计算
        if (this.render.sizer.widerScreen && this.render.mainContainerCover)
        {
            const bgScaleWidth = this.render.screen.width / (this.render.mainContainerCover as Sprite).texture.width;
            const bgScaleHeight = this.render.screen.height / (this.render.mainContainerCover as Sprite).texture.height;
            const bgScale = bgScaleWidth > bgScaleHeight ? bgScaleWidth : bgScaleHeight;

            (this.render.mainContainerCover as Sprite).scale.set(bgScale);
            (this.render.mainContainerCover as Sprite).position.set(this.render.screen.width / 2, this.render.screen.height / 2);

            (this.render.mainContainerCover as Sprite).visible = true;
        }
        else if (this.render.mainContainerCover)
        {
            (this.render.mainContainerCover as Sprite).visible = false;
        }

        if (!this._isEnded && this.sprites)
        {
            if (this.sprites.progressBar)
            {
                this.sprites.progressBar.position.set(0, 0);
                this.sprites.progressBar.scale.y = this.render.sizer.heightPercent;
                this.sprites.progressBar.baseScaleX = this.render.sizer.width / this.sprites.progressBar.texture.baseTexture.width;
            }

            if (this.sprites.pauseButton)
            {
                this.sprites.pauseButton.position.x = this.render.sizer.width - this.render.sizer.heightPercent * 72;
                this.sprites.pauseButton.position.y = this.render.sizer.heightPercent * (61 + 14);
                this.sprites.pauseButton.scale.set(0.94 * this.render.sizer.heightPercent);
            }

            if (this.sprites.fakeJudgeline)
            {
                this.sprites.fakeJudgeline.position.x = this.render.sizer.width / 2;
                this.sprites.fakeJudgeline.position.y = this.render.sizer.height / 2;

                this.sprites.fakeJudgeline.height = this.render.sizer.lineScale * 18.75 * 0.008;
                if (shouldResetFakeJudgeLine || this._isEnded)
                {
                    this.sprites.fakeJudgeline.width = 0;
                }
            }
        }

        // FPS 计数器尺寸计算
        if (this.render.fpsText)
        {
            this.render.fpsText.position.x     = this.render.sizer.width;
            this.render.fpsText.position.y     = 0;
            this.render.fpsText.style.fontSize = this.render.sizer.heightPercent * 32;
            this.render.fpsText.style.padding  = this.render.sizer.heightPercent * 8;
        }

        if (this.render.watermark)
        {
            this.render.watermark.position.x     = this.render.sizer.width;
            this.render.watermark.position.y     = this.render.sizer.height;
            this.render.watermark.style.fontSize = this.render.sizer.heightPercent * 24;
        }
        
        if (withChartSprites)
        {
            this.judgement.resizeSprites(this.render.sizer as any, this._isEnded);
            this.chart.resizeSprites(this.render.sizer as any, this._isEnded);
        }
    }

    gameTimeInSec(): number
    {
        return (Date.now() - this._gameStartTime) / 1000;
    }
}
