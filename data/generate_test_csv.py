import csv
import random

# Approximate bounding box for NJ for visual spread
lat_min, lat_max = 38.8, 41.3
lon_min, lon_max = -75.6, -73.8

def generate_test_data():
    organizations = []
    # Generate 8 random organizations
    for i in range(1, 9):
        rev = round(random.uniform(50000, 500000), 2)
        bills = round(rev * random.uniform(0.60, 0.95), 2)
        organizations.append({
            "id": i,
            "name": f"Test Corp {i}",
            "avg_revenue": rev,
            "avg_bills": bills
        })
        
    locations = []
    # Generate 25 Businesses tied to those organizations
    for i in range(1, 26):
        org = random.choice(organizations)
        locations.append({
            "lat": random.uniform(lat_min, lat_max),
            "lon": random.uniform(lon_min, lon_max),
            "org_id": org["id"],
            "type": random.choice(["Store", "Employer"]),
            "name": f"Business {i} ({org['name']})"
        })
        
    # Generate 75 Homes with no organization
    for i in range(26, 101):
        locations.append({
            "lat": random.uniform(lat_min, lat_max),
            "lon": random.uniform(lon_min, lon_max),
            "org_id": "",
            "type": "Residential",
            "name": f"Home {i-25}"
        })
        
    print("Writing 8 organizations...")
    with open('data/organizations.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'name', 'avg_revenue', 'avg_bills'])
        writer.writeheader()
        writer.writerows(organizations)
        
    print("Writing 100 locations...")
    with open('data/locations.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['lat', 'lon', 'org_id', 'type', 'name'])
        writer.writeheader()
        writer.writerows(locations)
        
if __name__ == "__main__":
    generate_test_data()
    print("Test CSVs successfully built!")
