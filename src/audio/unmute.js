// Reference: https://github.com/bemusic/bemuse/blob/68e0d5213b56502b3f5812f1d28c8d7075762717/bemuse/src/sampling-master/index.js#L276

/**
 * 解除音频静音函数
 * 通过创建一个短促的音频振荡器来激活浏览器的音频上下文
 * @param {AudioContext} ctx - Web Audio API的AudioContext对象
 */
export default function unmuteAudio(ctx)
{
    // 创建增益节点和振荡器节点
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();

    // 设置振荡器频率为440Hz
    osc.frequency.value = 440;

    // 启动并立即停止振荡器（短促的音频脉冲）
    osc.start(ctx.currentTime + 0.1);
    osc.stop(ctx.currentTime + 0.1);

    // 连接增益节点到音频输出并断开连接
    gain.connect(ctx.destination);
    gain.disconnect();

    // 恢复音频上下文
    ctx.resume()
        .catch((e) => {
            console.info('[WAudio] Failed to resume AudioContext', e);
        }
    );
}