import { text as verifyText } from '@/verify';
import { loadChartFiles } from '../index';

const doms = {
    linkInput: document.querySelector('input#phizone-chart-link') as HTMLInputElement,
    chartDownload: document.querySelector('button#phizone-download-chart') as HTMLButtonElement,
    downloadProgress: document.querySelector('div#phizone-download-progress') as HTMLDivElement
};

const PhiZoneLinkReg = /^https:\/\/[\d\w]+\.phi\.zone\/charts\/([\da-f-]+)/i;

doms.linkInput.addEventListener('keydown', (e: KeyboardEvent) =>
{
    if (e.key === 'Enter') doms.chartDownload.dispatchEvent(new Event('click'));
});

doms.chartDownload.addEventListener('click', () =>
{
    let downloadId = doms.linkInput.value.trim();

    if (!downloadId || downloadId == '')
    {
        alert('Please enter a chart link/ID!');
        doms.linkInput.focus();
        return;
    }

    // 提取 ID（来自 URL 或直接输入）
    if (PhiZoneLinkReg.test(downloadId)) {
        downloadId = PhiZoneLinkReg.exec(downloadId)![1];
    }

    // 校验 ID 格式
    if (!/^[\da-f-]+$/i.test(downloadId)) {
        alert('Invalid ID format!');
        doms.linkInput.focus();
        return;
    }

    doms.downloadProgress.innerText = 'Getting chart info...';

    fetch('https://api.phi.zone/charts/' + downloadId + '/?query_song=1&query_owner=1')
        .then(res => res.json())
        .then((res: PhiZoneApiResponse) =>
        {
            if (res.data.id !== downloadId)
            {
                doms.downloadProgress.innerText = 'Cannot get chart info: ' + res.detail;
                return;
            }
            
            if (!verifyText(res.data.file, undefined) || !res.data.song.title || !verifyText(res.data.song.illustration, undefined) || !verifyText(res.data.song.file, undefined))
            {
                doms.downloadProgress.innerText = 'Cannot get chart info: server didn\'t provide any link';
                return;
            }

            let resUrls = {
                chart: res.data.file!,
                song: res.data.song.file!,
                illustration: res.data.song.illustration!
            };

            let infos = {
                name      : res.data.song.title,
                artist    : res.data.song.authorName,
                author    : res.data.authorName.replace(/\[PZUser:\d+:(.+)\]/, '$1'),
                bgAuthor  : res.data.song.illustrator,
                difficult : res.data.level + ' ' + 'Lv.' + Math.floor(res.data.difficulty)
            };

            downloadFiles(resUrls, infos);
        }
    );
});

function switchTab(e: Event | { target: EventTarget }): void {
    let targetTab = e.target as HTMLElement;
    let targetTabContent = targetTab.dataset.tabId;

    if (!document.querySelector('div.tab div.content > *#tab-' + targetTabContent)) return;

    for (const tab of document.querySelectorAll('div.tab div.bar > *')) {
        tab.classList.remove('active');
    }

    for (const content of document.querySelectorAll('div.tab div.content > *[id^="tab-"]')) {
        (content as HTMLElement).style.display = 'none';
    }

    targetTab.classList.add('active');
    (document.querySelector('div.tab div.content > *#tab-' + targetTabContent) as HTMLElement).style.display = 'block';
}

async function downloadFiles(urls: Record<string, string>, infos: Record<string, string>): Promise<void>
{
    let fileName = {
        chart: decodeURIComponent(urls.chart.split('/').pop()!),
        song: decodeURIComponent(urls.song.split('/').pop()!),
        bg: decodeURIComponent(urls.illustration.split('/').pop()!)
    };

    let settingsFile = `Name: ${infos.name}\r\n` +
        `Level: ${infos.difficult}\r\n` +
        `Charter: ${infos.author}\r\n` +
        `Chart: ${fileName.chart}\r\n` +
        `Song: ${fileName.song}\r\n` +
        `Picture: ${fileName.bg}`;

    let chart = await downloadFile(urls.chart, (progress: number) => { doms.downloadProgress.innerText = 'Downloading chart (' + Math.floor(progress * 100) + '%)'; });
    let song = await downloadFile(urls.song, (progress: number) => { doms.downloadProgress.innerText = 'Downloading song (' + Math.floor(progress * 100) + '%)'; });
    let bg = await downloadFile(urls.illustration, (progress: number) => { doms.downloadProgress.innerText = 'Downloading bg (' + Math.floor(progress * 100) + '%)'; });

    doms.downloadProgress.innerText = 'All files are downloaded, head to \'File\' to select chart.';

    loadChartFiles([
        new File([chart], fileName.chart, { type: chart.type, lastModified: Date.now() }),
        new File([song], fileName.song, { type: song.type, lastModified: Date.now() }),
        new File([bg], fileName.bg, { type: bg.type, lastModified: Date.now() }),
        new File([new Blob([settingsFile])], 'Settings.txt', { type: 'text/plain', lastModified: Date.now() })
    ]).then(() => {
        const fileTab = document.querySelector('div.tab div.bar > *[data-tab-id="file"]');
        if (fileTab) {
            switchTab({ target: fileTab } as unknown as Event);
        }
    });

    function downloadFile(url: string, onProgressChange?: (progress: number) => void): Promise<Blob>
    {
        return new Promise((res, rej) =>
        {
            let xhr = new XMLHttpRequest();

            xhr.responseType = 'blob';

            xhr.onreadystatechange = () =>
            {
                if (xhr.readyState === 4)
                {
                    if (xhr.status === 200)
                    {
                        res(xhr.response);
                    }
                }
            };

            xhr.onprogress = (e: ProgressEvent) =>
            {
                if (typeof onProgressChange === 'function')
                {
                    onProgressChange(e.loaded / e.total);
                }
            };

            xhr.onerror = (e: Event) => { rej(e) };

            xhr.open('GET', url);
            xhr.send();
        });
    }
}

interface PhiZoneApiResponse {
    detail?: string;
    data: {
        id: string;
        file: string | null;
        authorName: string;
        level: string;
        difficulty: number;
        song: {
            title: string;
            authorName: string;
            illustration: string | null;
            file: string | null;
            illustrator: string;
        };
    };
}