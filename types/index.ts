export interface ProxyScrape {
    ip: string;
    port: number;
    type: string;
    working?: boolean;
}

interface Info {
    name: string
    source: string
    source_type: string
    proxy_type: string
    author: string
}

export interface Extractors {
    type: string
    delimiter?: string
    regex?: string
    path?: {
        ip: string
        port: string
    }
}

export interface Requests {
    method: string
    headers: {
        [key: string]: string
    }
}

export interface ProxyList {
    info: Info
    extractors: Extractors
    proxies: string[]
    requests: Requests
}
