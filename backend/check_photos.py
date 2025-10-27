from pymongo import MongoClient
import os
from dotenv import load_dotenv
from collections import Counter

load_dotenv('.env')
client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

# Ver total de fotos
total = db.photos.count_documents({})
print(f"\n=== TOTAL DE FOTOS NO BANCO: {total} ===\n")

# Ver quantas fotos por funcionário
fotos = list(db.photos.find({}, {"employee_name": 1}))
counter = Counter([f['employee_name'] for f in fotos])

print("=== FOTOS POR FUNCIONÁRIO ===")
for nome, qtd in sorted(counter.items()):
    print(f"{nome}: {qtd} fotos")

client.close()