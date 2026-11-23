const sessions = new Map();

function broadcastToSession(code, message) {
  const session = sessions.get(code);
  if (!session || !session.clients) return;

  const type = message.type;
  const data = message.data || message;
  const serverSentEvent = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

  session.clients.forEach((clientResponse) => {
    try {
      clientResponse.write(serverSentEvent);
    } catch (error) {
      session.clients.delete(clientResponse);
    }
  });
}

module.exports = { sessions, broadcastToSession };
