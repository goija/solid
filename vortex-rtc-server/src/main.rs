use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router, State,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct SignalPacket {
    sender: String,
    #[serde(rename = "type")]
    msg_type: String,
    room: Option<String>,
    sdp: Option<serde_json::Value>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let (tx, _rx) = broadcast::channel::<String>(256);
    let app_state = Arc::new(AppState { tx });

    let app = Router::new()
        .route("/ws/signaling", get(ws_signaling_handler))
        .route("/rss/woo-tholen.xml", get(rss_feed_handler))
        .route("/api/v4/dossier/jsonp", get(jsonp_dossier_handler))
        .route("/health", get(health_handler))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8081));
    println!("⬢ VORTEX WebRTC Signaling & RSS Server actief op http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn ws_signaling_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() { break; }
        }
    });

    let tx = state.tx.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if text.to_lowercase().contains("burgerservicenummer") {
                continue; // Firewall: blokkeer BSN-transport
            }
            if let Ok(packet) = serde_json::from_str::<SignalPacket>(&text) {
                let _ = tx.send(text);
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }
}

async fn rss_feed_handler() -> Response {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>VORTEX Juridisch Centrum // Woo-Dossier 1456324 &amp; 1425030</title>
    <link>http://localhost:8081/rss/woo-tholen.xml</link>
    <description>Forensische proceschronologie &amp; PostNL 3SDQYS603048929</description>
    <language>nl-nl</language>
    <item>
      <title>[Prod. 10 &amp; 11] PostNL 3SDQYS603048929 - 0-Dagen Termijn Blaricum</title>
      <pubDate>Fri, 23 Oct 2026 11:42:00 +0200</pubDate>
      <description>Brief 1504535 feitelijk afgehaald te Blaricum op 23-10-2026. Schending art. 3:2 en 2:4 Awb.</description>
    </item>
  </channel>
</rss>"#;
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "application/rss+xml; charset=utf-8".parse().unwrap());
    (StatusCode::OK, headers, xml).into_response()
}

async fn jsonp_dossier_handler(Query(params): Query<HashMap<String, String>>) -> Response {
    let cb = params.get("callback").cloned().unwrap_or_else(|| "vortexDossier".to_string());
    let payload = serde_json::json!({
        "peildatum": "2026-10-27",
        "wooHoofdzaak": "1456324",
        "postnlBlaricum": "3SDQYS603048929",
        "besluitSpoorC": "1463739"
    });
    let body = format!("{}({});", cb, payload.to_string());
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "application/javascript; charset=utf-8".parse().unwrap());
    (StatusCode::OK, headers, body).into_response()
}

async fn health_handler() -> &'static str { "OK" }
