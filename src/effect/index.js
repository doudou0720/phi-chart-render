import { bool as verifyBool } from '@/verify';
import * as Reader from './reader';

/**
 * 特效类
 * 用于管理和应用各种视觉特效，如着色器效果
 */
export default class Effect
{
    /**
     * 构造函数
     * @param {Object} params - 参数对象
     */
    constructor(params)
    {
        this.shader = params.shader;           // 着色器对象
        this.startTime = params.startTime;     // 开始时间
        this.endTime = params.endTime;         // 结束时间
        this.isGlobal = verifyBool(params.isGlobal, false); // 是否为全局效果
        this.vars = {};                        // 变量对象

        this.reset();
    }

    /**
     * 重置特效状态
     */
    reset()
    {
        this._currentValue = (this.shader !== null && typeof this.shader !== 'string') ? this.shader.defaultValues : {};
    }

    /**
     * 从JSON数据创建特效对象
     * @param {Object|string} json - JSON数据
     * @returns {Array} 特效对象数组
     */
    static from(json)
    {
        let result;

        if (typeof json === 'object')
        {
            result = Reader.PrprEffectReader(json);
        }
        
        if (!result || result.length <= 0)
        {
            throw new Error('Unsupported file format');
        }

        return result;
    }
    
    /**
     * 计算时间并更新着色器
     * @param {number} currentTime - 当前时间
     * @param {Array} screenSize - 屏幕尺寸 [width, height]
     */
    calcTime(currentTime, screenSize)
    {
        if (this.shader === null) return;

        const { vars, shader, _currentValue } = this;

        // 更新变量值
        for (const name in vars)
        {
            const values = vars[name];
            if (typeof values === 'object') _currentValue[name] = valueCalculator(values, currentTime, shader.defaultValues[name]);
            else _currentValue[name] = values;
        }

        // 更新着色器
        shader.update({ ..._currentValue, time: currentTime, screenSize: screenSize });
    }
}

/**
 * 值计算器
 * 根据时间计算变量的当前值
 * @param {Array} values - 值数组
 * @param {number} currentTime - 当前时间
 * @param {*} defaultValue - 默认值
 * @returns {*} 计算后的值
 */
function valueCalculator(values, currentTime, defaultValue)
{
    for (let i = 0, length = values.length; i < length; i++)
    {
        const value = values[i];
        if (value.endTime < currentTime) continue;
        if (value.startTime > currentTime) break;
        if (value.start === value.end) return value.start;

        let timePercentEnd = (currentTime - value.startTime) / (value.endTime - value.startTime);
        let timePercentStart = 1 - timePercentEnd;

        return value.start * timePercentStart + value.end * timePercentEnd;
    }

    return defaultValue;
}

// 需要完成的事项:
// 1. 在 ./game/ticker 中计算值（现在预计算）
// 2. 将特效集成到谱面中 (./chart/index)
// 3. 在 ./game/index 中更新 uniforms
// 如果还有其他事情，可能是bug修复。

// 特效应作用于 Game 而不是 Chart，
// 因为滤镜是由 Game 加载并应用于容器的

// 我想现在都完成了