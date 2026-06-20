declare const GIT_VERSION: string;

import * as PhiChartRender from './main';
import FontFaceObserver from 'fontfaceobserver';
import JSZip from 'jszip';
import { Texture, Rectangle } from 'pixi.js';
import { canvasRGB as StackBlur } from 'stackblur-canvas';
import Pica from 'pica';
import * as Sentry from '@sentry/browser';
import { BrowserTracing } from '@sentry/tracing';
import './phizone';

// Extend File interface to support the dynamic `.format` property used in this codebase
interface ChartFile extends File {
    format: string;
}

// Augment Window for development mode globals and functions
declare global
{
    interface Window
    {
        qs: typeof qs;
        doms: typeof doms;
        files: typeof files;
        assets: typeof assets;
        currentFile: typeof currentFile;
        _game: PhiChartRender.Game | undefined;
        pauseGame: typeof pauseGame;
        restartGame: typeof restartGame;
        exitGame: typeof exitGame;
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
    }
}

(() =>
{
    if (import.meta.env.MODE === 'production')
    {
        // Init sentry
        Sentry.init({
            dsn: "https://c0f2c5052bd740c3b734b74c7dd6d350@o4504077358792704.ingest.sentry.io/4504077363183616",
            integrations: [ new BrowserTracing() ],
            tracesSampleRate: 1.0,
            maxBreadcrumbs: 50,
            debug: false,
            release: GIT_VERSION,
            beforeSend: (event, hint) => {
                let err = hint.originalException as Error;

                doms.errorWindow.content.innerText = (err.stack ? err.stack : err.message ? err.message : JSON.stringify(err, null, 4));
                doms.errorWindow.window.style.display = 'block';

                return event;
            }
        });
    }
})();

const qs = (selector: string) => document.querySelector(selector) as HTMLElement;

const fonts: Record<string, FontFaceObserver> = {
    'MiSans'               : new FontFaceObserver('MiSans'),
    'A-OTF Shin Go Pr6N H' : new FontFaceObserver('A-OTF Shin Go Pr6N H')
};

const doms = {
    fileSelect: document.querySelector('div.file-select') as HTMLDivElement,
    chartPackFile: document.querySelector('input#file-chart-pack') as HTMLInputElement,
    chartPackFileReadProgress: document.querySelector('div#file-read-progress') as HTMLDivElement,
    skinPackFile: document.querySelector('input#file-skin-pack') as HTMLInputElement,
    skinPackFileReadProgress: document.querySelector('div#loading-skin-pack') as HTMLDivElement,

    file : {
        chart: document.querySelector('#tab-file > .file-selection-controls > label > select#file-chart') as HTMLSelectElement,
        music: document.querySelector('#tab-file > .file-selection-controls > label > select#file-music') as HTMLSelectElement,
        bg: document.querySelector('#tab-file > .file-selection-controls > label > select#file-bg') as HTMLSelectElement
    },
    settings: {
        showBG: document.querySelector('input#settings-show-bg') as HTMLInputElement,
        multiNoteHL: document.querySelector('input#settings-multi-note-hl') as HTMLInputElement,
        showAPStatus: document.querySelector('input#settings-show-ap-status') as HTMLInputElement,
        showInputPoint: document.querySelector('input#settings-show-input-point') as HTMLInputElement,
        noteScale: document.querySelector('input#settings-note-scale') as HTMLInputElement,
        bgDim: document.querySelector('input#settings-bg-dim') as HTMLInputElement,
        bgBlur: document.querySelector('input#settings-bg-blur') as HTMLInputElement,
        bgQuality: document.querySelector('select#settings-bg-quality') as HTMLSelectElement,

        offset: document.querySelector('input#settings-audio-offset') as HTMLInputElement,
        useBrowserLatency: document.querySelector('input#settings-use-browser-latency') as HTMLInputElement,
        testInputDelay: document.querySelector('button#settings-test-input-delay') as HTMLButtonElement & { testTimes: number; testDelays: number },
        speed: document.querySelector('input#settings-audio-speed') as HTMLInputElement,

        hitsound: document.querySelector('input#settings-hitsound') as HTMLInputElement,
        hitsoundVolume: document.querySelector('input#settings-hitsound-volume') as HTMLInputElement,

        challengeMode: document.querySelector('input#settings-challenge-mode') as HTMLInputElement,
        plyndb: document.querySelector('input#settings-plyndb') as HTMLInputElement,
        autoPlay: document.querySelector('input#settings-autoplay') as HTMLInputElement,
        antiAlias: document.querySelector('input#settings-anti-alias') as HTMLInputElement,
        lowResolution: document.querySelector('input#settings-low-resolution') as HTMLInputElement,
        debug: document.querySelector('input#settings-debug') as HTMLInputElement,
        prprExtra: document.querySelector('input#settings-prpr-extra') as HTMLInputElement
    },
    startBtn : document.querySelector('button#start') as HTMLButtonElement,
    loadingStatus : document.querySelector('div#loading-status') as HTMLDivElement,
    fullscreenBtn : document.querySelector('button#fullscreen') as HTMLButtonElement,

    playResult: {
        container: document.querySelector('div.play-result') as HTMLDivElement,
        scoreBar: document.querySelector('div.play-result .info-bar.score') as HTMLDivElement,
        accBar: document.querySelector('div.play-result .info-bar.acc-bar') as HTMLDivElement,
    },

    errorWindow : {
        window: document.querySelector('div.error-window') as HTMLDivElement,
        closeBtn: document.querySelector('div.error-window button.close') as HTMLButtonElement,
        content: document.querySelector('div.error-window code.content') as HTMLElement
    }
};

const files: {
    charts: Record<string, PhiChartRender.Chart>;
    musics: Record<string, PhiChartRender.WAudio>;
    images: Record<string, import('pixi.js').Texture>;
    infos: Record<string, string>[];
    lines: Record<string, string>[];
    shaders: Record<string, PhiChartRender.Shader>;
    all: Record<string, unknown>;
    effects?: PhiChartRender.Effect[];
} = {
    charts: {},
    musics: {},
    images: {},
    infos: [],
    lines: [],
    shaders: {},
    all: {}
};

const currentFile: {
    chart: PhiChartRender.Chart | null;
    music: PhiChartRender.WAudio | null;
    bg: import('pixi.js').Texture | null;
} = {
    chart: null,
    music: null,
    bg: null
};

const assets: {
    textures: Record<string, import('pixi.js').Texture | import('pixi.js').Texture[]>;
    sounds: Record<string, PhiChartRender.WAudio | Record<string, PhiChartRender.WAudio>>;
} = {
    textures: {},
    sounds: {}
};

var GlobalGame: PhiChartRender.Game | undefined;

if (import.meta.env.MODE === 'development')
{
    window.qs = qs;
    window.doms = doms;
    window.files = files;
    window.assets = assets;
    window.currentFile = currentFile;
}

doms.chartPackFile.addEventListener('input', function (this: HTMLInputElement)
{
    if (this.files!.length <= 0) return;
    console.log(this.files);
    loadChartFiles(Array.from(this.files!) as ChartFile[]);
});

doms.skinPackFile.addEventListener('input', function (this: HTMLInputElement)
{
    if (this.files!.length <= 0 || !this.files![0]) return;

    JSZip.loadAsync(this.files![0], { createFolders: false })
        .then(async (result) =>
        {
            let loadSuccessCount = 0;

            for (const name in result.files)
            {
                let file = result.files[name];
                if (file.dir) continue;

                let fileFormatSplit = file.name.split('.');
                let fileFormat = fileFormatSplit[fileFormatSplit.length - 1];
                let newFile = new File(
                    [ (await file.async('blob')) ],
                    name,
                    {
                        type: '',
                        lastModified: file.date ? file.date.getTime() : Date.now()
                    }
                ) as ChartFile;

                newFile.format = fileFormat;

                (await (new Promise(() =>
                {
                    throw new Error('Just make a promise, plz ignore me');
                }))
                .catch(async () =>
                {
                    let imgBitmap = await createImageBitmap(newFile);
                    let texture = await Texture.from(imgBitmap);

                    let textureName = /^([a-zA-Z]+)\.[a-zA-Z]+$/.exec(newFile.name)![1];
                    textureName = textureName.replace(textureName[0], textureName[0].toLowerCase());

                    if (textureName.toLowerCase() == 'judgeline' || textureName.toLowerCase() == 'pauseButton') return;
                    if (!assets.textures[textureName]) return;

                    Texture.addToCache(texture, textureName);
                    assets.textures[textureName] = texture;

                    loadSuccessCount++;
                    doms.skinPackFileReadProgress.innerText = 'Load ' + newFile.name + ' successfully.';

                    return;
                })
                .catch(async () =>
                {
                    let audio = await loadAudio(newFile, false, true);

                    if (newFile.name.indexOf('Hitsound-') == 0)
                    {
                        let audioName = /^Hitsound\-([a-zA-Z]+)\.[a-zA-Z\d]+$/.exec(newFile.name)![1].toLowerCase();
                        if (!(assets.sounds as Record<string, PhiChartRender.WAudio>)[audioName]) return;

                        (assets.sounds as Record<string, PhiChartRender.WAudio>)[audioName] = audio;

                        loadSuccessCount++;
                        doms.skinPackFileReadProgress.innerText = 'Load ' + newFile.name + ' successfully.';
                    }

                    return;
                })
                .catch((_e) =>
                {
                    /* No */
                }));
            }

            if (!(assets.textures.clickRaw instanceof Array))
            {
                let _clickTextures: import('pixi.js').Texture[] = [];
                let clickRaw = assets.textures.clickRaw as import('pixi.js').Texture;

                for (let i = 0; i < Math.floor(clickRaw.height / clickRaw.width); i++) {
                    let rectangle = new Rectangle(0, i * clickRaw.width, clickRaw.width, clickRaw.width);
                    let texture = new Texture(clickRaw.baseTexture, rectangle);

                    Texture.addToCache(texture, 'clickRaw' + (i + 0));

                    texture.defaultAnchor.set(0.5);
                    _clickTextures.push(texture);
                }
                
                assets.textures.clickRaw = _clickTextures;
            }

            doms.skinPackFileReadProgress.innerText = 'Successfully load ' + loadSuccessCount + ' skin file(s).';
        })
        .catch((e) =>
        {
            doms.skinPackFileReadProgress.innerText = this.files![0].name + ' may not a vaild zip file.';
            console.error(e);
        }
    );
});

doms.file.chart.addEventListener('input', function (this: HTMLSelectElement) {
    currentFile.chart = files.charts[this.value];

    if (files.infos && files.infos.length > 0)
    {
        for (const info of files.infos)
        {
            if (info.Chart === this.value)
            {
                currentFile.music = files.musics[info.Music];
                currentFile.bg = files.images[info.Image];

                doms.file.music.value = info.Music;
                doms.file.bg.value = info.Image;

                break;
            }
        }
    }

    doms.file.music.dispatchEvent(new Event('input'));
    doms.file.bg.dispatchEvent(new Event('input'));
});

doms.file.music.addEventListener('input', function (this: HTMLSelectElement) {
    currentFile.music = files.musics[this.value];
});

doms.file.bg.addEventListener('input', function (this: HTMLSelectElement) {
    currentFile.bg = files.images[this.value];
});

doms.startBtn.addEventListener('click', async () => {
    if (!currentFile.chart)
    {
        alert('No chart selected.');
        return;
    }
    if (!currentFile.music)
    {
        alert('No music selected.');
        return;
    }

    let zipFiles: Record<string, unknown> = { ...files.all };

    if (!zipFiles['Tap.png']) zipFiles['Tap.png'] = assets.textures.tap;
    if (!zipFiles['TapHL.png']) zipFiles['TapHL.png'] = assets.textures.tapHL;
    if (!zipFiles['Drag.png']) zipFiles['Drag.png'] = assets.textures.drag;
    if (!zipFiles['DragHL.png']) zipFiles['DragHL.png'] = assets.textures.dragHL;
    if (!zipFiles['Flick.png']) zipFiles['Flick.png'] = assets.textures.flick;
    if (!zipFiles['FlickHL.png']) zipFiles['FlickHL.png'] = assets.textures.flickHL;
    if (!zipFiles['HoldHead.png']) zipFiles['HoldHead.png'] = assets.textures.holdHeadHL;
    if (!zipFiles['HoldHeadHL.png']) zipFiles['HoldHeadHL.png'] = assets.textures.holdHeadHL;
    if (!zipFiles['Hold.png']) zipFiles['Hold.png'] = assets.textures.holdBody;
    if (!zipFiles['HoldHL.png']) zipFiles['HoldHL.png'] = assets.textures.holdBodyHL;
    if (!zipFiles['HoldEnd.png']) zipFiles['HoldEnd.png'] = assets.textures.holdEnd;

    currentFile.chart.music = currentFile.music;
    if (currentFile.bg && doms.settings.showBG.checked)
    {
        let resized = await resizeImage(currentFile.bg, parseInt(doms.settings.bgQuality.value));
        let blurred = await blurImage(resized, parseFloat(doms.settings.bgBlur.value));
        let bgBlur = await Texture.from(blurred as any);
        Texture.addToCache(bgBlur, doms.file.bg.value + '_blured');
        currentFile.chart.bg = bgBlur;
    }
    else
    {
        currentFile.chart.bg = null;
    }

    if (files.infos && files.infos.length > 0)
    {
        for (const info of files.infos)
        {
            if (info.Chart === doms.file.chart.value)
            {
                currentFile.chart.info.name = info.Name;
                currentFile.chart.info.artist = info.Composer;
                currentFile.chart.info.author = info.Designer;
                currentFile.chart.info.bgAuthor = info.Illustrator;
                currentFile.chart.info.difficult = info.Level;

                break;
            }
        }
    }

    if (files.lines && files.lines.length > 0)
    {
        let lines: Record<string, string>[] = [];

        for (const line of files.lines)
        {
            if (line.Chart === doms.file.chart.value)
            {
                lines.push(line);
            }
        }

        currentFile.chart.readLineTextureInfo(lines as unknown as { LineId: number; Image: string; Horz?: number; Vert?: number }[]);
    }

    let noteScaleValue = 10000 - Number(doms.settings.noteScale.value);
    let bgDimValue = Number(doms.settings.bgDim.value);
    let audioOffsetValue = Number(doms.settings.offset.value) / 1000 + (doms.settings.useBrowserLatency.checked ? PhiChartRender.WAudio.globalLatency : 0);
    let speedValue = Number(doms.settings.speed.value);
    let hitsoundVolumeValue = Number(doms.settings.hitsoundVolume.value);

    GlobalGame = new PhiChartRender.Game({
        chart: currentFile.chart,
        assets: assets as { textures: Record<string, any>; sounds: Record<string, any> },
        effects: files.effects,
        zipFiles: zipFiles,
        render: {
            resizeTo: document.documentElement,
            resolution: doms.settings.lowResolution.checked ? 1 : window.devicePixelRatio,
            antialias: doms.settings.antiAlias.checked
        },
        settings: {
            multiNoteHL: doms.settings.multiNoteHL.checked,
            showAPStatus: doms.settings.showAPStatus.checked,
            showInputPoint: doms.settings.showInputPoint.checked,
            bgDim: bgDimValue,
            noteScale: noteScaleValue,

            audioOffset: audioOffsetValue,
            speed: speedValue,

            hitsound: doms.settings.hitsound.checked,
            hitsoundVolume: hitsoundVolumeValue,

            challengeMode: doms.settings.challengeMode.checked,
            autoPlay: doms.settings.autoPlay.checked,
            debug: doms.settings.debug.checked,
            shader: doms.settings.prprExtra.checked
        },
        watermark: 'github/MisaLiu/phi-chart-render ' + GIT_VERSION + (import.meta.env.MODE === 'development' ? ' [Develop Mode]' : '')
    });

    let canvas = GlobalGame.render.view as unknown as HTMLCanvasElement;
    document.body.appendChild(canvas);
    canvas.classList.add('canvas-game');

    GlobalGame.on('start', () => console.log('Game started!'));
    GlobalGame.on('pause', () => {
        console.log('Game paused!');
        qs('.game-paused').style.display = 'block';
    });
    GlobalGame.on('end', (game: PhiChartRender.Game) => {
        console.log('Game ended!');
        showGameResultPopup(game);
    });

    if (doms.settings.plyndb.checked) GlobalGame.on('tick', PlayLikeYouNeverDidBefore);

    GlobalGame.createSprites();
    GlobalGame.start();

    // eruda.hide();

    if (import.meta.env.MODE === 'development')
    {
        window._game = GlobalGame;
        (window as any).globalThis.__PIXI_APP__ = GlobalGame.render;
    }

    doms.fileSelect.style.display = 'none';
});

doms.errorWindow.closeBtn.addEventListener('click', () =>
{
    doms.errorWindow.window.style.display = 'none';
});

window.addEventListener('resize', () =>
{
    calcHeightPercent();
});
window.addEventListener('load', async () =>
{
    for (const name in fonts)
    {
        try
        {
            doms.loadingStatus.innerText = 'Loading font ' + name + ' ...';
            await fonts[name].load(null, 30000);
        }
        catch (e)
        {
            console.error(e);
        }
    }
    document.body.classList.add('font-loaded');

    (await (async (resources: { name: string; url: string }[] = []) =>
    {
        for (const resource of resources)
        {
            doms.loadingStatus.innerText = 'Loading asset ' + resource.name + ' ...';

            try
            {
                let res = await requestFile(resource.url);
                let imgBitmap = await createImageBitmap(res);
                let texture = await Texture.from(imgBitmap);

                Texture.addToCache(texture, resource.name);
                assets.textures[resource.name] = texture;

                if (resource.name == 'clickRaw')
                {
                    let _clickTextures: import('pixi.js').Texture[] = [];
                    let clickRaw = assets.textures[resource.name] as import('pixi.js').Texture;
                    
                    for (let i = 0; i < Math.floor(clickRaw.height / clickRaw.width); i++) {
                        let rectangle = new Rectangle(0, i * clickRaw.width, clickRaw.width, clickRaw.width);
                        let texture = new Texture(clickRaw.baseTexture, rectangle);

                        Texture.addToCache(texture, resource.name + (i + 0));

                        texture.defaultAnchor.set(0.5);
                        _clickTextures.push(texture);
                    }
                    
                    assets.textures[resource.name] = _clickTextures;
                }
            }
            catch (e)
            {
                console.error('Failed getting resource: ' + resource.name, e);
            }
        }
    })([
        { name: 'tap', url: './assets/Tap.png' },
        { name: 'tapHL', url: './assets/TapHL.png' },
        { name: 'drag', url: './assets/Drag.png' },
        { name: 'dragHL', url: './assets/DragHL.png' },
        { name: 'flick', url: './assets/Flick.png' },
        { name: 'flickHL', url: './assets/FlickHL.png' },
        { name: 'holdHead', url: './assets/HoldHead.png' },
        { name: 'holdHeadHL', url: './assets/HoldHeadHL.png' },
        { name: 'holdBody', url: './assets/Hold.png' },
        { name: 'holdBodyHL', url: './assets/HoldHL.png' },
        { name: 'holdEnd', url: './assets/HoldEnd.png' },
        { name: 'judgeline', url: './assets/JudgeLine.png' },
        { name: 'clickRaw', url: './assets/clickRaw128.png' },

        { name: 'pauseButton', url: './assets/pauseButton.png' }
    ]));

    (await (async (resources: { name: string; url: string }[] = [], options: { noTimer?: boolean } = {}) =>
    {
        for (const resource of resources)
        {
            doms.loadingStatus.innerText = 'Loading hitsound ' + resource.name + ' ...';

            try
            {
                let res = await requestFile(resource.url);
                let audio = await loadAudio(res, false, options.noTimer);

                if (!assets.sounds) assets.sounds = {};
                (assets.sounds as Record<string, PhiChartRender.WAudio>)[resource.name] = audio;
            }
            catch (e)
            {
                console.error('Failed getting resource: ' + resource.name, e);
            }
        }
    })([
        { name: 'tap', url: './assets/sounds/Hitsound-Tap.ogg' },
        { name: 'drag', url: './assets/sounds/Hitsound-Drag.ogg' },
        { name: 'flick', url: './assets/sounds/Hitsound-Flick.ogg' }
    ], { noTimer: true }));

    (await (async (resources: { name: string; url: string }[] = [], options: { loop?: boolean; noTimer?: boolean } = {}) =>
    {
        for (const resource of resources)
        {
            doms.loadingStatus.innerText = 'Loading result music ' + resource.name + ' ...';

            try
            {
                let res = await requestFile(resource.url);
                let audio = await loadAudio(res, options.loop, options.noTimer);

                if (!assets.sounds.result) assets.sounds.result = {};
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>)[resource.name] = audio;
            }
            catch (e)
            {
                console.error('Failed getting resource: ' + resource.name, e);
            }
        }
    })([
        { name: 'ez', url: './assets/sounds/result/ez.ogg' },
        { name: 'hd', url: './assets/sounds/result/hd.ogg' },
        { name: 'in', url: './assets/sounds/result/in.ogg' },
        { name: 'at', url: './assets/sounds/result/at.ogg' },
        { name: 'sp', url: './assets/sounds/result/sp.ogg' },
        { name: 'spGlitch', url: './assets/sounds/result/sp_glitch.ogg' },
    ], { loop: true, noTimer: true }));

    doms.loadingStatus.innerText = 'All done!';
    doms.chartPackFileReadProgress.innerText = 'No chart pack file selected';
    doms.chartPackFile.disabled = false;
    doms.skinPackFile.disabled = false;

    calcHeightPercent();

    doms.settings.testInputDelay.testTimes = 0;
    doms.settings.testInputDelay.testDelays = 0;

    doms.settings.testInputDelay.addEventListener('touchstart', (e: TouchEvent) =>
    {
        let getTime = () => performance ? performance.now() : Date.now();
        doms.settings.testInputDelay.testTimes += 1;
        doms.settings.testInputDelay.testDelays += (getTime() - e.timeStamp);
        doms.settings.testInputDelay.innerText = 'Tap on this button to test input delay...' + (Math.round((doms.settings.testInputDelay.testDelays / doms.settings.testInputDelay.testTimes) * 1000) / 1000) + 'ms';
    });

    doms.playResult.scoreBar.addEventListener('click', () => doms.playResult.accBar.classList.toggle('show'));

    {
        let listTabs = document.querySelectorAll('div.tab div.bar > *');
        let listTabContents = document.querySelectorAll('div.tab div.content > *[id^="tab-"]');

        for (const tab of Array.from(listTabs))
        {
            tab.addEventListener('click', switchTab as EventListener);
        }

        for (let i = 0; i < listTabContents.length; i++)
        {
            let content = listTabContents[i] as HTMLElement;
            if (i === 0) content.style.display = 'block';
            else content.style.display = 'none';
        }
    }

    if (import.meta.env.MODE === 'production')
    {
        fetch('https://www.googletagmanager.com/gtag/js?id=G-PW9YT2TVFV')
            .then(res => res.text())
            .then(res =>
            {
                eval(res);
                window.dataLayer = window.dataLayer || [];
                window.gtag = function() {(window.dataLayer as unknown[]).push(arguments);};
                window.gtag('js', new Date());
                window.gtag('config', 'G-PW9YT2TVFV');
            })
            .catch(e =>
            {
                console.error('Failed to load Google Analytics');
                console.error(e);
            }
        );
    }

    initConsoleEasterEgg();

    function requestFile(url: string): Promise<Blob>
    {
        return new Promise((res, rej) =>
        {
            let xhr = new XMLHttpRequest();

            xhr.responseType = 'blob';

            xhr.onreadystatechange = () =>
            {
                if (xhr.readyState === 4 && xhr.status === 200)
                {
                    res(xhr.response);
                }
            };

            xhr.onerror = (e) =>
            {
                rej(e);
            };

            xhr.open('GET', url);
            xhr.send();
        });
    }
});

function readArrayBuffer(file: Blob): Promise<ArrayBuffer>
    {
        return new Promise((res, rej) =>
        {
            let reader = new FileReader();

            reader.onloadend = () =>
            {
                res(reader.result as ArrayBuffer);
            };

            reader.onerror = (e) =>
            {
                rej(e);
            };

            reader.readAsArrayBuffer(file);
        });
}

function loadAudio(file: Blob, loop: boolean = false, noTimer: boolean = false): Promise<PhiChartRender.WAudio>
{
    return new Promise(async (res, rej) =>
    {
        try {
            let arrayBuffer = await readArrayBuffer(file);
            let audio = await PhiChartRender.WAudio.from(arrayBuffer, loop);
            res(audio);
        } catch (e) {
            rej(e);
        }
    });
}

function CsvReader(_text: string): Record<string, string>[]
{
    let firstRow: string[] = [];
    let result: Record<string, string>[] = [];

    _text.split(/\r\n|\n\r/).forEach((row, rowIndex) =>
    {
        row.split(',').forEach((text, columnIndex) =>
        {
            if (rowIndex <= 0)
            {
                firstRow.push(/([A-Za-z0-9]+)/.exec(text)![1]);
            }
            else
            {
                if (!result[rowIndex - 1]) result[rowIndex - 1] = {};
                result[rowIndex - 1][firstRow[columnIndex]] = text;
            }
        });
    });

    return result;
}

function SettingsReader(_text: string): Record<string, string>
{
    let rows = (_text + '').split(/\r\n|\n\r/);
    let rowReg = /^([a-zA-Z]+):\s(.+)$/;
    let result: Record<string, string> = {};

    for (const row of rows)
    {
        let rowRegResult = rowReg.exec(row);
    
        if (!rowRegResult || rowRegResult.length < 3) continue;

        let infoKey = rowRegResult[1];
        let infoValue = rowRegResult[2];

        switch (infoKey)
        {
            case 'Name':
            {
                result['Name'] = infoValue;
                break;
            }
            case 'Level':
            {
                result['Level'] = infoValue;
                break;
            }
            case 'Charter':
            {
                result['Designer'] = infoValue;
                break;
            }
            case 'Chart':
            {
                result['Chart'] = infoValue;
                break;
            }
            case 'Song':
            {
                result['Music'] = infoValue;
                break;
            }
            case 'Picture':
            {
                result['Image'] = infoValue;
                break;
            }
            default: {
                result[infoKey] = infoValue;
            }
        }
    }

    return result;
}

function blurImage(_texture: import('pixi.js').Texture | HTMLImageElement | HTMLCanvasElement | ImageBitmap, radius: number = 10): Promise<ImageBitmap>
{
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d')!;
    let texture: HTMLImageElement | HTMLCanvasElement;

    if ((_texture as import('pixi.js').Texture).baseTexture) texture = ((_texture as import('pixi.js').Texture).baseTexture.resource as any).source as HTMLImageElement | HTMLCanvasElement;
    else texture = _texture as HTMLImageElement | HTMLCanvasElement;

    canvas.width = texture.width;
    canvas.height = texture.height;

    ctx.drawImage(texture, 0, 0);

    StackBlur(canvas, 0, 0, texture.width, texture.height, radius);
    return new Promise((res, rej) =>
    {
        createImageBitmap(canvas)
            .then(result => res(result))
            .catch(e => rej(e));
    });
}

function resizeImage(_texture: import('pixi.js').Texture | HTMLImageElement | HTMLCanvasElement, quality: number = 1): Promise<ImageBitmap>
{
    let canvas = document.createElement('canvas');
    let texture: HTMLImageElement | HTMLCanvasElement;
    let pica = Pica({
        features: ['all']
    });

    if ((_texture as import('pixi.js').Texture).baseTexture) texture = ((_texture as import('pixi.js').Texture).baseTexture.resource as any).source as HTMLImageElement | HTMLCanvasElement;
    else texture = _texture as HTMLImageElement | HTMLCanvasElement;

    switch (quality)
    {
        case 0: {
            canvas.width = 480;
            canvas.height = texture.height * (480 / texture.width);
            break;
        }
        case 1:
        {
            canvas.width = 720;
            canvas.height = texture.height * (720 / texture.width);
            break;
        }
        case 2:
        {
            canvas.width = 1080;
            canvas.height = texture.height * (1080 / texture.width);
            break;
        }
        default:
        {
            canvas.width = texture.width;
            canvas.height = texture.height;
        }
    }

    return (new Promise(async (res, rej) =>
    {
        res(await createImageBitmap(await pica.resize(texture, canvas)));
    }));
}

function calcHeightPercent(): void
{
    let realWidth = document.documentElement.clientHeight / 9 * 16 < document.documentElement.clientWidth ? document.documentElement.clientHeight / 9 * 16 : document.documentElement.clientWidth;

    document.body.style.setProperty('--height-percent', String(document.documentElement.clientHeight / 1080));
    document.body.style.setProperty('--width-offset', (document.documentElement.clientWidth - realWidth) / 2 + 'px');
}

function pauseGame(): void
{
    if (!GlobalGame) return;

    GlobalGame.pause();

    if (GlobalGame._isPaused)
    {
        qs('.game-paused').style.display = 'block';
    }
    else
    {
        console.log('Game unpaused!');
        qs('.game-paused').style.display = 'none';
    }
}

function restartGame(): void
{
    if (!GlobalGame) return;

    GlobalGame.restart();

    for (const name in (assets.sounds as Record<string, Record<string, PhiChartRender.WAudio>>).result)
    {
        let sound = (assets.sounds as Record<string, Record<string, PhiChartRender.WAudio>>).result[name];
        sound.stop();
    }

    qs('.game-paused').style.display = 'none';
    qs('.play-result').classList.remove('show');
    doms.playResult.accBar.classList.remove('show');
}

function exitGame(): void
{
    if (!GlobalGame) return;

    GlobalGame.destroy(true);
    GlobalGame = undefined;

    if (import.meta.env.MODE === 'development')
    {
        window._game = undefined;
        (window as any).globalThis.__PIXI_APP__ = undefined;
    }

    for (const name in (assets.sounds as Record<string, Record<string, PhiChartRender.WAudio>>).result)
    {
        let sound = (assets.sounds as Record<string, Record<string, PhiChartRender.WAudio>>).result[name];
        sound.stop();
    }

    qs('.game-paused').style.display = 'none';
    qs('.play-result').classList.remove('show');
    doms.playResult.accBar.classList.remove('show');

    doms.fileSelect.style.display = 'block';
}

window.pauseGame = pauseGame;
window.restartGame  = restartGame;
window.exitGame = exitGame;

function showGameResultPopup(game: PhiChartRender.Game): void
{
    let chart = game.chart;
    let judge = game.judgement;

    qs('.play-result .song-info .title').innerHTML = (chart.info.name || 'Untitled');
    qs('.play-result .song-info .subtitle.artist').innerHTML = (chart.info.artist || 'Unknown');
    qs('.play-result .song-info .subtitle.diff').innerHTML = (chart.info.difficult || 'SP Lv.?');
    if (game._settings.challengeMode) qs('.play-result .song-info .subtitle.diff').innerHTML += ' (challenge)';
    if (Number((game._settings.speed).toFixed(2)) !== 1) qs('.play-result .song-info .subtitle.diff').innerHTML += ' (x' + (game._settings.speed).toFixed(2) + ')';

    if (judge.score.judgeLevel == 6) qs('.play-result .judge-icon').innerText = 'φ';
    else if (judge.score.judgeLevel == 5) qs('.play-result .judge-icon').innerText = 'V';
    else if (judge.score.judgeLevel == 4) qs('.play-result .judge-icon').innerText = 'S';
    else if (judge.score.judgeLevel == 3) qs('.play-result .judge-icon').innerText = 'A';
    else if (judge.score.judgeLevel == 2) qs('.play-result .judge-icon').innerText = 'B';
    else if (judge.score.judgeLevel == 1) qs('.play-result .judge-icon').innerText = 'C';
    else qs('.play-result .judge-icon').innerText = 'False';

    if (judge.score.APType == 2) qs('.play-result .extra-info').innerText = 'All Perfect';
    else if (judge.score.APType == 1) qs('.play-result .extra-info').innerText = 'Full Combo';
    else qs('.play-result .extra-info').innerText = '';
    if (judge.score._autoPlay) qs('.play-result .extra-info').innerText = 'Auto Play';

    qs('.play-result .info-bar.score .score').innerText = fillZero((judge.score.score).toFixed(0));
    qs('.play-result .info-bar.score .acc').innerText = 'Accuracy ' + (judge.score.acc * 100).toFixed(2) + '%';

    qs('.play-result .info-bar.detail .detail-single .value.perfect').innerText = String(judge.score.perfect);
    qs('.play-result .info-bar.detail .detail-single .value.good').innerText = String(judge.score.good);
    qs('.play-result .info-bar.detail .detail-single .value.bad').innerText = String(judge.score.bad);
    qs('.play-result .info-bar.detail .detail-single .value.miss').innerText = String(judge.score.miss);
    qs('.play-result .info-bar.detail .max-combo').innerText = 'Max Combo ' + judge.score.maxCombo;

    {
        qs('.play-result .info-bar.acc-bar .judge-histogram').innerHTML = '';

        let noteJudgeTime = (!game._settings.challengeMode ? 180 : 90) / 1000;
        let noteTimeHigestCount = 0;
        let accHistogramValue: Record<string, number> = {};

        game.chart.notes.forEach((note) =>
        {
            if (note.isFake) return;
            if (isNaN(note.scoreTime)) return;

            accHistogramValue[Math.ceil((note.scoreTime / noteJudgeTime) * 50)] = accHistogramValue[Math.ceil((note.scoreTime / noteJudgeTime) * 50)] ? accHistogramValue[Math.ceil((note.scoreTime / noteJudgeTime) * 50)] + 1 : 1;
        });

        for (const acc in accHistogramValue)
        {
            if (accHistogramValue[acc] > noteTimeHigestCount) noteTimeHigestCount = accHistogramValue[acc];
        }
        for (const acc in accHistogramValue)
        {
            let value = document.createElement('div');
            value.style.opacity = String(accHistogramValue[acc] / noteTimeHigestCount);
            value.style.setProperty('--pos', (Number(acc) + 50) + '%');

            if (!game._settings.challengeMode)
            {
                if (-(80 / 360 * 100) <= Number(acc) && Number(acc) <= (80 / 360 * 100)) value.style.background = '#FFECA0';
                else if (-(160 / 360 * 100) <= Number(acc) && Number(acc) <= (160 / 360 * 100)) value.style.background = '#B4E1FF';
                else value.style.background = '#6c4343';
            }
            else
            {
                if (-(40 / 180 * 100) <= Number(acc) && Number(acc) <= (40 / 180 * 100)) value.style.background = '#FFECA0';
                else if (-(75 / 180 * 100) <= Number(acc) && Number(acc) <= (75 / 180 * 100)) value.style.background = '#B4E1FF';
                else value.style.background = '#6c4343';
            }
            

            qs('.play-result .info-bar.acc-bar .judge-histogram').appendChild(value);
        }

        let center = document.createElement('div');
        center.className = 'center';
        qs('.play-result .info-bar.acc-bar .judge-histogram').appendChild(center);
    }

    {
        let diffType = chart.info.difficult ? /([a-zA-Z]+)\s[lL][vV]\.?(.+)/.exec(chart.info.difficult) : null;
        let diffTypeStr = (diffType && diffType.length >= 1 ? diffType[1] : 'IN');

        switch ((diffTypeStr ? diffTypeStr.toLowerCase() : 'in'))
        {
            case 'ez':
            {
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>).ez.stop();
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>).ez.play();
                break;
            }
            case 'hd':
            {
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>).hd.stop();
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>).hd.play();
                break;
            }
            case 'at':
            {
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>).at.stop();
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>).at.play();
                break;
            }
            case 'sp':
            {
                if (judge.score.levelPassed)
                {
                    (assets.sounds.result as Record<string, PhiChartRender.WAudio>).spGlitch.stop();
                    (assets.sounds.result as Record<string, PhiChartRender.WAudio>).spGlitch.play();
                }
                else
                {
                    (assets.sounds.result as Record<string, PhiChartRender.WAudio>).sp.stop();
                    (assets.sounds.result as Record<string, PhiChartRender.WAudio>).sp.play();
                }
                
                break;
            }
            case 'in' :
            default :
            {
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>).in.stop();
                (assets.sounds.result as Record<string, PhiChartRender.WAudio>).in.play();
                break;
            }
        }
    }

    qs('.play-result').classList.add('show');

    function fillZero(num: string): string
    {
        let result = num + '';
        while (result.length < 7)
        {
            result = '0' + result;
        }
        return result;
    }
}

function switchTab(e: Event): void
{
    let targetTab = e.target as HTMLElement;
    let targetTabContent = targetTab.dataset.tabId;

    if (!document.querySelector('div.tab div.content > *#tab-' + targetTabContent)) return;

    for (const tab of Array.from(document.querySelectorAll('div.tab div.bar > *')))
    {
        tab.classList.remove('active');
    }
    
    for (const content of Array.from(document.querySelectorAll('div.tab div.content > *[id^="tab-"]')))
    {
        (content as HTMLElement).style.display = 'none';
    }

    targetTab.classList.add('active');
    (document.querySelector('div.tab div.content > *#tab-' + targetTabContent) as HTMLElement).style.display = 'block';
}

async function loadChartFiles(_files: File[]): Promise<void>
{
    let fileList: ChartFile[] = [ ..._files ] as ChartFile[];

    for (let fileIndex = 0; fileIndex < fileList.length; fileIndex++)
    {
        if (!fileList[fileIndex]) continue;

        let file = fileList[fileIndex];
        let fileFormatSplit = file.name.split('.');
        let fileFormat = fileFormatSplit[fileFormatSplit.length - 1];

        file.format = fileFormat;

        doms.chartPackFileReadProgress.innerText = 'Loading files: ' + file.name + ' ...(' + (fileIndex + 1) + '/' + fileList.length + ')';

        if (file.name === 'info.csv')
        {
            try {
                let rawText = await readText(file);
                let infos = CsvReader(rawText);

                files.infos.push(...infos);
                files.all[file.name] = infos;

            } catch (e) {
                
            }
        }
        else if (file.name === 'line.csv')
        {
            try {
                let rawText = await readText(file);
                let lines = CsvReader(rawText);

                files.lines.push(...lines);
                files.all[file.name] = lines;

            } catch (e) {
                
            }
        }
        else if (file.name === 'extra.json')
        {
            if (files.effects instanceof Array)
            {
                console.warn('Already loaded an extra.json, previously loaded file will be overwritten');
                files.effects = undefined;
            }

            try {
                let rawText = await readText(file);
                let effects = PhiChartRender.Effect.from(JSON.parse(rawText));

                files.effects = effects;
                files.all[file.name] = effects;

            } catch (e) {

            } 
        }
        else if (file.name === 'Settings.txt' || file.name === 'info.txt')
        {
            try {
                let rawText = await readText(file);
                let info = SettingsReader(rawText);

                files.infos.push(info);
                files.all[file.name] = info;

            } catch (e) {
                
            }
        }
        else
        {
            (await (new Promise(() =>
            {
                throw new Error('Just make a promise, plz ignore me');
            }))
            .catch(async () =>
            {
                let zipFiles = await JSZip.loadAsync(file, { createFolders: false });

                for (const name in zipFiles.files)
                {
                    if (zipFiles.files[name].dir) continue;

                    let zipFile = zipFiles.files[name];
                    let newFile = new File(
                        [ (await zipFile.async('blob')) ],
                        name,
                        {
                            type: '',
                            lastModified: zipFile.date ? zipFile.date.getTime() : Date.now()
                        }
                    ) as ChartFile;

                    fileList.push(newFile);
                }

                return;
            })
            .catch(async () =>
            {
                let chartRaw = await readText(file);
                let chart;

                try {
                    chart = JSON.parse(chartRaw);
                } catch (e) {
                    chart = chartRaw;
                }

                chart = PhiChartRender.Chart.from(chart);

                files.charts[file.name] = chart;
                files.all[file.name] = chart;
                doms.file.chart.appendChild(createSelectOption(file));

                return;
            })
            .catch(async () =>
            {
                let imgBitmap = await createImageBitmap(file);
                let texture = await Texture.from(imgBitmap);

                Texture.addToCache(texture, file.name);

                files.images[file.name] = texture;
                files.all[file.name] = texture;
                doms.file.bg.appendChild(createSelectOption(file));

                return;
            })
            .catch(async () =>
            {
                let audio = await loadAudio(file, false, false);

                files.musics[file.name] = audio;
                files.all[file.name] = audio;
                doms.file.music.appendChild(createSelectOption(file));

                return;
            })
            .catch(async () =>
            {
                let shaderRaw = await readText(file);
                let shader = PhiChartRender.Shader.from(shaderRaw, file.name);

                files.shaders[file.name] = shader;
                files.all[file.name] = shader;
            })
            .catch((_e) =>
            {
                console.error('Unsupported file: ' + file.name);
                return;
            }));
        }
    }

    if (doms.file.chart.childNodes.length >= 1 && doms.file.music.childNodes.length >= 1)
    {
        doms.file.chart.dispatchEvent(new Event('input'));
        doms.startBtn.disabled = false;
    }

    doms.chartPackFileReadProgress.innerText = 'All done!';

    function readText(file: Blob): Promise<string>
    {
        return new Promise((res, rej) =>
        {
            let reader = new FileReader();

            reader.onloadend = () =>
            {
                res(reader.result as string);
            };

            reader.onerror = (e) =>
            {
                rej(e);
            };

            reader.readAsText(file);
        });
    }

    function createSelectOption(file: ChartFile): HTMLOptionElement
    {
        let option = document.createElement('option');
        option.innerText = option.value = file.name;
        return option;
    }
}

async function initConsoleEasterEgg(): Promise<void>
{
    try {
        let url = await getImageBase64('./icons/64.png');
        console.log('%c ', 'padding:32px;background:url(' + url + ') center center no-repeat;');
    } catch (e) {}
    
    console.log('%cphi-chart-render%c' + GIT_VERSION, 'padding:8px;background-color:#1C1C1C;color:#FFF', 'padding:8px;background-color:#1E90FF;color:#FFF;');
    
    try {
        let url = await getImageBase64('./icons/github.png');
        console.log('%chttps://github.com/MisaLiu/phi-chart-render', 'padding:4px;padding-left:22px;background:url(' + url + ') left center no-repeat;background-color:#1C1C1C;background-size:contain;color:#FFF;');
    } catch (e) {
        console.log('%cGitHub: https://github.com/MisaLiu/phi-chart-render', 'padding:4px;background-color:#1C1C1C;color:#FFF;');
    }
    
    console.groupCollapsed('❤️ Support me');
    try {
        let url = await getImageBase64('./icons/patreon.png');
        console.log('%chttps://patreon.com/HIMlaoS_Misa', 'padding:4px;padding-left:22px;background:url(' + url + ') left center no-repeat;background-color:#f3455c;background-size:contain;color:#FFF;');
    } catch (e) {
        console.log('%Patreon: https://patreon.com/HIMlaoS_Misa', 'padding:4px;background-color:#f3455c;color:#FFF;');
    }
    
    try {
        let url = await getImageBase64('./icons/afdian.png');
        console.log('%chttps://afdian.net/@MisaLiu', 'padding:4px;padding-left:22px;background:url(' + url + ') left center no-repeat;background-color:#946CE6;background-size:contain;color:#FFF;');
    } catch (e) {
        console.log('%爱发电: https://afdian.net/@MisaLiu', 'padding:4px;background-color:#946CE6;color:#FFF;');
    }

    console.groupEnd();

    function getImageBase64(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            fetch(url)
                .then(res => res.blob())
                .then(res => {
                    let reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result as string);
                    };
                    reader.onerror = (e) => {
                        reject(e);
                    };
                    reader.readAsDataURL(res);
                }
            );
        });
    }
}

function PlayLikeYouNeverDidBefore(game: PhiChartRender.Game, currentTime: number): void
{
    if (isNaN(currentTime)) return;

    let currentSpeed = 1 + 0.5 * Math.sin(1.5708 * (currentTime % 2));
    (game.chart.music as unknown as PhiChartRender.WAudio).speed = currentSpeed;
    (game.chart.sprites.info as Record<string, import('pixi.js').Text>).songName.text = game.chart.info.name + ' (x' + Math.round(currentSpeed * 100) / 100 + ')';
}

export { loadChartFiles };
