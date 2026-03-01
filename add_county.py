import csv
import random

counties = ["Bergen", "Hudson", "Essex", "Union", "Middlesex", "Monmouth", "Ocean", "Mercer", "Burlington", "Camden", "Gloucester", "Atlantic", "Cape May", "Salem", "Cumberland", "Hunterdon", "Somerset", "Morris", "Passaic", "Sussex", "Warren"]

with open('data/locations.csv', 'r') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

with open('data/locations.csv', 'w') as f:
    writer = csv.DictWriter(f, fieldnames=reader.fieldnames + ['county'])
    writer.writeheader()
    for row in rows:
        row['county'] = random.choice(counties)
        writer.writerow(row)
