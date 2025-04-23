// script.js

// URLs - Using Proxy directly now as direct fetch often fails due to CORS
// Consider setting up your own reliable CORS proxy for production
const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
const chandeUrl = proxyUrl + 'https://chande.net';
const tgjuBaseUrl = proxyUrl + 'https://www.tgju.org/profile/';

const currencies = [
  { code: 'usd', title: 'دلار آمریکا', unit: 'تومان', chandeCode: 'USD', tgjuProfile: 'price_dollar_rl' },
  { code: 'eur', title: 'یورو', unit: 'تومان', chandeCode: 'EUR' , tgjuProfile: 'price_eur'},
  { code: 'gbp', title: 'پوند انگلیس', unit: 'تومان', chandeCode: 'GBP', tgjuProfile: 'price_gbp' },
  { code: 'aed', title: 'درهم امارات', unit: 'تومان', chandeCode: 'AED', tgjuProfile: 'price_aed' }
];

const additionalAssets = [
  { title: 'طلا 18 عیار', profile: 'geram18', unit: 'تومان', category: 'gold', needsTomanConversion: true },
  { title: 'انس جهانی طلا', profile: 'ons', unit: 'دلار', category: 'gold', needsTomanConversion: false },
  { title: 'مثقال طلا', profile: 'mesghal', unit: 'تومان', category: 'gold', needsTomanConversion: true },
  { title: 'طلای ۲۴ عیار', profile: 'geram24', unit: 'تومان', category: 'gold', needsTomanConversion: true },
  { title: 'آبشده نقدی', url: proxyUrl + 'https://www.tgju.org/profile/gold_futures', unit: 'تومان', category: 'gold', needsTomanConversion: true }, // Added missing asset
  { title: 'سکه امامی', profile: 'sekee', unit: 'تومان', category: 'coin', needsTomanConversion: true },
  { title: 'نیم سکه', profile: 'nim', unit: 'تومان', category: 'coin', needsTomanConversion: true },
  { title: 'ربع سکه', profile: 'rob', unit: 'تومان', category: 'coin', needsTomanConversion: true },
  { title: 'سکه گرمی', profile: 'gerami', unit: 'تومان', category: 'coin', needsTomanConversion: true }
];

const outputDiv = document.getElementById('output');
const updateEl = document.getElementById('update');
const refreshButton = document.getElementById('btnRefresh');
let conversionRatesPromise = null;
let lastFetchedCategory = null;

// --- Helper Functions ---
function convertToToman(price) {
  return typeof price === 'number' && !isNaN(price) ? price / 10 : price;
}

function formatPrice(price, unit = 'تومان') {
  if (price === 'error' || price === null || typeof price === 'undefined' || isNaN(price)) {
    return `<span class="error">خطا در دریافت</span>`;
  }
  const number = Number(price);
  if (isNaN(number)) {
    return `<span class="error">نامعتبر</span>`;
  }
  return `${number.toLocaleString('fa-IR')} ${unit}`;
}

function getPlainText(htmlString) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  return tempDiv.textContent || tempDiv.innerText || "";
}

function showLoading() {
  outputDiv.innerHTML = '<div class="loader"></div><p style="text-align:center; color: var(--text-color-secondary);">در حال بارگذاری...</p>';
}

function showOutput(items) {
  outputDiv.innerHTML = '';
  if (!items || items.length === 0) {
    outputDiv.innerHTML = '<p style="text-align:center; color: var(--text-color-secondary);">داده‌ای برای نمایش وجود ندارد.</p>';
    return;
  }
  const ul = document.createElement('ul');
  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = item.label;
    li.style.animationDelay = `${index * 0.05}s`;
    if (item.label.includes('error') || item.label.includes('خطا') || item.label.includes('نامعتبر')) {
      li.classList.add('error');
    } else {
      li.addEventListener('click', () => handleItemClick(li));
    }
    ul.appendChild(li);
  });
  outputDiv.appendChild(ul);
}

async function handleItemClick(listItem) {
  const textToCopy = getPlainText(listItem.innerHTML);
  if (!textToCopy || !navigator.clipboard) {
    Swal.fire('خطا', 'امکان کپی کردن وجود ندارد.', 'error');
    return;
  }
  try {
    const result = await Swal.fire({
      title: 'کپی در کلیپ‌بورد',
      html: `آیا مایل به کپی کردن متن زیر هستید؟<br><strong style="color: var(--link-color); display: block; margin-top: 10px; direction: ltr; text-align: center;">${textToCopy}</strong>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'بله، کپی کن',
      cancelButtonText: 'انصراف',
      reverseButtons: true
    });
    if (result.isConfirmed) {
      await navigator.clipboard.writeText(textToCopy);
      Swal.fire({
        title: 'کپی شد!',
        text: 'متن با موفقیت در کلیپ‌بورد کپی شد.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    }
  } catch (err) {
    console.error('Failed to copy: ', err);
    Swal.fire('خطا', 'کپی کردن متن با مشکل مواجه شد.', 'error');
  }
}

// --- Basic Fetch Function (Handles Proxy Activation) ---
async function fetchData(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    let corsProxyActivated = sessionStorage.getItem('corsProxyActivated');

    try {
        console.log(`Fetching via proxy: ${url}`);
        const fetchOptions = {
            ...options,
            signal: controller.signal,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        const response = await fetch(url, fetchOptions);
        clearTimeout(id);

        if (!response.ok) {
            console.error(`Fetch error: ${response.status} ${response.statusText} for ${url}`);
            // Handle CORS Proxy 403 Forbidden error
            if (response.status === 403 && url.includes('cors-anywhere')) {
                console.warn(`CORS Proxy issue detected.`);
                if (!corsProxyActivated) {
                    const activated = await promptActivateProxy();
                    // Return specific status to indicate activation was needed
                    return { error: true, status: 'cors_proxy_activation_needed', data: null };
                } else {
                    console.error('CORS Proxy access likely expired or failed after activation.');
                    // Indicate a persistent CORS error after activation attempt
                    return { error: true, status: 403, corsExpired: true, data: null };
                }
            }
            // Other fetch errors
            return { error: true, status: response.status, data: null };
        }

        const textData = await response.text();
        return { error: false, data: textData };

    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            console.error(`Fetch timed out for ${url}`);
            return { error: true, status: 'timeout', data: null };
        }
        console.error(`Network or fetch error for ${url}:`, error);
        return { error: true, status: 'network_error', data: null };
    }
}

// CORS Activation Prompt Function
async function promptActivateProxy() {
    const result = await Swal.fire({
        title: 'فعال‌سازی دسترسی',
        html: `برای دریافت قیمت‌ها، نیاز به فعال‌سازی دسترسی به سرور کمکی (CORS Proxy) است.<br>لطفا روی دکمه زیر کلیک کنید و سپس دکمه "Request temporary access to the demo server" را در صفحه باز شده بزنید و به این صفحه برگردید.`,
        icon: 'info',
        confirmButtonText: 'فعال‌سازی دسترسی',
        showCancelButton: true,
        cancelButtonText: 'انصراف',
        allowOutsideClick: false
    });
    if (result.isConfirmed) {
        window.open(proxyUrl + 'corsdemo', '_blank');
        sessionStorage.setItem('corsProxyActivated', 'true');
        Swal.fire('دسترسی فعال شد!', 'لطفا دوباره دکمه دریافت قیمت را بزنید.', 'success');
        return true;
    }
    return false;
}

// --- Fetching Specific Prices ---
async function fetchPriceFromChande(currencyCode) {
    const result = await fetchData(chandeUrl); // Use proxied URL
    if (result.error) {
        return result.status === 'cors_proxy_activation_needed' ? 'cors_activation' : 'error';
    }
    try {
        const html = result.data;
        const regex = new RegExp(`<th.*?>\s*${currencyCode}\s*<\/th>.*?<td[^>]*>\s*([\d,.]+)\s*<\/td>`, 'is');
        const match = html.match(regex);
        return match && match[1] ? parseInt(match[1].replace(/,/g, '')) : 'error';
    } catch (e) {
        console.error(`Error parsing Chande.net HTML for ${currencyCode}:`, e);
        return 'error';
    }
}

async function fetchPriceFromTGJU(profile) {
    const url = `${tgjuBaseUrl}${profile}`; // Use proxied URL
    const result = await fetchData(url);
    if (result.error) {
        if (result.status === 'cors_proxy_activation_needed') return 'cors_activation';
        if (result.corsExpired) console.warn(`Skipping TGJU fetch for ${profile} due to potential expired CORS proxy.`);
        return 'error';
    }
    try {
        const html = result.data;
        const regex = /<td\s+class="text-left"[^>]*>\s*([\d,.]+)\s*<\/td>/i;
        const match = html.match(regex);
        return match && match[1] ? parseFloat(match[1].replace(/,/g, '')) : 'error';
    } catch (e) {
        console.error(`Error parsing TGJU HTML for ${profile}:`, e);
        return 'error';
    }
}

// --- Aggregate Fetching Functions (Using Promise.allSettled) ---
async function fetchCurrencyPrices() {
    console.log(`Fetching currency prices...`);
    const promises = currencies.map(cur =>
        Promise.allSettled([
            fetchPriceFromChande(cur.chandeCode),
            cur.tgjuProfile ? fetchPriceFromTGJU(cur.tgjuProfile) : Promise.resolve('N/A')
        ]).then(results => ({ cur, results }))
    );

    const settledResults = await Promise.all(promises);
    const finalResults = [];
    let corsPrompted = false;

    for (const { cur, results } of settledResults) {
        const [chandeResult, tgjuResult] = results;
        const priceChande = chandeResult.status === 'fulfilled' ? chandeResult.value : 'error';
        const priceTGJU = tgjuResult.status === 'fulfilled' ? tgjuResult.value : 'error';

        if (priceChande === 'cors_activation' || priceTGJU === 'cors_activation') {
            corsPrompted = true;
            break;
        }
        finalResults.push({ label: `${cur.title} (نرخ 1 - Chande): ${formatPrice(priceChande, cur.unit)}` });
        if (cur.tgjuProfile) {
            const formattedTgju = priceTGJU === 'N/A' ? '<span class="error">ندارد</span>' : formatPrice((priceTGJU !== 'error' ? convertToToman(priceTGJU) : 'error'), cur.unit);
            finalResults.push({ label: `${cur.title} (نرخ 2 - TGJU): ${formattedTgju}` });
        }
    }
    return corsPrompted ? null : finalResults;
}

async function fetchCurrencyRatesForConversion() {
    console.log(`Fetching conversion rates...`);
    const promises = currencies.map(cur =>
        fetchPriceFromChande(cur.chandeCode)
            .then(price => ({ code: cur.code, price }))
    );
    const settledResults = await Promise.allSettled(promises);
    const rates = {};
    let corsPrompted = false;
    let fetchSucceeded = false;

    for (const result of settledResults) {
        if (result.status === 'fulfilled') {
            const { code, price } = result.value;
            if (price === 'cors_activation') {
                corsPrompted = true;
                break;
            }
            if (price !== 'error') {
                rates[code] = price;
                fetchSucceeded = true;
            } else {
                rates[code] = null;
            }
        } else {
            console.error("Error in fetchCurrencyRatesForConversion promise:", result.reason);
        }
    }

    let finalResult;
    if (corsPrompted) {
        finalResult = { rates: null, error: 'cors_activation' };
    } else if (!fetchSucceeded) {
        finalResult = { rates: null, error: 'fetch_failed' };
    } else {
        finalResult = { rates: rates, error: null };
    }
    console.log("Conversion rates fetch complete:", finalResult);
    return finalResult;
}

async function fetchAssetPrices(category) {
    console.log(`Fetching ${category} prices...`);
    const assets = additionalAssets.filter(a => a.category === category);
    const promises = assets.map(asset =>
        // Corrected: Use profile for TGJU fetch
        fetchPriceFromTGJU(asset.profile)
            .then(price => ({ asset, price }))
    );
    const settledResults = await Promise.allSettled(promises);
    const finalResults = [];
    let corsPrompted = false;

    for (const result of settledResults) {
        if (result.status === 'fulfilled') {
            const { asset, price } = result.value;
            if (price === 'cors_activation') {
                corsPrompted = true;
                break;
            }
            let displayPrice = price;
            if (asset.needsTomanConversion && price !== 'error') {
                displayPrice = convertToToman(price);
            }
            finalResults.push({ label: `${asset.title}: ${formatPrice(displayPrice, asset.unit)}` });
        } else {
            console.error(`Error fetching asset price:`, result.reason);
        }
    }
    return corsPrompted ? null : finalResults;
}

// --- Trigger Fetch Function ---
async function triggerFetch(category) {
    lastFetchedCategory = category;
    showLoading();
    let dataPromise;
    switch (category) {
        case 'currency': dataPromise = fetchCurrencyPrices(); break;
        case 'gold': dataPromise = fetchAssetPrices('gold'); break;
        case 'coin': dataPromise = fetchAssetPrices('coin'); break;
        default:
            console.error("Invalid category:", category);
            outputDiv.innerHTML = '<p style="text-align:center; color: var(--error-color);">خطای داخلی: دسته نامعتبر.</p>';
            return Promise.reject("Invalid category");
    }

    try {
        const data = await dataPromise;
        if (data === null) { // Handle CORS activation needed
             outputDiv.innerHTML = '<p style="text-align:center; color: var(--text-color-secondary);">نیاز به فعال‌سازی دسترسی به سرور کمکی. لطفا دوباره تلاش کنید.</p>';
             return;
         }
        showOutput(data);
    } catch (error) {
        console.error(`Error triggering fetch for ${category}:`, error);
        outputDiv.innerHTML = `<p style="text-align:center; color: var(--error-color);">خطا در بارگذاری داده‌های ${category}.</p>`;
    }
}

// --- Event Listeners ---
document.getElementById('btnCurrency').addEventListener('click', () => triggerFetch('currency'));
document.getElementById('btnGold').addEventListener('click', () => triggerFetch('gold'));
document.getElementById('btnCoin').addEventListener('click', () => triggerFetch('coin'));

refreshButton.addEventListener('click', async () => {
    console.log("Refresh button clicked.");
    if (refreshButton.classList.contains('loading')) return;

    refreshButton.classList.add('loading');
    refreshButton.disabled = true;

    // Re-fetch conversion rates in the background
    conversionRatesPromise = fetchCurrencyRatesForConversion();
    conversionRatesPromise.catch(err => { console.error("Error during refresh pre-fetch:", err); });

    try {
        if (lastFetchedCategory) {
            console.log("Refreshing last category:", lastFetchedCategory);
            await triggerFetch(lastFetchedCategory); // Fetch again (no cache involved)
        } else {
            outputDiv.innerHTML = '<p style="text-align: center; color: var(--text-color-secondary);">یک دسته را برای دریافت قیمت‌های جدید انتخاب کنید.</p>';
        }
        Swal.fire({
            icon: 'success',
            title: 'رفرش شد',
            text: 'درخواست داده‌های جدید ارسال گردید.',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
    } catch (error) {
        console.error("Error during refresh fetch:", error);
        Swal.fire({
            icon: 'error',
            title: 'خطا در رفرش',
            text: 'مشکلی در دریافت داده‌های جدید رخ داد.',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    } finally {
        refreshButton.classList.remove('loading');
        refreshButton.disabled = false;
    }
});

document.getElementById('btnConvert').addEventListener('click', async () => {
  if (!conversionRatesPromise) {
    console.error("Conversion rates promise not initialized!");
    Swal.fire('خطا', 'در حال آماده‌سازی نرخ‌ها، لطفا چند لحظه صبر کنید و دوباره تلاش کنید.', 'warning');
    return;
  }
  const currencyOptions = currencies.reduce((acc, cur) => {
    acc[cur.code] = `${cur.title} (${cur.code.toUpperCase()})`;
    return acc;
  }, {});
  const { value: formValues } = await Swal.fire({
    title: 'تبدیل ارز 💱',
    html:
      `<label for="swal-input-amount" style="display: block; text-align: right; margin-bottom: 5px;">مقدار:</label>` +
      '<input id="swal-input-amount" class="swal2-input" placeholder="مقدار عددی وارد کنید" type="number" min="0" style="width: 95%; margin-bottom: 10px;">' +
      `<label for="swal-select-source" style="display: block; text-align: right; margin-bottom: 5px;">از ارز:</label>` +
      '<select id="swal-select-source" class="swal2-select" style="width: 95%; margin-bottom: 10px;"></select>' +
      `<label for="swal-select-target" style="display: block; text-align: right; margin-bottom: 5px;">به ارز:</label>` +
      '<select id="swal-select-target" class="swal2-select" style="width: 95%;"></select>',
    focusConfirm: false,
    confirmButtonText: 'محاسبه',
    showCancelButton: true,
    cancelButtonText: 'انصراف',
    showLoaderOnConfirm: true,
    didOpen: () => {
      const sourceSelect = document.getElementById('swal-select-source');
      const targetSelect = document.getElementById('swal-select-target');
      for (const code in currencyOptions) {
        sourceSelect.add(new Option(currencyOptions[code], code));
        targetSelect.add(new Option(currencyOptions[code], code));
      }
      sourceSelect.value = 'usd';
      targetSelect.value = 'eur';
      document.getElementById('swal-input-amount').onkeyup = (event) => event.key === 'Enter' && Swal.clickConfirm();
    },
    preConfirm: async () => {
      const amount = document.getElementById('swal-input-amount').value;
      const source = document.getElementById('swal-select-source').value;
      const target = document.getElementById('swal-select-target').value;
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0 || !source || !target) {
        Swal.showValidationMessage('لطفاً مقدار عددی معتبر و هر دو ارز را انتخاب کنید.');
        return false;
      }
      try {
        const ratesResult = await conversionRatesPromise;
        if (ratesResult.error === 'cors_activation') {
          Swal.showValidationMessage('لطفا ابتدا دسترسی به سرور کمکی را فعال کرده و دوباره امتحان کنید.');
          return false;
        }
        if (ratesResult.error || !ratesResult.rates) {
          Swal.showValidationMessage('خطا در دریافت نرخ‌ها. لطفا بعدا تلاش کنید.');
          return false;
        }
        const rates = ratesResult.rates;
        if (rates[source] === null || rates[target] === null) {
          Swal.showValidationMessage('نرخ ارز مورد نظر دریافت نشد.');
          return false;
        }
        if (rates[target] === 0) {
          Swal.showValidationMessage('نرخ ارز مقصد صفر است.');
          return false;
        }
        const result = (numericAmount * rates[source]) / rates[target];
        return { amount: numericAmount, source, target, result };
      } catch (error) {
        console.error("Error during preConfirm rate fetching:", error);
        Swal.showValidationMessage('خطای غیرمنتظره در دریافت نرخ‌ها.');
        return false;
      }
    }
  });
  if (formValues) {
    const { amount, source, target, result } = formValues;
    const targetCurrencyInfo = currencies.find(c => c.code === target);
    const sourceCurrencyInfo = currencies.find(c => c.code === source);
    const formattedAmount = amount.toLocaleString('fa-IR');
    const formattedResult = result.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
    Swal.fire({
      icon: 'success',
      title: 'نتیجه تبدیل',
      html: `
        <div style="text-align: center; font-size: 1.1em; margin-top: 15px;">
          <strong>${formattedAmount}</strong> ${sourceCurrencyInfo?.title || source.toUpperCase()}
          <br>برابر است با<br>
          <strong>${formattedResult}</strong> ${targetCurrencyInfo?.title || target.toUpperCase()}
        </div>
      `,
      confirmButtonText: 'فهمیدم'
    });
  }
});

// --- Date/Time Update ---
function updateDateTime() {
  try {
    const now = new Date();
    const persianDate = now.toLocaleDateString('fa-IR-u-nu-latn', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric'
    });
    const time = now.toLocaleTimeString('fa-IR-u-nu-latn', {
      timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false
    });
    updateEl.textContent = `آخرین بروزرسانی: ${persianDate} - ${time}`;
  } catch (e) {
    console.error("Error updating date/time:", e);
    updateEl.textContent = "خطا در بروزرسانی زمان";
  }
}

// --- Initialization ---
function initializeApp() {
  updateDateTime();
  setInterval(updateDateTime, 30000);
  // Pre-fetch conversion rates
  conversionRatesPromise = fetchCurrencyRatesForConversion();
  conversionRatesPromise.catch(err => {
    console.error("Error during initial conversion rate pre-fetch:", err);
  });
  console.log("Chand Web App Initialized (No Caching).");
}
document.addEventListener('DOMContentLoaded', initializeApp);
