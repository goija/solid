/**
 * GOIJA // SOVEREIGN SOLID POD + STREAM PIPES + WEBRTC DATACHANNEL TRANSCEIVER
 * Zero-Cloud, Chunked 16KB P2P Framing, SHA-256 Checksums & GeoSPARQL Generator
 */

export class SovereignPodRTC {
  constructor(options = {}) {
    this.podUri = options.podUri || "solid://goija.pod/tholen-scherpenisse";
    this.onLog = options.onLog || (() => {});
    this.onReceiveDataset = options.onReceiveDataset || (() => {});
    this.onPodUpdate = options.onPodUpdate || (() => {});
    this.onChannelState = options.onChannelState || (() => {});

    // Local Solid Pod Container Storage (In-Memory + LocalStorage mirror)
    this.containers = {
      "/kadaster/percelen/": new Map(),
      "/kadaster/audit-shoelace/": new Map(),
      "/geosparql/triples/": new Map(),
      "/webrtc/inbox/": new Map()
    };

    // WebRTC State
    this.pcLocal = null;
    this.pcLoopback = null;
    this.dcTx = null;
    this.dcRx = null;
    this.rxBuffer = new Map(); // msgId -> { meta, chunks: [] }
    this.stats = { txBytes: 0, rxBytes: 0, txPackets: 0, rxPackets: 0 };

    // Cross-Tab BroadcastChannel Pipe
    this.bcPipe = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("sovereign_pod_pipe_v1") : null;
    if (this.bcPipe) {
      this.bcPipe.onmessage = (ev) => this._handleIncomingFrame(ev.data, "BroadcastPipe");
    }

    this._restorePodFromStorage();
  }

  log(msg, type = "info") {
    const ts = new Date().toISOString().slice(11, 23);
    this.onLog(`[${ts}] ${msg}`, type);
  }

  // ── 1. CRYPTO SHA-256 INTEGRITY ───────────────────────────────────────────
  async sha256(str) {
    const buf = new TextEncoder().encode(str);
    if (window.crypto && window.crypto.subtle) {
      const hash = await window.crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback FNV-1a 64-bit hex als file:// geen crypto.subtle toestaat
    let h1 = 0xdeadbeef ^ buf.length, h2 = 0x41c6ce57 ^ buf.length;
    for (let i = 0; i < buf.length; i++) {
      h1 = Math.imul(h1 ^ buf[i], 2654435761);
      h2 = Math.imul(h2 ^ buf[i], 1597334677);
    }
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  }

  // ── 2. SOLID POD VFS (PUT / GET / LIST / TURTLE SERIALIZER) ───────────────
  async putResource(containerPath, resourceName, contentObj, contentType = "application/geo+json") {
    const raw = typeof contentObj === "string" ? contentObj : JSON.stringify(contentObj, null, 2);
    const hash = await this.sha256(raw);
    const uri = `${this.podUri}${containerPath}${resourceName}`;
    const entry = {
      uri,
      container: containerPath,
      name: resourceName,
      contentType,
      size: new Blob([raw]).size,
      sha256: hash,
      timestamp: new Date().toISOString(),
      raw
    };
    if (!this.containers[containerPath]) this.containers[containerPath] = new Map();
    this.containers[containerPath].set(resourceName, entry);
    this._persistPodToStorage();
    this.log(`POD PUT ➔ ${uri} (${entry.size} B | SHA256: ${hash.slice(0, 12)}…)`, "ok");
    this.onPodUpdate(this.listAllResources());
    return entry;
  }

  getResource(containerPath, resourceName) {
    return this.containers[containerPath]?.get(resourceName) || null;
  }

  listAllResources() {
    const list = [];
    for (const [cPath, map] of Object.entries(this.containers)) {
      for (const [, entry] of map.entries()) list.push(entry);
    }
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  _persistPodToStorage() {
    try {
      const dump = this.listAllResources().slice(0, 35);
      localStorage.setItem("sovereign_solid_pod_v1", JSON.stringify(dump));
    } catch (_) {}
  }

  _restorePodFromStorage() {
    try {
      const raw = localStorage.getItem("sovereign_solid_pod_v1");
      if (!raw) return;
      const dump = JSON.parse(raw);
      dump.forEach(item => {
        if (!this.containers[item.container]) this.containers[item.container] = new Map();
        this.containers[item.container].set(item.name, item);
      });
    } catch (_) {}
  }

  // ── 3. UNIX-STYLE ASYNC STREAM PIPELINE ───────────────────────────────────
  /**
   * Voert een modulaire pijplijn uit op de geladen OGC-features:
   * [STAGE 1: INGEST] ➔ [STAGE 2: SHOELACE AUDIT] ➔ [STAGE 3: GEOSPARQL .TTL] ➔ [STAGE 4: POD STORE] ➔ [STAGE 5: WEBRTC TX]
   */
  async runPipeline(features, meta = {}, pipeOptions = { audit: true, turtle: true, storePod: true, transmitRtc: true }) {
    this.log(`PIPE START ➔ [INGEST] ${features.length} feature(s) in pijplijn geladen`, "info");

    // Stage 1: Clone & Normalize
    let streamData = structuredClone(features);

    // Stage 2: Shoelace Planimetrische Audit Pipe
    if (pipeOptions.audit) {
      let totalBrk = 0, totalShoelace = 0;
      streamData = streamData.map(f => {
        const calcArea = this._calcShoelace(f.geometry);
        const brkArea = Number(f.properties?.kadastrale_grootte_waarde || 0);
        const delta = brkArea > 0 && calcArea > 0 ? +(calcArea - brkArea).toFixed(2) : null;
        totalBrk += brkArea;
        totalShoelace += calcArea;
        f.properties = {
          ...f.properties,
          _pipe_shoelace_m2: Math.round(calcArea * 100) / 100,
          _pipe_delta_m2: delta
        };
        return f;
      });
      this.log(`PIPE STAGE [SHOELACE-AUDIT] ➔ Σ BRK=${totalBrk} m² | Σ Geometrisch=${Math.round(totalShoelace)} m²`, "ok");
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const baseName = `${meta.collection || "features"}-${stamp}`;

    // Stage 3: GeoSPARQL RDF/Turtle Pipe
    let turtleDoc = "";
    if (pipeOptions.turtle) {
      turtleDoc = this.featuresToTurtle(streamData, meta);
      this.log(`PIPE STAGE [RDF-TURTLE] ➔ ${turtleDoc.split("\n").length} RDF-regels gegenereerd`, "ok");
      if (pipeOptions.storePod) {
        await this.putResource("/geosparql/triples/", `${baseName}.ttl`, turtleDoc, "text/turtle");
      }
    }

    // Stage 4: Solid Pod Container Opslag
    const geojsonEnvelope = {
      type: "FeatureCollection",
      generator: "SovereignPodRTC-Pipeline",
      timestamp: new Date().toISOString(),
      sourceUrl: meta.url || "",
      crs: meta.crs || "EPSG:28992",
      features: streamData
    };

    if (pipeOptions.storePod) {
      await this.putResource("/kadaster/percelen/", `${baseName}.geojson`, geojsonEnvelope, "application/geo+json");
    }

    // Stage 5: WebRTC DataChannel & BroadcastPipe Transmissie
    if (pipeOptions.transmitRtc) {
      await this.transmitOverDataChannel(geojsonEnvelope, `${baseName}.geojson`);
    }

    return { geojsonEnvelope, turtleDoc };
  }

  _calcShoelace(geom) {
    if (!geom) return 0;
    const polys = geom.type === "Polygon" ? [geom.coordinates] : (geom.type === "MultiPolygon" ? geom.coordinates : []);
    let total = 0;
    polys.forEach(poly => poly.forEach((ring, idx) => {
      let a = 0;
      for (let j = 0; j < ring.length - 1; j++) {
        a += ring[j][0] * ring[j + 1][1] - ring[j + 1][0] * ring[j][1];
      }
      total += (idx === 0 ? 1 : -1) * Math.abs(a) / 2;
    }));
    return total;
  }

  featuresToTurtle(features, meta = {}) {
    const lines = [
      `@prefix geo: <http://www.opengis.net/ont/geosparql#> .`,
      `@prefix brk: <https://brk.basisregistraties.overheid.nl/def/brk#> .`,
      `@prefix dct: <http://purl.org/dc/terms/> .`,
      `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`,
      `@prefix pod: <${this.podUri}/resource#> .`,
      ``,
      `# Sovereign Solid Pod GeoSPARQL Export (${new Date().toISOString()})`,
      `# Bron: ${meta.url || "PDOK OGC API"}`,
      ``
    ];
    features.slice(0, 50).forEach((f, idx) => {
      const p = f.properties || {};
      const id = (p.identificatie || f.id || `feat_${idx}`).replace(/[^a-zA-Z0-9_-]/g, "_");
      lines.push(`pod:${id} a geo:Feature ;`);
      if (p.kadastrale_gemeente_code) lines.push(`  brk:gemeenteCode "${p.kadastrale_gemeente_code}" ;`);
      if (p.sectie) lines.push(`  brk:sectie "${p.sectie}" ;`);
      if (p.perceelnummer) lines.push(`  brk:perceelnummer "${p.perceelnummer}"^^xsd:integer ;`);
      if (p.kadastrale_grootte_waarde) lines.push(`  brk:geregistreerdeGrootte "${p.kadastrale_grootte_waarde}"^^xsd:double ;`);
      if (p._pipe_shoelace_m2) lines.push(`  brk:shoelaceOppervlakte "${p._pipe_shoelace_m2}"^^xsd:double ;`);
      lines.push(`  dct:created "${new Date().toISOString()}"^^xsd:dateTime .\n`);
    });
    return lines.join("\n");
  }

  // ── 4. WEBRTC P2P DATACHANNEL ENGINE (LOOPBACK + EXTERNAL SDP) ────────────
  /**
   * Creëert direct een 100% werkende in-browser Dual-Peer WebRTC Loopback brug
   * (RTCPeerConnection A <== RTCDataChannel ==> RTCPeerConnection B)
   */
  async connectLoopbackPair() {
    this.closeRtc();
    this.log("WEBRTC ➔ Initialiseren van lokale Dual-Peer RTCPeerConnection Loopback (Tx ⇄ Rx)...", "info");

    this.pcLocal = new RTCPeerConnection({ iceServers: [] });
    this.pcLoopback = new RTCPeerConnection({ iceServers: [] });

    // ICE Candidate Piping tussen Peer A en Peer B
    this.pcLocal.onicecandidate = e => {
      if (e.candidate) this.pcLoopback.addIceCandidate(e.candidate);
    };
    this.pcLoopback.onicecandidate = e => {
      if (e.candidate) this.pcLocal.addIceCandidate(e.candidate);
    };

    // Maak geordend, betrouwbaar DataChannel op Peer A
    this.dcTx = this.pcLocal.createDataChannel("sovereign-geo-pipe", { ordered: true });
    this._bindTxChannel(this.dcTx);

    // Ontvang DataChannel op Peer B
    this.pcLoopback.ondatachannel = (ev) => {
      this.dcRx = ev.channel;
      this._bindRxChannel(this.dcRx);
    };

    const offer = await this.pcLocal.createOffer();
    await this.pcLocal.setLocalDescription(offer);
    await this.pcLoopback.setRemoteDescription(offer);

    const answer = await this.pcLoopback.createAnswer();
    await this.pcLoopback.setLocalDescription(answer);
    await this.pcLocal.setRemoteDescription(answer);
  }

  /**
   * Handmatige P2P SDP Offer aanmaken (voor koppeling tussen 2 aparte computers/browsers zonder server)
   */
  async createManualOffer() {
    this.closeRtc();
    this.pcLocal = new RTCPeerConnection({ iceServers: [] });
    this.dcTx = this.pcLocal.createDataChannel("sovereign-geo-pipe", { ordered: true });
    this._bindTxChannel(this.dcTx);
    this._bindRxChannel(this.dcTx); // Bidirectioneel op hetzelfde kanaal

    const offer = await this.pcLocal.createOffer();
    await this.pcLocal.setLocalDescription(offer);
    await this._waitIceGathering(this.pcLocal);

    const sdpBundle = btoa(JSON.stringify(this.pcLocal.localDescription));
    this.log("WEBRTC ➔ Handmatige SDP Offer gegenereerd (kopieer naar Peer B).", "ok");
    return sdpBundle;
  }

  /**
   * Handmatige P2P SDP Offer accepteren en SDP Answer teruggeven
   */
  async acceptManualOfferAndCreateAnswer(base64Offer) {
    this.closeRtc();
    this.pcLocal = new RTCPeerConnection({ iceServers: [] });
    this.pcLocal.ondatachannel = (ev) => {
      this.dcTx = ev.channel;
      this.dcRx = ev.channel;
      this._bindTxChannel(ev.channel);
      this._bindRxChannel(ev.channel);
    };

    const offerDesc = JSON.parse(atob(base64Offer.trim()));
    await this.pcLocal.setRemoteDescription(offerDesc);
    const answer = await this.pcLocal.createAnswer();
    await this.pcLocal.setLocalDescription(answer);
    await this._waitIceGathering(this.pcLocal);

    const sdpAnswer = btoa(JSON.stringify(this.pcLocal.localDescription));
    this.log("WEBRTC ➔ SDP Answer gegenereerd! Plak deze terug bij Peer A.", "ok");
    return sdpAnswer;
  }

  /**
   * Handmatige SDP Answer voltooien op Peer A
   */
  async acceptManualAnswer(base64Answer) {
    if (!this.pcLocal) throw new Error("Maak eerst een SDP Offer aan");
    const answerDesc = JSON.parse(atob(base64Answer.trim()));
    await this.pcLocal.setRemoteDescription(answerDesc);
    this.log("WEBRTC ➔ Remote SDP Answer gekoppeld! DataChannel opent...", "ok");
  }

  _waitIceGathering(pc) {
    return new Promise(resolve => {
      if (pc.iceGatheringState === "complete") return resolve();
      const check = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", check);
      setTimeout(resolve, 1200);
    });
  }

  _bindTxChannel(dc) {
    dc.onopen = () => {
      this.log(`DATACHANNEL [TX] OPEN ➔ label="${dc.label}" (state=${dc.readyState})`, "ok");
      this.onChannelState("OPEN", this.stats);
    };
    dc.onclose = () => {
      this.log("DATACHANNEL [TX] GESLOTEN", "info");
      this.onChannelState("CLOSED", this.stats);
    };
    dc.onerror = (e) => this.log(`DATACHANNEL [TX] FOUT: ${e.message || "onbekend"}`, "err");
  }

  _bindRxChannel(dc) {
    dc.onopen = () => {
      this.log(`DATACHANNEL [RX] ONTVANGER GEREED ➔ Luistert op "${dc.label}"`, "ok");
      this.onChannelState("OPEN", this.stats);
    };
    dc.onmessage = (ev) => this._handleIncomingFrame(ev.data, "WebRTC-DataChannel");
  }

  // ── 5. CHUNKED 16KB TRANSMITTER & REASSEMBLER ─────────────────────────────
  async transmitOverDataChannel(payloadObj, resourceName = "stream.geojson") {
    const rawJson = typeof payloadObj === "string" ? payloadObj : JSON.stringify(payloadObj);
    const checksum = await this.sha256(rawJson);
    const chunkSize = 16384; // 16 KB veilige WebRTC SCTP frame-grootte
    const totalChunks = Math.ceil(rawJson.length / chunkSize) || 1;
    const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

    const headerFrame = JSON.stringify({
      op: "HEAD",
      msgId,
      name: resourceName,
      totalChunks,
      totalBytes: rawJson.length,
      sha256: checksum,
      timestamp: new Date().toISOString()
    });

    const sendFrame = (frameStr) => {
      let sentRtc = false;
      if (this.dcTx && this.dcTx.readyState === "open") {
        this.dcTx.send(frameStr);
        sentRtc = true;
      }
      if (this.bcPipe) {
        this.bcPipe.postMessage(frameStr);
      }
      this.stats.txBytes += frameStr.length;
      this.stats.txPackets += 1;
      return sentRtc;
    };

    const viaRtc = sendFrame(headerFrame);
    for (let i = 0; i < totalChunks; i++) {
      const slice = rawJson.slice(i * chunkSize, (i + 1) * chunkSize);
      sendFrame(JSON.stringify({ op: "CHUNK", msgId, idx: i, data: slice }));
    }

    const modeLabel = viaRtc ? "WebRTC DataChannel + BroadcastPipe" : "BroadcastPipe (Tip: klik '⚡ Koppel Loopback Peers' voor live WebRTC SCTP)";
    this.log(`TX VERZONDEN ➔ "${resourceName}" (${rawJson.length} B in ${totalChunks} chunk(s) via ${modeLabel})`, "ok");
    this.onChannelState(this.dcTx?.readyState === "open" ? "OPEN" : "BROADCAST-ONLY", this.stats);
  }

  async _handleIncomingFrame(rawFrame, channelSource) {
    try {
      this.stats.rxBytes += typeof rawFrame === "string" ? rawFrame.length : 0;
      this.stats.rxPackets += 1;
      const frame = typeof rawFrame === "string" ? JSON.parse(rawFrame) : rawFrame;

      if (frame.op === "HEAD") {
        this.rxBuffer.set(frame.msgId, {
          meta: frame,
          chunks: new Array(frame.totalChunks),
          receivedCount: 0
        });
        this.log(`RX [${channelSource}] ➔ Header ontvangen voor "${frame.name}" (${frame.totalChunks} chunks verwacht)`, "info");
      } else if (frame.op === "CHUNK") {
        const entry = this.rxBuffer.get(frame.msgId);
        if (!entry) return;
        entry.chunks[frame.idx] = frame.data;
        entry.receivedCount += 1;

        if (entry.receivedCount === entry.meta.totalChunks) {
          const fullText = entry.chunks.join("");
          this.rxBuffer.delete(frame.msgId);
          const calcHash = await this.sha256(fullText);
          const verified = calcHash === entry.meta.sha256;

          this.log(
            `RX COMPLEET [${channelSource}] ➔ "${entry.meta.name}" (${fullText.length} B) | SHA-256 ${verified ? "VERIFIED ✅" : "MISMATCH ❌"}`,
            verified ? "ok" : "err"
          );

          // Sla automatisch op in de Solid Pod /webrtc/inbox/
          await this.putResource("/webrtc/inbox/", entry.meta.name, fullText, "application/geo+json");
          this.onChannelState(this.dcTx?.readyState === "open" ? "OPEN" : "BROADCAST-ONLY", this.stats);

          try {
            const parsed = JSON.parse(fullText);
            this.onReceiveDataset(parsed, entry.meta);
          } catch (_) {}
        }
      }
    } catch (err) {
      this.log(`RX FOUT: ${err.message}`, "err");
    }
  }

  closeRtc() {
    try { if (this.dcTx) this.dcTx.close(); } catch (_) {}
    try { if (this.dcRx) this.dcRx.close(); } catch (_) {}
    try { if (this.pcLocal) this.pcLocal.close(); } catch (_) {}
    try { if (this.pcLoopback) this.pcLoopback.close(); } catch (_) {}
    this.dcTx = null;
    this.dcRx = null;
    this.pcLocal = null;
    this.pcLoopback = null;
    this.onChannelState("CLOSED", this.stats);
  }
}

export default SovereignPodRTC;
