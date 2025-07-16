import express from 'express';
import cors from 'cors';
import { completion, createChatSession, fetchHistoryMessages } from './deepterm-core.js';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/completion', async (req, res) => {
  const { token, prompt, sessid="", stream = true } = req.body;
  let CHAT_SESSION_ID;
  let CHAT_SESSION;

  if (!token || !prompt) {
    return res.status(400).json({ error: 'Missing args' });
  }

  try {
    if (!sessid){
      const chatSession = await createChatSession(token);
      console.log(await chatSession)
      CHAT_SESSION = await chatSession;
      CHAT_SESSION_ID = CHAT_SESSION.data.biz_data.id
    }else{
      CHAT_SESSION_ID = sessid;
    }

    console.log(CHAT_SESSION_ID)
    const history = await fetchHistoryMessages(token, CHAT_SESSION_ID);
    const lastMsg = history?.data?.biz_data?.chat_messages?.slice(-1)[0];
    const parentMessageId = lastMsg?.message_id ?? null;

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      for await (const chunk of completion(token, prompt, CHAT_SESSION_ID, parentMessageId, true)) {
        res.write(`data: ${chunk}\n\n`);
      }

      res.write('event: end\ndata: [DONE]\n\n');
      res.end();
    } else {
      const resultData = completion(token, prompt, CHAT_SESSION_ID, parentMessageId, false)
      const { value: result } = await resultData.next()
      res.json({ result: result });
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: 'Internal error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🧠 DeepSeek API server listening on port ${PORT}`);
});
