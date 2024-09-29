import type { ProxyList, ProxyScrape } from "./types";
import { appendFileSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import { checkProxyLive, scrapeFromUrl } from "./util/function";

import chalk from 'chalk';
import { loadYamlFileSync } from 'load-yaml-file';
import path from 'path';
import { readdirSync } from 'node:fs';

const proxyDirectory = './list-proxys';

const processYamlFile = async (file: string): Promise<ProxyScrape[]> => {
    const filePath = path.join(proxyDirectory, file);
    const yml = loadYamlFileSync(filePath) as ProxyList;
    const { info, extractors, proxies, requests } = yml;

    console.log(
        chalk.cyan(`[${info.name}]`) +
        chalk.yellow(`[${info.name}]`) +
        chalk.magenta(`[${info.source_type}]`) +
        chalk.green(`[${info.proxy_type}]`) + ' ' +
        chalk.blue(info.source)
    );

    const scrapedProxies = await scrapeFromUrl(proxies, extractors,  requests);
    console.log(chalk.cyanBright(`[*] ${scrapedProxies.length} proxies scraped from ${info.source}`));

    return checkProxyLive(scrapedProxies);
};

const writeToFile = (filename: string, content: string, append: boolean = false) => {
    if (!append && existsSync(filename)) {
        unlinkSync(filename);
    }

    if (append) {
        appendFileSync(filename, content);
    } else {
        writeFileSync(filename, content);
    }
}

const writeProxiesToFile = (proxies: ProxyScrape[]) => {
    writeToFile('proxies.json', JSON.stringify(proxies));
    writeToFile('http.json', JSON.stringify(proxies.filter(proxy => proxy.type === 'http' || proxy.type === 'https')));
    writeToFile('socks.json', JSON.stringify(proxies.filter(proxy => proxy.type === 'socks5' || proxy.type === 'socks4')));

    // reset
    proxies.forEach(proxy => {
        writeToFile('proxies.txt', '',);
        writeToFile(`${proxy.type}.txt`, '',);
    });

    proxies.forEach(proxy => {
        writeToFile('proxies.txt', `${proxy.ip}:${proxy.port}\n`, true);
        writeToFile(`${proxy.type}.txt`, `${proxy.ip}:${proxy.port}\n`, true);
    });

};

const main = async () => {
    const ymlFiles = readdirSync(proxyDirectory).filter(file => path.extname(file).toLowerCase() === '.yml');
    const allProxies: ProxyScrape[] = [];

    console.log(chalk.cyan('[!] Scraping started...'));

    await Promise.all(ymlFiles.map(async (file) => {
        const proxies = await processYamlFile(file);
        allProxies.push(...proxies);
    }));

    console.log(chalk.green('[+] Scraping completed.'));

    const uniqueProxies = Array.from(new Set(allProxies.map(proxy => JSON.stringify(proxy)))).map(str => JSON.parse(str) as ProxyScrape);

    console.log(chalk.cyan('[!] Total live proxies: ') + chalk.yellow(uniqueProxies.length) + chalk.green(' proxies.'));

    writeProxiesToFile(uniqueProxies);
};

main();
