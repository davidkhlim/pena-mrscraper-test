const fs = require('fs');
const path = require('path');

/**
 * ================================
 * 1. PATH CONFIGURATION
 * ================================
 * Define base directory and file locations.
 * Using path.join ensures compatibility across OS (Windows/macOS/Linux).
 */
const baseDir = './Technical PM Interview challenge';
const csvPath = path.join(baseDir, 'PUDO list.csv');
const jsonDir = path.join(baseDir, 'MRSCRAPER RESULTS');

/**
 * ================================
 * 2. MATCHING CONFIGURATION
 * ================================
 * Coordinate comparisons require tolerance due to:
 * - floating point precision differences
 * - CSV rounding vs JSON high precision
 */
const TOLERANCE = 0.001;

/**
 * ================================
 * 3. HELPER FUNCTIONS
 * ================================
 */

/**
 * Convert string numbers into floats
 * Handles decimal commas (e.g., "-8,742399")
 */
function toNum(val) {
  if (!val) return NaN;
  return parseFloat(val.replace(',', '.'));
}

/**
 * Compare two coordinates within tolerance
 */
function isClose(a, b) {
  return Math.abs(a - b) <= TOLERANCE;
}

/**
 * ================================
 * 4. ROOT CAUSE ANALYSIS FUNCTION
 * ================================
 * For unmatched routes:
 * - Find closest JSON candidate
 * - Identify which fields mismatch
 */
function getMismatchDetails(row, jsonList) {
  const pickupLat = toNum(row.pickup_location_latitude);
  const pickupLng = toNum(row.pickup_location_longitude);
  const destLat = toNum(row.latitude_end);
  const destLng = toNum(row.longitude_end);

  let closest = null;
  let minDiff = Infinity;

  // Find closest pickup match
  jsonList.forEach(j => {
    const diff =
      2 * (Math.abs(j.booking_destination_latitude - destLat) +
        Math.abs(j.booking_destination_longitude - destLng)) +
      (Math.abs(j.booking_pickup_latitude - pickupLat) +
        Math.abs(j.booking_pickup_longitude - pickupLng));

    if (diff < minDiff) {
      minDiff = diff;
      closest = j;
    }
  });

  if (!closest) {
    return {
      reasons: ['no_data'],
      closest: null
    };
  }

  const issues = [];

  if (closest.service_area_name !== row.service_area_name) {
    issues.push('service_area_name');
  }

  if (closest.regency_name !== row.regency_name) {
    issues.push('regency_name');
  }

  if (closest.booking_pickup_name !== row.booking_pickup_name) {
    issues.push('pickup_name');
  }

  if (
    !isClose(closest.booking_pickup_latitude, pickupLat) ||
    !isClose(closest.booking_pickup_longitude, pickupLng)
  ) {
    issues.push('pickup_coordinate');
  }

  if (
    !isClose(closest.booking_destination_latitude, destLat) ||
    !isClose(closest.booking_destination_longitude, destLng)
  ) {
    issues.push('destination_coordinate');
  }

  return {
    reasons: issues.length ? issues : ['unknown'],
    closest
  };
}

/**
 * ================================
 * 5. LOAD AND PARSE CSV
 * ================================
 * Notes:
 * - File is semicolon-separated
 * - Handles BOM + Windows line endings
 */
const raw = fs.readFileSync(csvPath, 'utf-8')
  .replace(/^\uFEFF/, '')
  .replace(/\r/g, '');

const lines = raw.trim().split('\n');
const delimiter = ';';

const headers = lines[0]
  .split(delimiter)
  .map(h => h.trim())
  .filter(h => h !== '');

const rows = lines.slice(1).map(line => {
  const values = line.split(delimiter);

  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = values[i]?.trim();
  });

  return obj;
});

/**
 * ================================
 * 6. LOAD JSON DATA
 * ================================
 */
const jsonFiles = fs.readdirSync(jsonDir)
  .filter(f => f.endsWith('.json'));

const jsonList = jsonFiles.map(file => {
  const data = JSON.parse(
    fs.readFileSync(path.join(jsonDir, file), 'utf-8')
  );

  return {
    ...data,
    __file: file // attach filename for RCA
  };
});

/**
 * ================================
 * 7. MATCH ROUTES + DIAGNOSIS
 * ================================
 */
const missingRoutes = [];

rows.forEach((row, index) => {
  const pickupLat = toNum(row.pickup_location_latitude);
  const pickupLng = toNum(row.pickup_location_longitude);
  const destLat = toNum(row.latitude_end);
  const destLng = toNum(row.longitude_end);

  const match = jsonList.find(j =>
    j.service_area_name === row.service_area_name &&
    j.regency_name === row.regency_name &&
    j.booking_pickup_name === row.booking_pickup_name &&

    isClose(j.booking_pickup_latitude, pickupLat) &&
    isClose(j.booking_pickup_longitude, pickupLng) &&
    isClose(j.booking_destination_latitude, destLat) &&
    isClose(j.booking_destination_longitude, destLng)
  );

  if (!match) {
    const { reasons, closest } = getMismatchDetails(row, jsonList);

    missingRoutes.push({
      row: index + 1,
      service_area: row.service_area_name,
      regency: row.regency_name,
      pickup_name: row.booking_pickup_name,

      reasons,

      // 🔍 RCA fields
      closest_json_file: closest?.__file || null,

      expected: {
        pickup: [pickupLat, pickupLng],
        destination: [destLat, destLng]
      },

      actual: closest
        ? {
          pickup: [
            closest.booking_pickup_latitude,
            closest.booking_pickup_longitude
          ],
          destination: [
            closest.booking_destination_latitude,
            closest.booking_destination_longitude
          ],
          regency: closest.regency_name,
          pickup_name: closest.booking_pickup_name
        }
        : null
    });
  }
});

/**
 * ================================
 * 8. OUTPUT RESULTS
 * ================================
 */
console.log('====================================');
console.log(`Total routes: ${rows.length}`);
console.log(`Missing routes: ${missingRoutes.length}`);
console.log('====================================');

/**
 * Coverage metric
 */
const coverage = (
  (rows.length - missingRoutes.length) / rows.length * 100
).toFixed(2);

console.log(`Coverage: ${coverage}%`);

/**
 * Detailed missing routes
 */
console.log('\nDetailed Missing Routes:');
console.log(JSON.stringify(missingRoutes, null, 2));

/**
 * ================================
 * 9. SUMMARY BREAKDOWN (ROUTE-LEVEL)
 * ================================
 * We distinguish between:
 * - pickup only mismatch
 * - destination only mismatch
 * - both mismatched
 */
const summary = {
  pickup_coordinate: 0,
  destination_coordinate: 0
};

const routeSummary = {
  total_mismatched_routes: missingRoutes.length,
  pickup_only: 0,
  destination_only: 0,
  both: 0
};

missingRoutes.forEach(r => {
  const hasPickup = r.reasons.includes('pickup_coordinate');
  const hasDestination = r.reasons.includes('destination_coordinate');

  // Field-level counts (keep your original)
  if (hasPickup) summary.pickup_coordinate++;
  if (hasDestination) summary.destination_coordinate++;

  // Route-level classification
  if (hasPickup && hasDestination) {
    routeSummary.both++;
  } else if (hasPickup) {
    routeSummary.pickup_only++;
  } else if (hasDestination) {
    routeSummary.destination_only++;
  }
});

console.log('\nMismatch Breakdown (Field-Level):');
console.log(summary);

console.log('\nRoute-Level Breakdown:');
console.log(routeSummary);

/**
 * ================================
 * 10. WRITE TO FILE
 * ================================
 */
const data = {
  missingRoutes,
  fieldSummary: summary,
  routeSummary
};

const jsonData = JSON.stringify(data, null, 2);

fs.writeFile('missingRoutes.json', jsonData, (err) => {
  if (err) {
    console.error('Error writing file:', err);
  } else {
    console.log("Exported to missingRoutes.json successfully.");
  }
});