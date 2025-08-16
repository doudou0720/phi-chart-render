import { text as verifyText } from '@/verify';
import { loadChartFiles } from '../index';

const doms = {
    linkInput: document.querySelector('input#phizone-chart-link'),
    chartDownload: document.querySelector('button#phizone-download-chart'),
    downloadProgress: document.querySelector('div#phizone-download-progress')
};

const PhiZoneLinkReg = /^https:\/\/[\d\w]+\.phi\.zone\/charts\/([\da-f-]+)/i;   

doms.linkInput.addEventListener('keydown', (e) =>
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
        downloadId = PhiZoneLinkReg.exec(downloadId)[1]; // 提取 charts/ 后的部分
    }

    // 校验 ID 格式（数字或宽松的 UUID）
    if (!/^[\da-f-]+$/i.test(downloadId)) {
        alert('Invalid ID format! Expected:Numbers (e.g. 123) or UUID (e.g. 97100338-5fd6-4a49-a20e-d1a0c6690080)');
        doms.linkInput.focus();
        return;
    }


    doms.downloadProgress.innerText = 'Getting chart info...';

    fetch('https://api.phi.zone/charts/' + downloadId + '/?query_song=1&query_owner=1')
        .then(res => res.json())
        .then(res =>
        {
            let resUrls = {};
            let infos = {};

            if (res.data.id !== downloadId)
            {
                doms.downloadProgress.innerText = 'Cannot get chart info: ' + res.detail;
                return;
            }
            
            if (!verifyText(res.data.file, null) || !res.data.song.title || !verifyText(res.data.song.illustration, null) || !verifyText(res.data.song.file, null))
            {
                doms.downloadProgress.innerText = 'Cannot get chart info: server didn\'t provide any link';
                return;
            }

            resUrls = {
                chart: res.data.file,
                song: res.data.song.file,
                illustration: res.data.song.illustration
            };

            infos = {
                name      : res.data.song.title,
                artist    : res.data.song.authorName,
                author    : res.data.authorName.replace(/\[PZUser:\d+:(.+)\]/, '\$1'),
                bgAuthor  : res.data.song.illustrator,
                difficult : res.data.level + ' ' + 'Lv.' + Math.floor(res.data.difficulty)
            };

            downloadFiles(resUrls, infos);
        }
    );
});

function switchTab(e) {
    let targetTab = e.target;
    let targetTabContent = targetTab.dataset.tabId;

    if (!document.querySelector('div.tab div.content > *#tab-' + targetTabContent)) return;

    for (const tab of document.querySelectorAll('div.tab div.bar > *')) {
        tab.classList.remove('active');
    }

    for (const content of document.querySelectorAll('div.tab div.content > *[id^="tab-"]')) {
        content.style.display = 'none';
    }

    targetTab.classList.add('active');
    document.querySelector('div.tab div.content > *#tab-' + targetTabContent).style.display = 'block';
}

async function downloadFiles(urls, infos)
{
    let fileName = {
        chart: urls.chart.split('/'),
        song: urls.song.split('/'),
        bg: urls.illustration.split('/')
    };

    fileName.chart = decodeURIComponent(fileName.chart[fileName.chart.length - 1]);
    fileName.song = decodeURIComponent(fileName.song[fileName.song.length - 1]);
    fileName.bg = decodeURIComponent(fileName.bg[fileName.bg.length - 1]);

    let settingsFile = `Name: ${infos.name}\r\n` +
        `Level: ${infos.difficult}\r\n` +
        `Charter: ${infos.author}\r\n` +
        `Chart: ${fileName.chart}\r\n` +
        `Song: ${fileName.song}\r\n` +
        `Picture: ${fileName.bg}`;

    let chart = await downloadFile(urls.chart, (progress) => { doms.downloadProgress.innerText = 'Downloading chart (' + Math.floor(progress * 100) + '%)'; });
    let song = await downloadFile(urls.song, (progress) => { doms.downloadProgress.innerText = 'Downloading song (' + Math.floor(progress * 100) + '%)'; });
    let bg = await downloadFile(urls.illustration, (progress) => { doms.downloadProgress.innerText = 'Downloading bg (' + Math.floor(progress * 100) + '%)'; });

    doms.downloadProgress.innerText = 'All files are downloaded, head to \'File\' to select chart.';

    loadChartFiles([
        new File([chart], fileName.chart, { type: chart.type, lastModified: Date.now() }),
        new File([song], fileName.song, { type: song.type, lastModified: Date.now() }),
        new File([bg], fileName.bg, { type: bg.type, lastModified: Date.now() }),
        new File([new Blob([settingsFile])], 'Settings.txt', { type: 'text/plain', lastModified: Date.now() })
    ]).then(() => {
        // 切换到File标签页
        const fileTab = document.querySelector('div.tab div.bar > *[data-tab-id="file"]');
        if (fileTab) {
            switchTab({ target: fileTab });
        }
    });

    function downloadFile(url, onProgressChange)
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

            xhr.onprogress = (e) =>
            {
                if (typeof onProgressChange === 'function')
                {
                    onProgressChange(e.loaded / e.total);
                }
            };

            xhr.onerror = (e) => { rej(e) };

            xhr.open('GET', url);
            xhr.send();
        });
    }
}