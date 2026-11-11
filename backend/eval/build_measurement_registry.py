"""Build the fixed, non-executable equation registry for both shipped applications.

Only this repository-owned expression tree is interpreted. User expressions are
never evaluated. Run from the repository root; --check verifies generated assets.
"""
import ast
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend/src/app/calculators"
REGISTRY = {}
def x(i): return ["x", i]
def a(*v): return ["add", *v]
def s(v,w): return ["sub",v,w]
def m(*v): return ["mul",*v]
def d(v,w): return ["div",v,w]
def p(v,w): return ["pow",v,w]
def exp(v): return ["exp",v]
def log(v): return ["log",v]
def choose(test,yes,no): return ["if",test,yes,no]
def gt(v,w=0): return ["gt",v,w]
def ge(v,w=0): return ["ge",v,w]
def le(v,w): return ["le",v,w]
def between(v,lo,hi): return [ge(v,lo),le(v,hi)]
def add(key,n,expr,nominal=(),sample=None,extra=2,**meta):
    REGISTRY[key] = {"input_count":n,"extra_count":extra,"expression":expr,
                     "nominal_constraints":list(nominal),"sample_constraints":list(nominal if sample is None else sample),**meta}

v=[x(i) for i in range(12)]
A,B,C,D,E,F,G=v[:7]
add("density",2,d(A,B),[gt(A),gt(B)],extra=0)
factor=d(m(D,E),m(F,d(G,100)))
add("gcExtraction",7,m(d(s(A,C),B),factor),[gt(B),gt(D),ge(E,1),gt(F),gt(G)],sample=[gt(B),gt(D),gt(E),gt(F),gt(G)],extra=0)
add("viscosity",2,m(A,B),[gt(A),gt(B)])
add("residue",2,m(100,d(A,B)),[ge(A),gt(B),le(A,B)],sample=[gt(B)])
add("loss",2,m(100,d(s(A,B),A)),[gt(A),ge(B),le(B,A)],sample=[gt(A)])
add("corrected",2,a(A,B))
add("diluted",3,m(s(A,B),C),[ge(C,1)],sample=[gt(C)])
add("dynamic",2,d(m(A,B),1000),[gt(A),gt(B)])
add("kinematicFromDynamic",2,d(m(1000,A),B),[gt(A),gt(B)])
add("relativeDensity",2,d(A,B),[gt(A),gt(B)])
add("volumetricTitration",5,d(m(s(A,B),C,D),E),[ge(A),ge(B),gt(C),gt(D),gt(E)],sample=[gt(C),gt(D),gt(E)])
add("acidBaseNumber",5,d(m(s(A,B),C,E),D),[ge(A),ge(B),gt(C),gt(D),gt(E)],sample=[gt(C),gt(D),gt(E)])
add("pycnometer",4,m(d(s(B,A),s(C,A)),D),[gt(B,A),gt(C,A),gt(D)])
add("volumePercent",2,m(100,d(A,B)),[ge(A),gt(B),le(A,B)],sample=[gt(B)])
add("ratioPercent",2,m(100,d(A,B)),[ge(A),gt(B)],sample=[gt(B)])
add("solubility",2,m(100,s(1,d(A,B))),[ge(A),gt(B),le(A,B)],sample=[gt(B)])
add("transmission",2,m(100,d(A,B)),[ge(A),gt(B),le(A,B)],sample=[gt(B)])
add("absorbance",1,d(m(-1,log(d(A,100))),log(10)),[gt(A),le(A,100)],sample=[gt(A)])
add("apiGravity",1,s(d(141.5,A),131.5),[gt(A)])
add("kfCoulometric",3,d(s(A,B),C),[ge(A),ge(B),gt(C)],sample=[gt(C)])
add("kfVolumetric",4,d(m(1000,s(A,B),C),D),[ge(A),ge(B),gt(C),gt(D)],sample=[gt(C),gt(D)])
add("gcNormalization",3,d(m(100,A,B),a(m(A,B),C)),[ge(A),gt(B),ge(C),gt(a(m(A,B),C))],sample=[gt(a(m(A,B),C))])
add("indicationError",2,s(A,B))
add("relativeError",2,m(100,d(s(A,B),B)),[["ne",B,0]])
add("inverseCalibration",4,m(d(s(A,B),C),D),[gt(C),ge(D,1)],sample=[gt(C),gt(D)])
add("moistureWet",3,m(100,d(s(B,C),s(B,A))),[gt(B,A),ge(C,A),le(C,B)],sample=[gt(B,A)])
add("moistureDry",3,m(100,d(s(B,C),s(C,A))),[ge(B,C),gt(C,A)],sample=[gt(C,A)])
add("spikeRecovery",3,m(100,d(s(A,B),C)),[gt(C)])
add("massConcentrationTitration",6,d(m(1000,s(A,B),C,D,E),F),[ge(A),ge(B),gt(C),gt(D),gt(E),gt(F)],sample=[gt(C),gt(D),gt(E),gt(F)])
add("forceArea",2,d(A,B),[ge(A),gt(B)],sample=[gt(B)])
add("electricalResistance",2,d(A,B),[["ne",B,0],ge(d(A,B))],sample=[["ne",B,0]])
add("porosity",2,m(100,s(1,d(A,B))),[ge(A),gt(B),le(A,B)],sample=[gt(B)])
add("linearExpansion",3,m(A,B,C),[gt(B)])
# Nominal preparation equations include actual temperature / filling deviations.
# Their nominals are zero, so the first-order coefficients match the legacy UI.
mass,purity,vol,temp,fill,beta=[x(i) for i in range(6)]
add("standardPreparation",6,d(m(10,mass,purity),a(m(vol,a(1,m(beta,temp))),fill)),
    [gt(mass),gt(purity),le(purity,100),gt(vol),ge(beta),gt(a(m(vol,a(1,m(beta,temp))),fill))],
    sample=[gt(mass),gt(purity),gt(a(m(vol,a(1,m(beta,temp))),fill))],extra=0)
# [net mass, purity%, molar mass, volume, relative volume%, relative temp%, relative precision%]
add("naohStandardization",7,d(m(10,A,B,a(1,d(G,100))),m(C,D,a(1,d(E,100)),a(1,d(F,100)))),
    [gt(A),gt(B),le(B,100),gt(C),gt(D)],sample=[gt(A),gt(B),gt(C),gt(D),gt(a(1,d(E,100))),gt(a(1,d(F,100)))],extra=0)
REGISTRY["standardPreparation"]["uncertain_indices"]=[0,1,2,3,4]
REGISTRY["naohStandardization"]["uncertain_indices"]=[0,1,2,4,5,6]
add("balance",1,A,extra=5,uncertain_indices=[])
add("typeA",1,A,extra=1,uncertain_indices=[])

def field(fa,en,unit,fa_help,en_help):return {"fa":fa,"en":en,"unit":unit,"help":{"fa":fa_help,"en":en_help}}
def special(key,fields,expr,example,fa,en,formula,explanation,reference,edition,nominal=(),sample=None,outputs=None):
    add(key,len(fields),expr,nominal,sample,special=True,inputs=fields,example=example,fa=fa,en=en,formula=formula,
        explanation=explanation,reference=reference,source_edition=edition,unit=outputs or "1")

cal_help=("از گزارش کالیبراسیون واقعی دستگاه بردارید؛ ضرایب نمونه برای استفادهٔ واقعی نیستند.","Copy from the actual instrument calibration; example coefficients are not operational values.")
special("hthsTbs",[
 field("سیگنال گشتاور نمونه","Sample torque signal","signal","از خروجی TBS پس از پایداری در ۱۵۰°C و نرخ برش تعیین‌شده بردارید.","Use the stabilized TBS signal at 150°C and the established shear rate."),
 field("شیب خط کالیبراسیون گشتاور–ویسکوزیته","Torque-to-viscosity calibration slope","mPa·s/signal",*cal_help),
 field("عرض از مبدأ همان کالیبراسیون","Intercept of the same calibration","mPa·s",*cal_help),
 field("تصحیح اثر دما در واحد ویسکوزیته","Temperature-effect correction in viscosity units","mPa·s","از مطالعهٔ حساسیت دمای دستگاه؛ فقط با مستندات می‌توان صفر گذاشت.","From instrument temperature-sensitivity studies; zero requires justification."),
 field("تصحیح اثر نرخ برش یا موقعیت روتور","Shear-rate / rotor-position correction","mPa·s","از اعتبارسنجی کراس‌اور و کنترل روغن مرجع؛ عدم‌قطعیت را جدا وارد کنید.","From crossover calibration and reference-oil checks; enter its uncertainty separately.")],
 a(m(A,B),C,D,E),[596,.0045,-.1819,0,0],"HTHS با کالیبراسیون TBS","HTHS using TBS calibration","η = a × torque + b + δT + δshear",
 {"fa":"رابطهٔ خطی سازنده برای TBS است؛ برای دستگاه‌های دیگر تعمیم داده نمی‌شود. شیب و عرض از مبدأ و هم‌بستگی آن‌ها از یک کالیبراسیون می‌آیند. دما، نرخ برش و روغن‌های مرجع باید با روش واقعی منطبق باشند.","en":"Manufacturer's linear TBS calibration, not a universal HTHS equation. Use slope, intercept and their correlation from the same calibration. Temperature, shear rate and reference oils must match the actual method."},
 "https://www.tannasking.com/wp-content/uploads/2023/08/TBS2100E-Operations-Manual.2.2024.pdf","TBS 2100E manual 02/2024, pp. 18–21",[gt(B),gt(a(m(A,B),C,D,E))],sample=[],outputs="mPa·s")

fuel_fields=[field("چگالی در ۱۵°C","Density at 15°C","kg/m³","از گزارش چگالی تصحیح‌شده در ۱۵°C، نه دمای دلخواه.","Use density corrected to 15°C, not an arbitrary temperature."),
 field("آب، درصد جرمی","Water mass percentage","% mass","درصد جرمی واقعی؛ ۰٫۱ یعنی ۰٫۱٪، نه کسر جرمی.","Use percentage points: 0.1 means 0.1%, not a mass fraction."),
 field("خاکستر، درصد جرمی","Ash mass percentage","% mass","از آزمون خاکستر در همان مبنای نمونه.","Use ash on the same sample basis."),field("گوگرد، درصد جرمی","Sulfur mass percentage","% mass","از نتیجهٔ گوگرد در مبنای جرمی نمونه.","Use sulfur on the sample mass basis.")]
fuel_fraction=s(1,d(a(B,C,D),100))
gross_base=s(51.916,m(8.792e-6,p(A,2)))
net_base=a(46.423,m(-8.792e-6,p(A,2)),m(.003170,A))
for key,expr,name,eng in [("heatGross",a(m(gross_base,fuel_fraction),m(9.420,d(D,100))),"گرمای احتراق ناخالص تخمینی","Estimated gross heat of combustion"),("heatNet",s(a(m(net_base,fuel_fraction),m(9.420,d(D,100))),m(2.449,d(B,100))),"گرمای احتراق خالص تخمینی","Estimated net heat of combustion")]:
 special(key,fuel_fields,expr,[850,.1,.01,1],name,eng,
  "Qg = (51.916 − 8.792×10⁻⁶ρ²)(1−x−y−s)+9.420s" if key=="heatGross" else "Qn = (46.423−8.792×10⁻⁶ρ²+0.003170ρ)(1−x−y−s)+9.420s−2.449x",
  {"fa":"x، y و s کسر جرمی‌اند؛ برنامه درصدهای ورودی را بر ۱۰۰ تقسیم می‌کند. این برآورد تجربی برای سوخت هیدروکربنی متعارف و چگالی ۷۵۰ تا ۱۰۰۰ است، نه بیودیزل/الکل یا مادهٔ خالص. عدم‌قطعیت خود رابطهٔ تجربی نیز باید از اعتبارسنجی وارد شود.","en":"x, y and s are mass fractions; input percentages are divided by 100. This is an empirical estimate for conventional hydrocarbon fuels at 750–1000 kg/m³, not biodiesel/alcohol blends or pure compounds. Include model-discrepancy uncertainty from validation."},
  "https://store.astm.org/standards/d4868","Equation basis: D4868-00 (2005), §6; verify laboratory edition",[*between(A,750,1000),ge(B),ge(C),ge(D),le(a(B,C,D),100)],sample=[gt(A)],outputs="MJ/kg")

titr_fields=[field("حجم تیترانت","Titrant volume","mL","از نقطهٔ پایانی معتبر گزارش تیتریتور.","Use the validated titrator endpoint volume."),field("حجم بلانک","Blank volume","mL","بلانک همان حلال و روش، نه بلانک دستگاه دیگر.","Use the same solvent and method blank."),field("غلظت واقعی تیترانت","Actual titrant concentration","mol/L","از استانداردسازی تیترانت؛ عدد اسمی بطری کافی نیست.","Use standardized titrant concentration, not just the bottle label."),field("جرم نمونه","Sample mass","g","جرم واقعی منتقل‌شده از اختلاف توزین.","Use actual transferred mass by difference.")]
special("mercaptanSulfur",titr_fields,d(m(32060,s(A,B),C),D),[.5,.02,.01,20],"گوگرد مرکاپتانی با AgNO₃","Mercaptan sulfur using AgNO₃","S(mg/kg) = 1000 × 32.06 × (V−Vb) × cAg / m",
 {"fa":"خروجی بر مبنای جرم گوگرد مرکاپتانی است، نه جرم کل مولکول مرکاپتان. رابطهٔ مولی AgNO₃ و گروه تیول ۱ به ۱ است. اثر نقطهٔ پایانی، بلانک، واکنش جانبی و بازیابی باید بررسی شود.","en":"Reports mercaptan sulfur mass, not whole mercaptan molecular mass. AgNO₃ reacts 1:1 with thiol groups. Assess endpoint, blank, side reactions and recovery."},
 "https://cdn.hach.com/7FYZVWYB/at/8rthrq5wpn2ct9vfmzwb5gk/DOC3165293109.pdf","Hach DOC316.52.93109, 04/2015, D3227-13 application",[ge(A),ge(B),gt(C),gt(D)],sample=[gt(C),gt(D)],outputs="mg/kg")
special("freeAcid",titr_fields+[field("جرم مولی اسید مورد گزارش","Molar mass of the reported acid","g/mol","نام اسید و شکل شیمیایی را در SOP ثبت کنید.","Record the acid identity and chemical form in the SOP."),field("نسبت مول اسید به مول تیترانت","Moles of acid per mole of titrant","1","از واکنش موازنه‌شده؛ برای اسید تک‌پروتونی ۱ و واکنش کامل دوپروتونی ۰٫۵ است.","From balanced stoichiometry; 1 for a monoprotic acid, 0.5 for full diprotic neutralization.")],
 d(m(.1,s(A,B),C,E,F),D),[10,.1,.1,5,60.052,1],"اسید آزاد با هویت و استوکیومتری مشخص","Free acid with defined identity and stoichiometry","w(%) = 0.1 × (V−Vb) × c × M × z / m",
 {"fa":"اسید آزاد معادلهٔ یکتا برای همهٔ مواد ندارد؛ این مدل تیتراسیون اسید تعریف‌شده است. هویت اسید، تعداد پروتون‌های تیترشونده، حلال و نقطهٔ پایانی باید در SOP مشخص باشند. مثال فرضی اسید استیک است.","en":"Free acid has no universal analyte-independent equation. This model titrates a specified acid; identity, titratable protons, solvent and endpoint must be defined in the SOP. The hypothetical example uses acetic acid."},
 "https://www.eurachem.org/index.php/publications/guides/quam","Stoichiometric amount-of-substance and mass balance",[ge(A),ge(B),gt(C),gt(D),gt(E),gt(F)],sample=[gt(C),gt(D),gt(E),gt(F)],outputs="% mass")
special("coolantWater",[titr_fields[0],titr_fields[1],field("تیتر واقعی آب در معرف KF","Actual water titer of KF reagent","mg/mL","از استانداردسازی با آب یا استاندارد گواهی‌شده؛ غلظت مولار نیست.","From water/CRM standardization; this is not molarity."),titr_fields[3]],
 d(m(.1,s(A,B),C),D),[2,.02,5,1],"آب کولانت با KF حجمی، درصد جرمی","Coolant water by volumetric KF, mass percent","w(%) = (V−Vb) × t / (10m)",
 {"fa":"برای کنسانترهٔ کولانت با روش KF حجمی است؛ نتیجه درصد جرمی است. بلانک و رانش نباید دو بار کسر شوند. آزادسازی آب، تداخل ماتریس و استانداردسازی تیتر در بودجه لازم‌اند؛ این مدل درصد حجمی آب را نمی‌دهد.","en":"Volumetric KF for coolant concentrate, reported as mass percent. Do not subtract blank or drift twice. Include water release, matrix interference and titer standardization. This is not volume-percent water."},
 "https://store.astm.org/d1123-22.html","Volumetric KF mass-balance model; confirm D1123 procedure / SOP",[ge(A),ge(B),gt(C),gt(D)],sample=[gt(C),gt(D)],outputs="% mass")

dn=s(A,.85)
bb=s(exp(m(-3.5,dn)),1)
t10=s(B,215)
t50=s(C,260)
t90=s(D,310)
cetane=a(45.2,m(.0892,t10),m(a(.131,m(.901,bb)),t50),m(s(.0523,m(.420,bb)),t90),m(.00049,s(p(t10,2),p(t90,2))),m(107,bb),m(60,p(bb,2)))
special("cetaneA",[field("چگالی در ۱۵°C","Density at 15°C","g/mL","اگر kg/m³ دارید بر ۱۰۰۰ تقسیم کنید.","Divide kg/m³ by 1000."),field("دمای بازیافت ۱۰٪ در فشار مرجع","10% recovery temperature at reference pressure","°C","از D86 با تصحیح فشار طبق روش.","From D86 with the method pressure correction."),field("دمای بازیافت ۵۰٪","50% recovery temperature","°C","از همان منحنی تقطیر.","From the same distillation curve."),field("دمای بازیافت ۹۰٪","90% recovery temperature","°C","از همان منحنی؛ ترتیب دماها باید صعودی باشد.","Use the same curve with ascending recovery temperatures.")],cetane,[.8537,212,261.4,311.4],"شاخص ستان چهارمتغیره، رویهٔ A","Four-variable cetane index, procedure A","CCI = 45.2 + 0.0892T10N + (0.131+0.901B)T50N + (0.0523−0.420B)T90N + 0.00049(T10N²−T90N²) + 107B + 60B²",
 {"fa":"B=exp[−3.5(ρ−0.85)]−1 و دماهای نرمال‌شده به‌ترتیب T10−215، T50−260 و T90−310 هستند. برآورد رویهٔ A برای سوخت نفتی است، نه عدد ستان اندازه‌گیری‌شده و نه سوخت دارای افزایندهٔ ستان/بیودیزل. بایاس مدل باید جدا ارزیابی شود.","en":"B=exp[−3.5(ρ−0.85)]−1; normalized temperatures are T10−215, T50−260 and T90−310. Procedure A estimates petroleum-fuel cetane index, not measured cetane number; do not apply it to cetane-improver/biodiesel blends. Assess model discrepancy separately."},
 "https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1016IFV.TXT","ASTM D4737 procedure A as reproduced by EPA; confirm fuel class",[gt(A),gt(B),ge(C,B),ge(D,C)],sample=[gt(A),gt(B),ge(C,B),ge(D,C)],outputs="Cetane index")

rvp,sl,temp=A,B,C
root=p(sl,.5)
aa=s(s(15.64,m(1.854,root)),m(s(.8742,m(.3280,root)),log(rvp)))
bb2=s(s(8742,m(1042,root)),m(s(1049,m(179.4,root)),log(rvp)))
special("trueVaporRefined",[field("فشار بخار رید مطلق","Absolute Reid vapor pressure","psia","فشار مطلق ۱ تا ۲۰ psia برای فرآوردهٔ پالایش‌شدهٔ مناسب رابطه.","Absolute RVP 1–20 psia for an applicable refined stock."),field("شیب D86 در ۱۰٪ تبخیر","D86 slope at 10% evaporated","°F/vol%","از (T15−T5)/10 با دماهای °F به دست می‌آید.","Calculate (T15−T5)/10 with temperatures in °F."),field("دمای سطح مایع","Liquid surface temperature","°F","دمای خود مایع؛ نه دمای هوای محیط.","Use liquid, not ambient-air, temperature.")],m(6.894757293168,exp(s(aa,d(bb2,a(temp,459.67))))),[12,3,68.9],"فشار بخار واقعی فرآوردهٔ پالایش‌شده، EPA","Refined-stock true vapor pressure, EPA","P(kPa abs) = 6.894757293168 × exp[A − B/(T°F+459.67)]",
 {"fa":"A=15.64−1.854√S−(0.8742−0.3280√S)ln(RVP)، B=8742−1042√S−(1049−179.4√S)ln(RVP). رابطهٔ EPA برای فرآوردهٔ سبک پالایش‌شده است، نه نفت خام یا هر مخلوط دلخواه. خطای همبستگی تجربی باید جدا به بودجه اضافه شود.","en":"A=15.64−1.854√S−(0.8742−0.3280√S)ln(RVP); B=8742−1042√S−(1049−179.4√S)ln(RVP). EPA correlation for applicable light refined stocks, not crude oil or arbitrary mixtures. Include empirical-correlation discrepancy in the budget."},
 "https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1018Z2V.TXT","EPA AP-42 7.1, June 2018, Eq. 1-25 / Fig. 7.1-15",[*between(rvp,1,20),gt(sl),gt(temp,-459.67)],sample=[gt(rvp),gt(sl),gt(temp,-459.67)],outputs="kPa abs")

# n-d-M is multi-output: every output shares the same four physical inputs.
n,den,mw,sul=A,B,C,D
vv=s(m(2.51,s(n,1.475)),s(den,.851))
ww=s(s(den,.851),m(1.11,s(n,1.475)))
ca=a(m(choose(ge(vv),430,670),vv),d(3660,mw))
cr=a(m(choose(ge(ww),820,1440),ww),m(-3,sul),d(choose(ge(ww),10000,10600),mw))
cn=s(cr,ca)
cp=s(100,cr)
ra=a(.44,m(choose(ge(vv),.055,.080),mw,vv))
rt=a(1.33,m(choose(ge(ww),.146,.180),mw,s(ww,m(.005,sul))))
rn=s(rt,ra)
ndfields=[field("ضریب شکست nD در ۲۰°C","Refractive index nD at 20°C","1","از رفرکتومتر در خط D و ۲۰°C؛ دمای دیگر را جایگزین نکنید.","Use refractometer nD at 20°C, not another temperature."),field("چگالی d4 در ۲۰°C","Density d4 at 20°C","g/mL","از چگالی‌سنج در ۲۰°C؛ مقیاس kg/m³ را تبدیل کنید.","Use density at 20°C; convert kg/m³ to g/mL."),field("جرم مولی میانگین","Mean molar mass","g/mol","از روش معتبر جرم مولکولی میانگین؛ نه جرم مولی یک جزء انتخابی.","Use a validated average-molecular-weight method, not a chosen pure component."),field("گوگرد، درصد جرمی","Sulfur mass percentage","% mass","از آزمون گوگرد در همان نمونه.","Use sulfur mass percentage for the same sample.")]
ndformulas={"ndmCA":"CA = (v≥0 ? 430v : 670v) + 3660/M", "ndmCN":"CN = CR − CA; CR=(w≥0 ? 820w+10000/M : 1440w+10600/M)−3S; CA=(v≥0 ? 430v : 670v)+3660/M", "ndmCP":"CP = 100 − CR; CR=(w≥0 ? 820w+10000/M : 1440w+10600/M)−3S", "ndmRA":"RA = 0.44 + (v≥0 ? 0.055 : 0.080)Mv", "ndmRT":"RT = 1.33 + (w≥0 ? 0.146 : 0.180)M(w−0.005S)", "ndmRN":"RN = RT−RA; RT=1.33+(w≥0 ? 0.146 : 0.180)M(w−0.005S); RA=0.44+(v≥0 ? 0.055 : 0.080)Mv"}
nddomain=[gt(n,1),gt(den),gt(mw),ge(sul),le(sul,100),ge(ca),ge(cn),ge(cp),le(cr,75),le(ca,m(1.5,cn)),ge(ra),ge(rn),le(rt,4),le(ra,d(rt,2))]
for key,expr,fa,en,unit in [("ndmCA",ca,"درصد کربن آروماتیکی","Aromatic carbon percentage","% carbon"),("ndmCN",cn,"درصد کربن نفتنیکی","Naphthenic carbon percentage","% carbon"),("ndmCP",cp,"درصد کربن پارافینی","Paraffinic carbon percentage","% carbon"),("ndmRA",ra,"تعداد حلقه‌های آروماتیکی","Aromatic ring count","rings/molecule"),("ndmRN",rn,"تعداد حلقه‌های نفتنیکی","Naphthenic ring count","rings/molecule"),("ndmRT",rt,"تعداد کل حلقه‌ها","Total ring count","rings/molecule")]:
 special(key,ndfields,expr,[1.48,.86,300,.1],"n-d-M · "+fa,"n-d-M · "+en,"v=2.51(n−1.475)−(d−0.851); w=(d−0.851)−1.11(n−1.475); "+ndformulas[key],
 {"fa":"برای روغن نفتی بدون الفین و در محدودهٔ ترکیب روش است. شاخه‌های v و w در هر نمونهٔ مونت‌کارلو دوباره انتخاب می‌شوند. خروجی‌های کربن و حلقه‌ها جدا هستند؛ این درصد، درصد کربن ساختاری است و درصد جرمی ترکیب‌ها نیست.","en":"For olefin-free petroleum oils within the method composition range. The v/w branches are re-evaluated for every Monte Carlo draw. Carbon distribution and ring counts are separate outputs; carbon percentages are structural, not compound mass percentages."},
 "https://store.astm.org/d3238-22.html","Equation basis: D3238-95 (2005), §7; scope checked against D3238-22",nddomain,sample=nddomain,outputs=unit)

# Reference data from the MIT-licensed Chemicals distribution. No installed
# Chemicals/SciPy dependency is required in either shipped runtime.
wheel=ROOT/"output/uncertainty-review/chemicals-1.5.2-py3-none-any.whl"
target=ROOT/"backend/viscosity_index_reference.json"
if wheel.exists():
    with zipfile.ZipFile(wheel) as archive:
        source=archive.read("chemicals/viscosity.py").decode()
        arrays={}
        for node in ast.parse(source).body:
            if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in {"VI_nus","VI_Ls","VI_Hs"}:
                arrays[node.targets[0].id]=ast.literal_eval(node.value)
        licence=archive.read("chemicals-1.5.2.dist-info/licenses/LICENSE.txt").decode()
        ref={"source":"chemicals 1.5.2, chemicals.viscosity", "reference":"https://chemicals.readthedocs.io/chemicals.viscosity.html#chemicals.viscosity.viscosity_index", "source_sha256":hashlib.sha256(source.encode()).hexdigest(),"license":licence,**arrays}
else:
    ref=json.loads(target.read_text(encoding="utf-8"))
ll=["interp","L",B]
hh=["interp","H",B]
vi=choose(ge(A,hh),m(100,d(s(ll,A),s(ll,hh))),a(100,d(s(p(10,d(log(d(hh,A)),log(B))),1),.00715)))
special("viscosityIndex",[field("گرانروی کینماتیکی در ۴۰°C","Kinematic viscosity at 40°C","mm²/s","از D445 یا روش مجاز در ۴۰°C.","Use D445 or an applicable method at 40°C."),field("گرانروی کینماتیکی در ۱۰۰°C","Kinematic viscosity at 100°C","mm²/s","حداقل ۲ mm²/s؛ L و H خودکار از مرجع یا رابطه محاسبه می‌شوند.","At least 2 mm²/s; L and H are obtained automatically from reference data or equations.")],vi,[73.3,8.86],"شاخص گرانروی با جدول L/H خودکار","Viscosity index with automatic L/H reference","VI = 100(L−U)/(L−H) if U≥H; otherwise VI=100+(10^[ln(H/U)/ln(Y)]−1)/0.00715",
 {"fa":"برای Y از ۲ تا ۷۰، L/H از دادهٔ مرجع با درون‌یابی خطی و برای Y>۷۰ از روابط درجهٔ دو به دست می‌آیند. مونت‌کارلو جدول و شاخهٔ VI را در هر نمونه دوباره محاسبه می‌کند. نتیجه برای انتشار عدم‌قطعیت گرد نمی‌شود؛ دادهٔ مرجع و ویرایش روش در گزارش ثبت شوند.","en":"For Y=2–70, L/H use linearly interpolated reference data; above 70, quadratic equations apply. Monte Carlo re-evaluates lookup and the VI branch for every draw. Propagation uses unrounded VI; record the reference dataset and method edition."},ref["reference"],"Chemicals 1.5.2 data / D2270-10(2016) equation basis",[gt(A),ge(B,2)],sample=[gt(A),ge(B,2)],outputs="VI")

examples={"density":[50,50],"gcExtraction":[110,10,10,50,2,10,80],"viscosity":[.1,100],"residue":[.2,10],"loss":[10,9],"corrected":[25,-.2],"diluted":[5,1,10],"dynamic":[10,850],"kinematicFromDynamic":[8.5,850],"relativeDensity":[850,998.2],"volumetricTitration":[10,1,.1,1,25],"acidBaseNumber":[2,.1,.1,5,56.1],"pycnometer":[20,45,49.94,998.2],"volumePercent":[.5,100],"ratioPercent":[60,80],"solubility":[.1,2],"transmission":[50,100],"absorbance":[50],"apiGravity":[.85],"kfCoulometric":[120,20,1],"kfVolumetric":[.5,.02,5,1],"gcNormalization":[20,1,80],"indicationError":[10.2,10],"relativeError":[10.2,10],"inverseCalibration":[110,10,10,2],"moistureWet":[10,15,14],"moistureDry":[10,15,14],"spikeRecovery":[15,5,10],"massConcentrationTitration":[10,.1,.01,100.09,1,50],"forceArea":[10000,100],"electricalResistance":[5,.1],"porosity":[1500,2500],"linearExpansion":[.000012,1000,20],"standardPreparation":[100.28,99.99,100,0,0,.00021],"naohStandardization":[.3888,100,204.2212,18.64,0,0,0],"balance":[50],"typeA":[50]}
for key,example in examples.items():
    REGISTRY[key]["example"]=example
assets={ROOT/"backend/measurement_model_registry.json":REGISTRY,FRONT/"measurement-registry.json":REGISTRY,target:ref,FRONT/"viscosity-index-reference.json":ref}
for path,value in assets.items():
    data=json.dumps(value,ensure_ascii=False,indent=2)+"\n"
    if "--check" in sys.argv:
        if path.read_text(encoding="utf-8")!=data:
            raise SystemExit(f"Generated registry is stale: {path}")
    else:
        path.write_text(data,encoding="utf-8")
print(f"Verified {len(REGISTRY)} registered equations" if "--check" in sys.argv else f"Generated {len(REGISTRY)} registered equations")
