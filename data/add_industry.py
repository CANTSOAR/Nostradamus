import csv, random

industries = ["Retail", "Tech", "Healthcare", "Finance", "Manufacturing", "Government"]

with open('data/organizations.csv', 'r') as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    fields = reader.fieldnames

with open('data/organizations.csv', 'w') as f:
    writer = csv.DictWriter(f, fieldnames=fields + ['industry'])
    writer.writeheader()
    for row in rows:
        row['industry'] = random.choice(industries)
        writer.writerow(row)
