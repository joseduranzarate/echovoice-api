const API_URL = "http://localhost:8000";

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const connectBtn = document.getElementById("connect");
const disconnectBtn = document.getElementById("disconnect");

const room = new LivekitClient.Room({
  adaptiveStream: true,
  dynacast: true,
});

room.on(LivekitClient.RoomEvent.ParticipantConnected, (p) => {
  log(`participant joined: ${p.identity}`);
});

room.on(LivekitClient.RoomEvent.ParticipantDisconnected, (p) => {
  log(`participant left: ${p.identity}`);
});

room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, _pub, participant) => {
  log(`subscribed to ${participant.identity}'s ${track.kind} track`);
  if (track.kind === "audio") {
    const el = track.attach();
    el.autoplay = true;
    document.body.appendChild(el);
  }
});

room.on(LivekitClient.RoomEvent.Disconnected, () => {
  log("disconnected");
  setStatus("idle");
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
});

connectBtn.onclick = async () => {
  try {
    connectBtn.disabled = true;
    setStatus("requesting token from API…");
    const res = await fetch(`${API_URL}/token`, { method: "POST" });
    if (!res.ok) throw new Error(`/token returned ${res.status}`);
    const { token, url, room: roomName, identity } = await res.json();
    log(`got token for room '${roomName}' as '${identity}'`);

    setStatus(`connecting to ${url}…`);
    await room.connect(url, token);
    log(`connected to room`);

    const others = Array.from(room.remoteParticipants.values());
    if (others.length === 0) {
      log(`⚠️  no other participants in room — is the agent running?`);
    } else {
      log(`already in room: ${others.map((p) => p.identity).join(", ")}`);
    }

    setStatus("enabling microphone…");
    await room.localParticipant.setMicrophoneEnabled(true);
    log(`mic published`);

    setStatus(`connected as ${identity} — start talking`);
    disconnectBtn.disabled = false;
  } catch (err) {
    log(`ERROR: ${err.message}`);
    setStatus(`error: ${err.message}`);
    connectBtn.disabled = false;
  }
};

disconnectBtn.onclick = async () => {
  await room.disconnect();
};

function setStatus(s) {
  statusEl.textContent = s;
}

function log(s) {
  const div = document.createElement("div");
  const ts = new Date().toLocaleTimeString();
  div.textContent = `[${ts}] ${s}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}
