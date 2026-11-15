export const formulaNotes: Record<string, { fa: string; en: string }> = {
  dilution: {
    fa: "در رقیق‌سازی، مقدار مادهٔ حل‌شونده ثابت می‌ماند. از n = C × V، رابطهٔ C₁V₁ = C₂V₂ به دست می‌آید. C₁ و C₂ غلظت اولیه و هدف‌اند. V₁ حجم لازم از محلول مادر و V₂ حجم نهایی است.",
    en: "Dilution conserves solute. Using n = C × V gives C₁V₁ = C₂V₂. C₁ and C₂ are stock and target concentrations, V₁ is the stock aliquot, and V₂ is the final volume.",
  },
  molarity: {
    fa: "مولاریته C تعداد مول بر لیتر است. حجم نهایی V از میلی‌لیتر به لیتر تبدیل می‌شود. حاصل C × V بر حسب مول است و ضرب آن در جرم مولی M، جرم m را به گرم می‌دهد.",
    en: "Molarity C is moles per liter. Convert final volume V from mL to L, multiply by C to obtain moles, then multiply by molar mass M to obtain mass m in grams.",
  },
  pressure: {
    fa: "P₁ مقدار فشار در واحد مبدأ و P₂ مقدار همان فشار در واحد مقصد است. عدد را ابتدا با ضریب واحد مبدأ به پاسکال تبدیل می‌کنیم و سپس بر تعداد پاسکال در هر واحد مقصد تقسیم می‌کنیم. مبنای فشار مطلق یا گیج باید یکسان باشد.",
    en: "P₁ and P₂ are the same pressure in different units. Convert to pascals using the source factor, then divide by the target factor. Keep the same absolute or gauge reference.",
  },
  ppmMass: {
    fa: "ppm جرمی یعنی یک جزء جرمی در یک میلیون جزء. هر میلی‌گرم در یک کیلوگرم معادل یک ppm جرمی است. m جرم ماده و mₛ جرم کل نمونه است. برای ورودی گرم، ابتدا جرم کل را بر ۱۰۰۰ تقسیم می‌کنیم.",
    en: "Mass ppm means one mass part per million. One mg/kg equals one mass ppm. m is analyte mass and mₛ is total sample mass. Divide grams by 1000 to obtain kilograms.",
  },
  "Purity correction": {
    fa: "mₚ جرم مادهٔ خالص موردنیاز و purity درصد خلوص جرمی است. هر گرم از مادهٔ موجود به اندازهٔ purity/100 گرم مادهٔ خالص دارد. تقسیم جرم خالص بر این کسر، جرم توزین m را می‌دهد.",
    en: "mₚ is the required pure mass. Each gram of reagent contains purity/100 grams of pure material. Divide mₚ by this fraction to get the mass m to weigh.",
  },
  "Mass percentage w/w": {
    fa: "درصد جرمی از تعریف کسر جرمی به دست می‌آید. mₛ جرم حل‌شونده و m جرم کل محلول است. هر دو را در یک واحد وارد کنید و نسبتشان را در ۱۰۰ ضرب کنید.",
    en: "Mass percent is the mass fraction times 100. mₛ is solute mass and m is total solution mass, both in the same unit.",
  },
  "Mass ppm to mg/L": {
    fa: "ppm جرمی معادل mg/kg است. چگالی ρ جرم یک لیتر محلول را بر حسب کیلوگرم می‌دهد. ضرب mg/kg در kg/L، غلظت C بر حسب mg/L را به دست می‌دهد.",
    en: "Mass ppm equals mg/kg. Density ρ gives kilograms of solution per liter. Multiplying mg/kg by kg/L gives concentration C in mg/L.",
  },
  "Mass concentration in ppm": {
    fa: "C بر حسب mg/L مقدار ماده در هر لیتر است. تقسیم آن بر چگالی ρ بر حسب kg/L، مقدار ماده در هر کیلوگرم محلول را می‌دهد که از نظر عددی همان ppm جرمی است.",
    en: "C in mg/L is analyte mass per liter. Dividing by density ρ in kg/L gives mg/kg, numerically equal to mass ppm.",
  },
  "Volumetric flow conversion": {
    fa: "Q حجم عبوری در واحد زمان است. برای تبدیل لیتر بر دقیقه به مترمکعب بر ساعت، حجم بر ۱۰۰۰ تقسیم و نرخ زمانی در ۶۰ ضرب می‌شود. حاصل این دو تبدیل ضریب ۰٫۰۶ است.",
    en: "Q is volume per unit time. Divide liters by 1000 and multiply the per-minute rate by 60 to get the per-hour rate, giving a factor of 0.06.",
  },
  "m³/h to L/min flow conversion": {
    fa: "هر مترمکعب ۱۰۰۰ لیتر و هر ساعت ۶۰ دقیقه است. برای تبدیل دبی Q به لیتر بر دقیقه، آن را در ۱۰۰۰/۶۰ ضرب می‌کنیم که معادل تقسیم بر ۰٫۰۶ است.",
    en: "A cubic meter contains 1000 L and an hour contains 60 min. Multiply Q by 1000/60, equivalent to dividing by 0.06.",
  },
  "Celsius to Kelvin conversion": {
    fa: "T دماست. اندازهٔ یک درجهٔ سلسیوس و یک کلوین برابر است و صفر سلسیوس برابر ۲۷۳٫۱۵ کلوین تعریف می‌شود. بنابراین فقط مبدأ مقیاس جابه‌جا می‌شود.",
    en: "T is temperature. The Celsius and kelvin increments are equal, and 0 °C corresponds to 273.15 K. The conversion shifts the origin.",
  },
  "Kelvin to Celsius conversion": {
    fa: "T دماست. چون ۰ درجهٔ سلسیوس برابر ۲۷۳٫۱۵ کلوین است، برای برگرداندن دما به مقیاس سلسیوس این مقدار را کم می‌کنیم.",
    en: "T is temperature. Since 0 °C corresponds to 273.15 K, subtract 273.15 to express the temperature in Celsius.",
  },
  "Spike recovery": {
    fa: "Cspiked غلظت اندازه‌گیری‌شده پس از افزودن و Cinitial غلظت زمینه روی همان مبناست. اختلاف آن‌ها سهم بازیابی‌شده است. آن را بر غلظت واقعی افزوده‌شده Cadded تقسیم کنید. اثر تغییر حجم هنگام افزودن باید در مبنای ورودی‌ها لحاظ شود.",
    en: "Cspiked and Cinitial are the spiked and background concentrations on the same basis. Their difference estimates the recovered spike. Divide by Cadded, the known added concentration. Account for volume changes on the input basis.",
  },
  "Linear calibration concentration": {
    fa: "معادلهٔ خط y = ax + b را برای x حل می‌کنیم. y پاسخ دستگاه، a شیب غیرصفر و b عرض از مبدأ است. x در واحد استانداردهای کالیبراسیون به دست می‌آید.",
    en: "Solve y = ax + b for x. y is instrument response, a is the nonzero slope, and b is the intercept. x uses the calibration standards’ concentration unit.",
  },
  "Pipe flow velocity": {
    fa: "از رابطهٔ دبی Q = vA، سرعت متوسط v برابر دبی تقسیم بر سطح مقطع A است. برای لولهٔ دایره‌ای پر، A = πD²/4 و D قطر داخلی است. دبی و قطر برای محاسبه به m³/s و m تبدیل می‌شوند.",
    en: "From Q = vA, mean velocity v equals flow divided by area. For a full circular pipe A = πD²/4, where D is the internal diameter. Convert flow to m³/s and diameter to m.",
  },
  "Pipe Reynolds number": {
    fa: "Re نسبت اثر اینرسی به اثر ویسکوزیته در جریان است. ρ چگالی، v سرعت متوسط، D قطر داخلی و μ ویسکوزیتهٔ دینامیکی است. واحدها در این نسبت حذف می‌شوند.",
    en: "Re compares inertial and viscous effects. ρ is density, v is mean velocity, D is internal diameter, and μ is dynamic viscosity. The units cancel.",
  },
  "Mass flow from volumetric flow": {
    fa: "Q حجم عبوری در ساعت و ρ جرم هر مترمکعب سیال است. حاصل‌ضرب این دو، دبی جرمی ṁ را به کیلوگرم بر ساعت می‌دهد. چگالی باید مربوط به شرایط همان دبی باشد.",
    en: "Q is the volume passing per hour and ρ is mass per cubic meter. Their product gives mass flow ṁ in kg/h. Use density at the flow conditions.",
  },
  "Serial dilution": {
    fa: "در هر مرحله غلظت بر ضریب ثابت F تقسیم می‌شود. پس از n مرحله، تقسیم n بار تکرار می‌شود. C₀ غلظت اولیه و Cₙ غلظت نهایی است.",
    en: "Each step divides the concentration by the same factor F. After n steps, C₀ has been divided by F n times to obtain Cₙ.",
  },
  "Molar solution with purity correction": {
    fa: "C مولاریته، V حجم نهایی به میلی‌لیتر و M جرم مولی است. C × (V/1000) × M جرم خالص را می‌دهد. تقسیم آن بر کسر خلوص جرمی، جرم توزین m را تعیین می‌کند.",
    en: "C is molarity, V is final volume in mL, and M is molar mass. C × (V/1000) × M gives pure mass. Divide by the mass purity fraction to get the mass m to weigh.",
  },
  "Mass per volume percentage w/v": {
    fa: "درصد جرم به حجم یعنی گرم حل‌شونده در هر ۱۰۰ میلی‌لیتر محلول. m جرم حل‌شونده به گرم و V حجم نهایی محلول به میلی‌لیتر است.",
    en: "Mass per volume percent expresses grams of solute per 100 mL of solution. m is solute mass in grams and V is final solution volume in mL.",
  },
  "Volume percentage v/v": {
    fa: "V₁ حجم جزء و V₂ حجم نهایی محلول است. نسبت را در ۱۰۰ ضرب می‌کنیم. حجم نهایی را وارد کنید، چون حجم اجزا پس از اختلاط ممکن است جمع‌پذیر نباشد.",
    en: "V₁ is component volume and V₂ is final solution volume. Multiply the ratio by 100. Use the final measured volume because component volumes may not be additive.",
  },
  "Density from mass and volume": {
    fa: "چگالی ρ از تعریف جرم بر حجم به دست می‌آید. m جرم نمونه و V حجم همان نمونه در شرایط اندازه‌گیری است.",
    en: "Density ρ is defined as mass per volume. m and V are the mass and volume of the same sample at the measurement conditions.",
  },
  "Volumetric flow from mass flow": {
    fa: "این فرمول از حل ṁ = ρQ برای Q به دست می‌آید. ṁ دبی جرمی و ρ چگالی در شرایط جریان است. تقسیم kg/h بر kg/m³، دبی را به m³/h می‌دهد.",
    en: "Solve ṁ = ρQ for Q. ṁ is mass flow and ρ is density at the flow conditions. Dividing kg/h by kg/m³ gives m³/h.",
  },
  "Gas flow at reference conditions": {
    fa: "از معادلهٔ حالت گاز واقعی PV = ZnRT و ثابت بودن دبی مولی استفاده می‌شود. Q دبی حجمی، P فشار مطلق، T دمای کلوین و Z ضریب تراکم‌پذیری است. ref به شرایط مرجع اشاره دارد.",
    en: "The real-gas equation PV = ZnRT is applied at a fixed molar flow. Q is volumetric flow, P absolute pressure, T kelvin temperature, and Z compressibility factor. ref denotes reference conditions.",
  },
  "Dynamic to kinematic viscosity": {
    fa: "ویسکوزیتهٔ سینماتیکی ν از تقسیم ویسکوزیتهٔ دینامیکی μ بر چگالی ρ به دست می‌آید. ضریب ۱۰۰۰ از تبدیل mPa·s به Pa·s و m²/s به mm²/s حاصل می‌شود.",
    en: "Kinematic viscosity ν equals dynamic viscosity μ divided by density ρ. The factor 1000 accounts for converting mPa·s to Pa·s and m²/s to mm²/s.",
  },
  "Darcy–Weisbach friction pressure drop": {
    fa: "رابطهٔ دارسی–ویسباخ افت اصطکاکی ΔP را از حاصل‌ضرب ضریب دارسی f، نسبت طول L به قطر داخلی D و فشار دینامیکی ρv²/2 می‌دهد. ρ چگالی و v سرعت متوسط است. افت اتصالات جداگانه محاسبه می‌شود.",
    en: "Darcy–Weisbach gives friction loss ΔP as the product of the Darcy factor f, length-to-diameter ratio L/D, and dynamic pressure ρv²/2. ρ is density and v is mean velocity. Fitting losses are separate.",
  },
  "Pump hydraulic power": {
    fa: "توان منتقل‌شده به سیال برابر دبی حجمی ضرب‌در افزایش فشار است. Q از m³/h به m³/s تبدیل می‌شود و ضرب آن در ΔP بر حسب kPa، توان هیدرولیکی را به kW می‌دهد.",
    en: "Power delivered to the fluid is volume flow times pressure rise. Convert Q from m³/h to m³/s and multiply by ΔP in kPa to obtain hydraulic power in kW.",
  },
  "Mean, sample standard deviation and RSD": {
    fa: "x هر اندازه‌گیری و n تعداد داده‌هاست. میانگین x̄ از تقسیم مجموع داده‌ها بر n به دست می‌آید. انحراف معیار نمونه s از فاصله‌های مربع‌شده تا میانگین و تقسیم بر n−1 محاسبه می‌شود. RSD نسبت s به قدرمطلق میانگین بر حسب درصد است.",
    en: "x denotes a reading and n the count. The mean x̄ is their sum divided by n. Sample deviation s uses squared distances from the mean divided by n−1 before taking the root. RSD expresses s relative to the absolute mean as a percentage.",
  },
  "g/mL to kg/m³ density conversion": {
    fa: "ρ چگالی است. هر گرم ۰٫۰۰۱ کیلوگرم و هر میلی‌لیتر ۰٫۰۰۰۰۰۱ مترمکعب است. نسبت این دو ضریب، عدد چگالی را ۱۰۰۰ برابر می‌کند.",
    en: "ρ is density. One gram is 0.001 kg and one mL is 0.000001 m³. The ratio of these factors multiplies the density number by 1000.",
  },
  "Sensible heat energy": {
    fa: "Q انرژی گرمایی، m جرم، cₚ ظرفیت گرمایی ویژه در فشار ثابت و ΔT تغییر دماست. این رابطه از تعریف ظرفیت گرمایی می‌آید و برای تغییر دما بدون تغییر فاز و با cₚ تقریباً ثابت به کار می‌رود.",
    en: "Q is heat, m is mass, cₚ is specific heat at constant pressure, and ΔT is the temperature change. This follows from the definition of heat capacity and assumes approximately constant cₚ and no phase change.",
  },
  "Hydrostatic pressure difference": {
    fa: "اختلاف فشار ΔP برابر وزن ستون مایع بر واحد سطح است. برای مایع ساکن با چگالی ثابت ρ و اختلاف ارتفاع h، این مقدار ρgh می‌شود. ابزار از شتاب گرانش استاندارد ۹٫۸۰۶۶۵ m/s² استفاده می‌کند.",
    en: "Pressure difference ΔP is the liquid column’s weight per unit area. For a static fluid of constant density ρ and height difference h, this gives ρgh. The calculator uses standard gravity, 9.80665 m/s².",
  },
  "Linear calibration regression R²": {
    fa: "در خط y = ax + b، x غلظت، y پاسخ دستگاه، a شیب و b عرض از مبدأ است. روش کمترین مربعات خطی را انتخاب می‌کند که مجموع مربع فاصله‌های عمودی نقاط تا آن کمینه باشد. R² سهم پراکندگی پاسخ توضیح‌داده‌شده با خط را نشان می‌دهد.",
    en: "In y = ax + b, x is concentration, y is instrument response, a is slope and b is intercept. Least squares minimizes the sum of squared vertical residuals. R² measures the fraction of response variability explained by the line.",
  },
  "Relative measurement error": {
    fa: "x مقدار اندازه‌گیری‌شده و xref مقدار مرجع غیرصفر در همان واحد است. اختلاف را نسبت به مقدار مرجع و به‌صورت درصد گزارش می‌کنیم. علامت نتیجه جهت اختلاف را نشان می‌دهد.",
    en: "x is the measured value and xref is the nonzero reference in the same unit. Express their difference relative to the reference as a percentage. The sign indicates the direction.",
  },
  "Pump input power with efficiency": {
    fa: "بازده η نسبت توان هیدرولیکی Phyd به توان ورودی Pin است. چون بازده به درصد وارد می‌شود، توان هیدرولیکی را بر η/100 تقسیم می‌کنیم.",
    en: "Efficiency η is the ratio of hydraulic power Phyd to input power Pin. Since efficiency is entered as a percent, divide hydraulic power by η/100.",
  },
  unitConverter: {
    fa: "هر واحد با یک ضریب ثابت به واحد پایهٔ SI همان کمیت تبدیل می‌شود. مقدار ابتدا به واحد پایه می‌رود و سپس بر ضریب واحد مقصد تقسیم می‌شود. دما استثناست: چون صفر مقیاس‌ها یکی نیست، تبدیل از راه کلوین انجام می‌شود. گالن و بشکه واحدهای آمریکایی‌اند، کالری ترموشیمیایی و Btu جدول بین‌المللی است.",
    en: "Each unit has a fixed factor to the SI base unit of its quantity. The value is taken to the base unit and then divided by the target unit's factor. Temperature is the exception: the scales have different zero points, so it is converted through kelvin. Gallon and barrel are US units, the calorie is thermochemical and the Btu is the International Table value.",
  },
  "Normal solution preparation": {
    fa: "نرمالیته تعداد اکی‌والان بر لیتر است. N × V تعداد اکی‌والان لازم را می‌دهد. جرم هر اکی‌والان برابر M / z است که z تعداد اکی‌والان در هر مول در واکنش مورد نظر است. تقسیم بر خلوص، جرم واقعی برای توزین را می‌دهد. z به واکنش بستگی دارد و برای یک ماده همیشه ثابت نیست.",
    en: "Normality is equivalents per litre. N × V gives the equivalents needed. One equivalent weighs M / z, where z is the number of equivalents per mole in the intended reaction. Dividing by purity gives the mass to weigh. z depends on the reaction and is not always the same for one substance.",
  },
  "Molarity of a concentrated reagent": {
    fa: "یک لیتر محلول غلیظ ۱۰۰۰ × ρ گرم جرم دارد. کسر w / 100 آن مادهٔ خالص است. تقسیم بر جرم مولی، مول در لیتر را می‌دهد. ضریب ۱۰ حاصل ۱۰۰۰ / ۱۰۰ است. درصد و چگالی را از برچسب همان بطری بردارید.",
    en: "One litre of concentrate weighs 1000 × ρ grams, of which the fraction w / 100 is pure substance. Dividing by molar mass gives moles per litre. The factor 10 is 1000 / 100. Take assay and density from the label of the bottle in use.",
  },
  "Concentrate volume for a molar solution": {
    fa: "مول لازم برابر C × V است. مولاریتهٔ محلول غلیظ 10 × ρ × w / M است. حجم لازم از تقسیم مول لازم بر این مولاریته به دست می‌آید. این حجم را به حلال اضافه کنید و به حجم نهایی برسانید. برای اسیدها همیشه اسید را به آب اضافه کنید.",
    en: "The moles needed are C × V. The concentrate's molarity is 10 × ρ × w / M. Dividing one by the other gives the volume to measure. Add it to solvent and bring to the final volume. With acids, always add acid to water.",
  },
  "Molar mass from formula": {
    fa: "جرم مولی مجموع وزن اتمی استاندارد هر عنصر ضرب در تعداد آن در فرمول است. وزن‌های اتمی از کتابخانهٔ عناصر همین برنامه می‌آیند. آب تبلور در جرم مولی حساب می‌شود.",
    en: "Molar mass is the sum of each element's standard atomic weight times its count in the formula. Atomic weights come from this app's element library. Water of crystallisation is included.",
  },
  "pH from hydrogen ion concentration": {
    fa: "pH منفی لگاریتم پایهٔ ۱۰ فعالیت یون هیدروژن است. این ابزار غلظت را به‌جای فعالیت می‌گذارد که برای محلول‌های رقیق تقریب خوبی است. در محلول‌های غلیظ یا با قدرت یونی بالا، pH اندازه‌گیری‌شده با این عدد فرق دارد.",
    en: "pH is the negative base-10 logarithm of hydrogen ion activity. This tool uses concentration in place of activity, a good approximation for dilute solutions. In concentrated or high ionic strength solutions the measured pH differs from this value.",
  },
  "Hydrogen ion concentration from pH": {
    fa: "از تعریف pH = −log₁₀[H⁺] نتیجه می‌شود [H⁺] = 10^(−pH). غلظت به‌جای فعالیت به کار رفته است، پس نتیجه برای محلول‌های رقیق معتبرتر است.",
    en: "From the definition pH = −log₁₀[H⁺] it follows that [H⁺] = 10^(−pH). Concentration stands in for activity, so the result is most reliable for dilute solutions.",
  },
  "Buffer pH (Henderson–Hasselbalch)": {
    fa: "از ثابت تفکیک اسید Ka = [H⁺][A⁻] / [HA] با لگاریتم‌گیری، pH = pKa + log₁₀([A⁻] / [HA]) به دست می‌آید. نسبت غلظت‌ها مهم است، پس هر دو باید در یک واحد باشند. رابطه وقتی دقیق‌تر است که نسبت بین ۰٫۱ و ۱۰ باشد و محلول خیلی رقیق نباشد. pKa به دما بستگی دارد.",
    en: "Taking logarithms of the acid dissociation constant Ka = [H⁺][A⁻] / [HA] gives pH = pKa + log₁₀([A⁻] / [HA]). Only the ratio matters, so both concentrations must use the same unit. The relation works best for ratios between 0.1 and 10 in solutions that are not very dilute. pKa depends on temperature.",
  },
  "Analyte concentration from titration": {
    fa: "در نقطهٔ هم‌ارزی، مول تیترانت مصرف‌شده Cₜ × Vₜ است. ضرب در نسبت استوکیومتری r مول آنالیت را می‌دهد و تقسیم بر حجم نمونه، غلظت آن را. چون هر دو حجم به میلی‌لیتر است، تبدیل واحد لازم نیست.",
    en: "At the equivalence point the titrant consumed is Cₜ × Vₜ moles. Multiplying by the stoichiometric ratio r gives moles of analyte, and dividing by the sample volume gives its concentration. Both volumes are in millilitres, so no unit conversion is needed.",
  },
  "Acid number from KOH titration": {
    fa: "A − B حجم خالص تیترانت پس از کم کردن شاهد است. ضرب در غلظت M میلی‌مول KOH را می‌دهد و ضرب در ۵۶٫۱۰۶ (جرم مولی KOH) آن را به میلی‌گرم تبدیل می‌کند. تقسیم بر جرم نمونه، نتیجه را به mg KOH/g می‌دهد. نقطهٔ پایانی، حلال و مقدار نمونه را روش آزمون تعیین می‌کند.",
    en: "A − B is the net titrant volume after the blank. Multiplying by concentration M gives millimoles of KOH, and by 56.106 (the molar mass of KOH) gives milligrams. Dividing by sample mass gives mg KOH/g. The end point, solvent and sample size are set by the test method.",
  },
  "API gravity from relative density": {
    fa: "درجهٔ API مقیاسی قراردادی برای چگالی فراورده‌های نفتی است که از چگالی نسبی در ۶۰ درجهٔ فارنهایت نسبت به آب در همان دما تعریف می‌شود. آب ۱۰ درجهٔ API دارد و مایع سبک‌تر عدد بزرگ‌تری می‌گیرد. چگالی اندازه‌گیری‌شده در دمای دیگر باید اول به ۶۰ درجهٔ فارنهایت تصحیح شود.",
    en: "API gravity is a conventional scale for petroleum liquids, defined from relative density at 60 °F against water at the same temperature. Water is 10 °API and lighter liquids have higher values. A density measured at another temperature must first be corrected to 60 °F.",
  },
  "Relative density from API gravity": {
    fa: "این رابطه وارون تعریف درجهٔ API است. نتیجه چگالی نسبی در ۶۰ درجهٔ فارنهایت نسبت به آب در همان دماست و واحد ندارد.",
    en: "This is the definition of API gravity inverted. The result is relative density at 60 °F against water at the same temperature and has no unit.",
  },
};
