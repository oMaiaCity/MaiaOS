"""Parlor — on-device, real-time multimodal AI (voice + vision)."""

import asyncio
import base64
import json
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path

_PARLOR_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _PARLOR_DIR.parent.parent


def _load_env() -> None:
    """Load .env: parlor first, then repo root (e.g. shared HF token), without clobbering parlor."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    parlor_env = _PARLOR_DIR / ".env"
    if parlor_env.is_file():
        load_dotenv(parlor_env, override=True)
    root_env = _REPO_ROOT / ".env"
    if root_env.is_file():
        load_dotenv(root_env, override=False)


_load_env()

import litert_lm
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

import tts

# Default: Gemma 4 E4B (~3.6 GB). Override with HF_REPO + HF_FILENAME for E2B (~2.6 GB) or a local .litertlm.
_DEFAULT_HF_REPO = "litert-community/gemma-4-E4B-it-litert-lm"
_DEFAULT_HF_FILENAME = "gemma-4-E4B-it.litertlm"
HF_REPO = os.environ.get("HF_REPO", _DEFAULT_HF_REPO)
HF_FILENAME = os.environ.get("HF_FILENAME", _DEFAULT_HF_FILENAME)


def _hf_token() -> str | None:
    # huggingface_hub also reads these from os.environ; pass explicitly for clarity
    t = (os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN") or "").strip()
    return t or None


def resolve_model_path() -> str:
    path = os.environ.get("MODEL_PATH", "")
    if path:
        return path
    from huggingface_hub import hf_hub_download
    print(f"Downloading {HF_REPO}/{HF_FILENAME} (first run only)...")
    return hf_hub_download(
        repo_id=HF_REPO,
        filename=HF_FILENAME,
        token=_hf_token(),
    )


MODEL_PATH = resolve_model_path()
# One conversation per WebSocket: LiteRT allows only a single session on the engine at a time.
UNIFIED_SYSTEM_PROMPT = (
    "You are a friendly, conversational AI assistant running fully on the user's device. "
    "For plain text messages, reply helpfully and concisely. "
    "When the user sends images (chat upload or camera), read visible text and layout carefully; "
    "for documents or screenshots, extract and organize information accurately (OCR-style). "
    "When the user sends audio (and optionally a camera image), you MUST use the "
    "respond_to_user tool: set transcription to what they said and response to your reply."
)

SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+')

engine = None
tts_backend = None


def load_models():
    global engine, tts_backend
    print(f"Loading Gemma (HF: {HF_REPO} / {HF_FILENAME}) from {MODEL_PATH}...")
    engine = litert_lm.Engine(
        MODEL_PATH,
        backend=litert_lm.Backend.GPU,
        vision_backend=litert_lm.Backend.GPU,
        audio_backend=litert_lm.Backend.CPU,
    )
    engine.__enter__()
    print("Engine loaded.")

    tts_backend = tts.load()


@asynccontextmanager
async def lifespan(app):
    await asyncio.get_event_loop().run_in_executor(None, load_models)
    yield


app = FastAPI(lifespan=lifespan)


def split_sentences(text: str) -> list[str]:
    """Split text into sentences for streaming TTS."""
    parts = SENTENCE_SPLIT_RE.split(text.strip())
    return [s.strip() for s in parts if s.strip()]


@app.get("/")
async def root():
    return HTMLResponse(content=(Path(__file__).parent / "index.html").read_text())


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    # Per-connection tool state captured via closure
    tool_result = {}

    def respond_to_user(transcription: str, response: str) -> str:
        """Respond to the user's voice message.

        Args:
            transcription: Exact transcription of what the user said in the audio.
            response: Your conversational response to the user. Keep it to 1-4 short sentences.
        """
        tool_result["transcription"] = transcription
        tool_result["response"] = response
        return "OK"

    conversation = engine.create_conversation(
        messages=[{"role": "system", "content": UNIFIED_SYSTEM_PROMPT}],
        tools=[respond_to_user],
    )
    conversation.__enter__()

    interrupted = asyncio.Event()
    msg_queue = asyncio.Queue()

    async def receiver():
        """Receive messages from WebSocket and route them."""
        try:
            while True:
                raw = await ws.receive_text()
                msg = json.loads(raw)
                if msg.get("type") == "interrupt":
                    interrupted.set()
                    print("Client interrupted")
                else:
                    await msg_queue.put(msg)
        except WebSocketDisconnect:
            await msg_queue.put(None)

    recv_task = asyncio.create_task(receiver())

    try:
        while True:
            msg = await msg_queue.get()
            if msg is None:
                break

            interrupted.clear()

            is_chat = msg.get("type") == "chat" or (
                not msg.get("audio")
                and not msg.get("image")
                and (str(msg.get("text") or "").strip() != "")
            )
            if is_chat:
                user_text = (msg.get("text") or "").strip()
                image_b64 = (msg.get("image") or "").strip()
                if not user_text and not image_b64:
                    continue
                if image_b64:
                    content: list[dict] = [{"type": "image", "blob": image_b64}]
                    if user_text:
                        content.append({"type": "text", "text": user_text})
                    else:
                        content.append(
                            {
                                "type": "text",
                                "text": (
                                    "This image may be a document, photo, or screenshot. "
                                    "Extract all readable text (OCR) and summarize the key "
                                    "information. If the text is long, give a clear outline first."
                                ),
                            }
                        )
                    send_payload = {"role": "user", "content": content}
                else:
                    send_payload = {
                        "role": "user",
                        "content": [{"type": "text", "text": user_text}],
                    }
            else:
                if not msg.get("audio"):
                    continue
                content = []
                if msg.get("audio"):
                    content.append({"type": "audio", "blob": msg["audio"]})
                if msg.get("image"):
                    content.append({"type": "image", "blob": msg["image"]})
                if msg.get("audio") and msg.get("image"):
                    content.append({
                        "type": "text",
                        "text": "The user just spoke to you (audio) while showing their camera (image). Respond to what they said, referencing what you see if relevant.",
                    })
                elif msg.get("audio"):
                    content.append(
                        {
                            "type": "text",
                            "text": "The user just spoke to you. Respond to what they said.",
                        }
                    )
                elif msg.get("image"):
                    content.append(
                        {
                            "type": "text",
                            "text": "The user is showing you their camera. Describe what you see.",
                        }
                    )
                else:
                    content.append({"type": "text", "text": msg.get("text", "Hello!")})
                send_payload = {"role": "user", "content": content}

            # LLM inference
            t0 = time.time()
            tool_result.clear()
            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: conversation.send_message(send_payload)
            )
            llm_time = time.time() - t0

            if tool_result:
                strip = lambda s: s.replace('<|"|>', "").strip()
                transcription = strip(tool_result.get("transcription", ""))
                text_response = strip(tool_result.get("response", ""))
                print(f"LLM ({llm_time:.2f}s) [tool] heard: {transcription!r} → {text_response}")
            else:
                transcription = None
                text_response = response["content"][0]["text"]
                mode_tag = "chat" if is_chat else "no tool"
                print(f"LLM ({llm_time:.2f}s) [{mode_tag}]: {text_response!r}")

            if interrupted.is_set():
                print("Interrupted after LLM, skipping response")
                continue

            reply = {
                "type": "text",
                "text": text_response,
                "llm_time": round(llm_time, 2),
            }
            if is_chat:
                reply["mode"] = "chat"
            if transcription:
                reply["transcription"] = transcription
            await ws.send_text(json.dumps(reply))

            if is_chat or interrupted.is_set():
                if interrupted.is_set() and not is_chat:
                    print("Interrupted before TTS, skipping audio")
                continue

            # Streaming TTS: split into sentences and send chunks progressively
            sentences = split_sentences(text_response)
            if not sentences:
                sentences = [text_response]

            tts_start = time.time()

            # Signal start of audio stream
            await ws.send_text(json.dumps({
                "type": "audio_start",
                "sample_rate": tts_backend.sample_rate,
                "sentence_count": len(sentences),
            }))

            for i, sentence in enumerate(sentences):
                if interrupted.is_set():
                    print(f"Interrupted during TTS (sentence {i+1}/{len(sentences)})")
                    break

                # Generate audio for this sentence
                pcm = await asyncio.get_event_loop().run_in_executor(
                    None, lambda s=sentence: tts_backend.generate(s)
                )

                if interrupted.is_set():
                    break

                # Convert to 16-bit PCM and send as base64
                pcm_int16 = (pcm * 32767).clip(-32768, 32767).astype(np.int16)
                await ws.send_text(json.dumps({
                    "type": "audio_chunk",
                    "audio": base64.b64encode(pcm_int16.tobytes()).decode(),
                    "index": i,
                }))

            tts_time = time.time() - tts_start
            print(f"TTS ({tts_time:.2f}s): {len(sentences)} sentences")

            if not interrupted.is_set():
                await ws.send_text(json.dumps({
                    "type": "audio_end",
                    "tts_time": round(tts_time, 2),
                }))

    except WebSocketDisconnect:
        print("Client disconnected")
    finally:
        recv_task.cancel()
        conversation.__exit__(None, None, None)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    # Default 127.0.0.1 so the startup line matches a browser-safe URL; set HOST=0.0.0.0 to listen on all interfaces
    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
