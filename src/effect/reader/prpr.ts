import Effect from '../index';
import utils from '@/chart/convert/utils';
import type { ChartEvent, BpmItem } from '@/chart/convert/utils';

const Easing: ((x: number) => number)[] = [
    (x: number) => x,
    (x: number) => Math.sin((x * Math.PI) / 2),
    (x: number) => 1 - Math.cos((x * Math.PI) / 2),
    (x: number) => 1 - (1 - x) * (1 - x),
    (x: number) => x * x,
    (x: number) => -(Math.cos(Math.PI * x) - 1) / 2,
    (x: number) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
    (x: number) => 1 - Math.pow(1 - x, 3),
    (x: number) => x * x * x,
    (x: number) => 1 - Math.pow(1 - x, 4),
    (x: number) => x * x * x * x,
    (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    (x: number) => x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2,
    (x: number) => 1 - Math.pow(1 - x, 5),
    (x: number) => x * x * x * x * x,
    (x: number) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x),
    (x: number) => x === 0 ? 0 : Math.pow(2, 10 * x - 10),
    (x: number) => Math.sqrt(1 - Math.pow(x - 1, 2)),
    (x: number) => 1 - Math.sqrt(1 - Math.pow(x, 2)),
    (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
    (x: number) => 2.70158 * x * x * x - 1.70158 * x * x,
    (x: number) => x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2,
    (x: number) => x < 0.5 ? (Math.pow(2 * x, 2) * ((2.594910 + 1) * 2 * x - 2.594910)) / 2 : (Math.pow(2 * x - 2, 2) * ((2.594910 + 1) * (x * 2 - 2) + 2.594910) + 2) / 2,
    (x: number) => x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
    (x: number) => x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * ((2 * Math.PI) / 3)),
    (x: number) => x < 1 / 2.75 ? 7.5625 * x * x : x < 2 / 2.75 ? 7.5625 * (x -= 1.5 / 2.75) * x + 0.75 : x < 2.5 / 2.75 ? 7.5625 * (x -= 2.25 / 2.75) * x + 0.9375 : 7.5625 * (x -= 2.625 / 2.75) * x + 0.984375,
    (x: number) => 1 - Easing[25](1 - x),
    (x: number) => x < 0.5 ? (1 - Easing[25](1 - 2 * x)) / 2 : (1 + Easing[25](2 * x - 1)) / 2
];

interface RawEffect {
    start: number[];
    end: number[];
    shader: any;
    global?: boolean;
    vars: Record<string, any>;
    [key: string]: unknown;
}

interface RawBpm {
    time: number[];
    bpm: number;
    beat: number;
    [key: string]: unknown;
}

interface PrprEffectData {
    effects: RawEffect[];
    bpm: RawBpm[];
}

export default function PrprEffectReader(effect: PrprEffectData): Effect[] {
    let effectList: Effect[] = [];
    let rawEffects: RawEffect[] = [...effect.effects];
    let bpmList: any[] = [...effect.bpm];

    { // 将 Beat 计算为对应的时间（秒）
        let currentBeatRealTime: number = 0.5; // 当前每个 Beat 的实际时长（秒）
        let bpmChangedBeat: number = 0; // 当前 BPM 是在什么时候被更改的（Beat）
        let bpmChangedTime: number = 0; // 当前 BPM 是在什么时候被更改的（秒）

        bpmList.forEach((bpm: any, index: number) => {
            bpm.endTime = bpmList[index + 1] ? bpmList[index + 1].time : [1e4, 0, 1];

            bpm.startBeat = bpm.time[0] + bpm.time[1] / bpm.time[2];
            bpm.endBeat = bpm.endTime[0] + bpm.endTime[1] / bpm.endTime[2];

            bpmChangedTime += currentBeatRealTime * (bpm.startBeat - bpmChangedBeat);
            bpm.startTime = bpmChangedTime;
            bpm.endTime = currentBeatRealTime * (bpm.endBeat - bpmChangedBeat);

            bpmChangedBeat += (bpm.beat - bpmChangedBeat);

            currentBeatRealTime = 60 / bpm.bpm;
            bpm.beatTime = 60 / bpm.bpm;
        });

        bpmList.sort((a: any, b: any) => b.beat - a.beat);
    }

    if (bpmList.length <= 0) {
        bpmList.push({
            startBeat: 0,
            endBeat: 1e4,
            startTime: 0,
            endTime: 1e6 - 1,
            bpm: 120,
            beatTime: 0.5
        });
    }

    utils.calculateRealTime(bpmList as BpmItem[], calculateEffectsBeat(rawEffects) as unknown as ChartEvent[])
        .forEach((_effect: ChartEvent) => {
            let effect = new Effect({
                startTime: _effect.startTime,
                endTime: _effect.endTime,
                shader: (_effect as any).shader,
                isGlobal: (_effect as any).global || false,
                vars: {},
            });

            for (const name in (_effect as any).vars) {
                let _values = (_effect as any).vars[name];

                if (_values instanceof Array) {
                    let _timedValues: ChartEvent[] = [];
                    let values: ChartEvent[] = [];

                    utils.calculateEventsBeat(_values as ChartEvent[])
                        .sort((a: ChartEvent, b: ChartEvent) => a.startTime - b.startTime || b.endTime - a.startTime)
                        .forEach((_value: ChartEvent, index: number, arr: ChartEvent[]) => {
                            let prevValue = arr[index - 1];

                            if (!prevValue) _timedValues.push(_value);
                            else if (_value.startTime == prevValue.startTime) {
                                if (_value.endTime >= prevValue.endTime) _timedValues[_timedValues.length - 1] = _value;
                            }
                            else _timedValues.push(_value);
                        });

                    for (const _value of _timedValues) {
                        values.push(...utils.calculateRealTime(bpmList as BpmItem[], utils.calculateEventEase(_value, Easing)));
                    }
                    values.sort((a: ChartEvent, b: ChartEvent) => a.startTime - b.startTime || b.endTime - a.startTime);
                    effect.vars[name] = values;
                }
                else {
                    effect.vars[name] = _values;
                }
            }

            effectList.push(effect);
        });

    effectList.sort((a: Effect, b: Effect) => a.startTime - b.startTime);

    return effectList;
}


function calculateEffectBeat(effect: RawEffect): RawEffect {
    effect.startTime = parseFloat((effect.start[0] + (effect.start[1] / effect.start[2])).toFixed(3));
    effect.endTime = parseFloat((effect.end[0] + (effect.end[1] / effect.end[2])).toFixed(3));
    return effect;
}

function calculateEffectsBeat(effects: RawEffect[]): RawEffect[] {
    effects.forEach((effect: RawEffect) => {
        effect = calculateEffectBeat(effect);
    });
    return effects;
}
