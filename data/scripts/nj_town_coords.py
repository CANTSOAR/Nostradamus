#!/usr/bin/env python3
"""
Geocode NJ municipalities to lat/lon centroids using Nominatim.
Caches results to data/scripts/nj_town_centroids.json.
Only needs to run ONCE — subsequent scripts read the JSON cache.
"""
import csv
import json
import os
import time
import urllib.request
import urllib.parse

RAW_DIR = os.path.join(os.path.dirname(__file__), '..', 'raw')
CACHE_FILE = os.path.join(os.path.dirname(__file__), 'nj_town_centroids.json')

def extract_municipalities():
    """Extract unique (COUNTY, MUN_NAME) pairs from property tax data."""
    muns = set()
    tax_file = os.path.join(RAW_DIR, 'NJ_Property_Taxes_2024.csv')
    with open(tax_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            county = row['COUNTY'].strip()
            mun = row['MUN_NAME'].strip()
            if county and mun:
                muns.add((county, mun))
    return sorted(muns)

def geocode_nominatim(mun_name, county):
    """Query Nominatim for a municipality centroid."""
    # Clean up municipality name: remove TWP, BORO, CITY suffixes for better search
    clean_name = mun_name
    for suffix in [' TWP', ' BORO', ' CITY', ' TOWN', ' VILLAGE']:
        clean_name = clean_name.replace(suffix, '')
    clean_name = clean_name.strip()
    
    query = f"{clean_name}, {county.title()} County, New Jersey, USA"
    params = urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'limit': 1,
        'countrycodes': 'us',
    })
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    
    req = urllib.request.Request(url, headers={
        'User-Agent': 'NostradamusSimulation/1.0 (educational project)'
    })
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"  Error geocoding {query}: {e}")
    
    return None, None

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_cache(cache):
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)

def main():
    print("Extracting NJ municipalities from property tax data...")
    muns = extract_municipalities()
    print(f"Found {len(muns)} unique municipalities")
    
    cache = load_cache()
    geocoded = 0
    skipped = 0
    failed = 0
    
    for i, (county, mun) in enumerate(muns):
        key = f"{county}|{mun}"
        
        if key in cache and cache[key]['lat'] is not None:
            skipped += 1
            continue
        
        lat, lon = geocode_nominatim(mun, county)
        
        if lat is not None:
            cache[key] = {'county': county, 'mun': mun, 'lat': lat, 'lon': lon}
            geocoded += 1
            print(f"  [{i+1}/{len(muns)}] {mun}, {county} → ({lat:.4f}, {lon:.4f})")
        else:
            # Store failure so we can retry later
            cache[key] = {'county': county, 'mun': mun, 'lat': None, 'lon': None}
            failed += 1
            print(f"  [{i+1}/{len(muns)}] FAILED: {mun}, {county}")
        
        # Save after every 10 geocodes for crash recovery
        if (geocoded + failed) % 10 == 0:
            save_cache(cache)
        
        # Nominatim rate limit: 1 request per second
        time.sleep(1.1)
    
    save_cache(cache)
    
    # Fill in any failures with county-level fallbacks
    county_coords = {}
    for key, val in cache.items():
        if val['lat'] is not None:
            c = val['county']
            if c not in county_coords:
                county_coords[c] = []
            county_coords[c].append((val['lat'], val['lon']))
    
    # Compute county centroids
    county_centroids = {}
    for c, coords in county_coords.items():
        avg_lat = sum(x[0] for x in coords) / len(coords)
        avg_lon = sum(x[1] for x in coords) / len(coords)
        county_centroids[c] = (avg_lat, avg_lon)
    
    # Backfill failures
    for key, val in cache.items():
        if val['lat'] is None:
            c = val['county']
            if c in county_centroids:
                val['lat'] = county_centroids[c][0]
                val['lon'] = county_centroids[c][1]
                print(f"  Backfilled {val['mun']}, {c} with county centroid")
    
    save_cache(cache)
    
    print(f"\nDone! Geocoded: {geocoded}, Skipped (cached): {skipped}, Failed: {failed}")
    print(f"Cache saved to {CACHE_FILE}")

if __name__ == '__main__':
    main()
