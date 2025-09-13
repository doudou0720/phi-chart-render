import * as verify from '@/verify';
import utils from './convert/utils';
import { Sprite, Container, Text, Graphics } from 'pixi.js';

/**
 * 判定线类
 * 表示Phigros谱面中的判定线，包含位置、旋转、缩放等属性以及相关事件
 */
export default class Judgeline
{
    /**
     * 构造函数
     * @param {Object} params - 参数对象
     */
    constructor(params)
    {
        this.id               = verify.number(params.id, -1, 0);                 // 判定线ID
        this.texture          = params.texture ? params.texture : null;          // 纹理名称
        this.parentLine       = params.parentLine || params.parentLine === 0 ? params.parentLine : null; // 父级判定线
        this.zIndex           = verify.number(params.zIndex, NaN);               // Z轴索引
        this.isCover          = verify.bool(params.isCover, true);               // 是否覆盖
        this.useOfficialScale = false;                                           // 是否使用官方缩放

        this.eventLayers = [];          // 事件层列表
        this.floorPositions = [];       // 地板位置列表
        this.extendEvent = {            // 扩展事件
            color: [],                  // 颜色事件
            scaleX: [],                 // X轴缩放事件
            scaleY: [],                 // Y轴缩放事件
            text: [],                   // 文本事件
            incline: []                 // 倾斜事件
        };
        this.noteControls = {           // 音符控制参数
            alpha: [],                  // 透明度控制
            scale: [],                  // 缩放控制
            x: [],                      // X轴位置控制
            /* y: [] */                 // Y轴位置控制（注释掉）
        };
        this.isText = false;            // 是否为文本判定线
        
        this.sprite = undefined;        // Pixi精灵对象

        this.reset();
    }

    /**
     * 重置判定线状态
     */
    reset()
    {
        this.speed = 1;         // 速度
        this.x     = 0.5;       // X坐标
        this.y     = 0.5;       // Y坐标
        this.alpha = 1;         // 透明度
        this.deg   = 0;         // 角度（度数）
        this.sinr  = 0;         // 角度的正弦值
        this.cosr  = 1;         // 角度的余弦值

        this.floorPosition = 0; // 地板位置

        this.baseScaleX = 3;    // 基础X轴缩放
        this.baseScaleY = 2.88; // 基础Y轴缩放
        
        // 设置X轴缩放值
        if (this.extendEvent.scaleX.length > 0 && this.extendEvent.scaleX[0].startTime <= 0) this.scaleX = this.extendEvent.scaleX[0].start;
        else this.scaleX = 1;
        
        // 设置Y轴缩放值
        if (this.extendEvent.scaleY.length > 0 && this.extendEvent.scaleY[0].startTime <= 0) this.scaleY = this.extendEvent.scaleY[0].start;
        else this.scaleY = 1;

        this.inclineSinr = NaN; // 倾斜正弦值
        this.color = NaN;       // 颜色值

        // 重置精灵属性
        if (this.sprite)
        {
            this.sprite.alpha = 1;
            this.sprite.angle = 0;
            this.sprite.scale.set(1);

            if (this.isText)
            {
                this.sprite.text = '';
            }
        }
    }

    /**
     * 对事件进行排序
     * @param {boolean} withEndTime - 是否包含结束时间
     */
    sortEvent(withEndTime = false)
    {
        // 对每个事件层进行排序
        this.eventLayers.forEach((eventLayer) =>
        {
            eventLayer.sort();
        });

        // 对扩展事件按开始时间排序
        for (const name in this.extendEvent)
        {
            this.extendEvent[name].sort((a, b) => a.startTime - b.startTime);
        }

        // 处理事件层中的事件
        for (const name in this.eventLayers[0])
        {
            if (name == 'speed' || !(this.eventLayers[0][name] instanceof Array)) continue;
            if (this.eventLayers[0][name].length <= 0) continue;
            if (this.eventLayers[0][name][0].startTime <= 0) continue;
            this.eventLayers[0][name].unshift({
                startTime : 1 - 100,
                endTime   : this.eventLayers[0][name][0].startTime,
                start     : 0,
                end       : 0
            });
        }

        // 对音符控制参数按Y轴排序
        for (const name in this.noteControls)
        {
            this.noteControls[name].sort((a, b) => b.y - a.y);
        }
    }

    /**
     * 计算地板位置
     */
    calcFloorPosition()
    {
        if (this.eventLayers.length <= 0) throw new Error('No event layer in this judgeline');

        // 计算没有速度事件的层数
        let noSpeedEventsLayerCount = 0;
        this.eventLayers.forEach((eventLayer) =>
        {
            eventLayer.speed = utils.arrangeSameSingleValueEvent(eventLayer.speed);
            if (eventLayer.speed.length < 1) noSpeedEventsLayerCount++;
        });

        // 如果所有层都没有速度事件，则添加默认速度事件
        if (noSpeedEventsLayerCount == this.eventLayers.length)
        {
            console.warn('Line ' + this.id + ' don\'t have any speed event, use default speed.');
            this.eventLayers[0].speed.push({
                startTime: 0,
                endTime: 1e4,
                start: 1,
                end: 1
            });
        }

        // 记录相同时间的速度事件
        let sameTimeSpeedEventAlreadyExist = {};
        let currentFloorPosition = 0;
        let floorPositions = [];

        this.floorPositions = [];

        // 处理每个事件层中的速度事件
        this.eventLayers.forEach((eventLayer, eventLayerIndex) =>
        {
            eventLayer.speed.forEach((event, eventIndex) =>
            {
                event.endTime = eventLayer.speed[eventIndex + 1] ? eventLayer.speed[eventIndex + 1].startTime : 1e4;

                let eventTime = (event.startTime).toFixed(3);

                if (!sameTimeSpeedEventAlreadyExist[eventTime])
                {
                    floorPositions.push({
                        startTime     : event.startTime,
                        endTime       : NaN,
                        floorPosition : NaN
                    });
                }

                sameTimeSpeedEventAlreadyExist[eventTime] = true;
            });

            // 如果第一个事件的开始时间大于0，则添加默认事件
            if (eventLayerIndex === 0 && eventLayer.speed[0].startTime > 0)
            {
                eventLayer.speed.unshift({
                    startTime : 1 - 100,
                    endTime   : eventLayer.speed[0] ? eventLayer.speed[0].startTime : 1e4,
                    value     : eventLayer.speed[0] ? eventLayer.speed[0].value : 1
                });
            }
        });

        // 对地板位置按开始时间排序
        floorPositions.sort((a, b) => a.startTime - b.startTime);

        // 添加初始地板位置
        floorPositions.unshift({
            startTime     : 1 - 1000,
            endTime       : floorPositions[0] ? floorPositions[0].startTime : 1e4,
            floorPosition : 1 - 1000
        });
        currentFloorPosition += floorPositions[0].endTime;
        
        // 计算每个地板位置
        for (let floorPositionIndex = 1; floorPositionIndex < floorPositions.length; floorPositionIndex++)
        {
            let currentEvent = floorPositions[floorPositionIndex];
            let nextEvent = floorPositionIndex < floorPositions.length - 1 ? floorPositions[floorPositionIndex + 1] : { startTime: 1e4 };
            let currentTime = currentEvent.startTime;

            floorPositions[floorPositionIndex].floorPosition = currentFloorPosition;
            floorPositions[floorPositionIndex].endTime = nextEvent.startTime;

            currentFloorPosition += (nextEvent.startTime - currentEvent.startTime) * this._calcSpeedValue(currentTime);
        }

        this.floorPositions = floorPositions;
    }

    /**
     * 获取指定时间的地板位置
     * @param {number} time - 时间
     * @returns {Object} 地板位置信息
     */
    getFloorPosition(time)
    {
        if (this.floorPositions.length <= 0) throw new Error('No floorPosition created, please call calcFloorPosition() first');

        let result = {};

        // 查找对应时间的地板位置
        for (const floorPosition of this.floorPositions)
        {
            if (floorPosition.endTime < time) continue;
            if (floorPosition.startTime > time) break;

            result.startTime     = floorPosition.startTime;
            result.endTime       = floorPosition.endTime;
            result.floorPosition = floorPosition.floorPosition;
        }

        result.value = this._calcSpeedValue(time);

        return result;
    }

    /**
     * 计算速度值
     * @param {number} time - 时间
     * @returns {number} 速度值
     */
    _calcSpeedValue(time)
    {
        let result = 0;

        // 计算每个事件层的速度值
        this.eventLayers.forEach((eventLayer) =>
        {
            let currentValue = 0;

            for (const event of eventLayer.speed)
            {
                if (event.endTime < time) continue;
                if (event.startTime > time) break;
                currentValue = event.value;
            }

            result += currentValue;
        });

        return result;
    }

    /**
     * 创建精灵对象
     * @param {Object} texture - 纹理对象
     * @param {Object} zipFiles - ZIP文件对象
     * @param {boolean} debug - 是否为调试模式
     * @returns {Sprite} 创建的精灵对象
     */
    createSprite(texture, zipFiles, debug = false)
    {
        if (this.sprite) return this.sprite;

        // 创建文本或图像精灵
        if (!this.isText)
        {
            this.sprite = new Sprite(zipFiles[this.texture] ? zipFiles[this.texture] : texture.judgeline);

            if (this.texture)
            {
                this.baseScaleX = this.baseScaleY = 1;
            }
        }
        else
        {
            this.sprite = new Text('', {
                fontFamily: 'MiSans',
                align: 'center',
                fill: 0xFFFFFF
            });
        }
        
        this.sprite.anchor.set(0.5);
        this.sprite.alpha = 1;

        // 调试模式下创建调试信息容器
        if (debug)
        {
            let lineInfoContainer = new Container();
            let lineId = new Text(this.id, {
                fontSize: 48,
                fill: 0xFF00A0
            });
            let linePosBlock = new Graphics()
                .beginFill(0xFF00A0)
                .drawRect(-22, -22, 44, 44)
                .endFill();
            
            lineId.anchor.set(0.5);
            lineId.position.set(0, -36 - lineId.width / 2);

            /*
            lineId.cacheAsBitmap = true;
            linePosBlock.cacheAsBitmap = true;
            */
            
            lineInfoContainer.addChild(lineId);
            lineInfoContainer.addChild(linePosBlock);

            this.debugSprite = lineInfoContainer;
        }

        // 设置初始缩放值
        if (this.extendEvent.scaleX.length > 0 && this.extendEvent.scaleX[0].startTime <= 0)
        {
            this.scaleX = this.extendEvent.scaleX[0].start;
        }
        if (this.extendEvent.scaleY.length > 0 && this.extendEvent.scaleY[0].startTime <= 0)
        {
            this.scaleY = this.extendEvent.scaleY[0].start;
        }
        
        return this.sprite;
    }

    /**
     * 计算指定时间的状态
     * @param {number} currentTime - 当前时间
     * @param {Object} size - 画布尺寸
     */
    calcTime(currentTime, size)
    {
        this.speed = 0;
        this.x     = 0;
        this.y     = 0;
        this.alpha = 0;
        this.deg   = 0;

        // 计算每个事件层的状态
        for (let i = 0, length = this.eventLayers.length; i < length; i++)
        {
            let eventLayer = this.eventLayers[i];
            eventLayer.calcTime(currentTime);

            this.speed  += eventLayer._speed;
            this.x      += eventLayer._posX;
            this.y      += eventLayer._posY;
            this.alpha  += eventLayer._alpha;
            this.deg    += eventLayer._rotate;
        }

        // 计算地板位置
        for (let i = 0, length = this.floorPositions.length; i < length; i++)
        {
            let event = this.floorPositions[i];
            if (event.endTime < currentTime) continue;
            if (event.startTime > currentTime) break;

            this.floorPosition = (currentTime - event.startTime) * this.speed + event.floorPosition;
        };

        // 计算X轴缩放
        for (let i = 0, length = this.extendEvent.scaleX.length; i < length; i++)
        {
            let event = this.extendEvent.scaleX[i];
            if (event.endTime < currentTime) continue;
            if (event.startTime > currentTime) break;

            let timePercentEnd = (currentTime - event.startTime) / (event.endTime - event.startTime);
            let timePercentStart = 1 - timePercentEnd;

            this.scaleX = event.start * timePercentStart + event.end * timePercentEnd;
            this.sprite.scale.x = this.scaleX * this.baseScaleX;
        }

        // 计算Y轴缩放
        for (let i = 0, length = this.extendEvent.scaleY.length; i < length; i++)
        {
            let event = this.extendEvent.scaleY[i];
            if (event.endTime < currentTime) continue;
            if (event.startTime > currentTime) break;

            let timePercentEnd = (currentTime - event.startTime) / (event.endTime - event.startTime);
            let timePercentStart = 1 - timePercentEnd;

            this.scaleY = event.start * timePercentStart + event.end * timePercentEnd;
            this.sprite.scale.y = this.scaleY * this.baseScaleY;
        }

        // 设置文本内容
        for (let i = 0, length = this.extendEvent.text.length; i < length; i++)
        {
            let event = this.extendEvent.text[i];
            if (event.endTime < currentTime) continue;
            if (event.startTime > currentTime) break;

            this.sprite.text = event.value;
        }

        // 设置颜色
        for (let i = 0, length = this.extendEvent.color.length; i < length; i++)
        {
            let event = this.extendEvent.color[i];
            if (event.endTime < currentTime) continue;
            if (event.startTime > currentTime) break;

            this.color = this.sprite.tint = event.value;
        }

        // 计算倾斜
        for (let i = 0, length = this.extendEvent.incline.length; i < length; i++)
        {
            let event = this.extendEvent.incline[i];
            if (event.endTime < currentTime) continue;
            if (event.startTime > currentTime) break;

            let timePercentEnd = (currentTime - event.startTime) / (event.endTime - event.startTime);
            let timePercentStart = 1 - timePercentEnd;

            this.inclineSinr = Math.sin(event.start * timePercentStart + event.end * timePercentEnd);
        }

        // 计算角度的正弦和余弦值
        this.cosr = Math.cos(this.deg);
        this.sinr = Math.sin(this.deg);

        // 处理父子判定线关系
        if (this.parentLine)
        {
            let newPosX = (this.x * this.parentLine.cosr + this.y * this.parentLine.sinr) * 0.918554 + this.parentLine.x,
                newPosY = (this.y * this.parentLine.cosr - this.x * this.parentLine.sinr) * 1.088662 + this.parentLine.y;

            this.x = newPosX;
            this.y = newPosY;
        }

        // 更新精灵位置和属性
        this.sprite.position.x = (this.x + 0.5) * size.width;
        this.sprite.position.y = (0.5 - this.y) * size.height;
        this.sprite.alpha      = this.alpha >= 0 ? this.alpha : 0;
        this.sprite.rotation   = this.deg;
        this.sprite.visible    = (this.alpha > 0);

        /*
        if (this.sprite.alpha <= 0) this.sprite.visible = false;
        else this.sprite.visible = true;
        */
        
        /*
        this.sprite.width = this._width * this.scaleX;
        this.sprite.height = this._height * this.scaleY;
        */
        
        // 更新调试精灵
        if (this.debugSprite)
        {
            this.debugSprite.position = this.sprite.position;
            this.debugSprite.rotation = this.sprite.rotation;
            this.debugSprite.alpha = 0.2 + (this.sprite.alpha * 0.8);
        }
    }

    /**
     * 计算音符控制参数
     * @param {number} y - Y坐标
     * @param {string} valueType - 参数类型
     * @param {*} defaultValue - 默认值
     * @returns {*} 计算后的参数值
     */
    calcNoteControl(y, valueType, defaultValue)
    {
        for (let i = 0, length = this.noteControls[valueType].length; i < length; i++)
        {
            if (this.noteControls[valueType][i].y < y) return this.noteControls[valueType][i - 1].value;
        }
        return defaultValue;
    }
}