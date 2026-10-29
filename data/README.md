# Data

`osm-arunachal-health.csv` — 44 hospitals and blood banks in Arunachal Pradesh, fetched on 2026-10-29 from the
OpenStreetMap Overpass API (query: `amenity=hospital`, `healthcare=hospital`, `healthcare=blood_bank`, with the
enclosing district looked up from OSM district boundaries).

© OpenStreetMap contributors, available under the [Open Database Licence (ODbL)](https://www.openstreetmap.org/copyright).
Keep this attribution if you reuse or redistribute the file.

It is real, crowd-sourced public data and may be incomplete or out of date: most rows have no phone number, so the
importer gives them the placeholder `+910000000000`, to be corrected by an administrator before verifying.

Load it (as pending facilities) with:

```bash
npm run import:directory -w server -- ../data/osm-arunachal-health.csv --dry-run
npm run import:directory -w server -- ../data/osm-arunachal-health.csv
```

No donor or patient data is ever imported: it is not public.
