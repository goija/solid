/**
 * Sovereign OGC API Features Client (EPSG:28992 / CRS84)
 * CORS-safe Simple GET Requests (0% Iframes)
 */
class OgcApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
    }

    async getCollections() {
        const res = await fetch(`${this.baseUrl}/collections?f=json`);
        if (!res.ok) throw new Error(`HTTP ${res.status} op /collections`);
        return await res.json();
    }

    async getFeatures(collectionId, bbox = null, limit = 25, crsEpsg = "28992") {
        const crsUri = crsEpsg === "28992"
            ? "http://www.opengis.net/def/crs/EPSG/0/28992"
            : (crsEpsg === "4258" ? "http://www.opengis.net/def/crs/EPSG/0/4258" : "http://www.opengis.net/def/crs/OGC/1.3/CRS84");

        const params = new URLSearchParams();
        if (bbox && bbox.length === 4) {
            params.set("bbox", bbox.join(","));
            params.set("bbox-crs", crsUri);
        }
        params.set("crs", crsUri);
        params.set("limit", String(limit));
        params.set("f", "json");

        const url = `${this.baseUrl}/collections/${encodeURIComponent(collectionId)}/items?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} bij ophalen items`);
        return await res.json();
    }
}

export default OgcApiClient;
