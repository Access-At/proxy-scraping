import type { Extractors, ProxyList, ProxyScrape } from "../../types";
import axios, { AxiosError, type AxiosInstance } from "axios";

import { loadYamlFileSync } from 'load-yaml-file';
import path from 'path';
import { readdirSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import select from '@gizt/selector'

const proxyDirectory = '../../list-proxys';

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

    try {
        const response = await axiosInstance.post('https://api.proxyscrape.com/v4/online_check', data);
        return response.data
            .map((proxy: any) => ({
                ip: proxy.ip,
                port: proxy.port,
                type: proxy.type,
                working: proxy.working,
            }));
    } catch (error) {
        if (error instanceof AxiosError) {
            console.log(chalk.red(`[-] Error check proxy: ${error.message}`));
        }
        return [];
    }
};

const scrapeFromUrl = async (urls: string[], extractors: Extractors): Promise<string[]> => {
    const allProxies: string[] = [];

    await Promise.all(urls.map(async (url) => {
        try {
            const response = await axiosInstance.get(url);
            if(extractors.type === 'split') {
                allProxies.push(...response.data.replace(/\r/g, '').split(extractors.delimiter).filter(Boolean));
            } else if (extractors.type === 'regex' && extractors.regex) {
                const matches = response.data.replace(/\r/g, '').match(new RegExp(extractors.regex, 'g'));
                if (matches) {
                    allProxies.push(...matches);
                }
            } else if (extractors.type === 'json' && extractors.path) {
                const matches_ip = select(extractors.path.ip, response.data);
                const matches_port = select(extractors.path.port, response.data);
                for (let i = 0; i < matches_ip.length; i++) {
                    if (matches_ip[i] && matches_port[i]) {
                        allProxies.push(`${matches_ip[i]}:${matches_port[i]}`.replace(/\r/g, ''));
                    }
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

const processYamlFile = async (file: string): Promise<{ name: string, sourceType: string, author: string, proxyType: string[], totalProxies: number, liveProxies: number, deadProxies: number }> => {
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
    const checkedProxies = await checkProxyLive(scrapedProxies);

    const totalProxies = checkedProxies.length;
    const liveProxies = checkedProxies.filter(proxy => proxy.working).length;
    const deadProxies = totalProxies - liveProxies;

    return {
        name: info.name,
        sourceType: info.source_type,
        author: info.author,
        proxyType: info.proxy_type.split(',').map(type => type.trim()),
        totalProxies,
        liveProxies,
        deadProxies
    };
};

const main = async () => {
    const ymlFiles = readdirSync(proxyDirectory).filter(file => path.extname(file).toLowerCase() === '.yml');
    const proxyStats: { name: string, sourceType: string, author: string, proxyType: string[], totalProxies: number, liveProxies: number, deadProxies: number }[] = [];

    console.log(chalk.cyan('[!] Scraping started...'));

    await Promise.all(ymlFiles.map(async (file) => {
        const stats = await processYamlFile(file);
        proxyStats.push(stats);
    }));

    console.log(chalk.green('[+] Scraping completed.'));

    // Create summary tables
    let sourceTypeTable = '| Source Type | Count |\n|-------------|-------|\n';
    let authorTable = '| Author | Count |\n|--------|-------|\n';
    let proxyTypeTable = '| Proxy Type | Count |\n|------------|-------|\n';

    const sourceTypeCounts: { [key: string]: number } = {};
    const authorCounts: { [key: string]: number } = {};
    const proxyTypeCounts: { [key: string]: number } = {};

    proxyStats.forEach(stat => {
        sourceTypeCounts[stat.sourceType] = (sourceTypeCounts[stat.sourceType] || 0) + 1;
        authorCounts[stat.author] = (authorCounts[stat.author] || 0) + 1;
        stat.proxyType.forEach(type => {
            proxyTypeCounts[type] = (proxyTypeCounts[type] || 0) + 1;
        });
    });

    for (const [sourceType, count] of Object.entries(sourceTypeCounts)) {
        sourceTypeTable += `| ${sourceType} | ${count} |\n`;
    }

    for (const [author, count] of Object.entries(authorCounts)) {
        authorTable += `| ${author} | ${count} |\n`;
    }

    for (const [proxyType, count] of Object.entries(proxyTypeCounts)) {
        proxyTypeTable += `| ${proxyType} | ${count} |\n`;
    }

    // Create main table
    let mainTable = '| Name | Total Proxies | Live Proxies | Dead Proxies |\n';
    mainTable += '|------|---------------|--------------|---------------|\n';
    proxyStats.forEach(stat => {
        mainTable += `| ${stat.name} | ${stat.totalProxies} | ${stat.liveProxies} | ${stat.deadProxies} |\n`;
    });

    const fullContent = `# Source Type Summary\n\n${sourceTypeTable}\n\n# Author Summary\n\n${authorTable}\n\n# Proxy Type Summary\n\n${proxyTypeTable}\n\n# Proxy Details\n\n${mainTable}`;

    writeFileSync(path.join(__dirname, '../../docs/STATISTICS.md'), fullContent);
    console.log(chalk.green('[+] STATISTICS.md has been created with the proxy statistics and summaries.'));
};

main();
