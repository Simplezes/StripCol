const { sessions } = require('./state');
const { getSectorAirports } = require('./sectors');

const BRIDGE_PREFIX = '@@RPC ';

const FACILITY_NAMES = {
  1: 'FSS',
  2: 'DEL',
  3: 'GND',
  4: 'TWR',
  5: 'APP',
  6: 'CTR',
};

const AERODROME_FACILITIES = [1, 2, 3, 4];

function emit(type, data) {
  process.stdout.write(`${BRIDGE_PREFIX}${JSON.stringify({ type, data })}\n`);
}

function classifyAircraft(aircraft, context) {
  const departure = (aircraft.departure || '').toUpperCase();
  const arrival = (aircraft.arrival || '').toUpperCase();

  if (context.isAerodrome) {
    if (departure === context.localIcao) return 'departure';
    if (arrival === context.localIcao) return 'arrival';
    return 'overfly';
  }

  if (context.sectorAirports.size > 0) {
    if (context.sectorAirports.has(departure)) return 'departure';
    if (context.sectorAirports.has(arrival)) return 'arrival';
  }
  return 'overfly';
}

function buildTrafficSummary(session, callsign, facility, positionId) {
  const icaoMatch = callsign.match(/^([A-Z]{3,4})/);
  const context = {
    localIcao: icaoMatch ? icaoMatch[1].toUpperCase() : '',
    isAerodrome: AERODROME_FACILITIES.includes(facility),
    sectorAirports: getSectorAirports(positionId),
  };

  const counts = { departure: 0, arrival: 0, overfly: 0 };
  session.aircraft.forEach((aircraft) => {
    counts[classifyAircraft(aircraft, context)] += 1;
  });
  return `${counts.departure} Dep / ${counts.arrival} Arr / ${counts.overfly} Ovr`;
}

function sendRpcUpdate(code) {
  const session = sessions.get(code);
  if (!session || !session.controller || !session.controller.callsign) {
    emit('rpc_clear');
    return;
  }

  const callsign = session.controller.callsign;
  const facility = parseInt(session.controller.facility);
  const positionId = session.controller.positionId || '';
  const facilityName = FACILITY_NAMES[facility] || 'ATC';

  const state = session.rpcManualState || buildTrafficSummary(session, callsign, facility, positionId);

  emit('rpc_update', {
    details: `Controlling ${facilityName} (${callsign})`,
    state,
    callsign,
  });
}

module.exports = { sendRpcUpdate };
