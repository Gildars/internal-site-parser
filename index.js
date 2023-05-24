const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const fs = require('fs').promises;
const async = require('async');

const MAX_CONCURRENT_TASKS = 4;
const RES_STORAG_EPATH = '/var/www/parser-website/res_storage';
const KEYS_PATH = '/var/www/parser-website/key_storage';

const visitedLinks = new Set();
const urlsAwaitVisit = new Set();


async function parseWebsite(url) {
    const used = process.memoryUsage();
    console.log(`Memory usage: ${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`);
    console.log('urlsAwaitVisit :' + urlsAwaitVisit.size);
    console.log('visitedLinks : ' + visitedLinks.size);

    if (visitedLinks.has(url)) {
        const nextLink = urlsAwaitVisit.values().next().value;
        urlsAwaitVisit.delete(nextLink);
        await enqueueUrls(nextLink);
        return;
    }

    visitedLinks.add(url);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            },
        });

        if (!response.ok) {
            console.error(`Error fetching ${url}: ${response.status} ${response.statusText}`);
            const nextLink = getNextLink();
            if (nextLink) {
                await enqueueUrls(nextLink);
            }
            return;
        }

        const html = await response.text();
        const { window } = new JSDOM(html);
        let { document } = window;

        const headerLayout = document.querySelector('div.HeaderLayout');

        if (headerLayout) {
            const key = headerLayout.querySelector('p').textContent.trim();
            const nameFile = encodeURIComponent(key);
            const h3 = document.querySelector('h3');

            const resStoragePath = `${RES_STORAG_EPATH}/${nameFile}.txt`;
            const keysPath = `${KEYS_PATH}/keys.txt`;

            try {
                await fs.readFile(resStoragePath);
                const nextLink = getNextLink();
                await enqueueUrls(nextLink);
                return;
            } catch (err) {
                await fs.appendFile(keysPath, key + '\n');
                await fs.appendFile(resStoragePath, h3.textContent + '\n');
            }

            const links = Array.from(h3.getElementsByTagName('a'));
            const validLinks = links
                .map((link) => link.getAttribute('href'))
                .filter((link) => isValidUrl(link) && !visitedLinks.has(link));

            const lastLink = validLinks.pop();
            await enqueueUrls(lastLink);
            validLinks.forEach((link) => urlsAwaitVisit.add(link));
        }

        response.body.destroy();
        window.close();
    } catch (err) {
        console.error(`Error parsing ${url}: ${err.message}`);

        const nextLink = getNextLink();
        if (nextLink) {
            await enqueueUrls(nextLink);
        }
    }
}

function getNextLink() {
    const nextLink = urlsAwaitVisit.values().next().value;
    urlsAwaitVisit.delete(nextLink);
    return nextLink;
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (err) {
        return false;
    }
}

async function enqueueUrls(url) {
    const queue = async.queue(async (url, callback) => {
        await parseWebsite(url);
        callback();
    }, MAX_CONCURRENT_TASKS);

    queue.push(url);
}

async function runParallelParsing(urls) {
    await enqueueUrls(urls);
    while (urlsAwaitVisit.size > 0) {
        const urlsToVisit = Array.from(urlsAwaitVisit).splice(0, MAX_CONCURRENT_TASKS);
        await Promise.all(urlsToVisit.map((url) => parseWebsite(url)));
    }
}

const urls = [];

runParallelParsing(urls);
