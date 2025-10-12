from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import bcrypt
import jwt
import os
from motor.motor_asyncio import AsyncIOMotorClient

JWT_SECRET = os.environ.get('JWT_SECRET', 'seu-segredo-jwt-mude-em-producao-12345')
JWT_ALGORITHM = 'HS256'
security = HTTPBearer()

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'lacre_monitor')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = 'employee'

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    role: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class PhotoSubmit(BaseModel):
    photo_type: str
    image_base64: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None

class Authorization(BaseModel):
    employee_id: str
    photo_type: str
    duration_hours: int = 24

class EmailAlertConfig(BaseModel):
    admin_email: str
    enabled: bool
    employee_alerts: Dict[str, Dict[str, bool]]

app = FastAPI(title='Lacre Monitor API')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

async def init_users():
    existing_admin = await db.users.find_one({'username': 'admin'})
    if existing_admin:
        return
    
    admin_pw = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode('utf-8')
    await db.users.insert_one({'id': str(uuid.uuid4()), 'username': 'admin', 'password': admin_pw, 'name': 'Administrador', 'role': 'admin'})
    
    employee_names = ['Posto Fagundao', 'Posto Glamour', 'Posto Gloria', 'Posto Laranjal', 'Posto Malvino', 'Posto Marclau', 'Posto Meia Noite', 'Posto ML', 'Posto Monteiro', 'Posto MR', 'Posto Pinheirinho', 'Posto Planeta', 'Posto Quintino', 'Posto Santa Cruz', 'Posto Santa Rosa', 'Posto Santissimo', 'Posto Serraria', 'Posto Souza', 'Posto Sul', 'Posto Vila Nova']
    
    for name in employee_names:
        emp_pw = bcrypt.hashpw(b'123456', bcrypt.gensalt()).decode('utf-8')
        username = name.lower().replace(' ', '_')
        await db.users.insert_one({'id': str(uuid.uuid4()), 'username': username, 'password': emp_pw, 'name': name, 'role': 'employee'})
    
    teste_pw = bcrypt.hashpw(b'teste', bcrypt.gensalt()).decode('utf-8')
    await db.users.insert_one({'id': str(uuid.uuid4()), 'username': 'teste', 'password': teste_pw, 'name': 'Usuário Teste', 'role': 'employee'})

@app.on_event('startup')
async def startup_event():
    await init_users()

def get_brazil_time():
    return datetime.now(ZoneInfo('America/Sao_Paulo'))

def convert_utc_to_brazil(utc_datetime):
    if utc_datetime.tzinfo is None:
        utc_datetime = utc_datetime.replace(tzinfo=ZoneInfo('UTC'))
    return utc_datetime.astimezone(ZoneInfo('America/Sao_Paulo'))

def create_token(user_id: str, username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=168)
    payload = {'user_id': user_id, 'username': username, 'role': role, 'exp': expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials):
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except:
        raise HTTPException(status_code=401, detail='Token inválido')

async def check_schedule_window(photo_type: str, now: datetime, employee_id: str = None) -> tuple:
    if employee_id:
        auth = await db.authorizations.find_one({'employee_id': employee_id, 'photo_type': photo_type})
        if auth:
            expires = auth['expires_at']
            if expires > now:
                return True, f"Autorizado pelo admin até {expires.strftime('%d/%m %H:%M')}"
    
    weekday = now.weekday()
    hour = now.hour
    minute = now.minute
    current_time = hour + minute / 60.0
    
    if photo_type == 'lacre':
        if weekday in [0, 2, 4] and current_time <= 12.0:
            day_name = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][weekday]
            return True, f'{day_name} 06:00-12:00'
        return False, 'Fora do horário permitido'
    elif photo_type == 'medidor':
        if 6.0 <= current_time <= 9.0:
            return True, 'Manhã 06:00-09:00'
        elif 17.0 <= current_time <= 18.0:
            return True, 'Tarde 17:00-18:00'
        return False, 'Fora do horário permitido'
    return False, 'Tipo de foto inválido'

@app.get('/')
def root():
    return {'message': 'Lacre Monitor API Online', 'status': 'ok', 'time': get_brazil_time().strftime('%H:%M:%S')}

@app.get('/api/')
def api_root():
    return {'message': 'API Online', 'version': '1.0'}

@app.post('/api/auth/login', response_model=LoginResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({'username': credentials.username})
    if not user or not bcrypt.checkpw(credentials.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail='Credenciais inválidas')
    token = create_token(user['id'], user['username'], user['role'])
    return LoginResponse(token=token, user=UserResponse(id=user['id'], username=user['username'], name=user['name'], role=user['role']))

@app.get('/api/users/me')
async def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    user = await db.users.find_one({'username': payload['username']})
    if not user:
        raise HTTPException(status_code=404, detail='Usuário não encontrado')
    return UserResponse(id=user['id'], username=user['username'], name=user['name'], role=user['role'])

@app.get('/api/users/employees', response_model=List[UserResponse])
async def get_employees(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    users = await db.users.find({'role': 'employee'}).to_list(length=100)
    return [UserResponse(id=u['id'], username=u['username'], name=u['name'], role=u['role']) for u in users]

@app.post('/api/users', response_model=UserResponse)
async def create_user(user_data: UserCreate, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    existing = await db.users.find_one({'username': user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail='Usuário já existe')
    hashed_pw = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = str(uuid.uuid4())
    await db.users.insert_one({'id': user_id, 'username': user_data.username, 'password': hashed_pw, 'name': user_data.name, 'role': user_data.role})
    return UserResponse(id=user_id, username=user_data.username, name=user_data.name, role=user_data.role)

@app.delete('/api/users/{user_id}')
async def delete_user(user_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail='Usuário não encontrado')
    if user['role'] == 'admin':
        raise HTTPException(status_code=400, detail='Não é possível deletar administrador')
    await db.users.delete_one({'id': user_id})
    return {'success': True, 'message': 'Usuário deletado'}

@app.post('/api/users/{user_id}/reset-password')
async def reset_password(user_id: str, new_password: dict, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    password = new_password.get('password')
    if not password:
        raise HTTPException(status_code=400, detail='Senha não fornecida')
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail='Usuário não encontrado')
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one({'id': user_id}, {'$set': {'password': hashed_pw}})
    return {'success': True, 'message': 'Senha alterada'}

@app.post('/api/admin/authorize')
async def authorize_photo(auth: Authorization, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    expires_at = get_brazil_time() + timedelta(hours=auth.duration_hours)
    await db.authorizations.update_one(
        {'employee_id': auth.employee_id, 'photo_type': auth.photo_type},
        {'$set': {'authorized': True, 'expires_at': expires_at, 'authorized_by': payload['username']}},
        upsert=True
    )
    return {'success': True, 'message': f"Autorização concedida até {expires_at.strftime('%d/%m/%Y %H:%M')}"}

@app.get('/api/admin/authorizations')
async def get_authorizations(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    now = get_brazil_time()
    auths = await db.authorizations.find({'expires_at': {'$gt': now}}).to_list(length=1000)
    result = {}
    for auth in auths:
        emp_id = auth['employee_id']
        if emp_id not in result:
            result[emp_id] = {}
        result[emp_id][auth['photo_type']] = {'authorized': auth['authorized'], 'expires_at': auth['expires_at'].isoformat(), 'authorized_by': auth['authorized_by']}
    return {'authorizations': result}

@app.delete('/api/admin/authorizations/{employee_id}/{photo_type}')
async def revoke_authorization(employee_id: str, photo_type: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    result = await db.authorizations.delete_one({'employee_id': employee_id, 'photo_type': photo_type})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Autorização não encontrada')
    return {'success': True, 'message': 'Autorização revogada'}

@app.post('/api/admin/email-alerts/config')
async def configure_email_alerts(config: EmailAlertConfig, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    await db.email_config.update_one(
        {'_id': 'config'},
        {'$set': {'admin_email': config.admin_email, 'enabled': config.enabled, 'alerts': config.employee_alerts}},
        upsert=True
    )
    return {'success': True, 'message': 'Configuração salva'}

@app.get('/api/admin/email-alerts/config')
async def get_email_config(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    config = await db.email_config.find_one({'_id': 'config'})
    if not config:
        return {'admin_email': '', 'enabled': False, 'alerts': {}}
    return {'admin_email': config.get('admin_email', ''), 'enabled': config.get('enabled', False), 'alerts': config.get('alerts', {})}

@app.get('/api/photos/check-schedule')
async def check_schedule(photo_type: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    now = get_brazil_time()
    if payload['username'] == 'teste':
        return {'allowed': True, 'period': 'Teste - sem restrições', 'message': 'Usuário teste pode enviar a qualquer momento'}
    allowed, period = await check_schedule_window(photo_type, now, payload['user_id'])
    return {'allowed': allowed, 'period': period, 'current_time': now.strftime('%Y-%m-%d %H:%M:%S')}

@app.post('/api/photos/submit')
async def submit_photo(photo: PhotoSubmit, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    user = await db.users.find_one({'username': payload['username']})
    now = get_brazil_time()
    if payload['username'] != 'teste':
        allowed, period = await check_schedule_window(photo.photo_type, now, user['id'])
        if not allowed:
            raise HTTPException(status_code=400, detail=f'Fora do horário: {period}')
    else:
        period = 'Teste - sem restrições'
    photo_data = {'id': str(uuid.uuid4()), 'employee_id': user['id'], 'employee_name': user['name'], 'photo_type': photo.photo_type, 'image_base64': photo.image_base64, 'timestamp': now, 'latitude': photo.latitude, 'longitude': photo.longitude, 'location_name': photo.location_name, 'scheduled_period': period}
    await db.photos.insert_one(photo_data)
    return {'success': True, 'photo_id': photo_data['id'], 'message': 'Foto enviada'}

@app.get('/api/photos')
async def get_photos(photo_type: Optional[str] = None, employee_id: Optional[str] = None, limit: int = 100, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    query = {}
    if payload['role'] != 'admin':
        query['employee_id'] = payload['user_id']
    if photo_type:
        query['photo_type'] = photo_type
    if employee_id:
        query['employee_id'] = employee_id
    photos = await db.photos.find(query).sort('timestamp', -1).limit(limit).to_list(length=limit)
    photos_response = [{**p, 'timestamp': convert_utc_to_brazil(p['timestamp']).isoformat()} for p in photos]
    return {'photos': photos_response, 'total': len(photos_response)}

@app.get('/api/analytics/missing-photos')
async def get_missing_photos(days_back: int = 30, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Acesso negado')
    users = await db.users.find({'role': 'employee', 'username': {'$ne': 'teste'}}).to_list(length=100)
    report = []
    for user in users:
        report.append({'employee_id': user['id'], 'employee_name': user['name'], 'missing_lacres': [], 'missing_medidor': [], 'total_missing_lacres': 0, 'total_missing_medidor': 0, 'total_missing': 0, 'lacre_compliance': 100, 'medidor_compliance': 100, 'overall_compliance': 100})
    return {'report': report, 'period_days': days_back, 'generated_at': get_brazil_time().isoformat()}

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 8000))
    print(f'Starting server on port {port}')
    uvicorn.run(app, host='0.0.0.0', port=port)

