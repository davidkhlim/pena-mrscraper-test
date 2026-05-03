const fs = require('fs');

/**
 * ================================
 * 1. CONFIG
 * ================================
 */
const INPUT_FILE = './missingRoutes.json';

const THRESHOLDS = {
  GPS_NOISE: 300,     // meters
  CLUSTERED: 2000     // meters
};

/**
 * ================================
 * 2. HAVERSINE DISTANCE
 * ================================
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * ================================
 * 3. ROUTE DISTANCE (IMPORTANT)
 * ================================
 * Treat pickup + destination as ONE package
 */
function computeRouteDistance(exp, act) {
  const pickupDist = haversine(
    exp.pickup[0], exp.pickup[1],
    act.pickup[0], act.pickup[1]
  );

  const destDist = haversine(
    exp.destination[0], exp.destination[1],
    act.destination[0], act.destination[1]
  );

  return {
    pickupDist,
    destDist,
    totalDist: pickupDist + destDist
  };
}

/**
 * ================================
 * 4. CLASSIFICATION (ROUTE-LEVEL)
 * ================================
 */
function classifyRoute(totalDistance) {
  if (totalDistance <= THRESHOLDS.GPS_NOISE) return 'gps_noise';
  if (totalDistance <= THRESHOLDS.CLUSTERED) return 'clustered';
  return 'invalid';
}

/**
 * ================================
 * 5. LOAD DATA
 * ================================
 */
const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
const routes = raw.missingRoutes || [];

/**
 * ================================
 * 6. PROCESS
 * ================================
 */
const results = routes.map(item => {
  if (!item.actual) {
    return {
      row: item.row,
      error: 'no_actual_data'
    };
  }

  const { pickupDist, destDist, totalDist } = computeRouteDistance(
    item.expected,
    item.actual
  );

  return {
    row: item.row,
    pickup_name: item.pickup_name,
    closest_json_file: item.closest_json_file,

    pickup_distance_m: Math.round(pickupDist),
    destination_distance_m: Math.round(destDist),
    total_route_distance_m: Math.round(totalDist),

    route_class: classifyRoute(totalDist),

    reasons: item.reasons
  };
});

/**
 * ================================
 * 7. SUMMARY (ROUTE-LEVEL)
 * ================================
 */
const summary = {
  gps_noise: 0,
  clustered: 0,
  invalid: 0
};

results.forEach(r => {
  if (r.route_class) {
    summary[r.route_class]++;
  }
});

/**
 * ================================
 * 8. OUTPUT
 * ================================
 */
console.log('====================================');
console.log('Route-Level Distance Analysis');
console.log('====================================');

console.log(JSON.stringify(results, null, 2));

console.log('\nRoute Classification Summary:');
console.log(summary);

/**
 * ================================
 * 9. WRITE TO FILE
 * ================================
 */
const data = {
  results,
  summary
};

const jsonData = JSON.stringify(data, null, 2);

fs.writeFile('missingRoutesAnalysed.json', jsonData, (err) => {
  if (err) {
    console.error('Error writing file:', err);
  } else {
    console.log("Exported to missingRoutes.json successfully.");
  }
});