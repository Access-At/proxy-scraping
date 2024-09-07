import axios, { AxiosError } from "axios";
import { parseGenericResponse, parseGeoNodeResponse, parseMyProxy, parseWithRegexResponse } from "./helper/parse";

import type { ProxyScrape } from "./types";
import { appendFileSync } from "node:fs";

const axiosInstance = axios.create({
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

const proxyUrls: string[] = [
    // http
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/http.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
    "https://raw.githubusercontent.com/proxy4parsing/proxy-list/main/http.txt",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
    "https://raw.githubusercontent.com/B4RC0DE-TM/proxy-list/main/HTTP.txt",
    "https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt",
    "https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt",
    "https://www.proxy-list.download/api/v1/get?type=http",
    "https://www.proxy-list.download/api/v1/get?type=https",
    "https://api.openproxylist.xyz/http.txt",
    "https://spys.me/proxy.txt",
    "https://proxyspace.pro/http.txt",

    // socks4
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/socks4.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS4_RAW.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt",
    "https://raw.githubusercontent.com/B4RC0DE-TM/proxy-list/main/SOCKS4.txt",
    "https://www.proxy-list.download/api/v1/get?type=socks4",
    "https://api.openproxylist.xyz/socks4.txt",
    "https://proxyspace.pro/socks4.txt",

    // socks5
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/socks5.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
    "https://raw.githubusercontent.com/B4RC0DE-TM/proxy-list/main/SOCKS4.txt",
    "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
    "https://www.proxy-list.download/api/v1/get?type=socks5",
    "https://api.openproxylist.xyz/socks5.txt",
    "https://proxyspace.pro/http.txt",
    "https://spys.me/socks.txt",

    // unknown
    "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies.txt",
    "https://proxylist.geonode.com/api/proxy-list?limit=500&sort_by=speed&sort_type=asc",
    "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
    "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt",
    "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/proxy.txt",
    "https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt",
    "https://api.proxyscrape.com/v2/?request=displayproxies",
    "https://multiproxy.org/txt_all/proxy.txt",
    "http://rootjazz.com/proxies/proxies.txt",
    "http://alexa.lr2b.com/proxylist.txt",

    ...Array.from({ length: 10 }, (_, i) => `https://www.my-proxy.com/free-proxy-list${i ? `-${i + 1}` : ''}.html`)
];


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


const scrapeFromUrl = async (url: string): Promise<ProxyScrape[]> => {
    const response = await axiosInstance.get(url);
    let data = [];

    if (url.includes('proxylist.geonode.com')) {
        data = parseGeoNodeResponse(response.data);
    } else if (url.includes('spys.me')) {
        data = parseWithRegexResponse(response.data);
    } else if (url.includes('my-proxy.com')) {
        data = parseMyProxy(response.data);
    } else {
        data = parseGenericResponse(response.data);
    }

    return await checkProxyLive(data);
};

const getProxies = async (): Promise<ProxyScrape[]> => {
    const allProxies: ProxyScrape[] = [];

    await Promise.all(proxyUrls.map(async (url) => {
        try {
            const proxies = await scrapeFromUrl(url);
            allProxies.push(...proxies);
        } catch (error) {
            if (error instanceof AxiosError) {
                console.error(`Error scraping from ${url}:`, error.message);
            }
        }
    }));

    return allProxies;
};


const writeProxiesToFile = (proxies: ProxyScrape[]) => {
    const writeToFile = (filename: string, content: string) => appendFileSync(filename, content);

    writeToFile('proxies.json', JSON.stringify(proxies));
    writeToFile('http.json', JSON.stringify(proxies.filter(proxy => proxy.type === 'http' || proxy.type === 'https')));
    writeToFile('socks.json', JSON.stringify(proxies.filter(proxy => proxy.type === 'socks5' || proxy.type === 'socks4')));

    proxies.forEach(proxy => {
        writeToFile('proxies.txt', `${proxy.ip}:${proxy.port}\n`);
        writeToFile(`${proxy.type}.txt`, `${proxy.ip}:${proxy.port}\n`);
    });
};


const main = async () => {
    const proxies = await getProxies();
    const uniqueProxies = Array.from(new Set(proxies.map(proxy => JSON.stringify(proxy)))).map(str => JSON.parse(str) as ProxyScrape);
    writeProxiesToFile(uniqueProxies);
};


main();
