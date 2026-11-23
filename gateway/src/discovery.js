const dgram = require('dgram');

const DISCOVERY_PORT = Number(process.env.STRIPCOL_DISCOVERY_PORT) || 3001;
const REQUEST = 'STRIPCOL_DISCOVER';
const REPLY = 'STRIPCOL_GATEWAY';

function startDiscoveryResponder(gatewayPort) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('message', (message, sender) => {
    if (message.toString().trim() !== REQUEST) return;
    socket.send(`${REPLY}:${gatewayPort}`, sender.port, sender.address);
  });

  socket.on('error', (error) => {
    console.error('Discovery responder error:', error.message);
    socket.close();
  });

  socket.bind(DISCOVERY_PORT, '0.0.0.0');
  return socket;
}

module.exports = { startDiscoveryResponder };
