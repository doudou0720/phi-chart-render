import { number as verifyNum } from '@/verify';
import * as Convert from './convert';
import md5Hash from 'md5-js';
import { Sprite, Graphics, Text, Container, Texture } from 'pixi.js';
import type Judgeline from './judgeline';
import type Note from './note';
import type { BpmItem } from './convert/utils';

interface ChartParams {
    name?: string;
    artist?: string;
    author?: string;
    bgAuthor?: string;
    difficult?: string;
    md5?: string;
    offset?: number;
    music?: AudioBuffer | null;
    bg?: Texture | null;
}

interface ChartInfo {
    name?: string;
    artist?: string;
    author?: string;
    bgAuthor?: string;
    difficult?: string;
    md5?: string | null;
}

interface LineTextureInfo {
    LineId: number;
    Image: string;
    Horz?: number;
    Vert?: number;
}

interface RenderSize {
    width: number;
    height: number;
    widthPercent: number;
    heightPercent: number;
    noteSpeed: number;
    noteScale: number;
    lineScale: number;
}

interface SpriteWithCover extends Sprite {
    cover?: Graphics;
}

interface EventLike {
    startTime: number;
    endTime: number;
    start: number;
    end: number;
    value?: number;
    [key: string]: unknown;
}

export default class Chart
{
    judgelines: Judgeline[];
    notes: Note[];
    bpmList: BpmItem[];
    offset: number;
    isLineTextureReaded: boolean;
    holdBetween!: number;

    music: AudioBuffer | null;
    bg: Texture | null;
    info: ChartInfo;
    sprites: Record<string, unknown>;
    renderSize?: RenderSize;

    constructor(params: ChartParams = {})
    {
        this.judgelines          = [];
        this.notes               = [];
        this.bpmList             = [];
        this.offset              = verifyNum(params.offset, 0);
        this.isLineTextureReaded = false;

        this.music      = params.music ? params.music : null;
        this.bg         = params.bg ? params.bg : null;

        this.info       = {
            name      : params.name,
            artist    : params.artist,
            author    : params.author,
            bgAuthor  : params.bgAuthor,
            difficult : params.difficult,
            md5       : params.md5
        };

        this.sprites = {};
    }

    static from(rawChart: unknown, _chartInfo: Partial<ChartInfo> = {}, _chartLineTexture: LineTextureInfo[] = []): Chart
    {
        let chart: Chart | null = null;
        let chartInfo: Partial<ChartInfo> = _chartInfo;
        let chartMD5: string | null | undefined;

        if (typeof rawChart == 'object')
        {
            if (!isNaN(Number((rawChart as Record<string, unknown>).formatVersion)))
            {
                chart = Convert.Official(rawChart);
            }
            else if ((rawChart as Record<string, unknown>).META && !isNaN(Number(((rawChart as Record<string, unknown>).META as Record<string, unknown>).RPEVersion)))
            {
                chart = Convert.RePhiEdit(rawChart);
                chartInfo = chart!.info;
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

        chart.judgelines.forEach((judgeline) =>
        {
            judgeline.eventLayers.forEach((eventLayer) =>
            {
                eventLayer.moveX = arrangeLineEvents(eventLayer.moveX as unknown as EventLike[]) as unknown as typeof eventLayer.moveX;
                eventLayer.moveY = arrangeLineEvents(eventLayer.moveY as unknown as EventLike[]) as unknown as typeof eventLayer.moveY;
                eventLayer.rotate = arrangeLineEvents(eventLayer.rotate as unknown as EventLike[]) as unknown as typeof eventLayer.rotate;
                eventLayer.alpha = arrangeLineEvents(eventLayer.alpha as unknown as EventLike[]) as unknown as typeof eventLayer.alpha;
            });

            for (const name in judgeline.extendEvent)
            {
                if (name !== 'color' && name !== 'text')
                    (judgeline.extendEvent as unknown as Record<string, EventLike[]>)[name] = arrangeLineEvents((judgeline.extendEvent as unknown as Record<string, EventLike[]>)[name]);
                else
                    (judgeline.extendEvent as unknown as Record<string, EventLike[]>)[name] = arrangeSingleValueLineEvents((judgeline.extendEvent as unknown as Record<string, EventLike[]>)[name]);
            }
            
            judgeline.sortEvent();
        });

        chart.readLineTextureInfo(_chartLineTexture);

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

        return chart;
    }

    readLineTextureInfo(infos: LineTextureInfo[] = []): void
    {
        if (this.isLineTextureReaded) return;
        if (infos.length <= 0) return;

        let isReaded = false;

        infos.forEach((lineInfo) =>
        {
            if (!this.judgelines[lineInfo.LineId]) return;

            this.judgelines[lineInfo.LineId].texture = lineInfo.Image;
            this.judgelines[lineInfo.LineId].useOfficialScale = true;
            this.judgelines[lineInfo.LineId].scaleX = !isNaN(lineInfo.Horz!) ? parseFloat(String(lineInfo.Horz)) : 1;
            this.judgelines[lineInfo.LineId].scaleY = !isNaN(lineInfo.Vert!) ? parseFloat(String(lineInfo.Vert)) : 1;

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

    createSprites(stage: Container, size: RenderSize, textures: Record<string, unknown>, uiStage: Container | null = null, zipFiles: Record<string, unknown> = {}, speed: number = 1, bgDim: number = 0.5, multiNoteHL: boolean = true, debug: boolean = false): void
    {
        let linesWithZIndex: Judgeline[] = [];

        if (this.bg)
        {
            this.sprites.bg = new Sprite(this.bg);

            let bgCover = new Graphics();

            bgCover.beginFill(0x000000);
            bgCover.drawRect(0, 0, (this.sprites.bg as SpriteWithCover).texture.width, (this.sprites.bg as SpriteWithCover).texture.height);
            bgCover.endFill();

            bgCover.position.x = -(this.sprites.bg as SpriteWithCover).width / 2;
            bgCover.position.y = -(this.sprites.bg as SpriteWithCover).height / 2;
            bgCover.alpha = bgDim;

            (this.sprites.bg as SpriteWithCover).addChild(bgCover);
            (this.sprites.bg as SpriteWithCover).anchor.set(0.5);
            (this.sprites.bg as SpriteWithCover).cover = bgCover;

            stage.addChild(this.sprites.bg as Sprite);
        }

        this.judgelines.forEach((judgeline, index) =>
        {
            judgeline.createSprite(textures, zipFiles, debug);

            judgeline.sprite!.position.x = size.width / 2;
            judgeline.sprite!.position.y = size.height / 2;
            (judgeline.sprite as Sprite).zIndex = 10 + index;

            if (!isNaN(judgeline.zIndex)) linesWithZIndex.push(judgeline);

            stage.addChild(judgeline.sprite as Sprite);
            if (judgeline.debugSprite)
            {
                judgeline.debugSprite.zIndex = 999 + (judgeline.sprite as Sprite).zIndex;
                stage.addChild(judgeline.debugSprite);
            }

            if (judgeline.texture && judgeline.useOfficialScale)
            {
                let oldScaleY = judgeline.extendEvent.scaleY[0].start as number;

                judgeline.extendEvent.scaleY[0].start = judgeline.extendEvent.scaleY[0].end = (1080 / (judgeline.sprite as Sprite).texture.height) * (oldScaleY * (oldScaleY < 0 ? -1 : 1));
                judgeline.extendEvent.scaleX[0].start = judgeline.extendEvent.scaleX[0].end = (judgeline.extendEvent.scaleY[0].start as number) * (judgeline.extendEvent.scaleX[0].start as number);

                judgeline.useOfficialScale = false;
            }
        });

        linesWithZIndex.sort((a, b) => a.zIndex - b.zIndex);
        linesWithZIndex.forEach((judgeline, index) =>
        {
            (judgeline.sprite as Sprite).zIndex = 10 + this.judgelines.length + index;
            if (judgeline.debugSprite) judgeline.debugSprite.zIndex = 999 + (judgeline.sprite as Sprite).zIndex;
        });

        this.notes.forEach((note, index) =>
        {
            note.createSprite(textures, zipFiles, multiNoteHL, debug);

            (note.sprite as Sprite).zIndex = 10 + (this.judgelines.length + linesWithZIndex.length) + (note.type === 3 ? index : index + 10);

            stage.addChild(note.sprite as Sprite);
            if (note.debugSprite)
            {
                note.debugSprite.zIndex = 999 + (note.sprite as Sprite).zIndex;
                stage.addChild(note.debugSprite);
            }
        });

        this.sprites.info = {} as Record<string, unknown>;

        (this.sprites.info as Record<string, Text>).songName = new Text((this.info.name || 'Untitled') + ((Math.round(speed * 100) !== 100) ? ' (x' + speed.toFixed(2) + ')' : ''), {
            fontFamily: 'A-OTF Shin Go Pr6N H',
            fill: 0xFFFFFF
        });
        (this.sprites.info as Record<string, Text>).songName.anchor.set(0, 1);
        (this.sprites.info as Record<string, Text>).songName.zIndex = 99999;

        if (uiStage) uiStage.addChild((this.sprites.info as Record<string, Text>).songName);
        else stage.addChild((this.sprites.info as Record<string, Text>).songName);


        (this.sprites.info as Record<string, Text>).songDiff = new Text((this.info.difficult || 'SP Lv.?'), {
            fontFamily: 'MiSans',
            fill: 0xFFFFFF
        });
        (this.sprites.info as Record<string, Text>).songDiff.anchor.set(0, 1);
        (this.sprites.info as Record<string, Text>).songDiff.zIndex = 99999;

        if (uiStage) uiStage.addChild((this.sprites.info as Record<string, Text>).songDiff);
        else stage.addChild((this.sprites.info as Record<string, Text>).songDiff);
    }

    resizeSprites(size: RenderSize, isEnded: boolean): void
    {
        this.renderSize = size;

        if (this.sprites.bg)
        {
            let bgScaleWidth = this.renderSize.width / (this.sprites.bg as Sprite).texture.width;
            let bgScaleHeight = this.renderSize.height / (this.sprites.bg as Sprite).texture.height;
            let bgScale = bgScaleWidth > bgScaleHeight ? bgScaleWidth : bgScaleHeight;

            (this.sprites.bg as Sprite).scale.set(bgScale);
            (this.sprites.bg as Sprite).position.set(this.renderSize.width / 2, this.renderSize.height / 2);
        }

        if (this.judgelines && this.judgelines.length > 0)
        {
            this.judgelines.forEach((judgeline) =>
            {
                if (!judgeline.sprite) return;

                if (judgeline.isText)
                {
                    ((judgeline.sprite as import('pixi.js').Text).style as import('pixi.js').TextStyle).fontSize = 68 * this.renderSize!.heightPercent;
                    judgeline.baseScaleX = judgeline.baseScaleY = 1;
                }
                else if (judgeline.texture)
                {
                    judgeline.baseScaleX = judgeline.baseScaleY = this.renderSize!.heightPercent;
                }
                else
                {
                    judgeline.baseScaleX = (4000 / (judgeline.sprite as Sprite).texture.width) * (this.renderSize!.width / 1350);
                    judgeline.baseScaleY = ((this.renderSize!.lineScale * 18.75 * 0.008) / (judgeline.sprite as Sprite).texture.height);
                }

                (judgeline.sprite as Sprite).scale.set(judgeline.scaleX * judgeline.baseScaleX, judgeline.scaleY * judgeline.baseScaleY);

                (judgeline.sprite as Sprite).position.x = judgeline.x * this.renderSize!.width;
                (judgeline.sprite as Sprite).position.y = judgeline.y * this.renderSize!.height;

                for (const name in judgeline.noteControls)
                {
                    for (const control of judgeline.noteControls[name as keyof typeof judgeline.noteControls])
                    {
                        control.y = (control as unknown as { _y: number })._y * size.height;
                    }
                }

                if (isEnded) (judgeline.sprite as Sprite).alpha = 0;
                if (judgeline.debugSprite) judgeline.debugSprite.scale.set(this.renderSize!.heightPercent);
            });
        }

        if (this.notes && this.notes.length > 0)
        {
            this.notes.forEach((note) =>
            {
                if (note.type === 3)
                {
                    let holdLength = note.holdLength * (note.useOfficialSpeed ? 1 : note.speed) * this.renderSize!.noteSpeed / this.renderSize!.noteScale;
                    ((note.sprite as Container).children[1] as Sprite).height = holdLength;
                    (note.sprite as Container).children[2].position.y = -holdLength;
                }

                (note.sprite as Sprite).baseScale = this.renderSize!.noteScale;
                (note.sprite as Sprite).scale.set(this.renderSize!.noteScale * note.xScale, this.renderSize!.noteScale);
                if (isEnded) (note.sprite as Sprite).alpha = 0;
                if (note.debugSprite) note.debugSprite.scale.set(this.renderSize!.heightPercent);
            });
        }

        ((this.sprites.info as Record<string, Text>).songName as Text).style.fontSize = size.heightPercent * 27;
        ((this.sprites.info as Record<string, Text>).songName as Text).position.x = size.heightPercent * 57;
        ((this.sprites.info as Record<string, Text>).songName as Text).position.y = size.height - size.heightPercent * 66;

        ((this.sprites.info as Record<string, Text>).songDiff as Text).style.fontSize = size.heightPercent * 20;
        ((this.sprites.info as Record<string, Text>).songDiff as Text).position.x = size.heightPercent * 57;
        ((this.sprites.info as Record<string, Text>).songDiff as Text).position.y = size.height - size.heightPercent * 42;
    }

    reset(): void
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

    destroySprites(): void
    {
        this.judgelines.forEach((judgeline) =>
        {
            if (!judgeline.sprite) return;
            judgeline.reset();
            (judgeline.sprite as Sprite).destroy();
            judgeline.sprite = undefined;

            if (judgeline.debugSprite)
            {
                judgeline.debugSprite.destroy(true);
                judgeline.debugSprite = undefined;
            }
        });
        this.notes.forEach((note) =>
        {
            if (!note.sprite) return;
            note.reset();
            (note.sprite as Sprite).destroy();
            note.sprite = undefined;

            if (note.debugSprite)
            {
                note.debugSprite.destroy(true);
                note.debugSprite = undefined;
            }
        });

        if (this.sprites.bg)
        {
            (this.sprites.bg as Sprite).destroy();
            this.sprites.bg = undefined;
        }

        ((this.sprites.info as Record<string, Text>).songName as Text).destroy();
        (this.sprites.info as Record<string, Text>).songName = undefined as unknown as Text;

        ((this.sprites.info as Record<string, Text>).songDiff as Text).destroy();
        (this.sprites.info as Record<string, Text>).songDiff = undefined as unknown as Text;

        this.sprites.info = undefined;
    }

    get totalNotes(): number {
        return this.notes.length;
    }

    get totalRealNotes(): number {
        let result = 0;
        this.notes.forEach((note) => {
            if (!note.isFake) result++;
        });
        return result;
    }

    get totalFakeNotes(): number {
        let result = 0;
        this.notes.forEach((note) => {
            if (note.isFake) result++;
        });
        return result;
    }
}


function arrangeLineEvents(events: EventLike[]): EventLike[]
{
    let oldEvents = events.slice();
    let newEvents2: EventLike[] = [];
    let newEvents: EventLike[] = [{ // 以 -99 开始
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
    newEvents2 = [ newEvents.shift()! ];
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


function arrangeSingleValueLineEvents(events: EventLike[]): EventLike[]
{
    let oldEvents = events.slice();
    let newEvents: EventLike[] = [ oldEvents.shift()! ];

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
