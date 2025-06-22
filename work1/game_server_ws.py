import asyncio
import websockets
import json
import logging

# Konfigurasi logging dasar
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# State untuk menyimpan data pemain yang terhubung
PLAYERS = {}

async def broadcast(message):
    """Mengirim pesan ke semua klien yang terhubung."""
    if PLAYERS:
        json_message = json.dumps(message)
        logging.info(f"Broadcasting: {json_message}")
        # Buat daftar tugas untuk mengirim pesan ke semua pemain
        tasks = [asyncio.create_task(player["ws"].send(json_message)) for player in PLAYERS.values()]
        await asyncio.wait(tasks)

async def check_and_start_game():
    """Memeriksa apakah semua pemain siap dan memulai permainan."""
    # Game dimulai jika ada 2 pemain dan keduanya sudah READY
    if len(PLAYERS) == 2 and all(p['status'] == 'READY' for p in PLAYERS.values()):
        await broadcast({"type": "START_GAME"})

async def handler(websocket, path):
    """Fungsi utama untuk menangani koneksi dan pesan dari setiap klien."""
    client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    
    # Tolak koneksi jika server sudah penuh (2 pemain)
    if len(PLAYERS) >= 2:
        logging.warning(f"Connection rejected for {client_id}: Server is full.")
        await websocket.send(json.dumps({"type": "ERROR", "message": "Server is full."}))
        await websocket.close()
        return

    logging.info(f"Player {client_id} connected.")
    PLAYERS[client_id] = {"ws": websocket, "status": "CONNECTED"}
    
    # Kirim state saat ini ke semua pemain
    await broadcast({
        "type": "PLAYER_UPDATE",
        "players": {pid: {"status": p["status"]} for pid, p in PLAYERS.items()}
    })

    try:
        async for message in websocket:
            data = json.loads(message)
            logging.info(f"Received from {client_id}: {data}")

            if data['type'] == 'READY':
                if client_id in PLAYERS:
                    PLAYERS[client_id]['status'] = 'READY'
                    await broadcast({
                        "type": "PLAYER_UPDATE",
                        "players": {pid: {"status": p["status"]} for pid, p in PLAYERS.items()}
                    })
                    await check_and_start_game()
            
            # Anda bisa menambahkan tipe pesan lain di sini, misalnya untuk skor
            # if data['type'] == 'UPDATE_SCORE':
            #     await broadcast({"type": "SCORE_UPDATE", "id": client_id, "score": data['score']})

    finally:
        logging.info(f"Player {client_id} disconnected.")
        if client_id in PLAYERS:
            del PLAYERS[client_id]
        # Umumkan bahwa seorang pemain telah keluar
        await broadcast({
            "type": "PLAYER_UPDATE",
            "players": {pid: {"status": p["status"]} for pid, p in PLAYERS.items()}
        })

async def main():
    # Jalankan server di semua interface (0.0.0.0) pada port 6666
    async with websockets.serve(handler, "0.0.0.0", 6666):
        logging.info("WebSocket Game Server started on ws://0.0.0.0:6666")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())