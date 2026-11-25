const { sessions } = require('../state');
const { normalizeAddress } = require('../network');

function findSession(request, response) {
  const { code } = request.query;
  if (!code) {
    response.status(400).json({ error: 'Missing code' });
    return null;
  }

  const session = sessions.get(code.toUpperCase());
  if (!session) {
    response.status(404).json({ error: 'Session not found' });
    return null;
  }
  return session;
}

function registerSessionDataRoutes(app) {
  app.get('/api/pair/:code', (request, response) => {
    const session = sessions.get(request.params.code?.toUpperCase());
    if (!session) {
      response.json({ success: false, message: 'Euroscope plugin not found for this code.' });
      return;
    }

    session.lastActivity = Date.now();
    response.json({ success: true, message: 'Paired', controller: session.controller });
  });

  app.get('/api/discover', (request, response) => {
    const requester = normalizeAddress(request.socket.remoteAddress);
    const found = [];
    sessions.forEach((session, code) => {
      if (session.ws && session.address === requester) {
        found.push({ code, controller: session.controller });
      }
    });
    response.json(found);
  });

  app.get('/api/assumed', (request, response) => {
    const session = findSession(request, response);
    if (session) response.json(Array.from(session.aircraft.values()));
  });

  app.get('/api/ATC-list', (request, response) => {
    const session = findSession(request, response);
    if (session) response.json(session.atcList);
  });

  app.get('/api/point-time', (request, response) => {
    const { code, callsign, points } = request.query;
    if (!code) {
      response.status(400).send('Missing Link Code');
      return;
    }

    const session = sessions.get(code.toUpperCase());
    const aircraft = session && session.aircraft.get(callsign);
    if (!aircraft) {
      response.json([]);
      return;
    }

    const requestedNames = points ? points.split(',').map((name) => name.toUpperCase()) : [];
    const allPoints = [
      ...(aircraft.routePoints || []),
      ...(aircraft.arrivalPoints || []),
      ...(aircraft.departurePoints || []),
    ];
    response.json(
      allPoints.filter(
        (point) => requestedNames.length === 0 || requestedNames.includes((point.name || '').toUpperCase()),
      ),
    );
  });
}

module.exports = { registerSessionDataRoutes };
