/* ───────────────────────────────────────────────
   CONSTANTS & CALENDAR
─────────────────────────────────────────────── */
const YEARS  = [2079,2080,2081,2082,2083,2084,2085,2086];
const MONTHS = ['Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];

/* Approximate BS→AD offset — enough for POG calculation */
/* We use a simple day-count from BS 2079-01-01 baseline  */
const BS_EPOCH_AD = new Date(2022, 3, 14); // 2022-Apr-14 ≈ BS 2079-01-01

function bsToAdDays(year, month, day) {
  /* Approximate: every BS year ≈ 365.25 days, every month = 30 days */
  const bsYears = year - 2079;
  const totalDays = Math.round(bsYears * 365.25) + (month - 1) * 30 + (day - 1);
  return totalDays;
}

function adToBS(adDate) {
  const diffMs  = adDate - BS_EPOCH_AD;
  const diffDays= Math.floor(diffMs / 86400000);
  const y = 2079 + Math.floor(diffDays / 365.25);
  const rem = diffDays - Math.floor((y - 2079) * 365.25);
  const m = Math.floor(rem / 30) + 1;
  const d = (rem % 30) + 1;
  return { year: y, month: Math.max(1,Math.min(m,12)), day: Math.max(1,Math.min(d,30)) };
}

function bsDayDiff(a, b) {
  /* positive = b is after a */
  return bsToAdDays(b.year,b.month,b.day) - bsToAdDays(a.year,a.month,a.day);
}

function addDaysToBS(bs, days) {
  const base = bsToAdDays(bs.year, bs.month, bs.day);
  const total = base + days;
  const y = 2079 + Math.floor(total / 365.25);
  const rem = total - Math.floor((y-2079)*365.25);
  const m = Math.floor(rem / 30) + 1;
  const d = (rem % 30) + 1;
  return {
    year: y,
    month: Math.max(1, Math.min(m, 12)),
    day:   Math.max(1, Math.min(d, 30))
  };
}

function formatBS(bs) {
  return `${bs.year} ${MONTHS[bs.month-1]} ${String(bs.day).padStart(2,'0')}`;
}

/* ───────────────────────────────────────────────
   UI SETUP
─────────────────────────────────────────────── */
function fillSelect(id, values, labelFn, blank) {
  const el = document.getElementById(id);
  el.innerHTML = `<option value="">${blank}</option>`;
  values.forEach((v,i) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = labelFn ? labelFn(v,i) : v;
    el.appendChild(opt);
  });
}

function setup() {
  fillSelect('xMonth', [...Array(12).keys()].map(i=>i+1), (v,i) => `${v} — ${MONTHS[i]}`, 'Month');
  fillSelect('yMonth', [...Array(12).keys()].map(i=>i+1), (v,i) => `${v} — ${MONTHS[i]}`, 'Month');
  fillSelect('sMonth', [...Array(12).keys()].map(i=>i+1), (v,i) => `${v} — ${MONTHS[i]}`, 'Month');

  /* Auto-fill today */
  const today = adToBS(new Date());
  document.getElementById('xYear').value  = today.year;
  setSelect('xMonth', today.month);
  document.getElementById('xDay').value   = today.day;
  markFilled(['xYear','xMonth','xDay']);

  /* Theme */
  const saved = localStorage.getItem('ob-theme');
  if (saved === 'dark') applyTheme('dark');
}

function setSelect(id, val) {
  const el = document.getElementById(id);
  el.value = val;
}

function markFilled(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el.value) el.classList.add('filled');
    else el.classList.remove('filled');
  });
}

function onInputChange(el, errId) {
  const val = parseInt(el.value);
  const min = parseInt(el.min);
  const max = parseInt(el.max);
  if (el.value && val >= min && val <= max) {
    el.classList.add('filled');
    document.getElementById(errId).textContent = '';
  } else {
    el.classList.remove('filled');
    if (el.value && (val < min || val > max)) {
      document.getElementById(errId).textContent = 'Must be ' + min + '-' + max;
    }
  }
}

function onSelectChange(el, errId) {
  if (el.value) { el.classList.add('filled'); document.getElementById(errId).textContent = ''; }
  else el.classList.remove('filled');
}

/* ───────────────────────────────────────────────
   METHOD SWITCHER
─────────────────────────────────────────────── */
var currentMethod = 'lmp';

function switchMethod(method) {
  currentMethod = method;
  document.getElementById('panelLMP').classList.toggle('active', method === 'lmp');
  document.getElementById('panelScan').classList.toggle('active', method === 'scan');
  document.getElementById('tabLMP').classList.toggle('active', method === 'lmp');
  document.getElementById('tabScan').classList.toggle('active', method === 'scan');
  // clear result when switching
  document.getElementById('resultBody').innerHTML =
    '<div class="result-empty">Fill in the fields above and tap <strong>Calculate</strong></div>';
  document.getElementById('copyBtn').style.display = 'none';
  lastResult = null;
}

/* ───────────────────────────────────────────────
   THEME
─────────────────────────────────────────────── */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeIcon').textContent = t === 'dark' ? 'Light' : 'Dark';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('ob-theme', next);
}

/* ───────────────────────────────────────────────
   CALCULATE
─────────────────────────────────────────────── */
function calculate() {
  if (currentMethod === 'lmp') {
    calculateLMP();
  } else {
    calculateScan();
  }
}

/* ── LMP method ── */
function calculateLMP() {
  // clear errors
  ['xYear','xMonth','xDay','yYear','yMonth','yDay'].forEach(function(id) {
    document.getElementById(id + 'Err').textContent = '';
  });

  var ok = true;
  var numFields = { xYear:[2079,2086], xDay:[1,30], yYear:[2079,2086], yDay:[1,30] };
  ['xYear','xMonth','xDay','yYear','yMonth','yDay'].forEach(function(id) {
    var el = document.getElementById(id);
    var val = el.value;
    if (!val) {
      document.getElementById(id + 'Err').textContent = 'Required';
      ok = false;
    } else if (numFields[id]) {
      var num = parseInt(val);
      var mn = numFields[id][0]; var mx = numFields[id][1];
      if (num < mn || num > mx) {
        document.getElementById(id + 'Err').textContent = 'Must be ' + mn + ' to ' + mx;
        ok = false;
      }
    }
  });
  if (!ok) return;

  var today = { year: +xYear.value, month: +xMonth.value, day: +xDay.value };
  var lmp   = { year: +yYear.value, month: +yMonth.value, day: +yDay.value };

  var diff = bsDayDiff(lmp, today);
  if (diff < 0) {
    document.getElementById('yYearErr').textContent = 'LMP must be before today';
    return;
  }
  if (diff > 400) {
    document.getElementById('yYearErr').textContent = 'LMP too far in the past (>400 days)';
    return;
  }

  var weeks = Math.floor(diff / 7);
  var days  = diff % 7;

  // EDD = LMP + 9 months + 7 days
  var eddMonth0 = lmp.month + 9;
  var eddYear   = lmp.year + Math.floor((eddMonth0 - 1) / 12);
  var eddMonth  = ((eddMonth0 - 1) % 12) + 1;
  var eddDay    = lmp.day + 7;
  var eddYearF  = eddYear;
  var eddMonthF = eddMonth;
  if (eddDay > 30) { eddDay -= 30; eddMonthF += 1; }
  if (eddMonthF > 12) { eddMonthF = 1; eddYearF += 1; }
  var edd = { year: eddYearF, month: eddMonthF, day: eddDay };

  var trimester = weeks < 13 ? '1st Trimester' : weeks < 27 ? '2nd Trimester' : '3rd Trimester';

  lastResult = { weeks: weeks, days: days, edd: edd, trimester: trimester, diff: diff, method: 'lmp' };
  renderResult(lastResult);
}

/* ── Dating Scan method ── */
function calculateScan() {
  // clear errors
  ['xYear','xMonth','xDay','sYear','sMonth','sDay','gaWeeks','gaDays'].forEach(function(id) {
    document.getElementById(id + 'Err').textContent = '';
  });

  var ok = true;
  var numFields = {
    xYear:[2079,2086], xDay:[1,30],
    sYear:[2079,2086], sDay:[1,30],
    gaWeeks:[6,13], gaDays:[0,6]
  };
  ['xYear','xMonth','xDay','sYear','sMonth','sDay','gaWeeks','gaDays'].forEach(function(id) {
    var el = document.getElementById(id);
    var val = el.value;
    if (!val && val !== '0') {
      document.getElementById(id + 'Err').textContent = 'Required';
      ok = false;
    } else if (numFields[id]) {
      var num = parseInt(val);
      var mn = numFields[id][0]; var mx = numFields[id][1];
      if (num < mn || num > mx) {
        document.getElementById(id + 'Err').textContent = 'Must be ' + mn + ' to ' + mx;
        ok = false;
      }
    }
  });
  if (!ok) return;

  var today     = { year: +xYear.value, month: +xMonth.value, day: +xDay.value };
  var scanDate  = { year: +sYear.value, month: +sMonth.value, day: +sDay.value };
  var gaAtScanDays = parseInt(gaWeeks.value) * 7 + parseInt(gaDays.value);

  // Validate scan date is not after today
  var scanToToday = bsDayDiff(scanDate, today);
  if (scanToToday < 0) {
    document.getElementById('sYearErr').textContent = 'Scan date must be before today';
    return;
  }
  if (scanToToday > 280) {
    document.getElementById('sYearErr').textContent = 'Scan date too far in the past';
    return;
  }

  // Current POG = GA at scan + days elapsed since scan
  var totalDays = gaAtScanDays + scanToToday;
  var weeks = Math.floor(totalDays / 7);
  var days  = totalDays % 7;

  // EDD = scan date + (280 - GA at scan in days)
  // 280 days = 40 weeks total pregnancy
  var daysToEDD = 280 - gaAtScanDays;
  var edd = addDaysToBS(scanDate, daysToEDD);

  var trimester = weeks < 13 ? '1st Trimester' : weeks < 27 ? '2nd Trimester' : '3rd Trimester';

  lastResult = {
    weeks: weeks, days: days, edd: edd, trimester: trimester,
    diff: totalDays, method: 'scan',
    gaAtScan: parseInt(gaWeeks.value) + 'w ' + parseInt(gaDays.value) + 'd',
    scanDateStr: formatBS(scanDate)
  };
  renderResult(lastResult);
}
function renderResult(r) {
  var body    = document.getElementById('resultBody');
  var copyBtn = document.getElementById('copyBtn');

  body.innerHTML = '';

  // Row 1 — POG
  var pogRow = document.createElement('div');
  pogRow.className = 'result-row';
  pogRow.innerHTML =
    '<div>' +
      '<div class="label">Period of Gestation (POG)</div>' +
      '<div class="value">' + r.weeks + ' wks' + (r.days > 0 ? ' + ' + r.days + ' days' : '') + '</div>' +
      '<div class="sub">' + r.diff + ' total days &middot; ' + r.trimester + '</div>' +
    '</div>';

  // Row 2 — EDD
  var subText = r.method === 'scan'
    ? 'Dating scan (' + r.gaAtScan + ' on ' + r.scanDateStr + ') + 280 days'
    : 'LMP + 9 months + 7 days (Nepali calendar)';

  var eddRow = document.createElement('div');
  eddRow.className = 'result-row';
  eddRow.innerHTML =
    '<div>' +
      '<div class="label">Estimated Delivery Date (EDD)</div>' +
      '<div class="value">' + formatBS(r.edd) + '</div>' +
      '<div class="sub">' + subText + '</div>' +
    '</div>';

  body.appendChild(pogRow);
  body.appendChild(eddRow);

  // Row 3 — scan info badge (scan method only)
  if (r.method === 'scan') {
    var scanRow = document.createElement('div');
    scanRow.className = 'result-row';
    scanRow.style.background = 'rgba(99,102,241,0.07)';
    scanRow.style.borderColor = 'rgba(99,102,241,0.2)';
    scanRow.innerHTML =
      '<div class="icon" style="background:rgba(99,102,241,0.1);font-size:15px;color:#6366f1;">USG</div>' +
      '<div>' +
        '<div class="label">Scan-Based Calculation</div>' +
        '<div class="value" style="font-size:16px;">GA at scan: ' + r.gaAtScan + '</div>' +
        '<div class="sub">Scan on ' + r.scanDateStr + ' &middot; 1st Trimester Dating</div>' +
      '</div>';
    body.appendChild(scanRow);
  }

  copyBtn.style.display = 'flex';

  var wrap = document.getElementById('resultWrap');
  wrap.classList.remove('pop');
  void wrap.offsetWidth;
  wrap.classList.add('pop');

  setTimeout(function() { wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
}

/* ───────────────────────────────────────────────
   COPY RESULT
─────────────────────────────────────────────── */
function copyResult() {
  if (!lastResult) return;
  var r = lastResult;
  var methodLine = r.method === 'scan'
    ? 'Method: Dating Scan (GA at scan: ' + r.gaAtScan + ' on ' + r.scanDateStr + ')'
    : 'Method: LMP';
  var text =
    "OB Calculator Result\n" +
    "---------------------\n" +
    methodLine + "\n" +
    "POG: " + r.weeks + " weeks" + (r.days > 0 ? " + " + r.days + " days" : "") + " (" + r.trimester + ")\n" +
    "EDD: " + formatBS(r.edd) + "\n" +
    "---------------------\n" +
    "Nepal OB Calc by Jimi Syangbo";

  navigator.clipboard.writeText(text).then(function() {
    var btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function() { btn.innerHTML = 'Copy'; btn.classList.remove('copied'); }, 2500);
  }).catch(function() {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}


/* ═══════════════════════════════════════════════════════
   APP SWITCHER
═══════════════════════════════════════════════════════ */
function switchApp(app) {
  document.getElementById('appPageOB').classList.toggle('active', app === 'ob');
  document.getElementById('appPageFG').classList.toggle('active', app === 'fg');
  document.getElementById('appPageBG').classList.toggle('active', app === 'bg');
  document.getElementById('appTabOB').classList.toggle('active', app === 'ob');
  document.getElementById('appTabFG').classList.toggle('active', app === 'fg');
  document.getElementById('appTabBG').classList.toggle('active', app === 'bg');
}

/* ═══════════════════════════════════════════════════════
   WHO FETAL GROWTH COEFFICIENTS
   Source: Kiserud et al. PLOS Medicine 2017
   Polynomial: loge(y) = b0 + b1*t + b2*t^2 + b3*t^3 + b4*t^4
   t = gestational age in weeks (14-40)
   Quantiles: 0.03, 0.05, 0.10, 0.50, 0.90, 0.95, 0.97
═══════════════════════════════════════════════════════ */

var WHO_QUANTILES = [.025, .05, .1, .25, .5, .75, .9, .95, .975];
var WHO_Q_LABELS  = ['2.5th','5th','10th','25th','50th','75th','90th','95th','97.5th'];
var WHO_Q_COLORS  = ['#066679','#066679','#066679','#850003','#FD900F','#067929','#FD900F','#850003','#066679'];

var WHO_DATA = {
  coef_efw:[[.025,-.230518383014592,.400511116318458,-.00617993235833267,316595762972649e-19],[.05,-.162057103557898,.393965369913166,-.00579733056422172,255319128239087e-19],[.1,-.0455887642525626,.389314052082164,-.00574527674062641,265557891064333e-19],[.25,-.012258767992062,.393836404898322,-.00592304885519551,28863017896588e-18],[.5,.157310086966445,.383067935520509,-.00554046846639963,246570062800598e-19],[.75,.293297386426919,.376096229210412,-.00529255036113726,218372277641981e-19],[.9,.353142227490073,.376486874470206,-.00528742945785833,214760212556463e-19],[.95,.285025055968914,.390621472299378,-.00582929182402995,279088693116937e-19],[.975,.408170594889372,.381068214664342,-.00550913922743603,246713147783532e-19]],
  coef_efw_male:[[.025,-.52610096513854,.44906549056954,-.0089009550762548,9868293523919e-17,-6.1862373692705e-7],[.05,-.264562353403465,.412210701662848,-.00659353966698675,387085414793403e-19,-5.92167006518022e-8],[.1,-.0631025226657407,.390993877846881,-.00560764189001381,190944627895524e-19,8.84241803692905e-8],[.25,-.136872920737678,.411385471212291,-.00662710457053528,401078967104191e-19,-6.09266544869339e-8],[.5,.222999048464601,.372888830200871,-.00482835487505679,538927935557086e-20,1.72630247811947e-7],[.75,.274568726691847,.381231662554576,-.00557248890309729,2934934995138e-17,-8.27628809790136e-8],[.9,.240213697127957,.391178494734445,-.00579538706713982,275733050639858e-19,-1.90970772277149e-8],[.95,.238080920038937,.394765675971259,-.00581267491399174,231531669574572e-19,6.85345268671191e-8],[.975,.79018076483077,.32585025131141,-.0025559098706069,-42038969571238e-18,5.4228420412733e-7]],
  coef_efw_female:[[.025,-.915523725804273,.529374415518249,-.0147446585943781,.000269201219853759,-23537061714461e-19],[.05,-.0356552265566936,.376064209229977,-.00496950115937874,100880399508847e-19,8.87897379966417e-8],[.1,.155170122624531,.356594762998776,-.00401282727802378,-114891004630409e-19,2.91905926442287e-7],[.25,-.00617926685323766,.391489315579454,-.00583983363713264,274701265932854e-19,1.25218741602196e-8],[.5,.247277418113423,.370440200280727,-.00507278668575342,179658724333519e-19,3.17102018612384e-8],[.75,.376784712355285,.361976162764535,-.00463535949504953,851326693543256e-20,1.04436638183705e-7],[.9,.286538459425835,.387048945293849,-.00606592437416756,419335923075893e-19,-1.64397771502855e-7],[.95,.381320788764689,.376613696575359,-.00528117982372732,181818929490566e-19,7.60085577423407e-8],[.975,.32551154984358,.40214557617585,-.0074145176202411,88196644838898e-18,-7.1015932637436e-7]],
  coef_ac:[[.025,1.19202778944614,.314756681991964,-.00801581308902169,751395976546808e-19],[.05,1.09869954558741,.330079995799838,-.00862095843727276,825440120054722e-19],[.1,1.24418122481299,.316315401650234,-.00814092689297361,772501495178619e-19],[.25,1.44520878528145,.299433786203949,-.00759672485585945,71668993412344e-18],[.5,1.58552931028045,.289936781915424,-.00732651929135797,69261631643994e-18],[.75,1.71452506914277,.281367067786763,-.00708195596502471,67086230433841e-18],[.9,1.78078382317074,.279278890414784,-.0070643788983289,675104548969352e-19],[.95,1.83213806223649,.277106952998102,-.00703388540291938,676124200964958e-19],[.975,2.03674472691951,.257138461817474,-.00634918788914223,60053745113196e-18]],
  coef_bpd:[[.025,.58340478243682,.257706867351367,-.00608380366281251,516940376186165e-19],[.05,.640086541374477,.25352855332296,-.00591651627062447,494614232987744e-19],[.1,.67586050811029,.25343383445191,-.00595606903884204,503055604381436e-19],[.25,.769315103415485,.249927024175735,-.00592399444708251,5076548429269e-17],[.5,.872984231314326,.243385003540798,-.00571172523683453,482880035733658e-19],[.75,.983298265402666,.236071116567572,-.00548348083012818,458419655773418e-19],[.9,1.01351909208103,.237088857953509,-.0055421492813894,465258350076297e-19],[.95,1.11401192681678,.228258457814188,-.00524271052970102,431665697359201e-19],[.975,1.17917438634649,.224245686901115,-.00513638678692311,421401138788865e-19]],
  coef_fl:[[.025,-7.27187176976836,1.28298928826162,-.0580601892487905,.00121314319801879,-960171505470123e-20],[.05,-7.07052933404414,1.26780052700097,-.0577556347769781,.00121608381996396,-970361787292646e-20],[.1,-6.69175407354157,1.22500911064189,-.055920618206786,.00118320191905997,-950365006831978e-20],[.25,-6.07953118554742,1.15245170563351,-.0525510654314434,.00111418613323875,-89802280974713e-19],[.5,-5.54922620776446,1.09559990166124,-.0501310925949098,.0010678072569586,-863970606288493e-20],[.75,-4.68666987282664,.978111793398168,-.0439319069083821,.00092346644003072,-739427758542544e-20],[.9,-4.31219596825529,.94038705308254,-.0424709867520927,.00089977742409265,-726284658350453e-20],[.95,-4.12398207550525,.920344210800571,-.0415728969581384,.000881055511995407,-710843959625547e-20],[.975,-3.64483930811801,.857028131514986,-.0384005685481303,.000812062784461527,-655932416998498e-20]],
  coef_hc:[[.025,1.59317517131532,.29459800552433,-.0073860372566707,656951770216148e-19],[.05,1.74883945698398,.278405280785763,-.00677990950687641,583587774721548e-19],[.1,1.83059537388222,.27244251174974,-.00659546864496838,563957469365128e-19],[.25,1.94181945227701,.26584757167445,-.00644544904011178,554517813431795e-19],[.5,2.09924879247164,.253373656106037,-.00605647816678282,514256072059917e-19],[.75,2.20777451923048,.245212320927953,-.00578557948587613,483972618799514e-19],[.9,2.31776999721364,.236651510200538,-.00550781288608926,453975879344267e-19],[.95,2.39550106176494,.229586666082063,-.00525318141633775,423738937924844e-19],[.975,2.50074069629423,.220067854715719,-.00493623111462443,389066000946519e-19]],
  coef_hl:[[.025,-7.47910160663101,1.35204523406865,-.0636532992863844,.00137481173675706,-112101330502122e-19],[.05,-6.90099057209008,1.27054553137824,-.0591262450111552,.0012637456183417,-102071740374974e-19],[.1,-6.53608302749862,1.2272413635898,-.0571034895407674,.00122207225813435,-988852986676249e-20],[.25,-5.42815715796469,1.07352977734643,-.0489087664932973,.0010293053840563,-820541048892881e-20],[.5,-4.85748536478029,1.00813558857801,-.0460077781702957,.000973401688196724,-781084345942064e-20],[.75,-4.3140683823838,.943595032408634,-.042967382499428,.000909706728731155,-731114518318759e-20],[.9,-3.70486556990912,.86055314135122,-.0385250212654406,.000804666353059272,-63896725175013e-19],[.95,-3.34494754486814,.813134285208091,-.0361206171893883,.000751920643315549,-596785208299362e-20],[.975,-3.54703721492887,.851835316341919,-.0385210544307558,.000815301857140939,-657662126778699e-20]],
};

/* Solve polynomial: exp(b0 + t*(b1 + t*(b2 + t*(b3 + t*b4)))) */
function solvePoly(coefRow, t) {
  var b0=coefRow[1], b1=coefRow[2], b2=coefRow[3], b3=coefRow[4], b4=coefRow[5]||0;
  return Math.exp(b0 + t*(b1 + t*(b2 + t*(b3 + t*b4))));
}

/* Get reference values at GA t for all quantiles for a parameter */
function whoRefValues(coefArr, t) {
  return coefArr.map(function(row) {
    return { q: row[0], val: solvePoly(row, t) };
  });
}

/* Interpolate percentile rank for observed value
   Method: linear interpolation on RAW scale between adjacent quantile curves
   This exactly matches the original WHO Fetal Growth Calculator logic
   (Kiserud et al. / jcarvalho45/whoFetalGrowth - mixins/calc.js getInterpolation) */
function whoPercentile(coefArr, t, observed) {
  var refs = whoRefValues(coefArr, t);

  // Below lowest centile (2.5th)
  if (observed < refs[0].val) {
    return '<2.5';
  }
  // Above highest centile (97.5th)
  if (observed > refs[refs.length-1].val) {
    return '>97.5';
  }
  // Linear interpolation on raw scale between bracketing quantiles
  for (var i = 0; i < refs.length - 1; i++) {
    var lo = refs[i];
    var hi = refs[i+1];
    if (observed >= lo.val && observed <= hi.val) {
      var frac = (observed - lo.val) / (hi.val - lo.val);
      var pct  = lo.q + frac * (hi.q - lo.q);
      return (pct * 100).toFixed(1);
    }
  }
  return (refs[Math.floor(refs.length/2)].q * 100).toFixed(1);
}

/* Hadlock III EFW: needs HC, AC, FL in mm -> returns grams */
function hadlockEFW(hc, ac, fl) {
  if (!hc || !ac || !fl) return null;
  var logWeight = 1.326
    - (ac/10) * 0.00326 * (fl/10)
    + (hc/10) * 0.0107
    + (ac/10) * 0.0438
    + (fl/10) * 0.158;
  return parseFloat(Math.pow(10, logWeight).toFixed(1));
}

/* Get coef array key based on param + sex */
function getCoefKey(param, sex) {
  if (param === 'efw') {
    if (sex === 'male')   return 'coef_efw_male';
    if (sex === 'female') return 'coef_efw_female';
    return 'coef_efw';
  }
  return 'coef_' + param;
}

/* =============================================
   FG UI STATE
============================================= */
var fgSex = 'unknown';
var lastFGResult = null;
var activeChartParam = 'hc';

function setSex(sex) {
  fgSex = sex;
  ['sexUnknown','sexMale','sexFemale'].forEach(function(id) {
    document.getElementById(id).classList.remove('active');
  });
  var map = { unknown:'sexUnknown', male:'sexMale', female:'sexFemale' };
  document.getElementById(map[sex]).classList.add('active');
}

function fgInputChange(el) {
  if (el.value !== '') el.classList.add('filled');
  else el.classList.remove('filled');
}

/* =============================================
   FG CALCULATE
============================================= */
function calculateFG() {
  // Clear all errors
  ['fgWeeks','fgDays','fgHC','fgAC','fgFL','fgBPD','fgHL','fgEFW'].forEach(function(id) {
    var e = document.getElementById(id + 'Err');
    if (e) e.textContent = '';
  });

  var wEl = document.getElementById('fgWeeks');
  var dEl = document.getElementById('fgDays');
  var ok = true;

  if (!wEl.value) {
    document.getElementById('fgWeeksErr').textContent = 'Required';
    ok = false;
  } else if (+wEl.value < 14 || +wEl.value > 40) {
    document.getElementById('fgWeeksErr').textContent = '14 to 40 only';
    ok = false;
  }
  if (dEl.value !== '' && (+dEl.value < 0 || +dEl.value > 6)) {
    document.getElementById('fgDaysErr').textContent = '0 to 6 only';
    ok = false;
  }
  if (!ok) return;

  var t = +wEl.value + (+dEl.value || 0) / 7;

  // Auto-calculate EFW via Hadlock if HC, AC, FL all provided but EFW empty
  var hcEl  = document.getElementById('fgHC');
  var acEl  = document.getElementById('fgAC');
  var flEl  = document.getElementById('fgFL');
  var efwEl = document.getElementById('fgEFW');
  if (hcEl.value && acEl.value && flEl.value && !efwEl.value) {
    var efw = hadlockEFW(+hcEl.value, +acEl.value, +flEl.value);
    if (efw) {
      efwEl.value = efw;
      efwEl.classList.add('filled');
      document.getElementById('hadlockNote').textContent = 'EFW auto-calculated via Hadlock III: ' + efw + ' g';
    }
  } else {
    document.getElementById('hadlockNote').textContent = '';
  }

  var PARAMS = [
    { id:'fgHC',  key:'hc',  label:'HC',  unit:'mm' },
    { id:'fgAC',  key:'ac',  label:'AC',  unit:'mm' },
    { id:'fgFL',  key:'fl',  label:'FL',  unit:'mm' },
    { id:'fgBPD', key:'bpd', label:'BPD', unit:'mm' },
    { id:'fgHL',  key:'hl',  label:'HL',  unit:'mm' },
    { id:'fgEFW', key:'efw', label:'EFW', unit:'g'  }
  ];

  var rows = [];
  var hasAny = false;

  PARAMS.forEach(function(p) {
    var el = document.getElementById(p.id);
    if (!el.value) return;
    hasAny = true;
    var val = parseFloat(el.value);
    var coefKey  = getCoefKey(p.key, fgSex);
    var coefArr  = WHO_DATA[coefKey];
    var pctStr   = whoPercentile(coefArr, t, val);
    var refs     = whoRefValues(coefArr, t);
    var median   = refs[4].val; // 50th centile is index 4
    rows.push({
      label: p.label, value: val, unit: p.unit,
      pct: pctStr, median: median,
      key: p.key, coefKey: coefKey
    });
  });

  if (!hasAny) {
    document.getElementById('fgWeeksErr').textContent = 'Enter at least one measurement';
    return;
  }

  lastFGResult = { t: t, weeks: +wEl.value, days: +dEl.value || 0, rows: rows, sex: fgSex };
  renderFGResult(lastFGResult);
  renderFGChart(lastFGResult, rows[0].key);
}

/* =============================================
   FG RENDER RESULT
============================================= */
function renderFGResult(r) {
  var body = document.getElementById('fgResultBody');
  body.innerHTML = '';

  // GA header row
  var gaRow = document.createElement('div');
  gaRow.style.cssText = 'padding:10px 16px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border);font-family:JetBrains Mono,monospace;background:var(--bg);';
  gaRow.textContent = 'GA: ' + r.weeks + 'w' + (r.days > 0 ? ' + ' + r.days + 'd' : '') +
    (r.sex !== 'unknown' ? '   |   Sex: ' + r.sex.charAt(0).toUpperCase() + r.sex.slice(1) : '');
  body.appendChild(gaRow);

  // Table
  var tbl = document.createElement('table');
  tbl.className = 'fg-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Param</th><th>Value</th><th>50th Ref</th><th>Percentile</th></tr>';
  tbl.appendChild(thead);

  var tbody = document.createElement('tbody');
  r.rows.forEach(function(row) {
    var tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    var medStr = row.unit === 'g' ? Math.round(row.median) + ' g' : row.median.toFixed(1) + ' mm';
    var valStr = row.unit === 'g' ? row.value + ' g' : row.value + ' mm';

    // Determine badge color
    var pctNum = parseFloat(row.pct);
    var cls = 'pct-normal';
    if (isNaN(pctNum)) {
      cls = row.pct.indexOf('<') >= 0 ? 'pct-low' : 'pct-high';
    } else if (pctNum < 5) {
      cls = 'pct-low';
    } else if (pctNum > 95) {
      cls = 'pct-high';
    }

    tr.innerHTML =
      '<td><strong>' + row.label + '</strong></td>' +
      '<td style="font-family:JetBrains Mono,monospace;font-size:13px">' + valStr + '</td>' +
      '<td style="color:var(--muted);font-size:13px">' + medStr + '</td>' +
      '<td><span class="pct-badge ' + cls + '">' + row.pct + 'th</span></td>';

    (function(key) {
      tr.onclick = function() {
        document.querySelectorAll('.fg-table tbody tr').forEach(function(r) { r.style.background = ''; });
        tr.style.background = 'var(--teal-dim)';
        renderFGChart(lastFGResult, key);
      };
    })(row.key);

    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  body.appendChild(tbl);

  // Highlight first row
  if (tbody.firstChild) tbody.firstChild.style.background = 'var(--teal-dim)';

  var wrap = document.getElementById('fgResultWrap');
  wrap.classList.remove('pop'); void wrap.offsetWidth; wrap.classList.add('pop');
}

/* =============================================
   FG CHART
============================================= */
function renderFGChart(r, param) {
  activeChartParam = param || r.rows[0].key;
  var wrap = document.getElementById('fgChartWrap');
  wrap.style.display = 'block';

  // Update chart param tabs
  var tabsEl = document.getElementById('chartTabs');
  tabsEl.innerHTML = '';
  r.rows.forEach(function(row) {
    var btn = document.createElement('button');
    btn.className = 'chart-tab' + (row.key === activeChartParam ? ' active' : '');
    btn.textContent = row.label;
    (function(key) {
      btn.onclick = function() {
        document.querySelectorAll('.chart-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderFGChart(r, key);
      };
    })(row.key);
    tabsEl.appendChild(btn);
  });

  // Find the row for this param
  var row = null;
  r.rows.forEach(function(rv) { if (rv.key === activeChartParam) row = rv; });
  if (!row) return;

  drawFGChart(row, r.t);
}

function drawFGChart(row, currentT) {
  var canvas = document.getElementById('fgCanvas');
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var cssW = canvas.offsetWidth;
  var cssH = window.innerWidth <= 375 ? 220 : window.innerWidth <= 480 ? 250 : 300;
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.scale(dpr, dpr);
  var W = cssW, H = cssH;

  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var bgColor   = isDark ? '#0c1e2e' : '#ffffff';
  var gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  var textColor = isDark ? '#94a3b8' : '#64748b';
  var axisColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';

  // Margins
  var ml=50, mr=20, mt=18, mb=42;
  var pw = W - ml - mr;
  var ph = H - mt - mb;

  // GA range: current week -2 to +2 (clamped to 14-40), min window 8w
  var wk = Math.floor(currentT);
  var tMin = Math.max(14, wk - 4);
  var tMax = Math.min(40, wk + 4);
  if (tMax - tMin < 6) { tMin = Math.max(14, tMax-6); }

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Build centile curves over range
  var coefArr = WHO_DATA[row.coefKey];
  var steps = (tMax - tMin) * 7; // one per day
  var tArr = [];
  for (var i = 0; i <= steps; i++) { tArr.push(tMin + i * (tMax - tMin) / steps); }

  var curves = WHO_QUANTILES.map(function(q, qi) {
    return tArr.map(function(t) { return solvePoly(coefArr[qi], t); });
  });

  // Y range from all curve values + observed
  var allVals = [];
  curves.forEach(function(cv) { cv.forEach(function(v) { allVals.push(v); }); });
  allVals.push(row.value);
  var vMin = Math.min.apply(null, allVals) * 0.97;
  var vMax = Math.max.apply(null, allVals) * 1.03;

  function px(t) { return ml + (t - tMin) / (tMax - tMin) * pw; }
  function py(v) { return mt + ph - (v - vMin) / (vMax - vMin) * ph; }

  // Grid
  ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
  for (var gt = Math.ceil(tMin); gt <= Math.floor(tMax); gt++) {
    var gx = px(gt);
    ctx.beginPath(); ctx.moveTo(gx, mt); ctx.lineTo(gx, mt + ph); ctx.stroke();
  }
  var nYTicks = 5;
  for (var yt = 0; yt <= nYTicks; yt++) {
    var yv = vMin + yt * (vMax - vMin) / nYTicks;
    var yp = py(yv);
    ctx.strokeStyle = gridColor;
    ctx.beginPath(); ctx.moveTo(ml, yp); ctx.lineTo(ml + pw, yp); ctx.stroke();
    ctx.fillStyle = textColor; ctx.font = '9px JetBrains Mono,monospace';
    ctx.textAlign = 'right';
    var yLabel = row.unit === 'g' ? Math.round(yv) : yv.toFixed(0);
    ctx.fillText(yLabel, ml - 5, yp + 3);
  }

  // Axes
  ctx.strokeStyle = axisColor; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt+ph); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ml, mt+ph); ctx.lineTo(ml+pw, mt+ph); ctx.stroke();

  // X-axis labels (weeks)
  ctx.fillStyle = textColor; ctx.font = '10px DM Sans,sans-serif'; ctx.textAlign = 'center';
  for (var lw = Math.ceil(tMin); lw <= Math.floor(tMax); lw++) {
    ctx.fillText(lw + 'w', px(lw), mt + ph + 16);
  }

  // Axis title
  ctx.fillStyle = textColor; ctx.font = '10px DM Sans,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Gestational Age', ml + pw/2, H - 4);

  // Y axis title
  ctx.save(); ctx.translate(13, mt + ph/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign = 'center';
  ctx.fillText(row.label + ' (' + row.unit + ')', 0, 0);
  ctx.restore();

  // Shaded band: 5th-95th
  ctx.beginPath();
  tArr.forEach(function(t, ti) {
    var x = px(t); var y = py(curves[1][ti]); // 5th
    ti === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  for (var ri = tArr.length-1; ri >= 0; ri--) {
    ctx.lineTo(px(tArr[ri]), py(curves[7][ri])); // 95th
  }
  ctx.closePath();
  ctx.fillStyle = isDark ? 'rgba(20,184,166,0.07)' : 'rgba(15,118,110,0.07)';
  ctx.fill();

  // 10th-90th band
  ctx.beginPath();
  tArr.forEach(function(t, ti) {
    var x = px(t); var y = py(curves[2][ti]); // 10th
    ti === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  for (var ri2 = tArr.length-1; ri2 >= 0; ri2--) {
    ctx.lineTo(px(tArr[ri2]), py(curves[6][ri2])); // 90th
  }
  ctx.closePath();
  ctx.fillStyle = isDark ? 'rgba(20,184,166,0.11)' : 'rgba(15,118,110,0.10)';
  ctx.fill();

  // Draw centile lines
  var lineConfigs = [
    {dash:[3,4], w:1,   color:'rgba(6,102,121,0.7)'},   // 2.5th
    {dash:[3,3], w:1,   color:'rgba(6,102,121,0.8)'},   // 5th
    {dash:[4,2], w:1.2, color:'rgba(6,102,121,0.9)'},   // 10th
    {dash:[5,2], w:1,   color:'rgba(133,0,3,0.7)'},     // 25th
    {dash:[],    w:2.5, color:'rgba(253,144,15,1)'},     // 50th - solid bold
    {dash:[5,2], w:1,   color:'rgba(6,121,41,0.7)'},    // 75th
    {dash:[4,2], w:1.2, color:'rgba(6,102,121,0.9)'},   // 90th
    {dash:[3,3], w:1,   color:'rgba(6,102,121,0.8)'},   // 95th
    {dash:[3,4], w:1,   color:'rgba(6,102,121,0.7)'},   // 97.5th
  ];

  curves.forEach(function(cv, ci) {
    var cfg = lineConfigs[ci];
    ctx.beginPath();
    ctx.setLineDash(cfg.dash);
    ctx.lineWidth = cfg.w;
    ctx.strokeStyle = cfg.color;
    tArr.forEach(function(t, ti) {
      var x = px(t); var y = py(cv[ti]);
      ti === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Label at right edge
    var lastVal = cv[cv.length-1];
    var lx = px(tMax) + 2;
    var ly = py(lastVal);
    ctx.fillStyle = cfg.color;
    ctx.font = 'bold 8px DM Sans,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(WHO_Q_LABELS[ci], lx, ly + 3);
  });

  // Vertical line at current GA
  ctx.strokeStyle = 'rgba(139,92,246,0.55)';
  ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
  ctx.beginPath(); ctx.moveTo(px(currentT), mt); ctx.lineTo(px(currentT), mt+ph);
  ctx.stroke(); ctx.setLineDash([]);

  // Observed point — filled circle
  var ox = px(currentT); var oy = py(row.value);
  ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI*2);
  ctx.fillStyle = '#8b5cf6'; ctx.fill();
  ctx.strokeStyle = isDark ? '#0c1e2e' : '#fff';
  ctx.lineWidth = 2; ctx.stroke();

  // Label the observed point
  ctx.fillStyle = '#8b5cf6';
  ctx.font = 'bold 10px DM Sans,sans-serif'; ctx.textAlign = 'left';
  var obsLabel = row.value + (row.unit === 'g' ? ' g' : ' mm');
  ctx.fillText(obsLabel, ox + 9, oy - 5);

  // Legend box
  var legX = ml + 6; var legY = mt + 8;
  ctx.fillStyle = isDark ? 'rgba(12,30,46,0.85)' : 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(legX, legY, 110, 16, 4)
                : ctx.rect(legX, legY, 110, 16);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8b5cf6'; ctx.font = 'bold 9px DM Sans,sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('* ' + row.label + ' = ' + row.value + row.unit + '  (' + row.pct + 'th %ile)', legX+5, legY+11);
}


/* =============================================
   BLOOD GLUCOSE — CONVERTER + OGTT
   ============================================= */

var MMOL_TO_MGDL = 18.018;

/* Conversion */
function bgConvert(from) {
  var mmolEl = document.getElementById('bgMmol');
  var mgdlEl = document.getElementById('bgMgdl');
  var note   = document.getElementById('bgConvertNote');

  if (from === 'mmol') {
    var v = parseFloat(mmolEl.value);
    if (!isNaN(v) && v >= 0) {
      var mgdl = (v * MMOL_TO_MGDL).toFixed(1);
      mgdlEl.value = mgdl;
      note.textContent = v + ' mmol/L = ' + mgdl + ' mg/dL';
      mmolEl.classList.add('filled'); mgdlEl.classList.add('filled');
    } else {
      mgdlEl.value = '';
      note.textContent = '';
      mgdlEl.classList.remove('filled');
    }
  } else {
    var v2 = parseFloat(mgdlEl.value);
    if (!isNaN(v2) && v2 >= 0) {
      var mmol = (v2 / MMOL_TO_MGDL).toFixed(2);
      mmolEl.value = mmol;
      note.textContent = v2 + ' mg/dL = ' + mmol + ' mmol/L';
      mmolEl.classList.add('filled'); mgdlEl.classList.add('filled');
    } else {
      mmolEl.value = '';
      note.textContent = '';
      mmolEl.classList.remove('filled');
    }
  }
}

/* OGTT thresholds — IADPSG 2010 / WHO 2013 (75g, venous plasma, mg/dL) */
var OGTT_THRESHOLDS = {
  f:  { label: 'Fasting',  threshold: 92,  unit: 'mg/dL' },
  h1: { label: '1-Hour',   threshold: 180, unit: 'mg/dL' },
  h2: { label: '2-Hour',   threshold: 153, unit: 'mg/dL' },
};

var lastOGTT = null;

function ogttAnalyze() {
  var fVal  = document.getElementById('ogttF').value;
  var h1Val = document.getElementById('ogtt1h').value;
  var h2Val = document.getElementById('ogtt2h').value;

  var resultEl  = document.getElementById('ogttResult');
  var shareBtn  = document.getElementById('ogttShareBtn');

  // Need at least one value
  if (!fVal && !h1Val && !h2Val) {
    resultEl.innerHTML = '';
    shareBtn.style.display = 'none';
    return;
  }

  var rows = [
    { key:'f',  val:fVal,  ...OGTT_THRESHOLDS.f  },
    { key:'h1', val:h1Val, ...OGTT_THRESHOLDS.h1 },
    { key:'h2', val:h2Val, ...OGTT_THRESHOLDS.h2 },
  ];

  var html = '';
  var abnormalCount = 0;
  var abnormalLabels = [];
  var hasAny = false;

  rows.forEach(function(row) {
    if (!row.val) return;
    hasAny = true;
    var num     = parseFloat(row.val);
    var isHigh  = num >= row.threshold;
    var mmol    = (num / MMOL_TO_MGDL).toFixed(2);
    var diff    = num - row.threshold;
    var diffStr = diff >= 0 ? '+' + diff.toFixed(0) : diff.toFixed(0);
    if (isHigh) { abnormalCount++; abnormalLabels.push(row.label); }

    html += '<div class="ogtt-row ' + (isHigh ? 'abnormal' : 'normal') + '">' +
      '<div class="ogtt-row-left">' +
        '<span class="ogtt-row-label">' + row.label + ' (threshold: ' + row.threshold + ' mg/dL)</span>' +
        '<span class="ogtt-row-value">' + num + ' <small style="font-size:14px;font-family:JetBrains Mono,monospace">mg/dL</small></span>' +
        '<span class="ogtt-row-mmol">' + mmol + ' mmol/L &nbsp;|&nbsp; ' + diffStr + ' from threshold</span>' +
      '</div>' +
      '<span class="ogtt-row-badge ' + (isHigh ? 'high' : 'ok') + '">' +
        (isHigh ? 'ABOVE' : 'NORMAL') +
      '</span>' +
    '</div>';
  });

  if (!hasAny) return;

  // Verdict
  var isGDM = abnormalCount >= 1;
  html += '<div class="ogtt-verdict ' + (isGDM ? 'gdm' : 'normal') + '">' +
    '<div class="verdict-title">' + (isGDM ? 'GDM Positive' : 'GDM Negative') + '</div>' +
    '<div class="verdict-sub">' + (isGDM
      ? abnormalCount + ' value' + (abnormalCount > 1 ? 's' : '') + ' exceeded threshold: ' + abnormalLabels.join(', ') + '.<br>Meets IADPSG/WHO 2013 criteria for Gestational Diabetes Mellitus.'
      : 'All entered values are within normal limits.<br>Does not meet IADPSG/WHO 2013 criteria for GDM.'
    ) + '</div>' +
  '</div>';

  resultEl.innerHTML = html;
  shareBtn.style.display = 'block';
  shareBtn.textContent = 'Copy Result';

  lastOGTT = { rows: rows, isGDM: isGDM, abnormalCount: abnormalCount, abnormalLabels: abnormalLabels };
}

function ogttShare() {
  if (!lastOGTT) return;
  var r = lastOGTT;
  var lines = [
    'OGTT Analysis — Antenatal Calculator',
    '─────────────────────────────────────',
    'Criteria: IADPSG/WHO 2013 (75g oral glucose)',
  ];
  r.rows.forEach(function(row) {
    if (!row.val) return;
    var num  = parseFloat(row.val);
    var mmol = (num / MMOL_TO_MGDL).toFixed(2);
    var status = num >= row.threshold ? 'ABOVE threshold' : 'Normal';
    lines.push(row.label + ': ' + num + ' mg/dL (' + mmol + ' mmol/L) — ' + status);
  });
  lines.push('─────────────────────────────────────');
  lines.push('Result: ' + (r.isGDM ? 'GDM POSITIVE (' + r.abnormalCount + ' abnormal value' + (r.abnormalCount > 1 ? 's' : '') + ')' : 'GDM NEGATIVE'));
  lines.push('via Antenatal Calculator — Jimi Syangbo, MMC');

  var text = lines.join('\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      document.getElementById('ogttShareBtn').textContent = 'Copied!';
      setTimeout(function() {
        document.getElementById('ogttShareBtn').textContent = 'Copy Result';
      }, 2500);
    });
  }
}

/* Init */
setup();