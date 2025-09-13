import Effect from '../index'
import utils from '@/chart/convert/utils';

/**
 * 缓动函数数组
 * 包含各种常用的缓动函数，用于动画插值计算
 */
const Easing = [
    (x) => x, // 线性
    (x) => Math.sin((x * Math.PI) / 2), // 正弦缓入
    (x) => 1 - Math.cos((x * Math.PI) / 2), // 余弦缓出
    (x) => 1 - (1 - x) * (1 - x), // 平方缓出
    (x) => x * x, // 平方缓入
    (x) => -(Math.cos(Math.PI * x) - 1) / 2, // 正弦缓入缓出
    (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2, // 平方缓入缓出
    (x) => 1 - Math.pow(1 - x, 3), // 立方缓出
    (x) => x * x * x, // 立方缓入
    (x) => 1 - Math.pow(1 - x, 4), // 四次缓出
    (x) => x * x * x * x, // 四次缓入
    (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, // 立方缓入缓出
    (x) => x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2, // 四次缓入缓出
    (x) => 1 - Math.pow(1 - x, 5), // 五次缓出
    (x) => x * x * x * x * x, // 五次缓入
    (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x), // 指数缓出
    (x) => x === 0 ? 0 : Math.pow(2, 10 * x - 10), // 指数缓入
    (x) => Math.sqrt(1 - Math.pow(x - 1, 2)), // 圆形缓出
    (x) => 1 - Math.sqrt(1 - Math.pow(x, 2)), // 圆形缓入
    (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2), // 弹跳缓出
    (x) => 2.70158 * x * x * x - 1.70158 * x * x, // 弹跳缓入
    (x) => x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2, // 圆形缓入缓出
    (x) => x < 0.5 ? (Math.pow(2 * x, 2) * ((2.594910 + 1) * 2 * x - 2.594910)) / 2 : (Math.pow(2 * x - 2, 2) * ((2.594910 + 1) * (x * 2 - 2) + 2.594910) + 2) / 2, // 弹跳缓入缓出
    (x) => x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1, // 正弦指数缓出
    (x) => x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * ((2 * Math.PI) / 3)), // 正弦指数缓入
    (x) => x < 1 / 2.75 ? 7.5625 * x * x : x < 2 / 2.75 ? 7.5625 * (x -= 1.5 / 2.75) * x + 0.75 : x < 2.5 / 2.75 ? 7.5625 * (x -= 2.25 / 2.75) * x + 0.9375 : 7.5625 * (x -= 2.625 / 2.75) * x + 0.984375, // 弹跳缓出
    (x) => 1 - Easing[25](1 - x), // 弹跳缓入
    (x) => x < 0.5 ? (1 - Easing[25](1 - 2 * x)) / 2 : (1 + Easing[25](2 * x - 1)) / 2 // 弹跳缓入缓出
];

/**
 * PRPR效果读取器
 * 用于读取和解析PRPR格式的特效数据
 * @param {Object} effect - 特效数据对象
 * @returns {Array} 特效列表
 */
export default function PrprEffectReader(effect)
{
    let effectList = [];         // 特效列表
    let rawEffects = [ ...effect.effects ]; // 原始特效数据
    let bpmList = [ ...effect.bpm ];        // BPM列表
    
    { // 将 Beat 计算为对应的时间（秒）
        let currentBeatRealTime = 0.5; // 当前每个 Beat 的实际时长（秒）
        let bpmChangedBeat = 0;        // 当前 BPM 是在什么时候被更改的（Beat）
        let bpmChangedTime = 0;        // 当前 BPM 是在什么时候被更改的（秒）

        // 计算每个BPM的时间信息
        bpmList.forEach((bpm, index) =>
        {
            bpm.endTime = bpmList[index + 1] ? bpmList[index + 1].time : [ 1e4, 0, 1 ];

            bpm.startBeat = bpm.time[0] + bpm.time[1] / bpm.time[2];
            bpm.endBeat = bpm.endTime[0] + bpm.endTime[1] / bpm.endTime[2];

            bpmChangedTime += currentBeatRealTime * (bpm.startBeat - bpmChangedBeat);
            bpm.startTime = bpmChangedTime;
            bpm.endTime = currentBeatRealTime * (bpm.endBeat - bpmChangedBeat);

            bpmChangedBeat += (bpm.beat - bpmChangedBeat);

            currentBeatRealTime = 60 / bpm.bpm;
            bpm.beatTime = 60 / bpm.bpm;
        });

        bpmList.sort((a, b) => b.beat - a.beat);
    }

    // 如果没有BPM信息，则添加默认BPM
    if (bpmList.length <= 0)
    {
        bpmList.push({
            startBeat : 0,
            endBeat   : 1e4,
            startTime : 0,
            endTime   : 1e6 - 1,
            bpm       : 120,
            beatTime  : 0.5 
        });
    }

    // 计算特效的实际时间并处理
    utils.calculateRealTime(bpmList, calculateEffectsBeat(rawEffects))
        .forEach((_effect) =>
        {
            let effect = new Effect({
                startTime: _effect.startTime,
                endTime: _effect.endTime,
                shader: _effect.shader,
                isGlobal: _effect.global || false,
                vars: {},
            });

            // 处理特效变量
            for (const name in _effect.vars)
            {
                let _values = _effect.vars[name];

                if (_values instanceof Array)
                {
                    let _timedValues = [];
                    let values = [];

                    // 计算事件的Beat值并排序
                    utils.calculateEventsBeat(_values)
                        .sort((a, b) => a.startTime - b.startTime || b.endTime - a.endTime)
                        .forEach((_value, index, arr) =>
                        {
                            let prevValue = arr[index - 1];

                            if (!prevValue) _timedValues.push(_value);
                            else if (_value.startTime == prevValue.startTime)
                            {
                                if (_value.endTime >= prevValue.endTime) _timedValues[_timedValues.length - 1] =  _value;
                            }
                            else _timedValues.push(_value);
                        }
                    );

                    // 计算实际时间并应用缓动函数
                    for (const _value of _timedValues)
                    {
                        values.push(...utils.calculateRealTime(bpmList, utils.calculateEventEase(_value, Easing)));
                    }
                    values.sort((a, b) => a.startTime - b.startTime || b.endTime - a.endTime);
                    effect.vars[name] = values;
                }
                else
                {
                    effect.vars[name] = _values;
                }
            }

            effectList.push(effect);
        }
    );

    // 按开始时间排序
    effectList.sort((a, b) => a.startTime  - b.startTime);

    return effectList;
}

/**
 * 计算特效的Beat值
 * @param {Object} effect - 特效对象
 * @returns {Object} 处理后的特效对象
 */
function calculateEffectBeat(effect)
{
    effect.startTime = parseFloat((effect.start[0] + (effect.start[1] / effect.start[2])).toFixed(3));
    effect.endTime = parseFloat((effect.end[0] + (effect.end[1] / effect.end[2])).toFixed(3));
    return effect;
}

/**
 * 计算多个特效的Beat值
 * @param {Array} effects - 特效数组
 * @returns {Array} 处理后的特效数组
 */
function calculateEffectsBeat(effects)
{
    effects.forEach((effect) =>
    {
        effect = calculateEffectBeat(effect);
    });
    return effects;
}