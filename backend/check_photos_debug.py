from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv('.env')
client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

# Verificar fotos com problemas
fotos = list(db.photos.find({}, {"employee_name": 1, "image_base64": 1, "timestamp": 1}))

print(f"\n=== Total de fotos: {len(fotos)} ===\n")

problemas = []
for foto in fotos:
    img_data = foto.get('image_base64', '')
    
    # Verificar se imagem está vazia ou muito pequena
    if not img_data or len(img_data) < 100:
        problemas.append({
            'funcionario': foto.get('employee_name'),
            'timestamp': foto.get('timestamp'),
            'tamanho': len(img_data) if img_data else 0
        })

if problemas:
    print(f"❌ Encontradas {len(problemas)} fotos com problemas:\n")
    for p in problemas[:10]:  # Mostrar apenas 10
        print(f"  - {p['funcionario']}: {p['timestamp']} (tamanho: {p['tamanho']} bytes)")
else:
    print("✅ Todas as fotos parecem OK!")

client.close()