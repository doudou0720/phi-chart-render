import { Text, Container } from 'pixi.js';

/**
 * 分数类
 * 用于计算和管理游戏分数、连击数、准确率等信息
 */
export default class Score
{
    /**
     * 构造函数
     * @param {number} notesCount - 音符总数
     * @param {boolean} showAPStatus - 是否显示AP状态
     * @param {boolean} isChallengeMode - 是否为挑战模式
     * @param {boolean} autoPlay - 是否为自动播放模式
     */
    constructor(notesCount = 0, showAPStatus = true, isChallengeMode = false, autoPlay = false)
    {
        this._notesCount = Number(notesCount);          // 音符总数
        this._showAPStatus = !!showAPStatus;            // 是否显示AP状态
        this._autoPlay = !!autoPlay;                    // 是否为自动播放模式

        // 检查音符数量是否有效
        if (isNaN((this._notesCount)) || this._notesCount <= 0)
        {
            console.warn('Invaild note count, Won\'t calculate score.');
            this._notesCount = 0;
        }

        // 计算每个音符和连击的分数
        this.scorePerNote  = isChallengeMode ? 1000000 / notesCount : 900000 / notesCount;  // 每个音符的分数
        this.scorePerCombo = isChallengeMode ? 0 : 100000 / notesCount;                      // 每个连击的分数

        this.renderSize = {}; // 渲染尺寸
        
        this.reset();
    }

    /**
     * 重置分数状态
     */
    reset()
    {
        this._score   = 0;     // 内部队列分数
        this.score    = 0;     // 当前显示分数
        this.acc      = 0;     // 准确率
        this.combo    = 0;     // 当前连击数
        this.maxCombo = 0;     // 最大连击数

        this.judgedNotes = 0;  // 已判定音符数
        this.perfect     = 0;  // Perfect数
        this.good        = 0;  // Good数
        this.bad         = 0;  // Bad数
        this.miss        = 0;  // Miss数

        this.judgeLevel  = -1; // 判定等级
        this.APType      = 2;  // AP类型 (0-未达成, 1-FC, 2-AP)
        this.levelPassed = false; // 关卡是否通过

        // 重置显示文本
        if (this.sprites)
        {
            this.sprites.combo.number.text = '0';
            this.sprites.acc.text = 'ACCURACY 0.00%';
            this.sprites.score.text = '0000000';

            this.sprites.combo.text.position.x = this.sprites.combo.number.width + this.renderSize.heightPercent * 6;
        }
    }

    /**
     * 创建分数显示精灵
     * @param {Container} stage - Pixi舞台容器
     */
    createSprites(stage)
    {
        if (this.sprites) return;

        this.sprites = {};

        // 创建连击数显示容器
        this.sprites.combo = {};
        this.sprites.combo.container = new Container();
        this.sprites.combo.container.zIndex = 99999;

        // 连击数数字文本
        this.sprites.combo.number = new Text('0', {
            fontFamily: 'A-OTF Shin Go Pr6N H',
            fill: 0xFFFFFF
        });
        this.sprites.combo.number.alpha = 0.81;
        
        // 连击数标签文本
        this.sprites.combo.text = new Text((this._autoPlay ? 'AUT' + 'OPL' + 'AY' : 'COMBO'), {
            fontFamily: 'MiSans',
            fill: 0xFFFFFF
        });
        this.sprites.combo.text.alpha = 0.55;
        
        this.sprites.combo.container.addChild(this.sprites.combo.number, this.sprites.combo.text);
        stage.addChild(this.sprites.combo.container);

        // 准确率文本
        this.sprites.acc = new Text('ACCURACY 0.00%', {
            fontFamily: 'MiSans',
            fill: 0xFFFFFF
        });
        this.sprites.acc.alpha = 0.63;
        this.sprites.acc.zIndex = 99999;
        stage.addChild(this.sprites.acc);

        // 总分数文本
        this.sprites.score = new Text('0000000', {
            fontFamily: 'A-OTF Shin Go Pr6N H',
            fill: 0xFFFFFF
        });
        this.sprites.score.alpha = 0.58;
        this.sprites.score.anchor.set(1, 0);
        this.sprites.score.zIndex = 99999;
        stage.addChild(this.sprites.score);
    }

    /**
     * 调整精灵尺寸
     * @param {Object} size - 尺寸对象
     * @param {boolean} isEnded - 是否结束
     */
    resizeSprites(size, isEnded)
    {
        this.renderSize = size;

        if (!this.sprites) return;

        // 调整各文本的字体大小
        this.sprites.combo.number.style.fontSize = size.heightPercent * 60;
        this.sprites.combo.text.style.fontSize = size.heightPercent * 30;
        this.sprites.acc.style.fontSize = size.heightPercent * 20;
        this.sprites.score.style.fontSize = size.heightPercent * 50;

        // 调整各文本的位置
        if (!isEnded)
        {
            this.sprites.combo.container.position.x = size.heightPercent * 72;
            this.sprites.combo.container.position.y = size.heightPercent * 41;
            this.sprites.combo.text.position.x = this.sprites.combo.number.width + size.heightPercent * 6;
            this.sprites.combo.text.position.y = size.heightPercent * 30;

            this.sprites.acc.position.x = size.heightPercent * 72;
            this.sprites.acc.position.y = size.heightPercent * 113;

            this.sprites.score.position.x = size.width - size.heightPercent * 139;
            this.sprites.score.position.y = size.heightPercent * 61;
        }
        else
        {
            this.sprites.combo.container.position.y = size.height;
            this.sprites.acc.position.y = size.height;
            this.sprites.score.position.y = size.height;
        }
    }

    /**
     * 推送判定结果
     * @param {number} type - 判定类型 (0-Miss, 1-Bad, 2-Good, 3-Great, 4-Perfect)
     * @param {Array} judgelines - 判定线数组
     */
    pushJudge(type = 0, judgelines = [])
    {
        if (!this._autoPlay)
        {
            // 非Miss和Bad的判定
            if (type > 2)
            {
                this.combo += 1;
                if (this.combo > this.maxCombo) this.maxCombo = this.combo;

                // Perfect判定
                if (type === 4) this.perfect += 1;
                else {
                    this.good += 1;
                    // 如果之前是AP状态，则降级为FC
                    if (this.APType >= 2)
                    {
                        this.APType = 1;

                        // 显示FC状态
                        if (this._showAPStatus)
                        {
                            for (const judgeline of judgelines)
                            {
                                if (!isNaN(judgeline.color)) return;
                                if (!judgeline.sprite) return;
                                judgeline.sprite.tint = 0xB4E1FF;
                            };
                        }
                    }
                }

                // 计算分数
                this._score += this.scorePerNote + (this.combo >= this.maxCombo ? this.scorePerCombo * (type === 4 ? 1 : 0.65) : 0); 
            }
            else
            {
                // Miss或Bad判定
                if (type === 2)this.bad += 1;
                else this.miss += 1;

                // 如果之前是FC或AP状态，则降级为未达成
                if (this.APType >= 1)
                {
                    this.APType = 0;

                    // 显示未达成状态
                    if (this._showAPStatus)
                    {
                        for (const judgeline of judgelines)
                        {
                            if (!isNaN(judgeline.color)) return;
                            if (!judgeline.sprite) return;
                            judgeline.sprite.tint = 0xFFFFFF;
                        };
                    }
                }
                
                this.combo = 0; // 重置连击数
            }
        }
        else
        {
            // 自动播放模式下全部为Perfect
            this.perfect += 1;
            this.combo += 1;
            this.maxCombo = this.combo;
            this._score += this.scorePerNote + this.scorePerCombo; 
        }
        
        this.judgedNotes++; // 增加已判定音符数
        this.score = Math.round(this._score); // 计算当前分数
        this.acc = (this.perfect + this.good * 0.65) / this.judgedNotes; // 计算准确率

        // 根据分数确定判定等级
        if (this.score >= 1000000) this.judgeLevel = 6;
		else if (this.score >= 960000) this.judgeLevel = 5;
		else if (this.score >= 920000) this.judgeLevel = 4;
		else if (this.score >= 880000) this.judgeLevel = 3;
		else if (this.score >= 820000) this.judgeLevel = 2;
		else if (this.score >= 700000) this.judgeLevel = 1;
        else this.judgeLevel = 0;

        // 判断关卡是否通过
        if (this.judgeLevel >= 1) this.levelPassed = true;

        // 更新显示文本
        if (this.sprites)
        {
            this.sprites.combo.number.text = this.combo;

            this.sprites.acc.text = 'ACCURACY ' + (this.acc * 100).toFixed(2) + '%';
            this.sprites.score.text = fillZero((this.score).toFixed(0), 7);

            this.sprites.combo.text.position.x = this.sprites.combo.number.width + this.renderSize.heightPercent * 6;
        }
    }

    /**
     * 销毁精灵对象
     */
    destroySprites()
    {
        if (!this.sprites) return;
        
        this.sprites.combo.number.destroy();
        this.sprites.combo.text.destroy();
        this.sprites.combo.container.destroy();
        this.sprites.combo = undefined;

        this.sprites.acc.destroy();
        this.sprites.acc = undefined;

        this.sprites.score.destroy();
        this.sprites.score = undefined;

        this.sprites = undefined;
    }
}

/**
 * 补零函数
 * @param {string|number} num - 数字
 * @param {number} length - 目标长度
 * @returns {string} 补零后的字符串
 */
function fillZero(num, length = 3)
{
    let result = num + '';
    while (result.length < length)
    {
        result = '0' + result;
    }
    return result;
}