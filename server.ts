/**
 * AUDIO ENGINE RELAY SERVER
 * Runtime: Deno
 * Port: 8000
 */

import { serve } from "https://deno.land/std/http/server.ts";

// Define the shape of our oscillator state
interface Oscillator {
  id: string;
  frequency: number;
  isPlaying: boolean;
}

interface AppState {
  oscillators: Oscillator[];
}

// Global state: The "Source of Truth"
let state: AppState = {
  oscillators: [
    { id: "osc-initial", frequency: 440, isPlaying: false }
  ]
};

// Track all active WebSocket connections
const clients = new Set<WebSocket>();

console.log("Audio Engine Relay started on ws://localhost:8000");

serve((req) => {
  // Check if the request is a WebSocket upgrade
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      clients.add(socket);
      console.log(`Client connected. Total clients: ${clients.size}`);
      
      // Immediately sync the new client with the current state
      socket.send(JSON.stringify({ 
        type: "SYNC", 
        oscillators: state.oscillators 
      }));
    };

    socket.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data);

        // Update the central state if the message type is UPDATE
        if (message.type === "UPDATE") {
          state.oscillators = message.oscillators;
        }

        // Broadcast the updated state to ALL clients (including the sender)
        // This ensures the sender gets confirmation and other clients react live
        const payload = JSON.stringify({ 
          type: "SYNC", 
          oscillators: state.oscillators 
        });

        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        }
      } catch (err) {
        console.error("Failed to process message:", err);
      }
    };

    socket.onclose = () => {
      clients.delete(socket);
      console.log(`Client disconnected. Total clients: ${clients.size}`);
    };

    socket.onerror = (e) => console.error("WebSocket error:", e);

    return response;
  }

  // Fallback for standard HTTP requests
  return new Response("Audio Server Logic Active. Connect via WebSocket.", { status: 200 });
}, { port: 8000 });