"""Usage observations, not a laboratory approval or a full measurement archive."""
import json
import logging
import math
import re
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials
from auth_service import get_optional_customer
from repositories.base import get_connection

logger = logging.getLogger(__name__)
SERVER_PATHS = {'/uncertainty/budget': 'gum-budget', '/uncertainty/mc-study': 'monte-carlo'}
NAMES = {
    'chat-dilution': ('رقیق‌سازی در گفت‌وگو', 'Dilution in chat'),
    'chat-statistics': ('آمار تکرارها در گفت‌وگو', 'Replicate statistics in chat'),
    'chat-solution_mass': ('جرم ماده برای محلول در گفت‌وگو', 'Solution mass in chat'),
    'chat-unit_conversion': ('تبدیل واحد در گفت‌وگو', 'Unit conversion in chat'),
    'chat-uncertainty': ('عدم‌قطعیت در گفت‌وگو', 'Uncertainty in chat'),
    'chat-reviewed_file': ('بازمحاسبهٔ فایل در گفت‌وگو', 'File recalculation in chat'),
    'gum-budget': ('بودجهٔ عدم‌قطعیت GUM', 'GUM uncertainty budget'),
    'monte-carlo': ('مطالعهٔ مونت‌کارلو', 'Monte Carlo study'),
    'file-confirm': ('محاسبه از فایل تأییدشده', 'Reviewed file calculation'),
    'file-recalculate': ('بازمحاسبهٔ فایل', 'File recalculation'),
    'precision': ('مطالعهٔ تکرارپذیری', 'Repeatability study'),
    'intermediate': ('مطالعهٔ دقت میانی', 'Intermediate precision study'),
    'calibration': ('کالیبراسیون خطی', 'Linear calibration'),
    'bias': ('مطالعهٔ بایاس', 'Bias study'),
    'control': ('نمودار کنترل I–MR', 'I–MR control chart'),
    'decision': ('قاعدهٔ تصمیم', 'Decision rule'),
    'top-down': ('عدم‌قطعیت Top-Down', 'Top-down uncertainty'),
    'solution': ('تهیهٔ محلول مولار', 'Molar solution preparation'),
    'commercial-solution': ('تهیه از محلول تجاری', 'Commercial solution preparation'),
    'dilution-plan': ('طرح رقیق‌سازی', 'Dilution plan'),
    'stock-preparation': ('تهیهٔ محلول مادر و عدم‌قطعیت', 'Stock preparation and uncertainty'),
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds')


def connection():
    conn = get_connection()
    conn.execute('''CREATE TABLE IF NOT EXISTS calculation_activity (
        id TEXT PRIMARY KEY, dedupe_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
        customer_id INTEGER, actor_kind TEXT NOT NULL, actor_key TEXT NOT NULL,
        full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
        tool TEXT NOT NULL, title TEXT NOT NULL, title_en TEXT NOT NULL,
        status TEXT NOT NULL, execution TEXT NOT NULL, source TEXT NOT NULL,
        duration_ms INTEGER, summary_json TEXT NOT NULL)''')
    conn.execute('CREATE INDEX IF NOT EXISTS calculation_activity_time ON calculation_activity(created_at)')
    conn.execute('CREATE INDEX IF NOT EXISTS calculation_activity_customer ON calculation_activity(customer_id)')
    conn.commit()
    return conn


async def actor(request, response):
    header = request.headers.get('authorization', '')
    credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials=header[7:]) if header.lower().startswith('bearer ') else None
    customer = await get_optional_customer(request, credentials)
    if customer:
        from db_service import get_customer_by_id
        row = get_customer_by_id(customer['customer_id']) or {}
        return {'customer_id': customer['customer_id'], 'actor_key': f"customer:{customer['customer_id']}", 'actor_kind': 'customer',
                'full_name': str(row.get('full_name') or '')[:200], 'email': str(row.get('email') or '')[:250], 'phone': str(row.get('phone') or '')[:80]}
    # Anonymous and unapproved requests are denied by route dependencies and never recorded as users.
    return None


def safe_summary(value):
    """Never persist request bodies, files, certificates, arbitrary errors or AI prose."""
    fields = {'model', 'unit', 'measured', 'mean', 'n', 'sample_sd', 'standard_uncertainty', 'expanded_uncertainty',
              'coverage', 'coverage_factor', 'slope', 'intercept', 'r_squared', 'http_status', 'component_count', 'row_count', 'import_id', 'engine'}
    return {k: v[:160] if isinstance(v, str) else v for k, v in (value or {}).items()
            if k in fields and (isinstance(v, str) or type(v) in (int, float) and math.isfinite(v))}


def record(who, tool, status, execution, source, summary=None, duration_ms=None, event_id=None, title=''):
    if not who:
        return
    key = str(uuid.uuid4())
    if tool.startswith('chat-'):
        from laboratory_chat import CATALOG
        kind=tool[5:]
        entry=CATALOG['models'].get(kind)
        if entry:
            title=entry['fa']
    labels = NAMES.get(tool, (title[:120] or tool[:120], title[:120] or tool[:120]))
    dedupe = who['actor_key']+':'+(event_id or key)
    with connection() as conn:
        conn.execute('''INSERT INTO calculation_activity
            (id,dedupe_key,created_at,customer_id,actor_kind,actor_key,full_name,email,phone,tool,title,title_en,status,execution,source,duration_ms,summary_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO NOTHING''',
            (key, dedupe, now(), who['customer_id'], who['actor_kind'], who['actor_key'], who['full_name'], who['email'], who['phone'],
             tool[:80], labels[0], labels[1], status, execution, source, duration_ms, json.dumps(safe_summary(summary), ensure_ascii=False, allow_nan=False)))


def filters(q='', status='', execution='', actor_kind='', since='', until=''):
    clauses, args = [], []
    for column, value in [('status', status), ('execution', execution), ('actor_kind', actor_kind)]:
        if value:
            clauses.append(column+'=?')
            args.append(value)
    if q:
        escaped = q.strip().casefold().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
        columns = ['full_name','email','phone','tool','title','title_en']
        clauses.append('('+' OR '.join(f"lower({c}) LIKE ? ESCAPE '\\'" for c in columns)+')')
        args.extend(['%'+escaped+'%']*len(columns))
    if since:
        clauses.append('created_at>=?')
        args.append(since)
    if until:
        clauses.append('created_at<?')
        args.append(until)
    return (' WHERE '+' AND '.join(clauses) if clauses else ''), args


def stats(where='', args=()):
    today = datetime.now(timezone(timedelta(hours=3, minutes=30))).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat(timespec='milliseconds')
    with connection() as conn:
        result = dict(conn.execute('''SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN status='success' THEN 1 ELSE 0 END),0) AS success,
            COALESCE(SUM(CASE WHEN status='error' THEN 1 ELSE 0 END),0) AS errors,
            COUNT(DISTINCT customer_id) AS customers, MIN(created_at) AS first_recorded_at
            FROM calculation_activity'''+where, args).fetchone())
        result['today'] = conn.execute('SELECT COUNT(*) FROM calculation_activity'+where+(' AND ' if where else ' WHERE ')+'created_at>=?', [*args,today]).fetchone()[0]
    return result


def list_activity(limit=25, offset=0, **query):
    where, args = filters(**query)
    with connection() as conn:
        rows = [dict(r) for r in conn.execute('SELECT * FROM calculation_activity'+where+' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?', [*args,limit,offset]).fetchall()]
    for r in rows:
        r['visitor_label'] = r['actor_key'].removeprefix('visitor:')[:10] if r['customer_id'] is None else None
        r.pop('actor_key')
        r.pop('dedupe_key')
        r['summary'] = json.loads(r.pop('summary_json'))
    return {'items': rows, 'summary': stats(where, args), 'limit': limit, 'offset': offset}


class CalculationActivityRoute(APIRoute):
    """Observe delivered numerical API responses, including validation/engine errors."""
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            path = request.url.path
            tool = SERVER_PATHS.get(path)
            source = 'calculator'
            if re.fullmatch(r'/laboratory/imports/[a-f0-9]{32}/(?:confirm|recalculate)', path):
                tool = 'file-confirm' if path.endswith('/confirm') else 'file-recalculate'
                source = 'file_import'
            chat = path == '/chat/laboratory'
            if request.method != 'POST' or not (tool or chat):
                return await original(request)
            started = time.perf_counter()
            try:
                response = await original(request)
            except Exception as error:
                from fastapi.exceptions import RequestValidationError
                from starlette.exceptions import HTTPException
                code = 422 if isinstance(error, RequestValidationError) else error.status_code if isinstance(error, HTTPException) else 500
                if tool and code not in (401,403,404,429):
                    try:
                        from starlette.responses import Response
                        # Error cookie creation cannot be attached to an exception response; an existing identity is retained.
                        who = await actor(request, Response())
                        record(who, tool, 'error', 'server', source, {'http_status':code}, round((time.perf_counter()-started)*1000))
                    except Exception:
                        logger.exception('Calculation activity recording failed')
                raise
            try:
                if response.status_code >= 400:
                    return response
                who = await actor(request, response)
                data = json.loads(response.body)
                duration = round((time.perf_counter()-started)*1000)
                if chat:
                    for kind in data.get('failed_calculations', [])[:8]:
                        if kind in {'calculate_quick','calculate_model','calculate_current_budget','calculate_uncertainty','convert_lab_units','recalculate_import'}:
                            record(who, 'chat-'+kind, 'error', 'server', 'laboratory_chat', {'engine':'tool-error'}, duration, title=kind)
                    for c in data.get('calculations', [])[:8]:
                        record(who, 'chat-'+c['kind'], 'success', 'server', 'laboratory_chat', {**c.get('result',{}), 'unit':c.get('unit','')}, duration, title=c['kind'])
                else:
                    result = data.get('result', data)
                    summary = {**result, 'http_status':response.status_code}
                    if source == 'file_import':
                        summary.update(import_id=data.get('id') or data.get('importId'), model=data.get('selection',{}).get('mode',''), unit=data.get('unit',''))
                    else:
                        body = await request.json()
                        summary.update(model=(body.get('measurement_model') or {}).get('kind',''), component_count=len(body.get('components',[])))
                    record(who, tool, 'success', 'server', source, summary, duration)
            except Exception:
                # Analytics failure never changes a numerical result or its HTTP status.
                logger.exception('Calculation activity recording failed')
            return response
        return handler
