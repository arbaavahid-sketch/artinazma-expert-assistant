"""Extract a versioned element/isotope snapshot without importing third-party code."""
import hashlib
import json
import sqlite3
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
WHEEL=ROOT/'output/element-sources/mendeleev-1.3.0-py3-none-any.whl'
VERSION='mendeleev-1.3.0-v1'
DOC='https://mendeleev.readthedocs.io/en/stable/data.html'
NAMES='هیدروژن|هلیم|لیتیم|بریلیم|بور|کربن|نیتروژن|اکسیژن|فلوئور|نئون|سدیم|منیزیم|آلومینیم|سیلیسیم|فسفر|گوگرد|کلر|آرگون|پتاسیم|کلسیم|اسکاندیم|تیتانیم|وانادیم|کروم|منگنز|آهن|کبالت|نیکل|مس|روی|گالیم|ژرمانیم|آرسنیک|سلنیم|برم|کریپتون|روبیدیم|استرانسیم|ایتریم|زیرکونیم|نیوبیم|مولیبدن|تکنسیم|روتنیم|رودیم|پالادیم|نقره|کادمیم|ایندیم|قلع|آنتیموان|تلوریم|ید|زنون|سزیم|باریم|لانتان|سریم|پرازئودیمیم|نئودیمیم|پرومتیم|ساماریم|یوروپیم|گادولینیم|تربیم|دیسپروزیم|هولمیم|اربیم|تولیم|ایتربیم|لوتتیم|هافنیم|تانتال|تنگستن|رنیم|اسمیم|ایریدیم|پلاتین|طلا|جیوه|تالیم|سرب|بیسموت|پولونیم|استاتین|رادون|فرانسیم|رادیم|اکتینیم|توریم|پروتاکتینیم|اورانیم|نپتونیم|پلوتونیم|آمریسیم|کوریم|برکلیم|کالیفرنیم|اینشتینیم|فرمیم|مندلیفیم|نوبلیم|لورنسیم|رادرفوردیم|دوبنیم|سیبورگیم|بوریم|هاسیم|مایتنریم|دارمشتاتیم|رونتگنیم|کوپرنیسیم|نیهونیم|فلروویم|مسکوویم|لیورموریم|تنسین|اوگانسون'.split('|')


def build():
    assert len(NAMES)==118
    with zipfile.ZipFile(WHEEL) as package:
        database=ROOT/'output/element-sources/elements.db'
        database.write_bytes(package.read('mendeleev/elements.db'))
        license_text=package.read('mendeleev-1.3.0.dist-info/licenses/LICENSE').decode()
    db=sqlite3.connect(database)
    db.row_factory=sqlite3.Row
    fields='atomic_number,symbol,name,group_id,period,block,series_id,atomic_weight,atomic_weight_uncertainty,is_radioactive,electronic_configuration,en_pauling,density,cas'
    elements=[dict(row) for row in db.execute(f'SELECT {fields} FROM elements ORDER BY atomic_number')]
    assert [r['atomic_number'] for r in elements]==list(range(1,119))
    gas={1,2,7,8,9,10,17,18,36,54,86}
    estimates={85,87,*range(99,119)}
    allotropes={6:'graphite',15:'white',16:'rhombic',34:'gray',50:'white',51:'gray',97:'alpha'}
    isotope_fields='mass_number,mass,mass_uncertainty,abundance,abundance_uncertainty,is_radioactive,half_life,half_life_unit,half_life_uncertainty,spin'
    target=ROOT/f'frontend/public/data/elements/{VERSION}'
    target.mkdir(parents=True,exist_ok=True)
    total=0
    for element in elements:
        z=element['atomic_number']
        element['fa']=NAMES[z-1]
        element['is_radioactive']=None if element['is_radioactive'] is None else bool(element['is_radioactive'])
        element['density_kind']='estimated' if z in estimates else 'calculated-gas' if z in gas else 'source-reported'
        element['density_allotrope']=allotropes.get(z)
        isotopes=[dict(row) for row in db.execute(f'SELECT {isotope_fields} FROM isotopes WHERE atomic_number=? ORDER BY mass_number',(z,))]
        for isotope in isotopes:
            isotope['is_radioactive']=None if isotope['is_radioactive'] is None else bool(isotope['is_radioactive'])
        element['isotope_count']=len(isotopes)
        (target/f'{z}.json').write_text(json.dumps({'version':VERSION,'atomic_number':z,'symbol':element['symbol'],'isotopes':isotopes},ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
        total+=len(isotopes)
    keys={'atomic_weight','atomic_weight_uncertainty','density','electronic_configuration','mass','mass_uncertainty','abundance','abundance_uncertainty','half_life','half_life_unit','half_life_uncertainty','spin','en_pauling','electronegativity_pauling','econf','mass_number','is_radioactive'}
    provenance=[dict(r) for r in db.execute('SELECT table_name,attribute_name,description,unit,annotations,citation_keys,value_origin FROM propertymetadata') if r['attribute_name'] in keys and r['table_name'] in {'elements','isotopes'}]
    db.close()
    metadata={'provenance_revision':2,'version':VERSION,'source':'Mendeleev 1.3.0','retrieved_on':'2026-11-05','source_url':DOC,
              'wheel_sha256':hashlib.sha256(WHEEL.read_bytes()).hexdigest(),'element_count':len(elements),'isotope_count':total,
              'scope':'Snapshot of source values. No CIAAW intervals synthesized; missing values remain null. No values transferred to solution calculations.',
              'properties':provenance}
    destination=ROOT/'frontend/src/app/calculators/workspace/element-data.json'
    destination.write_text(json.dumps({'metadata':metadata,'elements':elements},ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    (ROOT/'docs/ELEMENT_SNAPSHOT_SOURCE.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'docs/licenses/mendeleev-1.3.0-LICENSE.txt').write_text(license_text,encoding='utf-8')
    print(json.dumps({k:v for k,v in metadata.items() if k!='properties'},indent=2))


if __name__=='__main__':
    build()
