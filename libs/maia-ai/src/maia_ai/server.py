"""Moai / Maia AI — on-device LiteRT-LM + FastAPI (UI static files in `services/moai/`)."""

import asyncio
import base64
import json
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path

# .../libs/maia-ai/src/maia_ai/server.py → repo root is parents[4]
_REPO_ROOT = Path(__file__).resolve().parents[4]


def _load_env() -> None:
    """Load the MaiaOS repo root `.env` only (monorepo-wide secrets and HF token)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    root_env = _REPO_ROOT / ".env"
    if root_env.is_file():
        load_dotenv(root_env, override=False)


def _moai_service_dir() -> Path:
    return _REPO_ROOT / "services" / "moai"


def _data_cache_root() -> Path:
    """Where HF hub snapshots + LiteRT engine cache live. Prefer `services/moai/.cache`, not `libs/maia-ai`."""
    override = (os.environ.get("MOAI_CACHE_DIR") or "").strip()
    if override:
        return Path(override).expanduser().resolve()
    moai = _moai_service_dir()
    if moai.is_dir() and (moai / "index.html").is_file():
        return (moai / ".cache").resolve()
    return (Path.home() / ".cache" / "maia-ai").resolve()


def _configure_data_cache() -> Path:
    """Set HF_HOME before any `huggingface_hub` download; keeps weights out of the package tree."""
    root = _data_cache_root()
    root.mkdir(parents=True, exist_ok=True)
    if not (os.environ.get("HF_HOME") or "").strip():
        os.environ["HF_HOME"] = str(root / "huggingface")
    return root


_load_env()
# Before Hub download (HF_HOME) and Engine cache_dir; keeps artifacts under `services/moai/.cache` by default
_DATA_CACHE_ROOT = _configure_data_cache()

import litert_lm
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

from . import tts
from .invoice_tool import make_extract_invoice

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
# LiteRT: only one `Conversation` / session per `Engine` process-wide. The shared session is
# created in `load_models`. Per-request tool output uses `_tool_result_box` set around each
# `send_message` (works across `run_in_executor` threads; concurrent turns are serialized).
UNIFIED_SYSTEM_PROMPT = (
    "You are a friendly, conversational AI assistant running fully on the user's device. "
    "For plain text messages, reply helpfully and concisely. "
    "When the user sends images (chat upload or camera), read visible text and layout carefully. "
    "If the image is an INVOICE, BILL, QUOTATION, or itemized financial document, you MUST call the "
    "extract_invoice tool: fill all parameters you can read (use empty string for unknowns). "
    "line_items_json must be a valid JSON string of an array of line objects (description, quantity, "
    "unit_price, line totals, tax fields per line as visible). For normal photos or non-invoices, "
    "answer in plain text. "
    "When the user sends audio (and optionally a camera image), you MUST use the "
    "respond_to_user tool: set transcription to what they said and response to your reply — "
    "do not use extract_invoice for voice."
)

SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+')

engine = None
tts_backend = None
shared_conversation = None
# Mutable cell for the dict tools write to during the current `send_message` (executor thread)
_tool_result_box: list[dict | None] = [None]
_inference_lock = asyncio.Lock()


def _moai_index_path() -> Path:
    d = (os.environ.get("MOAI_STATIC_DIR") or "").strip()
    if d:
        return Path(d) / "index.html"
    return _REPO_ROOT / "services" / "moai" / "index.html"


def load_models():
    global engine, tts_backend, shared_conversation
    litert_cache = _DATA_CACHE_ROOT / "litert-lm"
    litert_cache.mkdir(parents=True, exist_ok=True)
    print(f"Loading Gemma (HF: {HF_REPO} / {HF_FILENAME}) from {MODEL_PATH}...")
    engine = litert_lm.Engine(
        MODEL_PATH,
        backend=litert_lm.Backend.GPU,
        vision_backend=litert_lm.Backend.GPU,
        audio_backend=litert_lm.Backend.CPU,
        cache_dir=str(litert_cache),
    )
    engine.__enter__()
    print("Engine loaded.")

    tts_backend = tts.load()

    def _current_tool_result() -> dict | None:
        return _tool_result_box[0]

    def respond_to_user(transcription: str, response: str) -> str:
        tr = _tool_result_box[0]
        if tr is not None:
            tr["transcription"] = transcription
            tr["response"] = response
            tr["used_tool"] = "respond_to_user"
        return "OK"

    extract_invoice = make_extract_invoice(_current_tool_result)
    shared_conversation = engine.create_conversation(
        messages=[{"role": "system", "content": UNIFIED_SYSTEM_PROMPT}],
        tools=[respond_to_user, extract_invoice],
    )
    shared_conversation.__enter__()
    print("Shared conversation ready.")


@asynccontextmanager
async def lifespan(app):
    await asyncio.get_event_loop().run_in_executor(None, load_models)
    yield
    if shared_conversation is not None:
        try:
            shared_conversation.__exit__(None, None, None)
        except Exception as e:  # noqa: BLE001
            print(f"Conversation shutdown: {e}")
    if engine is not None:
        try:
            engine.__exit__(None, None, None)
        except Exception as e:  # noqa: BLE001
            print(f"Engine shutdown: {e}")


app = FastAPI(lifespan=lifespan)


def split_sentences(text: str) -> list[str]:
    """Split text into sentences for streaming TTS."""
    parts = SENTENCE_SPLIT_RE.split(text.strip())
    return [s.strip() for s in parts if s.strip()]


@app.get("/")
async def root():
    p = _moai_index_path()
    return HTMLResponse(content=p.read_text())


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    if shared_conversation is None:
        try:
            await ws.send_text(json.dumps({
                "type": "error",
                "text": "Model is not ready. Restart the server.",
            }))
        except Exception:
            pass
        await ws.close(code=1011)
        return

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
                                    "Analyze this image. If it is an invoice, bill, or itemized "
                                    "financial document, you MUST use the extract_invoice tool and "
                                    "fill every field you can. Otherwise summarize or OCR as usual."
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

            # LLM inference (one shared `Conversation`; serialize turns; tool callbacks see `_tool_result_box[0]`)
            t0 = time.time()
            tool_result: dict = {}
            async with _inference_lock:
                _tool_result_box[0] = tool_result
                try:
                    response = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: shared_conversation.send_message(send_payload)
                    )
                finally:
                    _tool_result_box[0] = None
            llm_time = time.time() - t0

            if tool_result and tool_result.get("invoice_output"):
                transcription = None
                text_response = tool_result["invoice_output"]
                used = tool_result.get("used_tool", "extract_invoice")
                print(f"LLM ({llm_time:.2f}s) [tool {used}] invoice JSON {len(text_response)} chars")
            elif tool_result and tool_result.get("used_tool") == "respond_to_user":
                strip = lambda s: s.replace('<|"|>', "").strip()
                transcription = strip(tool_result.get("transcription", ""))
                text_response = strip(tool_result.get("response", ""))
                print(f"LLM ({llm_time:.2f}s) [tool] heard: {transcription!r} → {text_response!r}")
            else:
                transcription = None
                text_response = response["content"][0]["text"]
                mode_tag = "chat" if is_chat else "no tool"
                print(f"LLM ({llm_time:.2f}s) [{mode_tag}]: {text_response!r}")

            if interrupted.is_set():
                print("Interrupted after LLM, skipping response")
                continue

            is_invoice_json = bool(tool_result.get("invoice_output"))
            reply: dict = {
                "type": "text",
                "text": text_response,
                "llm_time": round(llm_time, 2),
            }
            if is_invoice_json:
                reply["display_format"] = "json"
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    # Default 127.0.0.1 so the startup line matches a browser-safe URL; set HOST=0.0.0.0 to listen on all interfaces
    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
