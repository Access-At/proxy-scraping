import type { Extractors, ProxyList, ProxyScrape } from "./types";
import axios, { AxiosError, type AxiosInstance } from "axios";
import { appendFileSync, existsSync, unlinkSync, writeFileSync } from "node:fs";

import { loadYamlFileSync } from 'load-yaml-file';
import path from 'path';
import { readdirSync } from 'node:fs';
import chalk from 'chalk';

const proxyDirectory = './list-proxys';

const createAxiosInstance = (): AxiosInstance => {
    return axios.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Pragma': 'no-cache',
        }
    });
};

const axiosInstance = createAxiosInstance();

const checkProxyLive = async (proxies: string[]): Promise<ProxyScrape[]> => {
    const data = new URLSearchParams();
    proxies.forEach(proxy => data.append("ip_addr[]", proxy));

    const response = await axiosInstance.post('https://api.proxyscrape.com/v4/online_check', data);
    return response.data
        .filter((proxy: any) => proxy.working)
        .map((proxy: any) => ({
            ip: proxy.ip,
            port: proxy.port,
            type: proxy.type,
        }));
};

const scrapeFromUrl = async (urls: string[], extractors: Extractors): Promise<string[]> => {
    const allProxies: string[] = [];

    await Promise.all(urls.map(async (url) => {
        try {
            const response = await axiosInstance.get(url);
            if(extractors.type === 'split') {
                allProxies.push(...response.data.split('\n').filter(Boolean));
            } else if (extractors.type === 'regex' && extractors.regex) {
                const matches = response.data.match(new RegExp(extractors.regex, 'g'));
                if (matches) {
                    allProxies.push(...matches);
                }
            }
        } catch (error) {
            if (error instanceof AxiosError) {
                console.log(chalk.red(`[-] Error scraping from ${url}: ${error.message}`))
            }
        }
    }));
    return allProxies;
};

const processYamlFile = async (file: string): Promise<ProxyScrape[]> => {
    const filePath = path.join(proxyDirectory, file);
    const yml = loadYamlFileSync(filePath) as ProxyList;
    const { info, extractors, proxies } = yml;

    console.log(
        chalk.cyan(`[${info.name}]`) +
        chalk.yellow(`[${info.name}]`) +
        chalk.magenta(`[${info.source_type}]`) +
        chalk.green(`[${info.proxy_type}]`) + ' ' +
        chalk.blue(info.source)
    );

    const scrapedProxies = await scrapeFromUrl(proxies, extractors);
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
    console.log(chalk.cyan('[!] Total live proxies: ') + chalk.yellow(allProxies.length));

    const uniqueProxies = Array.from(new Set(allProxies.map(proxy => JSON.stringify(proxy)))).map(str => JSON.parse(str) as ProxyScrape);
    writeProxiesToFile(uniqueProxies);
};

main();
