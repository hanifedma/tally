// ============================================================
//  Tally — interface translations (English ⇄ Korean).
//
//  English is the default; the choice follows the account, so switching
//  language on a laptop switches it on the phone too.
//
//  Only the interface is translated. Notes, category names and account
//  names are the user's own words and are never touched — a category
//  renamed to "커피" stays "커피" in English.
//
//  Dates are not hard-coded here. Weekday and month names come from
//  Intl.DateTimeFormat with the active locale, computed once per language
//  change rather than once per row.
// ============================================================

export const LANGS = ["en", "ko"];
export const DEFAULT_LANG = "en";
export const LOCALE = { en: "en-US", ko: "ko-KR" };

const STRINGS = {
  en: {
    "app.name": "Tally",
    "app.tagline": "Every won and rupiah, counted once.",

    // --- shell ---
    "tab.log": "Log",
    "tab.insights": "Insights",
    "tab.accounts": "Accounts",
    "nav.prevPeriod": "Previous month",
    "nav.nextPeriod": "Next month",
    "nav.thisPeriod": "Back to this month",
    "theme.toggle": "Switch between light and dark",
    "lang.toggle": "Change language",
    "menu.open": "Menu",
    "search.open": "Search",
    "search.placeholder": "Search notes, categories, accounts",
    "search.clear": "Clear search",
    "search.results": "{n} found",
    "search.none": "Nothing matches “{q}”.",
    "add.new": "Add a transaction",

    // --- sign in ---
    "login.h1": "Money, counted simply.",
    "login.sub": "One ledger for every account and every currency — on your phone and your laptop at the same time.",
    "login.google": "Continue with Google",
    "login.wait": "Getting sign-in ready…",
    "login.privacy": "Your ledger is yours. Nobody else can read it.",
    "login.f1": "Real-time on every device",
    "login.f1sub": "Enter it on your phone, it is on your laptop before you look up.",
    "login.f2": "Won and rupiah, side by side",
    "login.f2sub": "Every account keeps its own currency; the totals still add up.",
    "login.f3": "Budgets that follow your payday",
    "login.f3sub": "Set the month to start on the day you are actually paid.",
    "login.or": "or",
    "login.local": "Use without an account",
    "login.localSub": "Everything stays on this device. You can sign in later and bring it with you.",
    "signout": "Sign out",
    "signout.confirm": "Sign out of Tally?",
    "signout.body": "Your ledger stays in the cloud. Signing back in brings it all back.",

    // --- on this device only ---
    "local.status": "On this device",
    "local.title": "This device only",
    "local.help": "Your ledger is saved here and sent nowhere. Sign in to sync it with your other devices and keep a copy that outlives this one.",
    "local.signIn": "Sign in to sync",
    "local.signInHelp": "Keeps everything you have entered.",
    "local.erase": "Erase everything on this device",
    "local.eraseConfirm": "Erase this ledger?",
    "local.eraseBody": "It exists only on this device. This cannot be undone — export a CSV first if you want to keep it.",
    "local.erased": "Erased.",
    "local.banner": "Saved on this device only.",
    "local.bannerAction": "Sign in to sync",
    "migrate.title": "Bring this ledger with you?",
    "migrate.body": "You have {n} on this device. Copy them into your account, so they are on your phone too?",
    "migrate.count": "{n} transactions",
    "migrate.yes": "Copy to my account",
    "migrate.no": "Start fresh",
    "migrate.working": "Copying…",
    "migrate.done": "Copied. Everything is in your account now.",
    "migrate.failed": "Couldn’t copy it. Nothing was lost — it is still on this device.",

    // --- setup ---
    "setup.h1": "One setup step is left",
    "setup.p1": "Tally is not connected to a database yet. Put your Supabase project URL and anon key into <code>supabase-config.js</code>, then reload.",
    "setup.p2": "Step by step, about ten minutes and free: <code>SETUP.md</code>.",
    "setup.missingUrl": "Missing: the project URL",
    "setup.missingKey": "Missing: the anon key",
    "setup.missingClient": "Missing: the Google client id",
    "setup.tryLocal": "Use it on this device only",
    "setup.tryLocalHelp": "Nothing to set up. Everything is saved on this device, and you can sign in later without losing it.",

    // --- month summary ---
    "sum.income": "Income",
    "sum.expenses": "Expenses",
    "sum.net": "Net",
    "sum.periodRange": "{start} – {end}",

    // --- log ---
    "log.empty.h": "Nothing here yet",
    "log.empty.p": "Add your first transaction and this month starts adding up.",
    "log.empty.cta": "Add a transaction",
    "log.emptyMonth.h": "No transactions this month",
    "log.emptyMonth.p": "Nothing was recorded between {start} and {end}.",
    "log.dayTotal": "Day total",
    "log.uncategorised": "Uncategorised",
    "log.noAccount": "No account",
    "log.transferTo": "{from} → {to}",
    "log.pending": "Waiting to sync",
    "log.showMore": "Show {n} more",

    // --- insights ---
    "ins.budget": "Budget",
    "ins.budgetSet": "Set a budget",
    "ins.budgetEdit": "Edit budgets",
    "ins.budgetNone.h": "No budget set",
    "ins.budgetNone.p": "A ceiling for the month makes overspending visible before the month ends.",
    "ins.budgetLeft": "{amount} left",
    "ins.budgetOver": "{amount} over",
    "ins.budgetTotal": "Total budget",
    "ins.spentOf": "{spent} of {limit}",
    "ins.paceAhead": "On track — {pct} of the month gone",
    "ins.paceBehind": "Ahead of pace — {pct} of the month gone",
    "ins.breakdown": "Where it went",
    "ins.breakdownIncome": "Where it came from",
    "ins.trend": "Last six months",
    "ins.trendExpense": "Expenses",
    "ins.trendIncome": "Income",
    "ins.top": "Most frequent",
    "ins.topCount": "{n}×",
    "ins.avgDay": "Average a day",
    "ins.avgProjected": "Projected month",
    "ins.biggest": "Largest single expense",
    "ins.empty": "Nothing to chart yet.",
    "ins.showExpense": "Expenses",
    "ins.showIncome": "Income",

    // --- accounts ---
    "acc.netWorth": "Net worth",
    "acc.assets": "Assets",
    "acc.liabilities": "Card balance",
    "acc.add": "Add an account",
    "acc.edit": "Edit account",
    "acc.new": "New account",
    "acc.name": "Name",
    "acc.namePlaceholder": "Bank, wallet, card…",
    "acc.kind": "Type",
    "acc.currency": "Currency",
    "acc.opening": "Starting balance",
    "acc.openingHelp": "What was in it before you started using Tally.",
    "acc.colour": "Colour",
    "acc.archive": "Archive",
    "acc.archived": "Archived",
    "acc.unarchive": "Unarchive",
    "acc.archivedHelp": "Hidden from the pickers. Its transactions still count.",
    "acc.showArchived": "Show archived",
    "acc.delete": "Delete account",
    "acc.deleteConfirm": "Delete “{name}”?",
    "acc.deleteBody": "Its {n} transactions are kept, but they will no longer belong to an account. Archiving is usually what you want instead.",
    "acc.empty.h": "No accounts yet",
    "acc.empty.p": "An account is anywhere money sits: a wallet, a bank, a card.",
    "acc.kind.cash": "Cash",
    "acc.kind.bank": "Bank",
    "acc.kind.card": "Card",
    "acc.kind.ewallet": "E-wallet",
    "acc.kind.savings": "Savings",
    "acc.txCount": "{n} transactions",
    "acc.viewLog": "See its transactions",
    "acc.inMain": "≈ {amount}",

    // --- transaction editor ---
    "tx.new": "New transaction",
    "tx.edit": "Edit transaction",
    "tx.expense": "Expense",
    "tx.income": "Income",
    "tx.transfer": "Transfer",
    "tx.amount": "Amount",
    "tx.category": "Category",
    "tx.categoryPick": "Pick a category",
    "tx.account": "Account",
    "tx.accountFrom": "From",
    "tx.accountTo": "To",
    "tx.accountPick": "Pick an account",
    "tx.note": "Note",
    "tx.notePlaceholder": "What was it for?",
    "tx.date": "Date",
    "tx.time": "Time",
    "tx.today": "Today",
    "tx.yesterday": "Yesterday",
    "tx.save": "Save",
    "tx.saveAnother": "Save & another",
    "tx.saved": "Saved",
    "tx.delete": "Delete",
    "tx.deleteConfirm": "Delete this transaction?",
    "tx.deleteBody": "You can undo this straight afterwards.",
    "tx.deleted": "Deleted",
    "tx.undo": "Undo",
    "tx.converted": "≈ {amount}",
    "tx.rateMissing": "No rate set for {code} — totals will leave this out.",
    "tx.rateFix": "Set a rate",
    "tx.receives": "Receives",
    "tx.receivesHelp": "The two accounts hold different currencies, so say what actually landed.",
    "tx.needAmount": "Enter an amount",
    "tx.needAccount": "Pick an account",
    "tx.needCategory": "Pick a category",
    "tx.needToAccount": "Pick where it goes",
    "tx.needRate": "Set what one {code} is worth first, or this will not count towards any total.",
    "tx.sameAccount": "Pick two different accounts",
    "tx.calcBad": "That is not a number Tally can read",
    "tx.calcHint": "You can type a sum: 12000+3400",
    "tx.calcEquals": "= {amount}",
    "tx.suggestions": "Recent notes",
    "tx.noAccounts": "Add an account first — money has to come from somewhere.",
    "tx.noCategories": "No categories yet. Add one in Settings.",

    // --- categories ---
    "cat.manage": "Categories",
    "cat.add": "Add a category",
    "cat.new": "New category",
    "cat.edit": "Edit category",
    "cat.name": "Name",
    "cat.namePlaceholder": "Coffee, rent, taxi…",
    "cat.icon": "Icon",
    "cat.iconHelp": "Any emoji, or a single character.",
    "cat.colour": "Colour",
    "cat.side": "Side",
    "cat.expense": "Expense",
    "cat.income": "Income",
    "cat.archive": "Archive",
    "cat.archived": "Archived",
    "cat.unarchive": "Unarchive",
    "cat.archivedHelp": "Hidden from the picker. Past transactions keep it.",
    "cat.delete": "Delete category",
    "cat.deleteConfirm": "Delete “{name}”?",
    "cat.deleteBody": "Its {n} transactions are kept and become uncategorised. Archiving is usually what you want instead.",
    "cat.reorder": "Drag to reorder",
    "cat.moveUp": "Move up",
    "cat.moveDown": "Move down",
    "cat.empty": "No categories on this side yet.",

    // --- budgets ---
    "bud.title": "Budgets",
    "bud.total": "Total for the month",
    "bud.perCategory": "Per category",
    "bud.amount": "Amount",
    "bud.none": "No limit",
    "bud.help": "Leave a category blank for no limit. Budgets repeat every month.",
    "bud.sumWarn": "Your category budgets add up to {sum}, which is more than the total of {total}.",

    // --- settings ---
    "set.title": "Settings",
    "set.appearance": "Appearance",
    "set.theme": "Theme",
    "set.theme.dark": "Dark",
    "set.theme.light": "Light",
    "set.language": "Language",
    "set.money": "Money",
    "set.mainCurrency": "Main currency",
    "set.mainCurrencyHelp": "Every total is shown in this. Accounts keep their own.",
    "set.accountsFollowed": "Your starting accounts are in {code} now. Once an account has money recorded in it, it keeps its own currency.",
    "set.rates": "Exchange rates",
    "set.ratesHelp": "What one unit is worth in {main}. Used for new entries; what you have already recorded keeps the rate it was entered with.",
    "set.rateFor": "1 {code} =",
    "set.rateUnset": "not set",
    "set.rateAdd": "Add a currency",
    "set.rateRemove": "Remove",
    "set.period": "Month",
    "set.monthStart": "Month starts on day",
    "set.monthStartHelp": "Set this to your payday to budget by salary cycle.",
    "set.weekStart": "Week starts on",
    "set.data": "Data",
    "set.export": "Export as CSV",
    "set.exportHelp": "Every transaction, in a spreadsheet.",
    "set.exporting": "Preparing…",
    "set.categories": "Manage categories",
    "set.accounts": "Manage accounts",
    "set.about": "About",
    "set.version": "Version {v}",
    "set.account": "Account",
    "set.signedInAs": "Signed in as {email}",
    "set.close": "Close",

    // --- sync ---
    "sync.offline": "Offline",
    "sync.offlineHelp": "Showing the last version this device saw. Anything you change is saved and will sync when you are back.",
    "sync.pending": "{n} waiting to sync",
    "sync.syncing": "Syncing…",
    "sync.live": "Up to date",
    "sync.reconnecting": "Reconnecting…",
    "sync.retry": "Try now",

    // --- generic ---
    "ok": "OK",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "close": "Close",
    "done": "Done",
    "back": "Back",
    "loading": "Loading…",
    "all": "All",
    "none": "None",
    "more": "More",

    // --- errors ---
    "err.generic": "Something went wrong. Try again.",
    "err.network": "No connection. Saved on this device for now.",
    "err.save": "Couldn't save that.",
    "err.setup": "The database refused that. Nothing is lost — it stays on this device and will be sent. Run schema.sql in Supabase again to finish setting the project up.",
    "err.delete": "Couldn't delete that.",
    "err.load": "Couldn't load your ledger.",
    "err.auth.cancelled": "Sign-in cancelled.",
    "err.auth.noAccount": "No Google account is available on this device.",
    "err.auth.network": "No connection — sign-in needs one.",
    "err.auth.generic": "Sign-in failed. Try again.",
    "err.auth.config": "Sign-in isn't configured yet. See SETUP.md.",
    "err.nameTaken": "You already have one called that.",
    "err.rateBad": "Enter a number greater than zero.",
    "err.tooMany": "That is more than Tally can store.",

    // --- update ---
    "update.ready": "A new version of Tally is ready.",
    "update.reload": "Reload",
  },

  ko: {
    "app.name": "Tally",
    "app.tagline": "원도 루피아도, 한 장부에.",

    // --- shell ---
    "tab.log": "내역",
    "tab.insights": "분석",
    "tab.accounts": "자산",
    "nav.prevPeriod": "이전 달",
    "nav.nextPeriod": "다음 달",
    "nav.thisPeriod": "이번 달로",
    "theme.toggle": "밝게 / 어둡게 전환",
    "lang.toggle": "언어 변경",
    "menu.open": "메뉴",
    "search.open": "검색",
    "search.placeholder": "메모, 카테고리, 자산 검색",
    "search.clear": "검색 지우기",
    "search.results": "{n}건",
    "search.none": "“{q}”와 일치하는 내역이 없습니다.",
    "add.new": "내역 추가",

    // --- sign in ---
    "login.h1": "가계부, 단순하게.",
    "login.sub": "모든 계좌와 모든 통화를 한 장부에. 휴대폰과 노트북에서 동시에.",
    "login.google": "Google로 계속하기",
    "login.wait": "로그인을 준비하는 중…",
    "login.privacy": "내 장부는 나만 볼 수 있습니다.",
    "login.f1": "모든 기기에서 실시간",
    "login.f1sub": "휴대폰에 입력하면 노트북에 바로 나타납니다.",
    "login.f2": "원과 루피아를 나란히",
    "login.f2sub": "계좌마다 통화를 그대로 두어도 합계는 맞습니다.",
    "login.f3": "월급날에 맞춘 예산",
    "login.f3sub": "달의 시작일을 실제 월급날로 정할 수 있습니다.",
    "login.or": "또는",
    "login.local": "로그인 없이 사용하기",
    "login.localSub": "모든 내용이 이 기기에만 저장됩니다. 나중에 로그인하면 그대로 가져갈 수 있습니다.",

    // --- on this device only ---
    "local.status": "이 기기에만",
    "local.title": "이 기기에만 저장",
    "local.help": "장부가 이 기기에만 저장되고 아무 곳에도 전송되지 않습니다. 로그인하면 다른 기기와 동기화되고, 이 기기를 잃어버려도 사라지지 않습니다.",
    "local.signIn": "로그인하고 동기화",
    "local.signInHelp": "지금까지 입력한 내용은 그대로 유지됩니다.",
    "local.erase": "이 기기의 모든 내용 지우기",
    "local.eraseConfirm": "이 장부를 지울까요?",
    "local.eraseBody": "이 기기에만 있는 내용입니다. 되돌릴 수 없으니 남기고 싶다면 먼저 CSV로 내보내세요.",
    "local.erased": "지웠습니다.",
    "local.banner": "이 기기에만 저장됩니다.",
    "local.bannerAction": "로그인하고 동기화",
    "migrate.title": "이 장부를 가져갈까요?",
    "migrate.body": "이 기기에 {n}이 있습니다. 계정으로 복사해서 휴대폰에서도 볼까요?",
    "migrate.count": "거래 {n}건",
    "migrate.yes": "내 계정으로 복사",
    "migrate.no": "새로 시작",
    "migrate.working": "복사하는 중…",
    "migrate.done": "복사했습니다. 이제 계정에 모두 들어 있습니다.",
    "migrate.failed": "복사하지 못했습니다. 내용은 그대로 이 기기에 남아 있습니다.",
    "signout": "로그아웃",
    "signout.confirm": "로그아웃할까요?",
    "signout.body": "장부는 클라우드에 그대로 있습니다. 다시 로그인하면 모두 돌아옵니다.",

    // --- setup ---
    "setup.h1": "설정이 한 단계 남았습니다",
    "setup.p1": "아직 데이터베이스에 연결되지 않았습니다. Supabase 프로젝트 URL과 anon 키를 <code>supabase-config.js</code>에 넣고 새로고침하세요.",
    "setup.p2": "자세한 방법은 <code>SETUP.md</code>에 있습니다. 약 10분이면 되고 무료입니다.",
    "setup.missingUrl": "누락됨: 프로젝트 URL",
    "setup.missingKey": "누락됨: anon 키",
    "setup.missingClient": "누락됨: Google 클라이언트 ID",
    "setup.tryLocal": "이 기기에서만 사용하기",
    "setup.tryLocalHelp": "따로 설정할 것이 없습니다. 모든 내용이 이 기기에 저장되고, 나중에 로그인해도 그대로 남습니다.",

    // --- month summary ---
    "sum.income": "수입",
    "sum.expenses": "지출",
    "sum.net": "합계",
    "sum.periodRange": "{start} ~ {end}",

    // --- log ---
    "log.empty.h": "아직 내역이 없습니다",
    "log.empty.p": "첫 내역을 추가하면 이번 달 집계가 시작됩니다.",
    "log.empty.cta": "내역 추가",
    "log.emptyMonth.h": "이번 달 내역이 없습니다",
    "log.emptyMonth.p": "{start}부터 {end}까지 기록된 내역이 없습니다.",
    "log.dayTotal": "하루 합계",
    "log.uncategorised": "미분류",
    "log.noAccount": "자산 없음",
    "log.transferTo": "{from} → {to}",
    "log.pending": "동기화 대기 중",
    "log.showMore": "{n}건 더 보기",

    // --- insights ---
    "ins.budget": "예산",
    "ins.budgetSet": "예산 설정",
    "ins.budgetEdit": "예산 편집",
    "ins.budgetNone.h": "예산이 없습니다",
    "ins.budgetNone.p": "한 달 한도를 정해 두면 달이 끝나기 전에 과소비가 보입니다.",
    "ins.budgetLeft": "{amount} 남음",
    "ins.budgetOver": "{amount} 초과",
    "ins.budgetTotal": "전체 예산",
    "ins.spentOf": "{limit} 중 {spent}",
    "ins.paceAhead": "적정 속도 — 이번 달의 {pct} 경과",
    "ins.paceBehind": "빠른 속도 — 이번 달의 {pct} 경과",
    "ins.breakdown": "어디에 썼나",
    "ins.breakdownIncome": "어디서 들어왔나",
    "ins.trend": "최근 6개월",
    "ins.trendExpense": "지출",
    "ins.trendIncome": "수입",
    "ins.top": "자주 쓴 항목",
    "ins.topCount": "{n}회",
    "ins.avgDay": "하루 평균",
    "ins.avgProjected": "이번 달 예상",
    "ins.biggest": "가장 큰 지출",
    "ins.empty": "아직 그릴 내역이 없습니다.",
    "ins.showExpense": "지출",
    "ins.showIncome": "수입",

    // --- accounts ---
    "acc.netWorth": "순자산",
    "acc.assets": "자산",
    "acc.liabilities": "카드 잔액",
    "acc.add": "자산 추가",
    "acc.edit": "자산 편집",
    "acc.new": "새 자산",
    "acc.name": "이름",
    "acc.namePlaceholder": "은행, 지갑, 카드…",
    "acc.kind": "종류",
    "acc.currency": "통화",
    "acc.opening": "시작 잔액",
    "acc.openingHelp": "Tally를 쓰기 전에 들어 있던 금액입니다.",
    "acc.colour": "색상",
    "acc.archive": "보관",
    "acc.archived": "보관됨",
    "acc.unarchive": "보관 해제",
    "acc.archivedHelp": "선택 목록에서 숨겨집니다. 기존 내역은 그대로 집계됩니다.",
    "acc.showArchived": "보관함 보기",
    "acc.delete": "자산 삭제",
    "acc.deleteConfirm": "“{name}”을(를) 삭제할까요?",
    "acc.deleteBody": "내역 {n}건은 남지만 어느 자산에도 속하지 않게 됩니다. 대개는 보관이 더 알맞습니다.",
    "acc.empty.h": "아직 자산이 없습니다",
    "acc.empty.p": "지갑, 은행, 카드 등 돈이 있는 곳이 자산입니다.",
    "acc.kind.cash": "현금",
    "acc.kind.bank": "은행",
    "acc.kind.card": "카드",
    "acc.kind.ewallet": "간편결제",
    "acc.kind.savings": "저축",
    "acc.txCount": "내역 {n}건",
    "acc.viewLog": "내역 보기",
    "acc.inMain": "≈ {amount}",

    // --- transaction editor ---
    "tx.new": "새 내역",
    "tx.edit": "내역 편집",
    "tx.expense": "지출",
    "tx.income": "수입",
    "tx.transfer": "이체",
    "tx.amount": "금액",
    "tx.category": "카테고리",
    "tx.categoryPick": "카테고리 선택",
    "tx.account": "자산",
    "tx.accountFrom": "보내는 곳",
    "tx.accountTo": "받는 곳",
    "tx.accountPick": "자산 선택",
    "tx.note": "메모",
    "tx.notePlaceholder": "무엇에 썼나요?",
    "tx.date": "날짜",
    "tx.time": "시간",
    "tx.today": "오늘",
    "tx.yesterday": "어제",
    "tx.save": "저장",
    "tx.saveAnother": "저장 후 계속",
    "tx.saved": "저장했습니다",
    "tx.delete": "삭제",
    "tx.deleteConfirm": "이 내역을 삭제할까요?",
    "tx.deleteBody": "바로 되돌릴 수 있습니다.",
    "tx.deleted": "삭제했습니다",
    "tx.undo": "실행 취소",
    "tx.converted": "≈ {amount}",
    "tx.rateMissing": "{code}의 환율이 없어 합계에서 빠집니다.",
    "tx.rateFix": "환율 설정",
    "tx.receives": "받는 금액",
    "tx.receivesHelp": "두 자산의 통화가 달라, 실제로 들어온 금액을 적어 주세요.",
    "tx.needAmount": "금액을 입력하세요",
    "tx.needAccount": "자산을 선택하세요",
    "tx.needCategory": "카테고리를 선택하세요",
    "tx.needToAccount": "받는 곳을 선택하세요",
    "tx.needRate": "1 {code}의 환율을 먼저 설정하세요. 그렇지 않으면 합계에 반영되지 않습니다.",
    "tx.sameAccount": "서로 다른 자산을 선택하세요",
    "tx.calcBad": "읽을 수 없는 숫자입니다",
    "tx.calcHint": "계산식도 됩니다: 12000+3400",
    "tx.calcEquals": "= {amount}",
    "tx.suggestions": "최근 메모",
    "tx.noAccounts": "먼저 자산을 추가하세요. 돈은 어딘가에서 나와야 합니다.",
    "tx.noCategories": "카테고리가 없습니다. 설정에서 추가하세요.",

    // --- categories ---
    "cat.manage": "카테고리",
    "cat.add": "카테고리 추가",
    "cat.new": "새 카테고리",
    "cat.edit": "카테고리 편집",
    "cat.name": "이름",
    "cat.namePlaceholder": "커피, 월세, 택시…",
    "cat.icon": "아이콘",
    "cat.iconHelp": "이모지 또는 한 글자.",
    "cat.colour": "색상",
    "cat.side": "구분",
    "cat.expense": "지출",
    "cat.income": "수입",
    "cat.archive": "보관",
    "cat.archived": "보관됨",
    "cat.unarchive": "보관 해제",
    "cat.archivedHelp": "선택 목록에서 숨겨집니다. 기존 내역에는 그대로 남습니다.",
    "cat.delete": "카테고리 삭제",
    "cat.deleteConfirm": "“{name}”을(를) 삭제할까요?",
    "cat.deleteBody": "내역 {n}건은 남고 미분류가 됩니다. 대개는 보관이 더 알맞습니다.",
    "cat.reorder": "끌어서 순서 변경",
    "cat.moveUp": "위로",
    "cat.moveDown": "아래로",
    "cat.empty": "이쪽에는 아직 카테고리가 없습니다.",

    // --- budgets ---
    "bud.title": "예산",
    "bud.total": "이 달 전체",
    "bud.perCategory": "카테고리별",
    "bud.amount": "금액",
    "bud.none": "한도 없음",
    "bud.help": "비워 두면 한도가 없습니다. 예산은 매달 반복됩니다.",
    "bud.sumWarn": "카테고리 예산의 합이 {sum}으로, 전체 예산 {total}보다 큽니다.",

    // --- settings ---
    "set.title": "설정",
    "set.appearance": "화면",
    "set.theme": "테마",
    "set.theme.dark": "어둡게",
    "set.theme.light": "밝게",
    "set.language": "언어",
    "set.money": "금액",
    "set.mainCurrency": "기준 통화",
    "set.mainCurrencyHelp": "모든 합계가 이 통화로 표시됩니다. 자산은 각자의 통화를 유지합니다.",
    "set.accountsFollowed": "시작 자산이 이제 {code}입니다. 내역이 기록된 자산은 각자의 통화를 유지합니다.",
    "set.rates": "환율",
    "set.ratesHelp": "1단위가 {main}로 얼마인지. 새 내역에 쓰이며, 이미 기록한 내역은 입력 당시의 환율을 유지합니다.",
    "set.rateFor": "1 {code} =",
    "set.rateUnset": "미설정",
    "set.rateAdd": "통화 추가",
    "set.rateRemove": "삭제",
    "set.period": "달",
    "set.monthStart": "달의 시작일",
    "set.monthStartHelp": "월급날로 정하면 급여 주기에 맞춰 예산을 세울 수 있습니다.",
    "set.weekStart": "주의 시작",
    "set.data": "데이터",
    "set.export": "CSV로 내보내기",
    "set.exportHelp": "모든 내역을 표로 저장합니다.",
    "set.exporting": "준비 중…",
    "set.categories": "카테고리 관리",
    "set.accounts": "자산 관리",
    "set.about": "정보",
    "set.version": "버전 {v}",
    "set.account": "계정",
    "set.signedInAs": "{email}(으)로 로그인됨",
    "set.close": "닫기",

    // --- sync ---
    "sync.offline": "오프라인",
    "sync.offlineHelp": "이 기기가 마지막으로 받은 내용을 보여 주고 있습니다. 지금 수정한 내용은 저장되었다가 연결되면 동기화됩니다.",
    "sync.pending": "{n}건 동기화 대기",
    "sync.syncing": "동기화 중…",
    "sync.live": "최신 상태",
    "sync.reconnecting": "다시 연결하는 중…",
    "sync.retry": "지금 시도",

    // --- generic ---
    "ok": "확인",
    "cancel": "취소",
    "save": "저장",
    "delete": "삭제",
    "close": "닫기",
    "done": "완료",
    "back": "뒤로",
    "loading": "불러오는 중…",
    "all": "전체",
    "none": "없음",
    "more": "더 보기",

    // --- errors ---
    "err.generic": "문제가 발생했습니다. 다시 시도해 주세요.",
    "err.network": "연결이 없습니다. 이 기기에 임시로 저장했습니다.",
    "err.save": "저장하지 못했습니다.",
    "err.setup": "데이터베이스가 거부했습니다. 내용은 이 기기에 남아 있고 나중에 전송됩니다. Supabase에서 schema.sql을 다시 실행해 설정을 마무리하세요.",
    "err.delete": "삭제하지 못했습니다.",
    "err.load": "장부를 불러오지 못했습니다.",
    "err.auth.cancelled": "로그인을 취소했습니다.",
    "err.auth.noAccount": "이 기기에 사용할 수 있는 Google 계정이 없습니다.",
    "err.auth.network": "연결이 없어 로그인할 수 없습니다.",
    "err.auth.generic": "로그인하지 못했습니다. 다시 시도해 주세요.",
    "err.auth.config": "로그인이 아직 설정되지 않았습니다. SETUP.md를 참고하세요.",
    "err.nameTaken": "같은 이름이 이미 있습니다.",
    "err.rateBad": "0보다 큰 숫자를 입력하세요.",
    "err.tooMany": "Tally가 저장할 수 있는 범위를 넘었습니다.",

    // --- update ---
    "update.ready": "새 버전이 준비되었습니다.",
    "update.reload": "새로고침",
  },
};

/**
 * The whole table, exported for one reason: tools/gen-android-strings.mjs
 * generates the Android app's Strings.kt from it. Two hand-maintained copies
 * of five hundred strings drift within a week; a generated one cannot.
 */
export const ALL_STRINGS = STRINGS;

let current = DEFAULT_LANG;

export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  buildDateNames();
  return current;
}

export function getLang() {
  return current;
}

export function locale() {
  return LOCALE[current];
}

/**
 * A translated string, with {placeholders} filled in.
 *
 * A missing key returns the key itself rather than an empty string: a screen
 * reading "tx.saveAnother" is a bug you fix in a minute, and a screen with a
 * blank button is one you ship.
 */
export function t(key, vars) {
  const table = STRINGS[current] || STRINGS[DEFAULT_LANG];
  let s = table[key];
  if (s == null) s = STRINGS[DEFAULT_LANG][key];
  if (s == null) return key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m
  );
}

/** True when the key exists — used by the few places that fall back. */
export function has(key) {
  return Object.prototype.hasOwnProperty.call(STRINGS[current] || {}, key);
}

// ------------------------------------------------------------
//  Dates
//
//  Built once per language change. Formatting a date with Intl costs about
//  a microsecond; doing it for every row of a year's ledger, on every
//  render, does not stay free.
// ------------------------------------------------------------

let WEEKDAY_SHORT = [];
let WEEKDAY_LONG = [];
let MONTH_LONG = [];
let MONTH_SHORT = [];

function buildDateNames() {
  const loc = LOCALE[current];
  const shortW = new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" });
  const longW = new Intl.DateTimeFormat(loc, { weekday: "long", timeZone: "UTC" });
  const longM = new Intl.DateTimeFormat(loc, { month: "long", timeZone: "UTC" });
  const shortM = new Intl.DateTimeFormat(loc, { month: "short", timeZone: "UTC" });
  // 2024-01-07 was a Sunday, so index 0 is Sunday — the same numbering
  // getUTCDay() uses, and the same one week_start is stored in.
  WEEKDAY_SHORT = [];
  WEEKDAY_LONG = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2024, 0, 7 + i));
    WEEKDAY_SHORT.push(shortW.format(d));
    WEEKDAY_LONG.push(longW.format(d));
  }
  MONTH_LONG = [];
  MONTH_SHORT = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(2024, i, 15));
    MONTH_LONG.push(longM.format(d));
    MONTH_SHORT.push(shortM.format(d));
  }
}
buildDateNames();

export const weekdayShort = (i) => WEEKDAY_SHORT[((i % 7) + 7) % 7];
export const weekdayLong = (i) => WEEKDAY_LONG[((i % 7) + 7) % 7];
export const monthLong = (i) => MONTH_LONG[((i % 12) + 12) % 12];
export const monthShort = (i) => MONTH_SHORT[((i % 12) + 12) % 12];

/** "August 2026" / "2026년 8월" */
export function formatMonthYear(key) {
  const [y, m] = key.split("-").map(Number);
  return current === "ko" ? y + "년 " + m + "월" : monthLong(m - 1) + " " + y;
}

/** "5 August" / "8월 5일" — the day heading in the log. */
export function formatDayLong(key) {
  const [y, m, d] = key.split("-").map(Number);
  return current === "ko" ? m + "월 " + d + "일" : d + " " + monthLong(m - 1);
}

/** "5 Aug 2026" / "2026. 8. 5." — compact, for ranges and pickers. */
export function formatDayShort(key) {
  const [y, m, d] = key.split("-").map(Number);
  return current === "ko"
    ? y + ". " + m + ". " + d + "."
    : d + " " + monthShort(m - 1) + " " + y;
}

/** Minutes past midnight as a clock reading in the active locale. */
export function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = new Date(Date.UTC(2024, 0, 1, h, m));
  return new Intl.DateTimeFormat(LOCALE[current], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

/** A percentage, rounded, in the active locale. */
export function formatPercent(ratio) {
  return new Intl.NumberFormat(LOCALE[current], {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(ratio) ? ratio : 0);
}
