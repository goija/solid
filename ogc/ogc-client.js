/**
 * Sovereign OGC API Features Client (EPSG:28992 / WGS84)
 * Zero Iframes - Pure Native JavaScript Geodesy Engine
 */
class OgcApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async getCollections() {
        const response = await fetch(`${this.baseUrl}/collections`);
        return await response.json();
    }

    async getFeatures(collectionId, bbox = null, limit = 100) {
        let url = `${this.baseUrl}/collections/${collectionId}/items?limit=${limit}`;
        if (bbox) {
            url += `&bbox=${bbox.join(',')}`;
        }
        const response = await fetch(url);
        return await response.json();
    }
}

export default OgcApiClient;
