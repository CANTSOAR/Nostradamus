#!/usr/bin/env python3
"""
Build organizations.csv from NJ raw data.

Sources:
- nj_businesses.csv (OSM) → unique business names with types
- industrial_sector_totals.csv → establishment counts per sector/county/town
- industrial_sector_total_wages.csv → total wages per sector/county/town

Output schema: id,name,value,avg_revenue,avg_bills,industry
"""
import csv
import os
from collections import defaultdict

RAW_DIR = os.path.join(os.path.dirname(__file__), '..', 'raw')
OUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'clean', 'organizations.csv')

# Map OSM type → simulation industry classification
OSM_TYPE_TO_INDUSTRY = {
    # Retail / Store
    'convenience': 'Retail', 'supermarket': 'Retail', 'clothes': 'Retail',
    'variety_store': 'Retail', 'shoes': 'Retail', 'jewelry': 'Retail',
    'alcohol': 'Retail', 'bakery': 'Retail', 'butcher': 'Retail',
    'greengrocer': 'Retail', 'florist': 'Retail', 'gift': 'Retail',
    'stationery': 'Retail', 'bookshop': 'Retail', 'toys': 'Retail',
    'pet': 'Retail', 'electronics': 'Retail', 'hardware': 'Retail',
    'furniture': 'Retail', 'garden_centre': 'Retail', 'deli': 'Retail',
    'department_store': 'Retail', 'mall': 'Retail', 'marketplace': 'Retail',
    'sports': 'Retail', 'outdoor': 'Retail', 'kiosk': 'Retail',
    'tobacco': 'Retail', 'confectionery': 'Retail', 'newsagent': 'Retail',
    'beauty': 'Retail', 'cosmetics': 'Retail', 'perfumery': 'Retail',
    'doityourself': 'Retail', 'tyres': 'Retail', 'bicycle': 'Retail',
    'car': 'Retail', 'car_parts': 'Retail', 'car_repair': 'Retail',
    'motorcycle': 'Retail', 'mobile_phone': 'Retail', 'computer': 'Retail',
    'hifi': 'Retail', 'video_games': 'Retail', 'musical_instrument': 'Retail',
    'photo': 'Retail', 'optician': 'Retail', 'art': 'Retail',
    'fabric': 'Retail', 'second_hand': 'Retail', 'antiques': 'Retail',
    'charity': 'Retail', 'wine': 'Retail', 'cheese': 'Retail',
    'seafood': 'Retail', 'tea': 'Retail', 'coffee': 'Retail',
    'pastry': 'Retail', 'chocolate': 'Retail', 'ice_cream': 'Retail',
    'copyshop': 'Retail', 'dry_cleaning': 'Retail', 'laundry': 'Retail',
    
    # Food / Hospitality
    'restaurant': 'Accommodations/Food', 'fast_food': 'Accommodations/Food',
    'cafe': 'Accommodations/Food', 'bar': 'Accommodations/Food',
    'pub': 'Accommodations/Food', 'food_court': 'Accommodations/Food',
    'biergarten': 'Accommodations/Food', 'nightclub': 'Accommodations/Food',
    'hotel': 'Accommodations/Food', 'motel': 'Accommodations/Food',
    'hostel': 'Accommodations/Food', 'guest_house': 'Accommodations/Food',
    
    # Healthcare
    'pharmacy': 'Health/Social', 'hospital': 'Health/Social',
    'doctors': 'Health/Social', 'dentist': 'Health/Social',
    'clinic': 'Health/Social', 'veterinary': 'Health/Social',
    'nursing_home': 'Health/Social', 'social_facility': 'Health/Social',
    
    # Education
    'school': 'Education', 'university': 'Education',
    'college': 'Education', 'kindergarten': 'Education',
    'library': 'Education', 'language_school': 'Education',
    'music_school': 'Education', 'driving_school': 'Education',
    
    # Finance
    'bank': 'Finance/Insurance', 'atm': 'Finance/Insurance',
    'bureau_de_change': 'Finance/Insurance', 'insurance': 'Finance/Insurance',
    'financial': 'Finance/Insurance', 'accountant': 'Finance/Insurance',
    
    # Government / Public
    'townhall': 'Government', 'post_office': 'Government',
    'police': 'Government', 'fire_station': 'Government',
    'courthouse': 'Government', 'prison': 'Government',
    'community_centre': 'Government', 'public_building': 'Government',
    
    # Professional / Office
    'office': 'Professional/Technical', 'lawyer': 'Professional/Technical',
    'estate_agent': 'Real Estate', 'company': 'Professional/Technical',
    'it': 'Professional/Technical', 'architect': 'Professional/Technical',
    'engineer': 'Professional/Technical', 'consulting': 'Professional/Technical',
    
    # Other
    'fuel': 'Retail', 'place_of_worship': 'Other Services',
    'cinema': 'Arts/Entertainment', 'theatre': 'Arts/Entertainment',
    'gym': 'Arts/Entertainment', 'sports_centre': 'Arts/Entertainment',
    'swimming_pool': 'Arts/Entertainment', 'pitch': 'Arts/Entertainment',
    'playground': 'Arts/Entertainment', 'park': 'Arts/Entertainment',
    'hairdresser': 'Other Services', 'tattoo': 'Other Services',
    'funeral_directors': 'Other Services', 'storage_rental': 'Other Services',
    'travel_agency': 'Other Services', 'money_transfer': 'Finance/Insurance',
}

# Map simulation industry → sector wage data column name
INDUSTRY_TO_WAGE_COL = {
    'Retail': 'Retail Trade',
    'Accommodations/Food': 'Accomodations/Food',
    'Health/Social': 'Health/Social',
    'Education': 'Education',
    'Finance/Insurance': 'Finance/Insurance',
    'Government': 'LOCAL GOVT TOTALS',
    'Professional/Technical': 'Professional/Technical',
    'Real Estate': 'Real Estate',
    'Arts/Entertainment': 'Arts/Entertainment',
    'Other Services': 'Other Services',
    'Manufacturing': 'Manufacturing',
    'Construction': 'Construction',
    'Information': 'Information',
}


def load_sector_revenue_estimates():
    """
    Compute avg revenue per establishment per sector (statewide, latest year).
    Revenue ≈ total_wages / num_establishments * 2.5 
    (wages are ~40% of revenue for most businesses)
    """
    # Load totals (establishment counts)
    totals_file = os.path.join(RAW_DIR, 'industrial_sector_totals.csv')
    wages_file = os.path.join(RAW_DIR, 'industrial_sector_total_wages.csv')
    
    # Aggregate statewide for 2023 (latest)
    sector_establishments = defaultdict(float)
    with open(totals_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['YEAR'] != '2023':
                continue
            for col in INDUSTRY_TO_WAGE_COL.values():
                val = row.get(col, '').strip()
                if val and val != '':
                    try:
                        sector_establishments[col] += float(val)
                    except ValueError:
                        pass
    
    sector_total_wages = defaultdict(float)
    with open(wages_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['YEAR'] != '2023':
                continue
            for col in INDUSTRY_TO_WAGE_COL.values():
                val = row.get(col, '').strip()
                if val and val != '':
                    try:
                        sector_total_wages[col] += float(val)
                    except ValueError:
                        pass
    
    # Compute avg revenue per establishment
    sector_avg_revenue = {}
    for col in INDUSTRY_TO_WAGE_COL.values():
        est = sector_establishments.get(col, 0)
        wages = sector_total_wages.get(col, 0)
        if est > 0 and wages > 0:
            avg_wage_per_est = wages / est
            # Revenue ≈ wages / 0.4 (wages are ~40% of revenue)
            sector_avg_revenue[col] = avg_wage_per_est / 0.4
        else:
            sector_avg_revenue[col] = 200000  # Default fallback
    
    return sector_avg_revenue


def main():
    print("Loading sector revenue estimates...")
    sector_rev = load_sector_revenue_estimates()
    
    for col, rev in sorted(sector_rev.items(), key=lambda x: -x[1]):
        print(f"  {col}: ${rev:,.0f} avg revenue/establishment")
    
    print("\nLoading OSM businesses...")
    businesses_file = os.path.join(RAW_DIR, 'nj_businesses.csv')
    
    # Deduplicate by name (keep first occurrence)
    seen_names = {}
    org_id = 1
    orgs = []
    
    with open(businesses_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('name', '').strip()
            osm_type = row.get('type', '').strip()
            
            if not name:
                continue
            
            # Deduplicate: same name = same organization
            if name in seen_names:
                continue
            
            industry = OSM_TYPE_TO_INDUSTRY.get(osm_type, 'Other Services')
            wage_col = INDUSTRY_TO_WAGE_COL.get(industry, 'Other Services')
            avg_revenue = sector_rev.get(wage_col, 200000)
            
            # avg_bills ≈ 85% of revenue (15% margin)
            avg_bills = avg_revenue * 0.85
            
            # Org value ≈ 3x annual revenue (rough market cap multiplier)
            value = avg_revenue * 3.0
            
            seen_names[name] = org_id
            orgs.append({
                'id': org_id,
                'name': name,
                'value': round(value, 2),
                'avg_revenue': round(avg_revenue, 2),
                'avg_bills': round(avg_bills, 2),
                'industry': industry,
            })
            org_id += 1
    
    print(f"Found {len(orgs)} unique organizations")
    
    # Write output
    with open(OUT_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'name', 'value', 'avg_revenue', 'avg_bills', 'industry'])
        writer.writeheader()
        writer.writerows(orgs)
    
    print(f"Written {len(orgs)} organizations to {OUT_FILE}")
    
    # Also write the name→id mapping for the location builder
    mapping_file = os.path.join(os.path.dirname(__file__), 'org_name_to_id.json')
    import json
    with open(mapping_file, 'w') as f:
        json.dump(seen_names, f)
    print(f"Saved org name→id mapping to {mapping_file}")

if __name__ == '__main__':
    main()
