import type { LangId, ThemeId } from '../types/workshop';

export const LOGO_URL = '/icons/hollywood-logo.png';
export const APP_VERSION = '0.0.0.1';

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const TR: Record<'hi' | 'bn', Record<string, string>> = {
  hi: {
    'Good morning': 'सुप्रभात',
    'Good afternoon': 'नमस्कार',
    'Good evening': 'शुभ संध्या',
    'Your name': 'आपका नाम',
    'Type your name': 'अपना नाम लिखें',
    'Enter PIN': 'पिन डालें',
    Next: 'आगे बढ़ें',
    Login: 'लॉगिन',
    'Wrong name or PIN': 'नाम या पिन गलत है',
    'Choose unit': 'यूनिट चुनें',
    Unit: 'यूनिट',
    Logout: 'लॉग आउट',
    Refresh: 'रिफ्रेश',
    Back: 'वापस',
    Today: 'आज',
    Save: 'सेव करें',
    'Save all': 'सब सेव करें',
    Saved: 'सेव हो गया',
    'Saving…': 'सेव हो रहा है…',
    Cancel: 'रद्द करें',
    Delete: 'हटाएँ',
    'Confirm & save': 'जाँचकर सेव करें',
    Add: 'जोड़ें',
    Search: 'खोजें',
    All: 'सब',
    'Show more': 'और देखें',
    Yes: 'हाँ',
    No: 'नहीं',
    Total: 'कुल',
    Pending: 'बाकी',
    Done: 'हो गया',
    pcs: 'पीस',
    Points: 'पॉइंट',
    Remarks: 'टिप्पणी',
    Note: 'नोट',
    Details: 'विवरण',
    Store: 'स्टोर',
    Garment: 'कपड़ा',
    'Who did it?': 'किसने किया?',
    'Saved as': 'इस नाम से सेव',
    Balance: 'बैलेंस',
    days: 'दिन',
    'Daily Report': 'डेली रिपोर्ट',
    'Release & Pack': 'रिलीज़ और पैक',
    'Ironmen Error': 'आयरनमैन गलती',
    'Scanned & Pending': 'स्कैन और बाकी',
    Rewash: 'रीवॉश',
    Repair: 'मरम्मत',
    'Washing Error': 'धुलाई गलती',
    'GRC Count': 'GRC गिनती',
    'Staff Error': 'स्टाफ गलती',
    'Electricity & Water': 'बिजली और पानी',
    'UL ↔ PC Transfer': 'UL ↔ PC ट्रांसफर',
    'Spot Treatment': 'दाग सफाई',
    'Quick Fix': 'क्विक फिक्स',
    Boiler: 'बॉयलर',
    Reports: 'रिपोर्ट',
    'Performance Overview': 'प्रदर्शन अवलोकन',
    Settings: 'सेटिंग',
    'Office work': 'ऑफिस का काम',
    'Process work': 'प्रोसेस का काम',
    Manage: 'मैनेज',
    'Today at a glance': 'आज एक नज़र में',
    Lots: 'लॉट',
    Release: 'रिलीज़',
    Pack: 'पैक',
    Urgent: 'अर्जेंट',
    'Lot 1 – Morning': 'लॉट 1 – सुबह',
    'Lot 2 – Evening': 'लॉट 2 – शाम',
    'Tap names': 'नाम दबाएँ',
    'Tap store': 'स्टोर दबाएँ',
    'Choose at least one name': 'कम से कम एक नाम चुनें',
    Karigar: 'कारीगर',
    'Today total': 'आज कुल',
    'Add karigar': 'कारीगर जोड़ें',
    'This week': 'इस हफ्ते',
    'Full wash': 'फुल वॉश',
    Spotting: 'स्पॉटिंग',
    Given: 'दिया',
    Received: 'मिला',
    'Still pending': 'अभी बाकी',
    'Pending by date': 'तारीख अनुसार बाकी',
    'Scanned today': 'आज स्कैन',
    'Upload scanned file': 'स्कैन फाइल डालें',
    'This file is': 'यह फाइल है',
    'Upload Workshop Out file': 'वर्कशॉप आउट फाइल डालें',
    'Due date-wise': 'तारीख अनुसार ड्यू',
    'Garments due till today': 'आज तक ड्यू कपड़े',
    Overdue: 'देर हो चुकी',
    'Store-wise': 'स्टोर अनुसार',
    'Reading file… please wait': 'फाइल पढ़ रहे हैं… रुकिए',
    'Check and confirm': 'जाँचें और पक्का करें',
    Sent: 'भेजा',
    'Back from repair': 'मरम्मत से वापस',
    'Released to store': 'स्टोर को रिलीज़',
    'Open repairs': 'बाकी मरम्मत',
    'Last reading': 'पिछली रीडिंग',
    'Today reading': 'आज की रीडिंग',
    'Used today': 'आज खपत',
    'Add error': 'गलती जोड़ें',
    'Error type': 'गलती का प्रकार',
    errors: 'गलतियाँ',
    'Send to': 'किसे भेजें',
    'Incoming — to clear': 'आया हुआ — क्लियर करें',
    'Sent by us — pending': 'हमने भेजा — बाकी',
    Clear: 'क्लियर',
    Start: 'चालू',
    Stop: 'बंद',
    Running: 'चल रहा',
    Off: 'बंद है',
    'Running time today': 'आज चलने का समय',
    'Submit report': 'रिपोर्ट जमा करें',
    Submitted: 'जमा हो गया',
    'Still to fill': 'अभी भरना है',
    'Fill all points first': 'पहले सब पॉइंट भरें',
    'Quantity (pcs)': 'संख्या (पीस)',
    Reason: 'कारण',
    'Mistake by': 'गलती किसकी',
    'Done by': 'किसने किया',
    'Checked by': 'किसने जाँचा',
    Opened: 'खोला',
    'Iron done': 'आयरन हुआ',
    'Washing lot': 'धुलाई लॉट',
    'Iron lot': 'आयरन लॉट',
    'Add lot': 'लॉट जोड़ें',
    'WN Garments': 'बिना नंबर (WN) कपड़े',
    'Tag missing (WN garment)': 'टैग गायब (WN कपड़ा)',
    'Detached tag': 'अलग हुआ टैग',
    Adjust: 'एडजस्ट',
    Adjusted: 'एडजस्ट हुआ',
    'Take photo': 'फोटो लें',
    'Ironed by': 'किसने आयरन किया',
    'Invoice no.': 'इनवॉइस नं.',
    'Saree Polish': 'साड़ी पॉलिश',
    'Sent to': 'किसे भेजा',
    Receive: 'वापस लिया',
    'Reason for difference': 'फर्क का कारण',
    'Sent for polish — pending': 'पॉलिश को भेजी — बाकी',
    'Workshop Operational Control': 'वर्कशॉप ऑपरेशनल कंट्रोल',
    Cleared: 'क्लियर',
    'Nothing yet': 'अभी कुछ नहीं',
    'Locked after saving': 'सेव के बाद बदल नहीं सकते',
  },
  bn: {
    'Good morning': 'সুপ্রভাত',
    'Good afternoon': 'নমস্কার',
    'Good evening': 'শুভ সন্ধ্যা',
    'Your name': 'আপনার নাম',
    'Type your name': 'আপনার নাম লিখুন',
    'Enter PIN': 'পিন দিন',
    Next: 'পরবর্তী',
    Login: 'লগইন',
    'Wrong name or PIN': 'নাম বা পিন ভুল',
    'Choose unit': 'ইউনিট বাছুন',
    Unit: 'ইউনিট',
    Logout: 'লগ আউট',
    Refresh: 'রিফ্রেশ',
    Back: 'ফিরে যান',
    Today: 'আজ',
    Save: 'সেভ করুন',
    'Save all': 'সব সেভ করুন',
    Saved: 'সেভ হয়েছে',
    'Saving…': 'সেভ হচ্ছে…',
    Cancel: 'বাতিল',
    Delete: 'মুছুন',
    'Confirm & save': 'নিশ্চিত করে সেভ',
    Add: 'যোগ',
    Search: 'খুঁজুন',
    All: 'সব',
    'Show more': 'আরও দেখুন',
    Yes: 'হ্যাঁ',
    No: 'না',
    Total: 'মোট',
    Pending: 'বাকি',
    Done: 'হয়েছে',
    pcs: 'পিস',
    Points: 'পয়েন্ট',
    Remarks: 'মন্তব্য',
    Note: 'নোট',
    Details: 'বিবরণ',
    Store: 'স্টোর',
    Garment: 'কাপড়',
    'Who did it?': 'কে করেছে?',
    'Saved as': 'এই নামে সেভ',
    Balance: 'ব্যালেন্স',
    days: 'দিন',
    'Daily Report': 'দৈনিক রিপোর্ট',
    'Release & Pack': 'রিলিজ ও প্যাক',
    'Ironmen Error': 'আয়রনম্যান ভুল',
    'Scanned & Pending': 'স্ক্যান ও বাকি',
    Rewash: 'রিওয়াশ',
    Repair: 'মেরামত',
    'Washing Error': 'ধোলাই ভুল',
    'GRC Count': 'GRC গণনা',
    'Staff Error': 'স্টাফ ভুল',
    'Electricity & Water': 'বিদ্যুৎ ও জল',
    'UL ↔ PC Transfer': 'UL ↔ PC ট্রান্সফার',
    'Spot Treatment': 'দাগ পরিষ্কার',
    'Quick Fix': 'কুইক ফিক্স',
    Boiler: 'বয়লার',
    Reports: 'রিপোর্ট',
    'Performance Overview': 'কর্মক্ষমতা সারসংক্ষেপ',
    Settings: 'সেটিংস',
    'Office work': 'অফিসের কাজ',
    'Process work': 'প্রসেসের কাজ',
    Manage: 'ম্যানেজ',
    'Today at a glance': 'আজ এক নজরে',
    Lots: 'লট',
    Release: 'রিলিজ',
    Pack: 'প্যাক',
    Urgent: 'জরুরি',
    'Lot 1 – Morning': 'লট ১ – সকাল',
    'Lot 2 – Evening': 'লট ২ – সন্ধ্যা',
    'Tap names': 'নাম টিপুন',
    'Tap store': 'স্টোর টিপুন',
    'Choose at least one name': 'অন্তত একটি নাম বাছুন',
    Karigar: 'কারিগর',
    'Today total': 'আজ মোট',
    'Add karigar': 'কারিগর যোগ',
    'This week': 'এই সপ্তাহ',
    'Full wash': 'ফুল ওয়াশ',
    Spotting: 'স্পটিং',
    Given: 'দেওয়া',
    Received: 'পাওয়া',
    'Still pending': 'এখনও বাকি',
    'Pending by date': 'তারিখ অনুযায়ী বাকি',
    'Scanned today': 'আজ স্ক্যান',
    'Upload scanned file': 'স্ক্যান ফাইল দিন',
    'This file is': 'এই ফাইলটি',
    'Upload Workshop Out file': 'ওয়ার্কশপ আউট ফাইল দিন',
    'Due date-wise': 'তারিখ অনুযায়ী ডিউ',
    'Garments due till today': 'আজ পর্যন্ত ডিউ কাপড়',
    Overdue: 'সময় পার হয়েছে',
    'Store-wise': 'স্টোর অনুযায়ী',
    'Reading file… please wait': 'ফাইল পড়া হচ্ছে… অপেক্ষা করুন',
    'Check and confirm': 'যাচাই করে সেভ',
    Sent: 'পাঠানো হয়েছে',
    'Back from repair': 'মেরামত থেকে এসেছে',
    'Released to store': 'স্টোরে রিলিজ',
    'Open repairs': 'বাকি মেরামত',
    'Last reading': 'আগের রিডিং',
    'Today reading': 'আজকের রিডিং',
    'Used today': 'আজ খরচ',
    'Add error': 'ভুল যোগ',
    'Error type': 'ভুলের ধরন',
    errors: 'ভুল',
    'Send to': 'কাকে পাঠাবেন',
    'Incoming — to clear': 'এসেছে — ক্লিয়ার করুন',
    'Sent by us — pending': 'আমরা পাঠিয়েছি — বাকি',
    Clear: 'ক্লিয়ার',
    Start: 'চালু',
    Stop: 'বন্ধ',
    Running: 'চলছে',
    Off: 'বন্ধ',
    'Running time today': 'আজ চলার সময়',
    'Submit report': 'রিপোর্ট জমা দিন',
    Submitted: 'জমা হয়েছে',
    'Still to fill': 'এখনও পূরণ বাকি',
    'Fill all points first': 'আগে সব পয়েন্ট পূরণ করুন',
    'Quantity (pcs)': 'সংখ্যা (পিস)',
    Reason: 'কারণ',
    'Mistake by': 'ভুল কার',
    'Done by': 'কে করেছে',
    'Checked by': 'কে দেখেছে',
    Opened: 'খোলা হয়েছে',
    'Iron done': 'আয়রন হয়েছে',
    'Washing lot': 'ধোলাই লট',
    'Iron lot': 'আয়রন লট',
    'Add lot': 'লট যোগ',
    'WN Garments': 'নম্বর ছাড়া (WN) কাপড়',
    'Tag missing (WN garment)': 'ট্যাগ নেই (WN কাপড়)',
    'Detached tag': 'আলাদা ট্যাগ',
    Adjust: 'অ্যাডজাস্ট',
    Adjusted: 'অ্যাডজাস্ট হয়েছে',
    'Take photo': 'ছবি তুলুন',
    'Ironed by': 'কে আয়রন করেছে',
    'Invoice no.': 'ইনভয়েস নং',
    'Saree Polish': 'শাড়ি পালিশ',
    'Sent to': 'কাকে পাঠানো',
    Receive: 'ফেরত নেওয়া',
    'Reason for difference': 'পার্থক্যের কারণ',
    'Sent for polish — pending': 'পালিশে পাঠানো — বাকি',
    'Workshop Operational Control': 'ওয়ার্কশপ অপারেশনাল কন্ট্রোল',
    Cleared: 'ক্লিয়ার',
    'Nothing yet': 'এখনও কিছু নেই',
    'Locked after saving': 'সেভের পরে বদলানো যাবে না',
  },
};

export function T(key: string, lang: LangId): string {
  if (lang === 'en') return key;
  return TR[lang]?.[key] || key;
}

export interface ModuleDef {
  id: string;
  t: string;
  icon: string;
  grp: 'daily' | 'office' | 'process' | 'admin';
}

export const MODULES: ModuleDef[] = [
  { id: 'daily', t: 'Daily Report', icon: 'daily', grp: 'daily' },
  { id: 'rp', t: 'Release & Pack', icon: 'box', grp: 'office' },
  { id: 'scan', t: 'Scanned & Pending', icon: 'due', grp: 'office' },
  { id: 'wn', t: 'WN Garments', icon: 'tag', grp: 'office' },
  { id: 'saree', t: 'Saree Polish', icon: 'saree', grp: 'office' },
  { id: 'iron', t: 'Ironmen Error', icon: 'iron', grp: 'office' },
  { id: 'rewash', t: 'Rewash', icon: 'rewash', grp: 'office' },
  { id: 'repair', t: 'Repair', icon: 'fix', grp: 'office' },
  { id: 'washerr', t: 'Washing Error', icon: 'wash', grp: 'office' },
  { id: 'grc', t: 'GRC Count', icon: 'grc', grp: 'office' },
  { id: 'staffErr', t: 'Staff Error', icon: 'user', grp: 'office' },
  { id: 'meter', t: 'Electricity & Water', icon: 'bolt', grp: 'office' },
  { id: 'spot', t: 'Spot Treatment', icon: 'spot', grp: 'process' },
  { id: 'quickfix', t: 'Quick Fix', icon: 'needle', grp: 'process' },
  { id: 'boiler', t: 'Boiler', icon: 'boiler', grp: 'process' },
  { id: 'reports', t: 'Reports', icon: 'chart', grp: 'admin' },
  { id: 'performance', t: 'Performance Overview', icon: 'trend', grp: 'admin' },
  { id: 'settings', t: 'Settings', icon: 'gear', grp: 'admin' },
];

export const GROUPS: [ModuleDef['grp'], string][] = [
  ['daily', ''],
  ['office', 'Office work'],
  ['process', 'Process work'],
  ['admin', 'Manage'],
];

export interface FormFieldDef {
  k: string;
  t: 'store' | 'list' | 'text' | 'seg' | 'pct' | 'num';
  l: string;
  src?: string;
  def?: string;
  caps?: boolean;
  opt?: boolean;
  opts?: [string, string][];
}

export const FORMS: Record<'repair' | 'spot' | 'quickfix' | 'washerr', FormFieldDef[]> = {
  repair: [
    { k: 'store', t: 'store', l: 'Store' },
    { k: 'garment', t: 'list', src: 'garments', l: 'Garment' },
    { k: 'tag', t: 'text', l: 'Invoice / Barcode no.', caps: true },
    { k: 'damage', t: 'list', src: 'damageTypes', l: 'Type of damage' },
    { k: 'sentTo', t: 'list', src: 'repairPlaces', l: 'Sent to', def: 'PP' },
    { k: 'note', t: 'text', l: 'Note', opt: true },
  ],
  spot: [
    { k: 'store', t: 'store', l: 'Store' },
    { k: 'garment', t: 'list', src: 'garments', l: 'Garment' },
    { k: 'spot', t: 'list', src: 'spotTypes', l: 'Spot type' },
    { k: 'tag', t: 'text', l: 'Barcode / Tag no.', caps: true },
    { k: 'pct', t: 'pct', l: 'How much removed?' },
    { k: 'by', t: 'list', src: 'teams.spot', l: 'Who did it?' },
  ],
  quickfix: [
    { k: 'store', t: 'store', l: 'Store' },
    { k: 'garment', t: 'list', src: 'garments', l: 'Garment' },
    { k: 'repair', t: 'list', src: 'repairTypes', l: 'Repair' },
    {
      k: 'kind',
      t: 'seg',
      opts: [
        ['QF', 'Quick Fix (QF)'],
        ['IR', 'Internal Repair (IR)'],
      ],
      l: 'Type',
    },
    { k: 'tag', t: 'text', l: 'Barcode / Tag no.', caps: true },
    { k: 'by', t: 'list', src: 'teams.qf', l: 'Who did it?' },
  ],
  washerr: [
    { k: 'store', t: 'store', l: 'Store' },
    { k: 'tag', t: 'text', l: 'Barcode / Tag no.', caps: true },
    { k: 'garment', t: 'list', src: 'garments', l: 'Garment' },
    { k: 'damage', t: 'list', src: 'damageTypes', l: 'Damage' },
    { k: 'points', t: 'num', l: 'Severity points (1–10)' },
    { k: 'by', t: 'list', src: 'teams.wash', l: 'Damage done by' },
    { k: 'note', t: 'text', l: 'Details', opt: true },
  ],
};

export const DSECTIONS = [
  { id: 'S1', t: 'Receiving & checking' },
  { id: 'S2', t: 'Planning & pending work' },
  { id: 'S3', t: 'Mistakes' },
  { id: 'S4', t: 'Production' },
  { id: 'S5', t: 'Others' },
];

export interface DailyRowColDef {
  k: string;
  t: 'text' | 'date' | 'staff' | 'store' | 'list';
  l: string;
  caps?: boolean;
  src?: string;
}

export interface DailyFieldDef {
  k: string;
  t: 'num' | 'yn' | 'text' | 'staff' | 'staffm' | 'store' | 'rows';
  l: string;
  show?: [string, string];
  when?: 'ironZero';
  need?: (d: Record<string, any>) => boolean;
  mail?: string;
  cols?: DailyRowColDef[];
}

export interface DailyItemDef {
  s: string;
  l: string;
  auto?: 'wn' | 'saree' | 'iron';
  carry?: string;
  f: DailyFieldDef[];
}

const IFY = (k: string): Partial<DailyFieldDef> => ({ show: [k, 'Yes'] });
const IFN = (k: string): Partial<DailyFieldDef> => ({ show: [k, 'No'] });
const WHO = (k: string, l = 'Done by', ifQty?: string): DailyFieldDef => ({
  k,
  t: 'staffm',
  l,
  ...(ifQty ? { need: (d) => Number(d[ifQty]) > 0 } : {}),
});

export const DAILY: DailyItemDef[] = [
  { s: 'S1', l: 'WN (without number) garments adjusted', auto: 'wn', f: [] },
  { s: 'S1', l: 'Saree polish — sent & received', auto: 'saree', f: [] },
  { s: 'S1', l: 'Ironmen dispute garments checked', f: [WHO('d10_by', 'Checked by')] },
  {
    s: 'S1',
    l: 'Vehicle delay',
    f: [
      { k: 'd11_yn', t: 'yn', l: 'Was the vehicle late?' },
      { k: 'd11_r', t: 'text', l: 'Reason', ...IFY('d11_yn') },
    ],
  },
  {
    s: 'S2',
    l: 'Garment release due & action plan',
    f: [
      { k: 'd12_yn', t: 'yn', l: 'Any release due?' },
      { k: 'd12_t', t: 'text', l: 'Action plan', ...IFY('d12_yn') },
    ],
  },
  {
    s: 'S2',
    l: 'Urgent garments delayed',
    f: [
      { k: 'd13_yn', t: 'yn', l: 'Urgent garment ready late?' },
      { k: 'd13_r', t: 'text', l: 'Reason for delay', ...IFY('d13_yn') },
    ],
  },
  {
    s: 'S2',
    l: 'Bedsheet / blanket / curtain / parda',
    f: [
      { k: 'd14_q', t: 'num', l: 'Packed today (pcs)' },
      WHO('d14_by', 'Done by', 'd14_q'),
      { k: 'd14_yn', t: 'yn', l: 'Any pending / not done?' },
      { k: 'd14_r', t: 'text', l: 'Reason', ...IFY('d14_yn') },
    ],
  },
  {
    s: 'S2',
    l: 'Work pending (packing / saree noting / rewash check)',
    f: [
      { k: 'd15_yn', t: 'yn', l: 'Work pending?' },
      { k: 'd15_t', t: 'text', l: 'What is pending', ...IFY('d15_yn') },
    ],
  },
  {
    s: 'S3',
    l: 'Challan name entry error',
    f: [
      { k: 'd16_yn', t: 'yn', l: 'Any mistake?' },
      {
        k: 'd16_rows',
        t: 'rows',
        l: 'Challan details',
        show: ['d16_yn', 'Yes'],
        mail: 'Admin + Accounts',
        cols: [
          { k: 'ch', t: 'text', l: 'Challan no.', caps: true },
          { k: 'wrong', t: 'text', l: 'Name written (wrong)' },
          { k: 'right', t: 'text', l: 'Correct name' },
          { k: 'by', t: 'staff', l: 'Mistake by' },
        ],
      },
    ],
  },
  {
    s: 'S3',
    l: 'Garment not sent (loading mistake)',
    f: [
      { k: 'd17_yn', t: 'yn', l: 'Any garment not sent?' },
      { k: 'd17_by', t: 'staff', l: 'Mistake by', ...IFY('d17_yn') },
      { k: 'd17_st', t: 'store', l: 'Store', ...IFY('d17_yn') },
      { k: 'd17_t', t: 'text', l: 'Details (garment, invoice, quantity)', ...IFY('d17_yn') },
    ],
  },
  {
    s: 'S3',
    l: 'Extra sticker but garment missing',
    carry: 'd18_rows',
    f: [
      { k: 'd18_yn', t: 'yn', l: 'Any case?' },
      {
        k: 'd18_rows',
        t: 'rows',
        l: 'Garments',
        show: ['d18_yn', 'Yes'],
        mail: 'Admin + Store',
        cols: [
          { k: 'inv', t: 'text', l: 'Invoice no.', caps: true },
          { k: 'g', t: 'list', l: 'Garment', src: 'garments' },
          { k: 'st', t: 'store', l: 'Store' },
        ],
      },
    ],
  },
  {
    s: 'S3',
    l: 'Extra garment (scanned) but sticker missing',
    carry: 'd19_rows',
    f: [
      { k: 'd19_yn', t: 'yn', l: 'Any case?' },
      {
        k: 'd19_rows',
        t: 'rows',
        l: 'Garments',
        show: ['d19_yn', 'Yes'],
        mail: 'Admin + Store',
        cols: [
          { k: 'inv', t: 'text', l: 'Invoice no.', caps: true },
          { k: 'g', t: 'list', l: 'Garment', src: 'garments' },
          { k: 'st', t: 'store', l: 'Store' },
        ],
      },
    ],
  },
  {
    s: 'S3',
    l: 'Packing / release mistakes',
    f: [
      { k: 'd20_yn', t: 'yn', l: 'Any mistake?' },
      {
        k: 'd20_rows',
        t: 'rows',
        l: 'Mistakes',
        show: ['d20_yn', 'Yes'],
        mail: '→ Staff Error',
        cols: [
          { k: 'by', t: 'staff', l: 'Mistake by' },
          { k: 't', t: 'text', l: 'Mistake details' },
        ],
      },
    ],
  },
  {
    s: 'S3',
    l: 'Software or scanning issue',
    f: [
      { k: 'd21_yn', t: 'yn', l: 'Any issue?' },
      { k: 'd21_t', t: 'text', l: 'What was the issue', ...IFY('d21_yn') },
    ],
  },
  {
    s: 'S4',
    l: 'Previous day GRC status',
    carry: 'd22_rows',
    f: [
      { k: 'd22_clear', t: 'yn', l: "Yesterday's GRC clear?" },
      {
        k: 'd22_rows',
        t: 'rows',
        l: 'Pending GRC',
        show: ['d22_clear', 'No'],
        mail: 'Admin + Store',
        cols: [
          { k: 'st', t: 'store', l: 'Store' },
          { k: 'd', t: 'date', l: 'GRC date' },
        ],
      },
    ],
  },
  {
    s: 'S4',
    l: 'Date sorting',
    f: [
      { k: 'd23_yn', t: 'yn', l: 'Sorting done?' },
      { k: 'd23_by', t: 'staff', l: 'Done by', ...IFY('d23_yn') },
      { k: 'd23_r', t: 'text', l: 'Why not done', ...IFN('d23_yn') },
    ],
  },
  {
    s: 'S4',
    l: 'Iron bhaga',
    f: [
      { k: 'd24_yn', t: 'yn', l: 'Bhaga done?' },
      { k: 'd24_by', t: 'staff', l: 'Done by', ...IFY('d24_yn') },
      { k: 'd24_r', t: 'text', l: 'Why not done', ...IFN('d24_yn') },
    ],
  },
  {
    s: 'S4',
    l: 'Ironmen errors noted today',
    auto: 'iron',
    f: [{ k: 'd2_r', t: 'text', l: 'No entry today — reason', when: 'ironZero' }],
  },
  {
    s: 'S5',
    l: 'External visitors',
    f: [
      { k: 'd28_yn', t: 'yn', l: 'Any visitor?' },
      { k: 'd28_t', t: 'text', l: 'Visitor names', ...IFY('d28_yn') },
    ],
  },
  {
    s: 'S5',
    l: 'Extra material / garment received from store',
    f: [
      { k: 'd29_yn', t: 'yn', l: 'Anything extra?' },
      {
        k: 'd29_rows',
        t: 'rows',
        l: 'Items',
        show: ['d29_yn', 'Yes'],
        cols: [
          { k: 'st', t: 'store', l: 'Store' },
          { k: 'item', t: 'list', l: 'What', src: 'extraItems' },
          { k: 't', t: 'text', l: 'Details / quantity' },
        ],
      },
    ],
  },
  { s: 'S5', l: 'Workshop checking — unattended garments, wrong placement, cleanliness', f: [WHO('d30_by', 'Checked by')] },
  {
    s: 'S5',
    l: 'Any other remark',
    f: [
      { k: 'd31_yn', t: 'yn', l: 'Anything to report?' },
      { k: 'd31_t', t: 'text', l: 'Remark', ...IFY('d31_yn') },
    ],
  },
];

export const THEMES: [ThemeId, string, string[]][] = [
  ['hollywood', 'Hollywood Green & Gold', ['#26311A', '#3B4C28', '#56703A', '#F7CF87']],
  ['emerald', 'Emerald & Champagne', ['#04221A', '#0B3B2E', '#17644E', '#DCC07E']],
  ['navy', 'Royal Navy & Gold', ['#0E1830', '#14213D', '#2B4378', '#E9CD86']],
  ['plum', 'Plum & Rose Gold', ['#1C0B1C', '#3A1838', '#64305D', '#E2B29C']],
  ['charcoal', 'Charcoal & Copper', ['#101112', '#1E2124', '#3B4146', '#DCA677']],
];

export const LISTS: [string, string][] = [
  ['teams.office', 'Office staff (release / pack, checks)'],
  ['teams.iron', 'Ironmen (karigar)'],
  ['teams.wash', 'Washing staff'],
  ['teams.spot', 'Spot treatment staff'],
  ['teams.qf', 'Quick fix staff'],
  ['rounds', 'Release & Pack rounds'],
  ['rewashTypes', 'Rewash types'],
  ['garments', 'Garments'],
  ['spotTypes', 'Spot types'],
  ['repairTypes', 'Repair types'],
  ['damageTypes', 'Damage types'],
  ['repairPlaces', 'Repair sent to (outside)'],
  ['sareeTo', 'Saree polish — sent to'],
  ['extraItems', 'Extra material items'],
  ['itCodes', 'Services that are always UL (IT)'],
];

export const RMENU: [string, [string, string, string][]][] = [
  [
    'Daily',
    [
      ['daily', 'Daily Workshop Report', 'daily'],
      ['checklist', 'Who filled what', 'check'],
    ],
  ],
  [
    'Operations',
    [
      ['rp', 'Release & Pack', 'box'],
      ['scan', 'Scanned & Pending', 'due'],
      ['wn', 'WN Garments', 'tag'],
      ['rewash', 'Rewash', 'rewash'],
      ['repair', 'Repair', 'fix'],
      ['saree', 'Saree Polish', 'saree'],
      ['lots', 'Washing & iron lots', 'wash'],
    ],
  ],
  [
    'Quality',
    [
      ['iron', 'Ironmen Error', 'iron'],
      ['washerr', 'Washing Error', 'wash'],
      ['staffErr', 'Staff Error', 'user'],
      ['grc', 'GRC Count', 'grc'],
      ['spot', 'Spot Treatment', 'spot'],
      ['quickfix', 'Quick Fix', 'needle'],
    ],
  ],
  [
    'Utilities',
    [
      ['meter', 'Electricity & Water', 'bolt'],
      ['boiler', 'Boiler', 'boiler'],
    ],
  ],
];

export const SPANELS: [string, string, string, string, boolean?][] = [
  ['general', 'General', 'gear', 'Colour theme · units'],
  ['stores', 'Stores', 'box', 'Codes, file names, UL / PC, email'],
  ['staff', 'Staff', 'user', 'Office, ironmen, washing, spot, quick fix'],
  ['lists', 'Lists', 'grc', 'Garments, damage, repair, saree, rounds…'],
  ['boilers', 'Boilers & meters', 'boiler', 'Boilers with their staff, meters'],
  ['alerts', 'Email alerts', 'mail', 'Who gets which email'],
  ['users', 'Users & access', 'lock', 'Logins, PINs, units, screens', true],
  ['backup', 'Backup & move', 'up', 'Export / import to a new file', true],
];

export const OFFICE_M = ['rp', 'iron', 'scan', 'wn', 'saree', 'rewash', 'repair', 'washerr', 'grc', 'meter'];
export const PROCESS_M = ['spot', 'quickfix', 'boiler'];

export function n0(x: unknown): string {
  return Number(x || 0).toLocaleString('en-IN');
}

export function sumNums(arr: unknown[]): number {
  return arr.reduce<number>((t, x) => t + (Number(x) || 0), 0);
}

export function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

export function dObj(d: string): Date {
  const p = d.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}

export function addD(d: string, n: number): string {
  const dt = dObj(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function fD(d?: string): string {
  if (!d) return '';
  const dt = dObj(String(d).slice(0, 10));
  return `${dt.getUTCDate()} ${MON[dt.getUTCMonth()]}`;
}

export function fDY(d?: string): string {
  if (!d) return '';
  const s = String(d).slice(0, 10).split('-');
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : d;
}

export function fLong(d?: string): string {
  if (!d) return '';
  const dt = dObj(d);
  return `${DAYS[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MON[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((dObj(b.slice(0, 10)).getTime() - dObj(a.slice(0, 10)).getTime()) / 86400000);
}

export function weekStartC(d: string): string {
  return addD(d, -((dObj(d).getUTCDay() + 6) % 7));
}

export function hm(m: number): string {
  m = Math.max(0, Math.round(m || 0));
  return `${Math.floor(m / 60)}h ${('0' + (m % 60)).slice(-2)}m`;
}

export function istToday(): string {
  return new Date(Date.now() + 19800000).toISOString().slice(0, 10);
}

export function nowHM(): string {
  const d = new Date(Date.now() + 19800000);
  return ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
}

export function mDiff(a: string, b: string): number {
  const x = a.split(':').map(Number);
  const y = b.split(':').map(Number);
  const m = y[0] * 60 + y[1] - (x[0] * 60 + x[1]);
  return m < 0 ? m + 1440 : m;
}

export function greet(): string {
  const h = Number(nowHM().slice(0, 2));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function modTitle(id: string): string {
  return MODULES.find((m) => m.id === id)?.t || id;
}

export function getSettingPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

export function photoUrl(id: string): string {
  return `/photo/${id}`;
}
