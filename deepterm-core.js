import fs from 'fs';
import { Buffer } from 'buffer';
import { fileURLToPath } from 'url';
import {dirname,join} from 'path';
import path from 'path';
import FormData from 'form-data';

const wasmFile = './deepseek.wasm';
const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, wasmFile);
const wasmBytes = fs.readFileSync(wasmPath);
let wasmInstance, wasmExports, memory, malloc, stack_ptr;


// Init WASM jika belum
async function initWasm() {
    if (wasmInstance) return;
    const {
        instance
    } = await WebAssembly.instantiate(wasmBytes, {});
    wasmInstance = instance;
    wasmExports = instance.exports;
    memory = wasmExports.memory;
    malloc = wasmExports.__wbindgen_export_0;
    stack_ptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
}

// UTF-8 allocator
function alloc_utf8(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const ptr = malloc(bytes.length, 1);
    const view = new Uint8Array(memory.buffer, ptr, bytes.length);
    view.set(bytes);
    return [ptr, bytes.length];
}

// === Main Solver Function ===
export async function solvePow(challenge, salt, expireAt, difficulty) {
    await initWasm();
    const prefix = `${salt}_${expireAt}_`;

    const [challengePtr, challengeLen] = alloc_utf8(challenge);
    const [prefixPtr, prefixLen] = alloc_utf8(prefix);

    wasmExports.wasm_solve(
        stack_ptr,
        challengePtr,
        challengeLen,
        prefixPtr,
        prefixLen,
        difficulty
    );

    const view = new DataView(memory.buffer, stack_ptr, 16);
    const found = view.getInt32(0, true);
    const answer = view.getFloat64(8, true);

    if (found === 0) {
        throw new Error("POW not found");
    }
    return Math.floor(answer);
}

function isJsonString(str) {
    try {
        const parsed = JSON.parse(str);
        return typeof parsed === 'object' && parsed !== null;
    } catch (e) {
        return false;
    }
}

function headers(TOKEN) {
    const baseHeaders = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'authorization': `Bearer ${TOKEN}`,
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-full-version-list': '"Not)A;Brand";v="8.0.0.0", "Chromium";v="138.0.0.0", "Brave";v="138.0.0.0"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-model': '""',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"19.0.0"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'x-app-version': '20241129.1',
        'x-client-locale': 'en_US',
        'x-client-platform': 'web',
        'x-client-version': '1.3.0-auto-resume'
    }
    return baseHeaders
}

export async function getCurrentProfile(TOKEN) {
    const response = await fetch("https://chat.deepseek.com/api/v0/users/current", {
        method: "GET",
        headers: {
            ...headers(TOKEN)
        },
        referrer: "https://chat.deepseek.com/",
        body: null,
        mode: "cors",
        credentials: "include"
    });

    try {
        const json = await response.json();
        return json;
    } catch {
        return
    }
}

export async function deleteAllChatSessions(TOKEN, CHAT_SESSION_ID) {
    const response = await fetch("https://chat.deepseek.com/api/v0/chat_session/delete_all", {
        method: "POST",
        headers: {
            ...headers(TOKEN)
        },
        referrer: `https://chat.deepseek.com/a/chat/s/${CHAT_SESSION_ID}`,
        body: null,
        mode: "cors",
        credentials: "include"
    });

    try {
        const json = await response.json();
        return json;
    } catch {
        return
    }
}

export async function getFileUrl(TOKEN, CHAT_SESSION_ID, file_id) {
    const response = await fetch(`https://chat.deepseek.com/api/v0/file/preview?file_id=file-${file_id}`, {
        method: "GET",
        headers: {
            ...headers(TOKEN),
        },
        referrer: `https://chat.deepseek.com/a/chat/s/${CHAT_SESSION_ID}`,
        body: null,
        mode: "cors",
        credentials: "include"
    });

    try {
        const json = await response.json();
        return json;
    } catch {
        return
    }

}
export async function uploadFile(TOKEN, CHAT_SESSION_ID, targetPath) {
    const pow = await generatePowHeader(TOKEN, CHAT_SESSION_ID, targetPath);

    const form = new FormData();
    const fileName = path.basename(filePath);
    form.append('file', fs.createReadStream(filePath), {
        filename: fileName,
        contentType: 'application/json'
    });

    const response = await fetch("https://chat.deepseek.com/api/v0/file/upload_file", {
        method: "POST",
        headers: {
            ...form.getHeaders(),
            ...headers(TOKEN),
            'x-ds-pow-response': pow,
            'x-thinking-enabled': '0'
        },
        body: form,
        referrer: "https://chat.deepseek.com/",
        mode: "cors",
        credentials: "include"
    });

    try {
        const json = await response.json();
        return json;
    } catch {
        return;
    }
}

export async function createChatSession(TOKEN) {
    const response = await fetch("https://chat.deepseek.com/api/v0/chat_session/create", {
        method: "POST",
        headers: {
            ...headers(TOKEN),
            'content-type': 'application/json',
        },
        referrer: "https://chat.deepseek.com/",
        body: JSON.stringify({
            character_id: null
        }),
        mode: "cors",
        credentials: "include"
    });

    try {
        const json = await response.json();
        return json;
    } catch {
        return
    }
}

export async function fetchAllChatSessions(TOKEN) {
    const response = await fetch("https://chat.deepseek.com/api/v0/chat_session/fetch_page", {
        method: "GET",
        headers: {
            ...headers(TOKEN),
        },
        referrer: "https://chat.deepseek.com/",
        body: null,
        mode: "cors",
        credentials: "include"
    });

    try {
        const json = await response.json();
        return json;
    } catch {
        return
    }

}
export async function generatePowHeader(TOKEN, CHAT_SESSION_ID, targetPath) {
    const res = await fetch('https://chat.deepseek.com/api/v0/chat/create_pow_challenge', {
        method: 'POST',
        headers: {
            ...headers(TOKEN),
            'content-type': 'application/json',
            referer: `https://chat.deepseek.com/a/chat/s/${CHAT_SESSION_ID}`
        },
        body: JSON.stringify({
            target_path: targetPath
        }),
    });
    try {

        const {
            data
        } = await res.json();
        const {
            challenge,
            salt,
            expire_at,
            difficulty,
            signature,
            algorithm,
            target_path
        } = data.biz_data.challenge;

        const answer = await solvePow(challenge, salt, expire_at, difficulty);

        const encoded = Buffer.from(JSON.stringify({
            algorithm,
            challenge,
            salt,
            answer,
            signature,
            target_path
        })).toString('base64');

        return encoded;
    } catch {
        return
    }
}

export async function fetchHistoryMessages(TOKEN, sessionId) {
    const url = `https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=${sessionId}&cache_version=-1`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            ...headers(TOKEN)
        },
        referrer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
        body: null,
        mode: "cors",
        credentials: "include"
    });
    try {

        const json = await response.json();
        return json;
    } catch {
        return
    }
}

export async function* completion(TOKEN, prompt, CHAT_SESSION_ID, parentMessageId, stream = true, search = true, thinking = false, file_ids = []) {
    const pow = await generatePowHeader(TOKEN, CHAT_SESSION_ID, '/api/v0/chat/completion');

    const response = await fetch("https://chat.deepseek.com/api/v0/chat/completion", {
        method: "POST",
        headers: {
            ...headers(TOKEN),
            'content-type': 'application/json',
            'x-ds-pow-response': pow,
            referer: `https://chat.deepseek.com/a/chat/s/${CHAT_SESSION_ID}`
        },
        body: JSON.stringify({
            chat_session_id: CHAT_SESSION_ID,
            parent_message_id: parentMessageId,
            prompt,
            ref_file_ids: file_ids,
            thinking_enabled: thinking,
            search_enabled: search
        })
    });

    let streamresponse = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const {
        value,
        done
    } = await reader.read();
    const chunk = decoder.decode(value, {
        stream: true
    });
    if (isJsonString(chunk)) {
        if (stream) {
            yield chunk
        } else {
            streamresponse = chunk
        }
    } else {
        while (true) {
            const {
                value,
                done
            } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, {
                stream: true
            });
            if (chunk.includes('challenge-platform')) {
                if (stream) {
                    yield 'Detected by Cloudflare, please try again and increase the request delay'
                } else {
                    streamresponse = 'Detected by Cloudflare, please try again and increase the request delay'
                }
            }
            const lines = chunk.split("\n").filter(line => line.startsWith("data:"));
            if (lines) {
                for (const line of lines) {
                    try {
                        const json = JSON.parse(line.replace(/^data:\s*/, ""));
                        if (typeof json?.v === "string" && !['SEARCHING', 'FINISHED', 'ANSWER'].includes(json.v)) {
                            if (stream) {
                                yield json.v;
                            } else {
                                streamresponse = streamresponse + json.v;
                            }
                        }
                    } catch {}
                }
            } else {
                if (stream) {
                    yield lines;
                } else {
                    streamresponse = streamresponse + lines;
                }
            }
        }
    }


    if (!stream) return streamresponse;
}