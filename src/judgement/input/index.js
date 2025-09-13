import ListenerCallback from './callback';
import InputPoint from './point';
import { Graphics } from 'pixi.js';

/**
 * 输入类
 * 处理用户的触摸和鼠标输入，管理输入点的状态
 */
export default class Input
{
    /**
     * 构造函数
     * @param {Object} params - 参数对象
     */
    constructor(params = {})
    {
        if (!params.canvas) throw new Error('You cannot add inputs without a canvas');

        this.inputs = []; // 输入点数组

        // 绑定监听器回调函数
        for (const name in ListenerCallback)
        {
            this['_' + name] = ListenerCallback[name].bind(this);
        }

        this.addListenerToCanvas(params.canvas);
        this.reset();
    }

    /**
     * 添加监听器到画布
     * @param {HTMLCanvasElement} canvas - 画布元素
     */
    addListenerToCanvas(canvas)
    {
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error('This is not a canvas');

        const passiveIfSupported = { passive: false };

        // 添加触摸事件监听器
        canvas.addEventListener('touchstart', this._touchStart, passiveIfSupported);
        canvas.addEventListener('touchmove', this._touchMove, passiveIfSupported);
        canvas.addEventListener('touchend', this._touchEnd, passiveIfSupported);
        canvas.addEventListener('touchcancel', this._touchEnd, passiveIfSupported);

        // 添加鼠标事件监听器（鼠标适配，其实并不打算做）
        canvas.addEventListener('mousedown', this._mouseStart, passiveIfSupported);
        canvas.addEventListener('mousemove', this._mouseMove);
        canvas.addEventListener('mouseup', this._mouseEnd);
        
        // canvas.addEventListener('contextmenu', this._noCanvasMenu, passiveIfSupported);
    }

    /**
     * 从画布移除监听器
     * @param {HTMLCanvasElement} canvas - 画布元素
     */
    removeListenerFromCanvas(canvas)
    {
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error('This is not a canvas');

        canvas.removeEventListener('touchstart', this._touchStart);
        canvas.removeEventListener('touchmove', this._touchMove);
        canvas.removeEventListener('touchend', this._touchEnd);
        canvas.removeEventListener('touchcancel', this._touchEnd);

        // 移除鼠标事件监听器
        canvas.removeEventListener('mousedown', this._mouseStart);
        canvas.removeEventListener('mousemove', this._mouseMove);
        canvas.removeEventListener('mouseup', this._mouseEnd);

        // canvas.removeEventListener('contextmenu', this._noCanvasMenu);
    }

    /**
     * 重置输入状态
     */
    reset()
    {
        this.inputs.length = 0;
    }

    /**
     * 创建输入精灵
     * @param {Container} stage - Pixi舞台容器
     * @param {boolean} showInputPoint - 是否显示输入点
     */
    createSprite(stage, showInputPoint = true)
    {
        if (showInputPoint)
        {
            this.sprite = new Graphics();
            this.sprite.zIndex = 99999;
            stage.addChild(this.sprite);
        }
    }

    /**
     * 添加输入点
     * @param {number} type - 输入类型
     * @param {number} id - 输入ID
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    addInput(type, id, x, y)
    {
        const { inputs } = this;
        let idx = inputs.findIndex(point => point.type === type && point.id === id);
        if (idx !== -1) inputs.splice(idx, 1);
        inputs.push(new InputPoint(type, id, x, y));
    }

    /**
     * 移动输入点
     * @param {number} type - 输入类型
     * @param {number} id - 输入ID
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    moveInput(type, id, x, y)
    {
        const { inputs } = this;
        let point = inputs.find(point => point.type === type && point.id === id);
        if (point) point.move(x, y);
    }

    /**
     * 移除输入点
     * @param {number} type - 输入类型
     * @param {number} id - 输入ID
     */
    removeInput(type, id)
    {
        const { inputs } = this;
        let point = inputs.find(point => point.type === type && point.id === id);
        if (point) point.isActive = false;
    }

    /**
     * 计算每帧逻辑
     */
    calcTick()
    {
        const { inputs } = this;

        if (this.sprite) this.sprite.clear();

        // 更新输入点状态和显示
        for (let i = 0, length = inputs.length; i < length; i++)
        {
            let point = inputs[i];

            // 绘制输入点
            if (this.sprite)
            {
                this.sprite
                    .beginFill(!point.isTapped ? 0xFFFF00 : point.isMoving ? 0x00FFFF : 0xFF00FF)
                    .drawCircle(point.x, point.y, this._inputPointSize)
                    .endFill();
            }

            // 更新输入点状态
            if (point.isActive)
            {
                point.isTapped = true;
                point.isMoving = false;
            }
            else
            {
                inputs.splice(i--, 1);
                length -= 1;
            }
        }
    }

    /**
     * 调整精灵尺寸
     * @param {Object} size - 尺寸对象
     */
    resizeSprites(size)
    {
        this.renderSize = size;
        this._inputPointSize = this.renderSize.heightPercent * 30; // 输入点尺寸
    }

    /**
     * 销毁精灵对象
     */
    destroySprites()
    {
        if (this.sprite)
        {
            this.sprite.destroy();
            this.sprite = undefined;
        }
    }
}