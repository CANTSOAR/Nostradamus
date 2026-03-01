import os
import requests
import csv
import random
import osmium
from tqdm import tqdm

PBF_URL = "https://download.geofabrik.de/north-america/us/new-jersey-latest.osm.pbf"
PBF_FILE = "data/new-jersey-latest.osm.pbf"

def download_pbf():
    if os.path.exists(PBF_FILE):
        print(f"Using existing map file: {PBF_FILE}")
        return
        
    print(f"Downloading New Jersey map data from {PBF_URL}...")
    response = requests.get(PBF_URL, stream=True)
    response.raise_for_status()
    total_size = int(response.headers.get('content-length', 0))
    
    with open(PBF_FILE, 'wb') as file, tqdm(
        desc=PBF_FILE,
        total=total_size,
        unit='iB',
        unit_scale=True,
        unit_divisor=1024,
    ) as bar:
        for data in response.iter_content(chunk_size=1024):
            size = file.write(data)
            bar.update(size)

def map_osm_type_to_rust(tags):
    if "shop" in tags: return "Store"
    if "office" in tags: return "Employer"
    if "amenity" in tags and tags["amenity"] in ["school", "hospital", "townhall"]: return "Public"
    if "building" in tags and tags["building"] in ["residential", "house", "apartments"]: return "Residential"
    return "Mixed"

def determine_organization(name, loc_type):
    if not name: return "None"
    name_lower = name.lower()
    if any(franchise in name_lower for franchise in ["mcdonald", "dunkin", "starbucks", "subway", "wawa"]):
        return "Franchise"
    elif loc_type == "Public": return "Government"
    elif loc_type in ["Store", "Employer"]: return "Company"
    return "None"

class LocationHandler(osmium.SimpleHandler):
    def __init__(self):
        super(LocationHandler, self).__init__()
        self.locations = []
        self.organizations = {}
        self.org_id_counter = 1

    def process_element(self, tags, lat, lon):
        # We want anything that is a building, shop, office, or amenity
        if 'building' not in tags and 'shop' not in tags and 'office' not in tags and 'amenity' not in tags:
            return

        loc_type = map_osm_type_to_rust(tags)
        name = tags.get('name', "Unnamed")
        org_type = determine_organization(name, loc_type)
        org_id = ""

        if org_type != "None" and org_type != "Residential":
            org_key = name.strip().upper() 
            if org_key not in self.organizations:
                rev = round(random.uniform(50000, 5000000), 2)
                bills = round(rev * random.uniform(0.60, 0.95), 2) 
                
                self.organizations[org_key] = {
                    "id": self.org_id_counter,
                    "name": name,
                    "avg_revenue": rev,
                    "avg_bills": bills
                }
                self.org_id_counter += 1
            org_id = self.organizations[org_key]["id"]

        self.locations.append({
            "lat": lat,
            "lon": lon,
            "org_id": org_id,
            "type": loc_type,
            "name": name
        })

    def node(self, n):
        self.process_element(n.tags, n.location.lat, n.location.lon)

    def way(self, w):
        # Polygons/Ways make up 99% of normal houses and generic buildings
        if len(w.nodes) > 0:
            try:
                # We just use the first node's geometry as the anchor point
                loc = w.nodes[0].location
                self.process_element(w.tags, loc.lat, loc.lon)
            except osmium.InvalidLocationError:
                pass

def extract_data():
    download_pbf()
    print("Parsing PBF file for ALL buildings... (this uses ~2GB of RAM and takes 1-2 minutes)")
    handler = LocationHandler()
    # locations=True caches all node coordinates in memory so ways can reference them
    handler.apply_file(PBF_FILE, locations=True)
    
    return handler.locations, list(handler.organizations.values())

def save_csvs(locations, organizations):
    print(f"Extracted {len(locations)} map locations globally.")
    with open('data/locations.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['lat', 'lon', 'org_id', 'type', 'name'])
        writer.writeheader()
        writer.writerows(locations)
        
    print(f"Extracted {len(organizations)} master organizations.")
    with open('data/organizations.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'name', 'avg_revenue', 'avg_bills'])
        writer.writeheader()
        writer.writerows(organizations)
    print("Done! Global dataset generated in /data folder.")

if __name__ == "__main__":
    locs, orgs = extract_data()
    save_csvs(locs, orgs)
