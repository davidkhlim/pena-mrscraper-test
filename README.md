# PUDO Matching & MrScraper Analysis

This project analyzes mismatches between expected pickup–dropoff coordinate pairs and scraped results from MrScraper.

It identifies:

* Missing routes
* Root causes of mismatches
* Distance-based deviations (GPS vs clustering vs actual issues)

---

## 📁 Project Structure

```
.
├── src/
│   ├── process-data.js        # Match CSV vs JSON, generate missing routes
│   └── analyze-mismatch.js    # Compute distance + classify mismatches
├── Technical PM Interview challenge/
│   ├── PUDO list.csv
│   └── MRSCRAPER RESULTS/
├── missingRoutes.json
├── missingRoutesAnalysed.json
├── package.json
└── README.md
```

---

## ⚙️ Setup

No external dependencies required.

```bash
npm install
```

---

## 🚀 Usage

### 1. Process Data (Matching)

Compares CSV routes against scraped JSON results and identifies missing routes.

```bash
npm run process
```

**Output:**

* `missingRoutes.json`

Contains:

* unmatched routes
* closest matched JSON
* mismatch reasons (pickup / destination / metadata)

---

### 2. Analyze Mismatches (Distance + RCA)

Computes distance differences and classifies mismatch severity.

```bash
npm run analyze
```

**Output:**

* `missingRoutesAnalysed.json`

---

## 📊 Key Concepts

### Route Matching

A route is defined as:

```
Pickup (lat, lng) → Destination (lat, lng)
```

Matching requires:

* same service area
* same regency
* same pickup name
* coordinates within tolerance (`0.001 ≈ 100m`)

---

### Distance Metrics

| Field                                  | Description                                        |
| -------------------------------------- | -------------------------------------------------- |
| `pickup_distance_m`                    | Difference between expected and actual pickup      |
| `destination_distance_m`               | Difference between expected and actual destination |
| `total_route_distance_m`               | Combined deviation (pickup + destination)          |
| `max_endpoint_distance_m` *(optional)* | Largest endpoint deviation                         |

> Note: These are **error distances**, not actual travel distances.

---

### Classification

Routes are classified based on total deviation:

| Distance | Classification | Meaning                                    |
| -------- | -------------- | ------------------------------------------ |
| ≤ 300m   | `gps_noise`    | Normal GPS / rounding differences          |
| ≤ 2km    | `clustered`    | Likely S2 cell snapping / backend grouping |
| > 2km    | `invalid`      | Significant mismatch / possible data issue |

---

## 📌 Output Example

```json
{
  "row": 11,
  "pickup_name": "Ngurah Rai International Airport - DPS",
  "pickup_distance_m": 280,
  "destination_distance_m": 2500,
  "total_route_distance_m": 2780,
  "route_class": "invalid",
  "closest_json_file": "12_00_15_35.json"
}
```

---

## 🧠 Insights & Findings

* Not all "missing routes" are true failures
* Many mismatches are caused by:

  * GPS precision differences
  * S2 cell clustering
* Only large deviations (>2km) indicate real issues

---

## 🎯 Key Takeaways

* Route matching must consider **both pickup and destination together**
* Coordinate tolerance alone is insufficient for analysis
* Distance-based classification provides clearer root cause insights

---

## 🛠 Scripts

```json
"scripts": {
  "process": "node src/process-data.js",
  "analyze": "node src/analyze-mismatch.js"
}
```

---

## 📎 Notes

* CSV uses semicolon (`;`) delimiter
* Coordinates may use comma decimal format (e.g. `-8,742399`)
* JSON data uses higher precision floats

---

## 📬 Repository

GitHub: https://github.com/davidkhlim/pena-mrscraper-test

---

## 📄 License

ISC
