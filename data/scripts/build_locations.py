#!/usr/bin/env python3
"""
Build locations.csv from NJ raw data.

Sources:
- NJ_Property_Taxes_2024.csv → residential locations (2.7M rows)
- nj_businesses.csv (OSM)    → store/employer locations (80K rows)
- nj_town_centroids.json     → municipality centroid coordinates (for geocoding)
- org_name_to_id.json        → organization ID mapping

Output schema: lat,lon,org_id,type,name,value,tax,county
"""
import csv
import json
import os
import random

RAW_DIR = os.path.join(os.path.dirname(__file__), '..', 'raw')
SCRIPTS_DIR = os.path.dirname(__file__)
OUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'clean', 'locations.csv')

# OSM type → simulation LocationType
OSM_TYPE_TO_LOC_TYPE = {
    # Stores
    'convenience': 'Store', 'supermarket': 'Store', 'clothes': 'Store',
    'variety_store': 'Store', 'shoes': 'Store', 'jewelry': 'Store',
    'alcohol': 'Store', 'bakery': 'Store', 'butcher': 'Store',
    'greengrocer': 'Store', 'florist': 'Store', 'gift': 'Store',
    'stationery': 'Store', 'bookshop': 'Store', 'toys': 'Store',
    'pet': 'Store', 'electronics': 'Store', 'hardware': 'Store',
    'furniture': 'Store', 'garden_centre': 'Store', 'deli': 'Store',
    'department_store': 'Store', 'mall': 'Store', 'marketplace': 'Store',
    'sports': 'Store', 'outdoor': 'Store', 'kiosk': 'Store',
    'tobacco': 'Store', 'confectionery': 'Store', 'newsagent': 'Store',
    'beauty': 'Store', 'cosmetics': 'Store', 'perfumery': 'Store',
    'doityourself': 'Store', 'tyres': 'Store', 'bicycle': 'Store',
    'car': 'Store', 'car_parts': 'Store', 'car_repair': 'Store',
    'motorcycle': 'Store', 'mobile_phone': 'Store', 'computer': 'Store',
    'hifi': 'Store', 'video_games': 'Store', 'musical_instrument': 'Store',
    'photo': 'Store', 'optician': 'Store', 'art': 'Store',
    'fabric': 'Store', 'second_hand': 'Store', 'antiques': 'Store',
    'charity': 'Store', 'wine': 'Store', 'cheese': 'Store',
    'seafood': 'Store', 'tea': 'Store', 'coffee': 'Store',
    'pastry': 'Store', 'chocolate': 'Store', 'ice_cream': 'Store',
    'copyshop': 'Store', 'dry_cleaning': 'Store', 'laundry': 'Store',
    'fuel': 'Store', 'hairdresser': 'Store', 'tattoo': 'Store',
    'restaurant': 'Store', 'fast_food': 'Store', 'cafe': 'Store',
    'bar': 'Store', 'pub': 'Store', 'food_court': 'Store',
    'biergarten': 'Store', 'nightclub': 'Store',
    'pharmacy': 'Store',
    
    # Employers (workplaces where people go to work)
    'school': 'Employer', 'university': 'Employer', 'college': 'Employer',
    'kindergarten': 'Employer', 'library': 'Employer',
    'hospital': 'Employer', 'doctors': 'Employer', 'dentist': 'Employer',
    'clinic': 'Employer', 'veterinary': 'Employer', 'nursing_home': 'Employer',
    'bank': 'Employer', 'insurance': 'Employer', 'financial': 'Employer',
    'accountant': 'Employer', 'office': 'Employer', 'lawyer': 'Employer',
    'estate_agent': 'Employer', 'company': 'Employer',
    'townhall': 'Employer', 'post_office': 'Employer',
    'police': 'Employer', 'fire_station': 'Employer',
    'courthouse': 'Employer', 'prison': 'Employer',
    'community_centre': 'Employer', 'hotel': 'Employer', 'motel': 'Employer',
    
    # Public  
    'place_of_worship': 'Public', 'cinema': 'Public', 'theatre': 'Public',
    'gym': 'Public', 'sports_centre': 'Public', 'swimming_pool': 'Public',
    'playground': 'Public', 'park': 'Public', 'social_facility': 'Public',
}


def load_town_centroids():
    """Load cached municipality centroids from JSON."""
    cache_file = os.path.join(SCRIPTS_DIR, 'nj_town_centroids.json')
    if os.path.exists(cache_file):
        with open(cache_file, 'r') as f:
            return json.load(f)
    return {}

def load_org_mapping():
    """Load org name → id mapping."""
    mapping_file = os.path.join(SCRIPTS_DIR, 'org_name_to_id.json')
    if os.path.exists(mapping_file):
        with open(mapping_file, 'r') as f:
            return json.load(f)
    return {}


def compute_county_median_values():
    """Compute median property value per county for business value estimation."""
    from collections import defaultdict
    
    county_values = defaultdict(list)
    tax_file = os.path.join(RAW_DIR, 'NJ_Property_Taxes_2024.csv')
    
    print("Computing county median property values (sampling 1 in 100)...")
    with open(tax_file, 'r') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            # Sample 1% for speed
            if i % 100 != 0:
                continue
            county = row['COUNTY'].strip()
            try:
                val = float(row['NET_VALUE'])
                if val > 0:
                    county_values[county].append(val)
            except (ValueError, KeyError):
                pass
    
    medians = {}
    for county, values in county_values.items():
        values.sort()
        medians[county] = values[len(values) // 2]
    
    for c, v in sorted(medians.items()):
        print(f"  {c}: ${v:,.0f}")
    
    return medians


def build_residential_locations(writer, centroids, county_medians):
    """Process 2.7M property tax records into residential locations."""
    tax_file = os.path.join(RAW_DIR, 'NJ_Property_Taxes_2024.csv')
    
    written = 0
    skipped = 0
    
    with open(tax_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            county = row['COUNTY'].strip()
            mun = row['MUN_NAME'].strip()
            address = row['PROP_LOC'].strip()
            
            try:
                value = float(row['NET_VALUE'])
                tax = float(row['TAX_2024'])
            except (ValueError, KeyError):
                skipped += 1
                continue
            
            if value <= 0:
                skipped += 1
                continue
            
            # Look up municipality centroid
            key = f"{county}|{mun}"
            centroid = centroids.get(key)
            
            if not centroid or centroid.get('lat') is None:
                skipped += 1
                continue
            
            # Add random jitter: ±0.005° ≈ ±500m
            lat = centroid['lat'] + random.uniform(-0.005, 0.005)
            lon = centroid['lon'] + random.uniform(-0.005, 0.005)
            
            writer.writerow({
                'lat': round(lat, 6),
                'lon': round(lon, 6),
                'org_id': '',
                'type': 'Residential',
                'name': address,
                'value': round(value, 2),
                'tax': round(tax, 2),
                'county': county,
            })
            written += 1
            
            if written % 100000 == 0:
                print(f"  Residential: {written:,} written, {skipped:,} skipped")
    
    print(f"  Residential DONE: {written:,} written, {skipped:,} skipped")
    return written


def build_business_locations(writer, org_mapping, county_medians):
    """Process 80K OSM businesses into store/employer locations."""
    businesses_file = os.path.join(RAW_DIR, 'nj_businesses.csv')
    
    written = 0
    skipped = 0

    with open(businesses_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('name', '').strip()
            osm_type = row.get('type', '').strip()
            
            try:
                lat = float(row.get('latitude', 0))
                lon = float(row.get('longitude', 0))
            except (ValueError, KeyError):
                skipped += 1
                continue
            
            if lat == 0 or lon == 0:
                skipped += 1
                continue
            
            # Determine location type
            loc_type = OSM_TYPE_TO_LOC_TYPE.get(osm_type, 'Mixed')
            
            # Get org_id from name mapping
            org_id = org_mapping.get(name, '')
            
            # Determine county from lat/lon (rough NJ county boundaries)
            county = lat_lon_to_county(lat, lon)
            
            # Value: use county median property value as estimate
            value = county_medians.get(county, 250000)
            
            # Estimate tax from value using average NJ tax rate (~2.5%)
            tax = value * 0.025
            
            if not name:
                name = f"{osm_type}_{written}"
            
            writer.writerow({
                'lat': round(lat, 6),
                'lon': round(lon, 6),
                'org_id': org_id,
                'type': loc_type,
                'name': name,
                'value': round(value, 2),
                'tax': round(tax, 2),
                'county': county,
            })
            written += 1
    
    print(f"  Businesses DONE: {written:,} written, {skipped:,} skipped")
    return written


def lat_lon_to_county(lat, lon):
    """
    Rough lat/lon → NJ county mapping using bounding boxes.
    Not perfectly accurate but good enough for estimation.
    """
    # Sorted roughly south to north
    # These are approximate centroid-based assignments
    if lat < 39.3:
        if lon < -75.0: return 'SALEM'
        elif lon < -74.7: return 'CUMBERLAND'
        elif lon < -74.4: return 'CAPE MAY'
        else: return 'ATLANTIC'
    elif lat < 39.6:
        if lon < -75.2: return 'GLOUCESTER'
        elif lon < -75.0: return 'CAMDEN'
        elif lon < -74.6: return 'BURLINGTON'
        else: return 'OCEAN'
    elif lat < 39.9:
        if lon < -74.8: return 'BURLINGTON'
        elif lon < -74.4: return 'OCEAN'
        else: return 'MONMOUTH'
    elif lat < 40.2:
        if lon < -74.8: return 'MERCER'
        elif lon < -74.4: return 'MIDDLESEX'
        else: return 'MONMOUTH'
    elif lat < 40.5:
        if lon < -74.8: return 'SOMERSET'
        elif lon < -74.4: return 'MIDDLESEX'
        elif lon < -74.1: return 'UNION'
        else: return 'HUDSON'
    elif lat < 40.7:
        if lon < -74.7: return 'MORRIS'
        elif lon < -74.4: return 'ESSEX'
        elif lon < -74.1: return 'HUDSON'
        else: return 'BERGEN'
    elif lat < 40.9:
        if lon < -74.6: return 'MORRIS'
        elif lon < -74.3: return 'PASSAIC'
        else: return 'BERGEN'
    elif lat < 41.0:
        if lon < -74.8: return 'WARREN'
        elif lon < -74.5: return 'SUSSEX'
        else: return 'PASSAIC'
    else:
        if lon < -74.8: return 'WARREN'
        elif lon < -74.5: return 'SUSSEX'
        else: return 'PASSAIC'


def main():
    print("=" * 60)
    print("Building locations.csv from NJ raw data")
    print("=" * 60)
    
    # Load dependencies
    print("\nLoading municipality centroids...")
    centroids = load_town_centroids()
    if not centroids:
        print("ERROR: No centroids found! Run nj_town_coords.py first.")
        return
    print(f"  Loaded {len(centroids)} municipality centroids")
    
    print("\nLoading org name→id mapping...")
    org_mapping = load_org_mapping()
    if not org_mapping:
        print("WARNING: No org mapping found. Run build_organizations.py first.")
        print("  Continuing without org_id assignments.")
    else:
        print(f"  Loaded {len(org_mapping)} org mappings")
    
    # Compute county median values
    county_medians = compute_county_median_values()
    
    # Write output
    print(f"\nWriting locations to {OUT_FILE}...")
    with open(OUT_FILE, 'w', newline='') as f:
        fieldnames = ['lat', 'lon', 'org_id', 'type', 'name', 'value', 'tax', 'county']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        # Residential locations first (2.7M)
        print("\n--- Processing Residential Locations ---")
        res_count = build_residential_locations(writer, centroids, county_medians)
        
        # Business locations (80K)
        print("\n--- Processing Business Locations ---")
        biz_count = build_business_locations(writer, org_mapping, county_medians)
    
    total = res_count + biz_count
    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {total:,} locations written to {OUT_FILE}")
    print(f"  Residential: {res_count:,}")
    print(f"  Business:    {biz_count:,}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
