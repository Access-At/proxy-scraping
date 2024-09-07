export const parseWithRegexResponse = (body: string): string[] => {
    const regex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/gm;

    const matches = body.match(regex);
    return matches as string[];
}

export const parseMyProxy = (body: string): string[] => {
    const regex = /\b\d{1,3}(?:\.\d{1,3}){3}:\d+\b/gm;
    const matches = body.match(regex);
    return matches as string[];
}

export const parseGeoNodeResponse = (data: any): string[] => {
    return data.data.map((item: any) => `${item.ip}:${item.port}`);
};

export const parseGenericResponse = (data: string): string[] => {
    return data.split('\n').filter(Boolean);
};
