import { text as verifyText } from '@/verify';
import { loadChartFiles } from '../index';

const doms = {
    linkInput: document.querySelector('input#phizone-chart-link') as HTMLInputElement,
    chartDownload: document.querySelector('button#phizone-download-chart') as HTMLButtonElement,
    downloadProgress: document.querySelector('div#phizone-download-progress') as HTMLDivElement
};

const PhiZoneLinkReg = /^https:\/\/[\d\w]+\.phi\.zone\/charts\/(\d+)/;

doms.linkInput.addEventListener('keydown', (e: KeyboardEvent) =>
{
    if (e.key === 'Enter') doms.chartDownload.dispatchEvent(new Event('click'));
});

doms.chartDownload.addEventListener('click', () =>
{
    let downloadId: string | number = doms.linkInput.value;

    if (!downloadId || downloadId == '')
    {
        alert('Please enter a chart link/ID!');
        doms.linkInput.focus();
        return;
    }

    if (PhiZoneLinkReg.test(downloadId))
    {
        downloadId = parseInt(PhiZoneLinkReg.exec(downloadId)![1]);
    }
    else downloadId = parseInt(downloadId);

    if (isNaN(downloadId) || downloadId <= 0)
    {
        alert('Please enter a valid chart link/ID!');
        doms.linkInput.focus();
        return;
    }

    doms.downloadProgress.innerText = 'Getting chart info...';

    fetch('https://api.phi.zone/charts/' + downloadId + '/?query_song=1&query_owner=1')
        .then(res => res.json())
        .then((res: PhiZoneApiResponse) =>
        {
            let resUrls: Record<string, string> = {};
            let infos: Record<string, string> = {};

            if (res.id !== downloadId)
            {
                doms.downloadProgress.innerText = 'Cannot get chart info: ' + res.detail;
                return;
            }
            
            if (!verifyText(res.chart, undefined) || !res.song || !verifyText(res.song.illustration, undefined) || !verifyText(res.song.song, undefined))
            {
                doms.downloadProgress.innerText = 'Cannot get chart info: server didn\'t provide any link';
                return;
            }

            resUrls = {
                chart: res.chart!,
                song: res.song.song!,
                illustration: res.song.illustration!
            };

            infos = {
                name      : res.song.name,
                artist    : res.song.composer,
                author    : res.charter.replace(/\[PZUser:\d+:(.+)\]/, '$1'),
                bgAuthor  : res.song.illustrator,
                difficult : 'Lv.' + res.level + ' ' + Math.floor(res.difficulty)
            };

            downloadFiles(resUrls, infos);
        }
    );
});


async function downloadFiles(urls: Record<string, string>, infos: Record<string, string>): Promise<void>
{
    let fileName: { chart: string; song: string; bg: string } = {
        chart: urls.chart.split('/').pop()!,
        song: urls.song.split('/').pop()!,
        bg: urls.illustration.split('/').pop()!
    };

    fileName.chart = decodeURIComponent(fileName.chart);
    fileName.song = decodeURIComponent(fileName.song);
    fileName.bg = decodeURIComponent(fileName.bg);

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
        new File([chart], fileName.chart, { type: (chart as Blob).type, lastModified: Date.now() }),
        new File([song], fileName.song, { type: (song as Blob).type, lastModified: Date.now() }),
        new File([bg], fileName.bg, { type: (bg as Blob).type, lastModified: Date.now() }),
        new File([new Blob([settingsFile])], 'Settings.txt', { type: 'text/plain', lastModified: Date.now() })
    ]);

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
    id: number;
    detail?: string;
    chart: string | null;
    charter: string;
    level: string;
    difficulty: number;
    song: {
        name: string;
        composer: string;
        illustration: string | null;
        illustrator: string;
        song: string | null;
    } | null;
}
