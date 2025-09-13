import * as verify from '@/verify';
import Judgement from '@/judgement';
import * as TickerFunc from './ticker';
import * as CallbackFunc from './callback';
import { Shader } from '@/main';
import { Application, Container, Texture, Sprite, Graphics, Text, Rectangle, settings as PIXISettings } from 'pixi.js';

PIXISettings.RENDER_OPTIONS.hello = true;

/**
 * 进度条缓存
 * 创建一个用于显示进度条的纹理
 */
const ProgressBarCache = (() =>
{
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 1920;
    canvas.height = 12;
    ctx.clearRect(0, 0, 1920, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1920, 12);

    const result = Texture.from(canvas);
    Texture.addToCache(result, 'progressBar');

    return result;
})();

/**
  * 游戏类
  * 管理整个游戏的渲染、音频、输入和判定等核心功能
  * @param {Object} _params - 游戏参数对象
  * {
  *     render: {
  *         width?,
  *         height?,
  *         resolution?,
  *         autoDensity?,
  *         antialias?,
  *         view?,
  *         resizeTo?
  *     },
  *     chart,
  *     assets,
  *     effects?,
  *     zipFiles?,
  *     watermark?,
  *     settings: {
  *         audioOffset?,
  *         hitsound?,
  *         hitsoundVolume?,
  *         speed?,
  *         noteScale?,
  *         bgDim?,
  *         multiNoteHL?,
  *         showInputPoint?,
  *         challengeMode?,
  *         autoPlay?,
  *         debug?
  *     }
  * }
 **/
export default class Game
{
    /**
     * 构造函数
     * @param {Object} _params - 游戏参数
     */
    constructor(_params)
    {
        let params = { ..._params };

        if (!params.render) params.render = {};
        if (!params.settings) params.settings = {};

        /* ===== 加载谱面基本信息 ===== */
        this.chart    = params.chart;    // 谱面对象
        this.assets   = params.assets;   // 资源对象
        this.effects  = (!!params.settings.shader && params.effects instanceof Array && params.effects.length > 0) ? params.effects : []; // 特效数组
        this.zipFiles = params.zipFiles; // ZIP文件对象

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
        });
        this.render.parentNode = params.render.resizeTo ? params.render.resizeTo : (params.render.canvas ? params.render.canvas.parentNode : this.render.view.parentElement);

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
            canvas         : this.render.view,
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
            challengeMode  : verify.bool(params.settings.challengeMode, false),
            autoPlay       : verify.bool(params.settings.autoPlay, false)
        });

        this.sprites = {};      // 精灵对象
        this.functions = {      // 回调函数对象
            start: [],          // 开始回调
            tick: [],           // 每帧回调
            pause: [],          // 暂停回调
            end: []             // 结束回调
        };
        this.processors = {     // 处理器对象
            judgeline: [],      // 判定线处理器
            note: []            // 音符处理器
        };

        /* ===== 用户设置暂存 ===== */
        this._settings = {
            resolution     : verify.number(params.render.resolution, window.devicePixelRatio, 1),  // 分辨率
            noteScale      : verify.number(params.settings.noteScale, 8000),                      // 音符缩放
            bgDim          : verify.number(params.settings.bgDim, 0.5, 0, 1),                     // 背景暗化
            offset         : verify.number(params.settings.audioOffset, 0),                      // 音频偏移
            speed          : verify.number(params.settings.speed, 1, 0, 2),                       // 播放速度
            showFPS        : verify.bool(params.settings.showFPS, true),                          // 显示FPS
            showInputPoint : verify.bool(params.settings.showInputPoint, true),                   // 显示输入点
            multiNoteHL    : verify.bool(params.settings.multiNoteHL, true),                      // 多押高亮
            showAPStatus   : verify.bool(params.settings.showAPStatus, true),                     // 显示AP状态
            challengeMode  : verify.bool(params.settings.challengeMode, false),                   // 挑战模式
            autoPlay       : verify.bool(params.settings.autoPlay, false),                        // 自动播放
            debug          : verify.bool(params.settings.debug, false),                           // 调试模式
            shader         : verify.bool(params.settings.shader, true)                            // 着色器特效
        };

        this._watermarkText = verify.text(params.watermark, 'github/MisaLiu/phi-chart-render'); // 水印文本

        this._audioOffset = 0;          // 音频偏移
        this._animateStatus = NaN;      // 动画状态
        this._gameStartTime = NaN;      // 游戏开始时间
        this._gameEndTime   = NaN;      // 游戏结束时间
        this._isPaused = false;         // 是否暂停
        this._isEnded = false;          // 是否结束
        this._currentEffects = [];      // 当前特效

        this.resize = this.resize.bind(this);

        // 绑定Ticker函数
        for (const name in TickerFunc)
        {
            this['_' + name] = TickerFunc[name].bind(this);
        }
        // 绑定回调函数
        for (const name in CallbackFunc)
        {
            this['_' + name] = CallbackFunc[name].bind(this);
        }

        // 检查播放速度范围
        if (this._settings.speed < 0.25) throw new Error('Speed too slow');
        else if (this._settings.speed > 2) throw new Error('Speed too fast');

        this.resize(false);
        window.addEventListener('resize', this.resize);
        if (this._settings.autoPlay) window.addEventListener('keydown', this._onKeyPressCallback);
    }

    /**
     * 创建游戏精灵
     */
    createSprites()
    {
        if (this.chart.bg)
        { // 创建超宽屏舞台覆盖
            this.render.mainContainerCover = new Sprite(this.chart.bg);
            let bgCover = new Graphics();

            bgCover.beginFill(0x000000);
            bgCover.drawRect(0, 0, this.render.mainContainerCover.texture.width, this.render.mainContainerCover.texture.height);
            bgCover.endFill();

            bgCover.position.x = -this.render.mainContainerCover.width / 2;
            bgCover.position.y = -this.render.mainContainerCover.height / 2;
            bgCover.alpha = 0.5;

            this.render.mainContainerCover.zIndex = 1;
            this.render.mainContainerCover.addChild(bgCover);
            this.render.mainContainerCover.anchor.set(0.5);

            this.render.stage.addChild(this.render.mainContainerCover);
        }

        // 创建谱面精灵
        this.chart.createSprites(
            this.render.gameContainer,
            this.render.sizer,
            this.assets.textures,
            this.render.UIContainer,
            this.zipFiles,
            this._settings.speed,
            this._settings.bgDim,
            this._settings.multiNoteHL,
            this._settings.debug
        );
        
        // 显示AP状态
        if (this._settings.showAPStatus)
        {
            for (const judgeline of this.chart.judgelines)
            {
                if (!judgeline.sprite) continue;
                judgeline.sprite.tint = 0xFFECA0;
            };
        }

        // 创建判定精灵
        this.judgement.stage = this.render.UIContainer;
        this.judgement.createSprites(this._settings.showInputPoint);

        // 进度条
        this.sprites.progressBar = new Sprite(ProgressBarCache);
        this.sprites.progressBar.width = 0;
        this.sprites.progressBar.alpha = 0.75;
        this.sprites.progressBar.zIndex = 99999;
        this.render.UIContainer.addChild(this.sprites.progressBar);

        // 暂停按钮
        this.sprites.pauseButton = new Sprite(this.assets.textures.pauseButton);

        // this.sprites.pauseButton.interactive = true;
        this.sprites.pauseButton.eventMode = 'static';
        this.sprites.pauseButton.buttonMode = true;
        // this.sprites.pauseButton.cursor = 'pointer';
        this.sprites.pauseButton.on('pointerdown', this._pauseBtnClickCallback);

        this.sprites.pauseButton.hitArea = new Rectangle(
            -(this.sprites.pauseButton.texture.width * 1.5),
            -(this.sprites.pauseButton.texture.height / 2),
            this.sprites.pauseButton.texture.width * 2,
            this.sprites.pauseButton.texture.height * 2
        );
        this.sprites.pauseButton.clickCount = 0;          // 点击次数
        this.sprites.pauseButton.lastClickTime = Date.now(); // 上次点击时间
        this.sprites.pauseButton.isEndRendering = false;     // 是否结束渲染
        this.sprites.pauseButton.lastRenderTime = Date.now(); // 上次渲染时间

        this.sprites.pauseButton.anchor.set(1, 0);
        this.sprites.pauseButton.alpha = 0.5;
        this.sprites.pauseButton.zIndex = 99999;
        this.render.UIContainer.addChild(this.sprites.pauseButton);

        // 假判定线，过场动画用
        this.sprites.fakeJudgeline = new Sprite(this.assets.textures.judgeline);
        this.sprites.fakeJudgeline.anchor.set(0.5);
        this.sprites.fakeJudgeline.zIndex = 99999;
        if (this._settings.showAPStatus) this.sprites.fakeJudgeline.tint = 0xFFECA0;
        this.render.UIContainer.addChild(this.sprites.fakeJudgeline);

        // FPS显示
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

        // 水印
        this.render.watermark = new Text(this._watermarkText, {
            fontFamily: 'MiSans',
            align: 'right',
            fill: 0xFFFFFF
        });
        this.render.watermark.anchor.set(1);
        this.render.watermark.alpha = 0.5;
        this.render.watermark.zIndex = 999999;
        this.render.mainContainer.addChild(this.render.watermark);

        // 对子元素按zIndex排序
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
            let shader = null;

            if (shaderName.indexOf('/') === 0)
            {
                const shaderNameReal = shaderName.substr(1);
                if (this.zipFiles[shaderNameReal]) shader = this.zipFiles[shaderNameReal];
            }
            else if (Shader.presets[shaderName])
            {
                shader = new Shader(Shader.presets[shaderName], shaderName);
            }

            effect.shader = shader;
            
            if (!effect.shader)
            {
                console.log('\'' + shaderName + '\' not found, will be ignored');
                effect.shader = null;
            }
        });
    }

    /**
     * 开始游戏
     */
    start()
    {
        if (!this.render) return;
        if (!this.chart.music) throw new Error('You must have a music to play');

        this.resize();
        for (const effect of this.effects) effect.reset();

        // FPS计数器
        if (this.render.fpsText)
        {
            this.render.fpsCounter = setInterval(() =>
            {
                this.render.fpsText.text = 'FPS: ' + (this.render.ticker.FPS).toFixed(0);
            }, 500);
        }

        // 设置音乐参数
        this.chart.music.speed = this._settings.speed;
        this.chart.music.onend = this._gameEndCallback;

        // 设置游戏状态
        this._animateStatus = 0;
        this._gameStartTime = Date.now();

        this.chart.noteJudgeCallback = this.judgement.calcNote;
        this.render.ticker.add(this._calcTick);

        // 隐藏判定线和音符
        for (const judgeline of this.chart.judgelines)
        {
            if (!judgeline.sprite) continue;

            judgeline.sprite.alpha = 0;
            if (judgeline.debugSprite) judgeline.debugSprite.visible = false;
        };
        for (const note of this.chart.notes)
        {
            if (!note.sprite) continue;

            note.sprite.alpha = 0;
            if (note.debugSprite) note.debugSprite.visible = false;
            if (note.hitsound) note.hitsound.volume = this.judgement._hitsoundVolume;
        };

        // 设置音效音量
        for (const name in this.judgement.sounds)
        {
            this.judgement.sounds[name].volume = this.judgement._hitsoundVolume;
        }
    }

    /**
     * 暂停/继续游戏
     */
    pause()
    {
        this._isPaused = !this._isPaused;
        this.judgement.input._isPaused = this._isPaused;

        if (this._isPaused)
        {
            this.chart.music.pause();
            this._runCallback('pause');
        }
        else
        {
            this.chart.music.play(true);
        }
    }

    /**
     * 重新开始游戏
     */
    restart()
    {
        this.render.ticker.remove(this._calcTick);
        this.chart.music.reset();

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

        // 隐藏判定线和音符
        for (const judgeline of this.chart.judgelines)
        {
            if (!judgeline.sprite) continue;

            judgeline.sprite.alpha = 0;
            if (this._settings.showAPStatus) judgeline.sprite.tint = 0xFFECA0;
            if (judgeline.debugSprite) judgeline.debugSprite.visible = false;
        };
        for (const note of this.chart.notes)
        {
            if (!note.sprite) continue;

            note.sprite.alpha = 0;
            if (note.debugSprite) note.debugSprite.visible = false;
        };
    }

    /**
     * 销毁游戏
     * @param {boolean} removeCanvas - 是否移除画布
     */
    destroy(removeCanvas = false)
    {
        const canvas = this.render.view;

        this.render.ticker.remove(this._calcTick);
        this.chart.music.reset();

        if (this.render.fpsText) clearInterval(this.render.fpsCounter);

        this.chart.reset();
        this.chart.destroySprites();
        this.judgement.destroySprites();

        this.judgement.input.removeListenerFromCanvas(canvas);

        window.removeEventListener('resize', this.resize);
        window.removeEventListener('keydown', this._onKeyPressCallback);

        canvas.width = canvas.height = 0;

        this.render.destroy(removeCanvas, { children: true, texture: false, baseTexture: false });
    }

    /**
     * 添加事件监听器
     * @param {string} type - 事件类型
     * @param {Function} callback - 回调函数
     */
    on(type, callback)
    {
        if (!this.functions[type]) return;
        if (!(callback instanceof Function)) return;
        this.functions[type].push(callback);
    }

    /**
     * 添加处理器
     * @param {string} type - 处理器类型
     * @param {Function} callback - 回调函数
     */
    addProcessor(type, callback)
    {
        if (!this.processors[type]) return;
        if (!(callback instanceof Function)) return;
        this.processors[type].push(callback);
    }

    /**
     * 调整窗口大小
     * @param {boolean} withChartSprites - 是否调整谱面精灵
     * @param {boolean} shouldResetFakeJudgeLine - 是否重置假判定线
     */
    resize(withChartSprites = true, shouldResetFakeJudgeLine = true)
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
            let bgScaleWidth = this.render.screen.width / this.render.mainContainerCover.texture.width;
            let bgScaleHeight = this.render.screen.height / this.render.mainContainerCover.texture.height;
            let bgScale = bgScaleWidth > bgScaleHeight ? bgScaleWidth : bgScaleHeight;

            this.render.mainContainerCover.scale.set(bgScale);
            this.render.mainContainerCover.position.set(this.render.screen.width / 2, this.render.screen.height / 2);

            this.render.mainContainerCover.visible = true;
        }
        else if (this.render.mainContainerCover)
        {
            this.render.mainContainerCover.visible = false;
        }

        // 调整精灵位置和尺寸
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

        // 水印尺寸计算
        if (this.render.watermark)
        {
            this.render.watermark.position.x     = this.render.sizer.width;
            this.render.watermark.position.y     = this.render.sizer.height;
            this.render.watermark.style.fontSize = this.render.sizer.heightPercent * 24;
        }
        
        // 调整谱面精灵
        if (withChartSprites)
        {
            this.judgement.resizeSprites(this.render.sizer, this._isEnded);
            this.chart.resizeSprites(this.render.sizer, this._isEnded);
        }
    }

    /**
     * 获取游戏时间（秒）
     * @returns {number} 游戏时间（秒）
     */
    gameTimeInSec() {
        return (Date.now() - this._gameStartTime) / 1000;
    }
}

/**
 * 计算尺寸调整器
 * 根据屏幕尺寸计算游戏元素的尺寸和位置参数
 * @param {number} width - 屏幕宽度
 * @param {number} height - 屏幕高度
 * @param {number} noteScale - 音符缩放比例
 * @param {number} resolution - 分辨率
 * @returns {Object} 尺寸参数对象
 */
function calcResizer(width, height, noteScale = 8000, resolution = window.devicePixelRatio)
{
    let result = {};

    result.shaderScreenSize = [ width * resolution, height * resolution ]; // 着色器屏幕尺寸

    result.width  = height / 9 * 16 < width ? height / 9 * 16 : width;     // 宽度
    result.height = height;                                                // 高度
    result.widthPercent = result.width * (9 / 160);                       // 宽度百分比
    result.widthOffset  = (width - result.width) / 2;                     // 宽度偏移

    result.widerScreen = result.width < width ? true : false;             // 是否为宽屏

    result.startX = -result.width / 12;                                   // 起始X坐标
    result.endX   = result.width * (13 / 12);                             // 结束X坐标
    result.startY = -result.height / 12;                                  // 起始Y坐标
    result.endY   = result.height * (13 / 12);                            // 结束Y坐标

    result.noteSpeed     = result.height * 0.6;                           // 音符速度
    result.noteScale     = result.width / noteScale;                      // 音符缩放
    result.noteWidth     = result.width * 0.117775;                       // 音符宽度
    result.lineScale     = result.width > result.height * 0.75 ? result.height / 18.75 : result.width / 14.0625; // 判定线缩放
    result.heightPercent = result.height / 1080;                          // 高度百分比
    result.textureScale  = result.height / 750;                           // 纹理缩放

    return result;
}