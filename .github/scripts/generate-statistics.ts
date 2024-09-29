import { checkProxy, scrapeFromUrl } from "../../util/function";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

import type { ProxyList } from "../../types";
import chalk from 'chalk';
import { loadYamlFileSync } from 'load-yaml-file';
import path from 'path';

const proxyDirectory = './list-proxys';

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
    console.log(chalk.green(`[+] ${scrapedProxies.length} proxies scraped from ${info.source}`));

    const checkedProxies = await checkProxy(scrapedProxies);

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

    const outputDir = path.join(__dirname, '../../docs');
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(path.join(outputDir, 'STATISTICS.md'), fullContent);
    console.log(chalk.green('[+] STATISTICS.md has been created with the proxy statistics and summaries.'));
};

main();
