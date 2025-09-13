import { number as verifyNum } from '@/verify';
import * as Convert from './convert';
import md5Hash from 'md5-js';
import { Sprite, Graphics, Text } from 'pixi.js';

/**
 * 谱面类
 * 表示一个完整的Phigros谱面，包含判定线、音符、BPM列表等信息
 */
export default class Chart
{
    /**
     * 构造函数
     * @param {Object} params - 参数对象
     */
    constructor(params = {})
    {
        this.judgelines          = [];                          // 判定线数组
        this.notes               = [];                           // 音符数组
        this.bpmList             = [];                           // BPM列表
        this.offset              = verifyNum(params.offset, 0); // 偏移量
        this.isLineTextureReaded = false;                       // 判定线纹理是否已读取

        this.music      = params.music ? params.music : null;   // 音乐文件
        this.bg         = params.bg ? params.bg : null;         // 背景图片

        this.info       = {                                     // 谱面信息
            name      : params.name,                            // 歌曲名称
            artist    : params.artist,                          // 艺术家
            author    : params.author,                          // 谱面作者
            bgAuthor  : params.bgAuthor,                        // 背景图片作者
            difficult : params.difficult,                       // 难度信息
            md5       : params.md5                              // MD5哈希值
        };

        this.sprites = {};                                      // 精灵对象
    }

    /**
     * 从原始谱面数据创建Chart实例
     * @param {Object|string} rawChart - 原始谱面数据
     * @param {Object} _chartInfo - 谱面信息
     * @param {Array} _chartLineTexture - 判定线纹理信息
     * @returns {Chart} 创建的Chart实例
     */
    static from(rawChart, _chartInfo = {}, _chartLineTexture = [])
    {
        let chart;
        let chartInfo = _chartInfo;
        let chartMD5;

        if (typeof rawChart == 'object')
        {
            if (!isNaN(Number(rawChart.formatVersion)))
            {
                chart = Convert.Official(rawChart);
            }
            else if (rawChart.META && !isNaN(Number(rawChart.META.RPEVersion)))
            {
                chart = Convert.RePhiEdit(rawChart);
                chartInfo = chart.info;
            }

            try {
                chartMD5 = md5Hash(JSON.stringify(rawChart));
            } catch (e) {
                console.warn('Failed to calculate chart MD5.');
                console.error(e);
                chartMD5 = null
            }
        }
        else if (typeof rawChart == 'string')
        {
            chart = Convert.PhiEdit(rawChart);
            try {
                chartMD5 = md5Hash(rawChart);
            } catch (e) {
                console.warn('Failed to calculate chart MD5.');
                console.error(e);
                chartMD5 = null
            }
        }

        if (!chart) throw new Error('Unsupported chart format');

        chart.info = {
            name      : chartInfo.name,
            artist    : chartInfo.artist,
            author    : chartInfo.author,
            bgAuthor  : chartInfo.bgAuthor,
            difficult : chartInfo.difficult,
            md5       : chartMD5
        };

        // 处理判定线事件
        chart.judgelines.forEach((judgeline) =>
        {
            judgeline.eventLayers.forEach((eventLayer) =>
            {
                /* eventLayer.speed = utils.arrangeSameSingleValueEvent(eventLayer.speed); */
                eventLayer.moveX = arrangeLineEvents(eventLayer.moveX);
                eventLayer.moveY = arrangeLineEvents(eventLayer.moveY);
                eventLayer.rotate = arrangeLineEvents(eventLayer.rotate);
                eventLayer.alpha = arrangeLineEvents(eventLayer.alpha);
            });

            // 处理判定线扩展事件
            for (const name in judgeline.extendEvent)
            {
                if (name !== 'color' && name !== 'text')
                    judgeline.extendEvent[name] = arrangeLineEvents(judgeline.extendEvent[name]);
                else
                    judgeline.extendEvent[name] = arrangeSingleValueLineEvents(judgeline.extendEvent[name]);
            }
            
            judgeline.sortEvent();
        });

        // 读取判定线纹理信息
        chart.readLineTextureInfo(_chartLineTexture);

        // 对判定线按父子关系和ID排序
        chart.judgelines.sort((a, b) =>
        {
            if (a.parentLine && b.parentLine)
            {
                return a.parentLine.id - b.parentLine.id;
            }
            else if (a.parentLine)
            {
                return 1;
            }
            else if (b.parentLine)
            {
                return -1;
            }
            else
            {
                return a.id - b.id;
            }
        });

        // console.log(chart);
        return chart;
    }

    /**
     * 读取判定线纹理信息
     * @param {Array} infos - 纹理信息数组
     */
    readLineTextureInfo(infos = [])
    {
        if (this.isLineTextureReaded) return;
        if (infos.length <= 0) return;

        let isReaded = false;

        infos.forEach((lineInfo) =>
        {
            if (!this.judgelines[lineInfo.LineId]) return;

            this.judgelines[lineInfo.LineId].texture = lineInfo.Image;
            this.judgelines[lineInfo.LineId].useOfficialScale = true;
            this.judgelines[lineInfo.LineId].scaleX = !isNaN(lineInfo.Horz) ? parseFloat(lineInfo.Horz) : 1;
            this.judgelines[lineInfo.LineId].scaleY = !isNaN(lineInfo.Vert) ? parseFloat(lineInfo.Vert) : 1;

            this.judgelines[lineInfo.LineId].extendEvent.scaleX.push({
                startTime: 1 - 1000,
                endTime: 1000,
                start: this.judgelines[lineInfo.LineId].scaleX,
                end: this.judgelines[lineInfo.LineId].scaleX
            });

            this.judgelines[lineInfo.LineId].extendEvent.scaleY.push({
                startTime: 1 - 1000,
                endTime: 1000,
                start: this.judgelines[lineInfo.LineId].scaleY,
                end: this.judgelines[lineInfo.LineId].scaleY
            });

            isReaded = true;
        });

        if (isReaded) this.isLineTextureReaded = true;
    }

    /**
     * 创建精灵对象
     * @param {Container} stage - Pixi舞台容器
     * @param {Object} size - 画布尺寸
     * @param {Object} textures - 纹理对象
     * @param {Container} uiStage - UI舞台容器
     * @param {Object} zipFiles - ZIP文件对象
     * @param {number} speed - 播放速度
     * @param {number} bgDim - 背景暗化程度
     * @param {boolean} multiNoteHL - 多押高亮
     * @param {boolean} debug - 调试模式
     */
    createSprites(stage, size, textures, uiStage = null, zipFiles = {}, speed = 1, bgDim = 0.5, multiNoteHL = true, debug = false)
    {
        let linesWithZIndex = []; // 带Z轴索引的判定线

        // 创建背景精灵
        if (this.bg)
        {
            this.sprites.bg = new Sprite(this.bg);

            let bgCover = new Graphics();

            bgCover.beginFill(0x000000);
            bgCover.drawRect(0, 0, this.sprites.bg.texture.width, this.sprites.bg.texture.height);
            bgCover.endFill();

            bgCover.position.x = -this.sprites.bg.width / 2;
            bgCover.position.y = -this.sprites.bg.height / 2;
            bgCover.alpha = bgDim;

            this.sprites.bg.addChild(bgCover);
            this.sprites.bg.anchor.set(0.5);
            this.sprites.bg.cover = bgCover;

            stage.addChild(this.sprites.bg);
        }

        // 创建判定线精灵
        this.judgelines.forEach((judgeline, index) =>
        {
            judgeline.createSprite(textures, zipFiles, debug);

            judgeline.sprite.position.x = size.width / 2;
            judgeline.sprite.position.y = size.height / 2;
            judgeline.sprite.zIndex = 10 + index;

            if (!isNaN(judgeline.zIndex)) linesWithZIndex.push(judgeline);

            stage.addChild(judgeline.sprite);
            if (judgeline.debugSprite)
            {
                judgeline.debugSprite.zIndex = 999 + judgeline.sprite.zIndex;
                stage.addChild(judgeline.debugSprite);
            }

            // 处理官方缩放
            if (judgeline.texture && judgeline.useOfficialScale)
            {
                let oldScaleY = judgeline.extendEvent.scaleY[0].start;

                judgeline.extendEvent.scaleY[0].start = judgeline.extendEvent.scaleY[0].end = (1080 / judgeline.sprite.texture.height) * (oldScaleY * (oldScaleY < 0 ? -1 : 1));
                judgeline.extendEvent.scaleX[0].start = judgeline.extendEvent.scaleX[0].end = judgeline.extendEvent.scaleY[0].start * judgeline.extendEvent.scaleX[0].start;

                judgeline.useOfficialScale = false;
            }
        });

        // 按Z轴索引排序
        linesWithZIndex.sort((a, b) => a.zIndex - b.zIndex);
        linesWithZIndex.forEach((judgeline, index) =>
        {
            judgeline.sprite.zIndex = 10 + this.judgelines.length + index;
            if (judgeline.debugSprite) judgeline.debugSprite.zIndex = 999 + judgeline.sprite.zIndex;
        });

        // 创建音符精灵
        this.notes.forEach((note, index) =>
        {
            note.createSprite(textures, zipFiles, multiNoteHL, debug);

            note.sprite.zIndex = 10 + (this.judgelines.length + linesWithZIndex.length) + (note.type === 3 ? index : index + 10);

            stage.addChild(note.sprite);
            if (note.debugSprite)
            {
                note.debugSprite.zIndex = 999 + note.sprite.zIndex;
                stage.addChild(note.debugSprite);
            }
        });

        // 创建信息文本精灵
        this.sprites.info = {};

        this.sprites.info.songName = new Text((this.info.name || 'Untitled') + ((Math.round(speed * 100) !== 100) ? ' (x' + speed.toFixed(2) + ')' : ''), {
            fontFamily: 'A-OTF Shin Go Pr6N H',
            fill: 0xFFFFFF
        });
        this.sprites.info.songName.anchor.set(0, 1);
        this.sprites.info.songName.zIndex = 99999;

        if (uiStage) uiStage.addChild(this.sprites.info.songName);
        else stage.addChild(this.sprites.info.songName);

        this.sprites.info.songDiff = new Text((this.info.difficult || 'SP Lv.?'), {
            fontFamily: 'MiSans',
            fill: 0xFFFFFF
        });
        this.sprites.info.songDiff.anchor.set(0, 1);
        this.sprites.info.songDiff.zIndex = 99999;

        if (uiStage) uiStage.addChild(this.sprites.info.songDiff);
        else stage.addChild(this.sprites.info.songDiff);
    }

    /**
     * 调整精灵尺寸
     * @param {Object} size - 画布尺寸
     * @param {boolean} isEnded - 是否结束
     */
    resizeSprites(size, isEnded)
    {
        this.renderSize = size;

        // 调整背景尺寸
        if (this.sprites.bg)
        {
            let bgScaleWidth = this.renderSize.width / this.sprites.bg.texture.width;
            let bgScaleHeight = this.renderSize.height / this.sprites.bg.texture.height;
            let bgScale = bgScaleWidth > bgScaleHeight ? bgScaleWidth : bgScaleHeight;

            this.sprites.bg.scale.set(bgScale);
            this.sprites.bg.position.set(this.renderSize.width / 2, this.renderSize.height / 2);
        }

        // 调整判定线尺寸
        if (this.judgelines && this.judgelines.length > 0)
        {
            this.judgelines.forEach((judgeline) =>
            {
                if (!judgeline.sprite) return;

                if (judgeline.isText)
                {
                    judgeline.sprite.style.fontSize = 68 * this.renderSize.heightPercent;
                    judgeline.baseScaleX = judgeline.baseScaleY = 1;
                }
                else if (judgeline.texture)
                {
                    judgeline.baseScaleX = judgeline.baseScaleY = this.renderSize.heightPercent;
                }
                else
                {
                    judgeline.baseScaleX = (4000 / judgeline.sprite.texture.width) * (this.renderSize.width / 1350);
                    judgeline.baseScaleY = ((this.renderSize.lineScale * 18.75 * 0.008) / judgeline.sprite.texture.height);
                }

                judgeline.sprite.scale.set(judgeline.scaleX * judgeline.baseScaleX, judgeline.scaleY * judgeline.baseScaleY);

                judgeline.sprite.position.x = judgeline.x * this.renderSize.width;
                judgeline.sprite.position.y = judgeline.y * this.renderSize.height;

                // 调整音符控制参数
                for (const name in judgeline.noteControls)
                {
                    for (const control of judgeline.noteControls[name])
                    {
                        control.y = control._y * size.height
                    }
                }

                if (isEnded) judgeline.sprite.alpha = 0;
                if (judgeline.debugSprite) judgeline.debugSprite.scale.set(this.renderSize.heightPercent);
            });
        }

        // 调整音符尺寸
        if (this.notes && this.notes.length > 0)
        {
            this.notes.forEach((note) =>
            {
                if (note.type === 3)
                {
                    let holdLength = note.holdLength * (note.useOfficialSpeed ? 1 : note.speed) * this.renderSize.noteSpeed / this.renderSize.noteScale
                    note.sprite.children[1].height = holdLength;
                    note.sprite.children[2].position.y = -holdLength;
                }

                note.sprite.baseScale = this.renderSize.noteScale;
                note.sprite.scale.set(this.renderSize.noteScale * note.xScale, this.renderSize.noteScale);
                if (isEnded) note.sprite.alpha = 0;
                if (note.debugSprite) note.debugSprite.scale.set(this.renderSize.heightPercent);
            });
        }

        // 调整信息文本位置和尺寸
        this.sprites.info.songName.style.fontSize = size.heightPercent * 27;
        this.sprites.info.songName.position.x = size.heightPercent * 57;
        this.sprites.info.songName.position.y = size.height - size.heightPercent * 66;

        this.sprites.info.songDiff.style.fontSize = size.heightPercent * 20;
        this.sprites.info.songDiff.position.x = size.heightPercent * 57;
        this.sprites.info.songDiff.position.y = size.height - size.heightPercent * 42;
    }

    /**
     * 重置谱面状态
     */
    reset()
    {
        this.holdBetween = this.bpmList[0].holdBetween;

        this.judgelines.forEach((judgeline) =>
        {
            judgeline.reset();
        });
        this.notes.forEach((note) =>
        {
            note.reset();
        });
    }

    /**
     * 销毁精灵对象
     */
    destroySprites()
    {
        // 销毁判定线精灵
        this.judgelines.forEach((judgeline) =>
        {
            if (!judgeline.sprite) return;
            judgeline.reset();
            judgeline.sprite.destroy();
            judgeline.sprite = undefined;

            if (judgeline.debugSprite)
            {
                judgeline.debugSprite.destroy(true);
                judgeline.debugSprite = undefined;
            }
        });
        
        // 销毁音符精灵
        this.notes.forEach((note) =>
        {
            if (!note.sprite) return;
            note.reset();
            note.sprite.destroy();
            note.sprite = undefined;

            if (note.debugSprite)
            {
                note.debugSprite.destroy(true);
                note.debugSprite = undefined;
            }
        });

        // 销毁背景精灵
        if (this.sprites.bg)
        {
            this.sprites.bg.destroy();
            this.sprites.bg = undefined;
        }

        // 销毁信息文本精灵
        this.sprites.info.songName.destroy();
        this.sprites.info.songName = undefined;

        this.sprites.info.songDiff.destroy();
        this.sprites.info.songDiff = undefined;

        this.sprites.info = undefined;
    }

    /**
     * 获取总音符数
     * @returns {number} 总音符数
     */
    get totalNotes() {
        return this.notes.length;
    }

    /**
     * 获取真实音符数（非假音符）
     * @returns {number} 真实音符数
     */
    get totalRealNotes() {
        let result = 0;
        this.notes.forEach((note) => {
            if (!note.isFake) result++;
        });
        return result;
    }

    /**
     * 获取假音符数
     * @returns {number} 假音符数
     */
    get totalFakeNotes() {
        let result = 0;
        this.notes.forEach((note) => {
            if (note.isFake) result++;
        });
        return result;
    }
}

/**
 * 整理判定线事件
 * @param {Array} events - 事件数组
 * @returns {Array} 整理后的事件数组
 */
function arrangeLineEvents(events) {
    let oldEvents = events.slice();
    let newEvents2 = [];
    let newEvents = [{ // 以 -99 开始
        startTime : -99,
        endTime   : 0,
        start     : oldEvents[0] ? oldEvents[0].start : 0,
        end       : oldEvents[0] ? oldEvents[0].start : 0
    }];

    if (events.length <= 0) return [];

    oldEvents.push({ // 以 1000 结束
        startTime : 0,
        endTime   : 1e3,
        start     : oldEvents[oldEvents.length - 1] ? oldEvents[oldEvents.length - 1].end : 0,
        end       : oldEvents[oldEvents.length - 1] ? oldEvents[oldEvents.length - 1].end : 0
    });
    
    // 保证时间连续性
    for (let oldEvent of oldEvents) {
        let lastNewEvent = newEvents[newEvents.length - 1];

        if (oldEvent.endTime < oldEvent.startTime)
        {
            let newStartTime = oldEvent.endTime,
                newEndTime = oldEvent.startTime;
            
                oldEvent.startTime = newStartTime;
                oldEvent.endTime = newEndTime;
        }

        if (lastNewEvent.endTime < oldEvent.startTime)
        {
            newEvents.push({
                startTime : lastNewEvent.endTime,
                endTime   : oldEvent.startTime,
                start     : lastNewEvent.end,
                end       : lastNewEvent.end
            }, oldEvent);
        }
        else if (lastNewEvent.endTime == oldEvent.startTime)
        {
            newEvents.push(oldEvent);
        }
        else if (lastNewEvent.endTime > oldEvent.startTime)
        {
            if (lastNewEvent.endTime < oldEvent.endTime)
            {
                newEvents.push({
                    startTime : lastNewEvent.endTime,
                    endTime   : oldEvent.endTime,
                    start     : oldEvent.start + (oldEvent.end - oldEvent.start) * ((lastNewEvent.endTime - oldEvent.startTime) / (oldEvent.endTime - oldEvent.startTime)) + (lastNewEvent.end - oldEvent.start),
                    end       : oldEvent.end
                });
            }
        }
    }
    
    // 合并相同变化率事件
    newEvents2 = [ newEvents.shift() ];
    for (let newEvent of newEvents)
    {
        let lastNewEvent2 = newEvents2[newEvents2.length - 1];
        let duration1 = lastNewEvent2.endTime - lastNewEvent2.startTime;
        let duration2 = newEvent.endTime - newEvent.startTime;
        
        if (newEvent.startTime == newEvent.endTime)
        {
            // 忽略此分支    
        }
        else if (
            lastNewEvent2.end == newEvent.start &&
            (lastNewEvent2.end - lastNewEvent2.start) * duration2 == (newEvent.end - newEvent.start) * duration1
        ) {
            newEvents2[newEvents2.length - 1].endTime = newEvent.endTime;
            newEvents2[newEvents2.length - 1].end     = newEvent.end;
        }
        else
        {
            newEvents2.push(newEvent);
        }
    }
    
    return newEvents.slice();
}

/**
 * 整理单值判定线事件
 * @param {Array} events - 事件数组
 * @returns {Array} 整理后的事件数组
 */
function arrangeSingleValueLineEvents(events) {
    let oldEvents = events.slice();
    let newEvents = [ oldEvents.shift() ];

    if (events.length <= 0) return [];

    // 保证时间连续性
    for (let oldEvent of oldEvents)
    {
        let lastNewEvent = newEvents[newEvents.length - 1];

        if (oldEvent.endTime < oldEvent.startTime)
        {
            let newStartTime = oldEvent.endTime,
                newEndTime = oldEvent.startTime;
            
                oldEvent.startTime = newStartTime;
                oldEvent.endTime = newEndTime;
        }

        if (lastNewEvent.value == oldEvent.value)
        {
            lastNewEvent.endTime = oldEvent.endTime;
        }
        else if (lastNewEvent.endTime < oldEvent.startTime || lastNewEvent.endTime > oldEvent.startTime)
        {
            lastNewEvent.endTime = oldEvent.startTime;
            newEvents.push(oldEvent);
        }
        else
        {
            newEvents.push(oldEvent);
        }
    }

    return newEvents.slice();
}