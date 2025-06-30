import asyncio
import websockets
import json
import logging

# Konfigurasi logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# State global
STATE = {
    "players": {},
    "game_status": "LOBBY"
}

async def broadcast_game_state():
    if not STATE["players"]:
        return

    game_state_payload = {
        "type": "GAME_STATE",
        "players": {
            pid: {
                "dino": p.get("dino", {}),
                "state": p.get("state", "CONNECTED"),
                "score": p.get("score", 0)
            }
            for pid, p in STATE["players"].items()
        }
    }

    active_connections = [p["ws"] for p in STATE["players"].values() if not p["ws"].closed]
    if active_connections:
        await asyncio.gather(
            *[ws.send(json.dumps(game_state_payload)) for ws in active_connections],
            return_exceptions=True
        )

async def check_and_update_game_status():
    players_list = list(STATE["players"].values())

    if len(players_list) == 2 and all(p.get("state") == "READY" for p in players_list):
        if STATE["game_status"] != "PLAYING":
            logging.info("All players are ready! Starting game.")
            STATE["game_status"] = "PLAYING"
            for p in players_list:
                p["state"] = "PLAYING"
            await asyncio.gather(*[
                p["ws"].send(json.dumps({"type": "START_GAME"})) for p in players_list
            ])

    elif len(players_list) == 2 and all(p.get("state") == "GAMEOVER" for p in players_list):
        if STATE["game_status"] != "GAMEOVER":
            logging.info("All players are game over! Ending session.")
            STATE["game_status"] = "GAMEOVER"

            # Penilaian skor
            scores = {
                pid: p.get("score", 0)
                for pid, p in STATE["players"].items()
            }

            if len(scores) == 2:
                pid1, pid2 = list(scores.keys())
                score1, score2 = scores[pid1], scores[pid2]

                logging.info(f"Final scores: {pid1}={score1}, {pid2}={score2}")

                if score1 > score2:
                    await STATE["players"][pid1]["ws"].send(json.dumps({"type": "WINNER_ANNOUNCEMENT", "result": "WIN"}))
                    await STATE["players"][pid2]["ws"].send(json.dumps({"type": "WINNER_ANNOUNCEMENT", "result": "LOSE"}))
                elif score2 > score1:
                    await STATE["players"][pid2]["ws"].send(json.dumps({"type": "WINNER_ANNOUNCEMENT", "result": "WIN"}))
                    await STATE["players"][pid1]["ws"].send(json.dumps({"type": "WINNER_ANNOUNCEMENT", "result": "LOSE"}))
                else:
                    # Seri
                    for p in players_list:
                        await p["ws"].send(json.dumps({"type": "WINNER_ANNOUNCEMENT", "result": "DRAW"}))

            await asyncio.gather(*[
                p["ws"].send(json.dumps({"type": "SESSION_OVER"}))
                for p in players_list
            ])

async def handler(websocket):
    if len(STATE["players"]) >= 2:
        logging.warning("Connection rejected: Server is full.")
        await websocket.close(1008, "Server is full")
        return

    client_id = str(websocket.id)
    STATE["players"][client_id] = {"ws": websocket, "state": "CONNECTED", "score": 0}
    logging.info(f"Player {client_id} connected. Total players: {len(STATE['players'])}")

    try:
        await websocket.send(json.dumps({"type": "ASSIGN_ID", "id": client_id}))
        await broadcast_game_state()

        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if client_id not in STATE["players"]:
                    break
                player = STATE["players"][client_id]

                if msg_type == "READY":
                    player["state"] = "READY"
                    logging.info(f"Player {client_id} is ready.")
                    await broadcast_game_state()
                    await check_and_update_game_status()

                elif msg_type == "UPDATE_STATE":
                    player["dino"] = data.get("dino", {})

                elif msg_type == "UPDATE_SCORE":
                    player["score"] = data.get("score", 0)

                elif msg_type == "GAME_OVER":
                    player["state"] = "GAMEOVER"
                    logging.info(f"Player {client_id} is game over.")
                    await broadcast_game_state()
                    await check_and_update_game_status()

            except json.JSONDecodeError:
                logging.warning("Received invalid JSON message.")
            except Exception as e:
                logging.error(f"Error processing message: {e}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if client_id in STATE["players"]:
            logging.info(f"Player {client_id} disconnected.")
            del STATE["players"][client_id]
            if STATE["game_status"] != "LOBBY" and len(STATE["players"]) < 2:
                logging.info("A player left, resetting game to lobby.")
                STATE["game_status"] = "LOBBY"
                for p in STATE["players"].values():
                    p["state"] = "CONNECTED"
            await broadcast_game_state()

async def broadcast_loop():
    while True:
        await asyncio.sleep(1 / 30)
        await broadcast_game_state()

async def main():
    asyncio.create_task(broadcast_loop())
    async with websockets.serve(handler, "0.0.0.0", 6666):
        logging.info("Game server started on ws://0.0.0.0:6666")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer is shutting down.")
