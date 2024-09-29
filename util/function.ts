import type { Extractors, ProxyScrape } from "../types";
import axios, { AxiosError } from "axios";

import type { AxiosInstance } from "axios";
import chalk from "chalk";
import select from '@gizt/selector'

export const createAxiosInstance = (): AxiosInstance => {
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

export const axiosInstance = createAxiosInstance();

export const checkProxyLive = async (proxies: string[]): Promise<ProxyScrape[]> => {
    if (proxies.length === 0) {
        return [];
    }

    const data = new URLSearchParams();
    proxies.forEach(proxy => data.append("ip_addr[]", proxy));

    try {
        const response = await axiosInstance.post('https://api.proxyscrape.com/v4/online_check', data);
        return response.data
            .filter((proxy: any) => proxy.working)
            .map(({ ip, port, type, working }: any) => ({ ip, port, type, working }));
    } catch (error) {
        if (error instanceof AxiosError) {
            console.log(chalk.red(`[-] Error check proxy: ${error.message}`));
        }
        return [];
    }
};

export const checkProxy = async (proxies: string[]): Promise<ProxyScrape[]> => {
    if (proxies.length === 0) {
        return [];
    }

    const data = new URLSearchParams();
    proxies.forEach(proxy => data.append("ip_addr[]", proxy));

    try {
        const response = await axiosInstance.post('https://api.proxyscrape.com/v4/online_check', data);
        return response.data.map(({ ip, port, type, working }: any) => ({ ip, port, type, working }));
    } catch (error) {
        if (error instanceof AxiosError) {
            console.log(chalk.red(`[-] Error check proxy: ${error.message}`));
        }
        return [];
    }
};


export const scrapeFromUrl = async (urls: string[], extractors: Extractors): Promise<string[]> => {
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
                if (response.config.url?.includes('rotatingproxies.com')) {
                    for (const key in response.data) {
                        const proxy = response.data[key];
                        if (proxy.ip && proxy.port) {
                            allProxies.push(`${proxy.ip}:${proxy.port}`.replace(/\r/g, ''));
                        }
                    }
                } else {
                    const matches_ip = select(extractors.path.ip, response.data);
                    const matches_port = select(extractors.path.port, response.data);

                    for (let i = 0; i < matches_ip.length; i++) {
                        if (matches_ip[i] && matches_port[i]) {
                            allProxies.push(`${matches_ip[i]}:${matches_port[i]}`.replace(/\r/g, ''));
                        }
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
