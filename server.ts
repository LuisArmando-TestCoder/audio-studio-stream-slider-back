/**
 * AUDIO ENGINE RELAY SERVER
 * Runtime: Deno | Port: 8000
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

interface Oscillator {
  id: string;
  frequency: number;
  isPlaying: boolean;
}

interface AppState {
  oscillators: Oscillator[];
}

let state: AppState = {
  oscillators: []
};

const clients = new Set<WebSocket>();

console.log("Audio Engine Relay started on ws://localhost:8000");

serve((req) => {
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      clients.add(socket);
      socket.send(JSON.stringify({ type: "SYNC", oscillators: state.oscillators }));
    };

    socket.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data);
        if (message.type === "UPDATE") {
          state.oscillators = message.oscillators;
        }

        const payload = JSON.stringify({ type: "SYNC", oscillators: state.oscillators });
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        }
      } catch (err) {
        console.error("Payload error:", err);
      }
    };

    socket.onclose = () => clients.delete(socket);
    return response;
  }
  return new Response("WebSocket Server Active", { status: 200 });
}, { port: 8000 });