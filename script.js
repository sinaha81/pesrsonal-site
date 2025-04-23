// script.js

// --- URLs with CORS Proxy ---
const proxyUrl = 'https://cors-anywhere.herokuapp.com/'; // Using the proxy again
const chandeUrl = proxyUrl + 'https://chande.net';
const tgjuBaseUrl = proxyUrl + 'https://www.tgju.org/profile/';

// --- Data Definitions (Unchanged) ---
const currencies = [
  { code: 'usd', title: 'دلار آمریکا', unit: 'تومان', chandeCode: 'USD', tgjuProfile: 'price_dollar_rl' },
  { code: 'eur', title: 'یورو', unit: 'تومان', chandeCode: 'EUR', tgjuProfile: 'price_eur' },
  { code: 'gbp', title: 'پوند انگلیس', unit: 'تومان', chandeCode: 'GBP', tgjuProfile: 'price_gbp' },
  { code: 'aed', title: 'درهم امارات', unit: 'تومان', chandeCode: 'AED', tgjuProfile: 'price_aed' }
];

const additionalAssets = [
  // Gold Assets
  { title: 'طلا 18 عیار', profile: 'geram18', unit: 'تومان', category: 'gold', needsTomanConversion: true },
  { title: 'انس جهانی طلا', profile: 'ons', unit: 'دلار', category: 'gold', needsTomanConversion: false },
  { title: 'مثقال طلا', profile: 'mesghal', unit: 'تومان', category: 'gold', needsTomanConversion: true },
  { title: 'طلای ۲۴ عیار', profile: 'geram24', unit: 'تومان', category: 'gold', needsTomanConversion: true },
  { title: 'آبشده نقدی', profile: 'gold_futures', unit: 'تومان', category: 'gold', needsTomanConversion: true },
  // Coin Assets
  { title: 'سکه امامی', profile: 'sekee', unit: 'تومان', category: 'coin', needsTomanConversion: true },
  { title: 'نیم سکه', profile: 'nim', unit: 'تومان', category: 'coin', needsTomanConversion: true },
  { title: 'ربع سکه', profile: 'rob', unit: 'تومان', category: 'coin', needsTomanConversion: true },
  { title: 'سکه گرمی', profile: 'gerami', unit: 'تومان', category: 'coin', needsTomanConversion: true }
];

// --- DOM Elements (Unchanged) ---
const outputDiv = document.getElementById('output');
const updateEl = document.getElementById('update');
const refreshButton = document.getElementById('btnRefresh');
const currencyButton = document.getElementById('btnCurrency');
const goldButton = document.getElementById('btnGold');
const coinButton = document.getElementById('btnCoin');
const convertButton = document.getElementById('btnConvert');

// --- State Variables (Unchanged) ---
let conversionRatesPromise = null;
let lastFetchedCategory = null;
let activeRequestController = null;

// --- Helper Functions (Unchanged, except formatPrice slightly) ---
function convertToToman(price) {
  const numericPrice = Number(price);
  return typeof numericPrice === 'number' && !isNaN(numericPrice) ? numericPrice / 10 : price;
}

function formatPrice(price, unit = 'تومان') {
  // Handle potential 'error_cors' status explicitly for formatting
  if (price === 'error' || price === null || typeof price === 'undefined' || price === 'error_cors') {
    return `<span class="error">خطا</span>`;
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
  outputDiv.innerHTML = '<div class="loader"></div><p style="text-align:center; color: var(--text-color-secondary);">در حال بارگذاری اطلاعات...</p>';
}

function showOutput(items) {
  outputDiv.innerHTML = '';
  if (!items || items.length === 0) {
    outputDiv.innerHTML = '<p style="text-align:center; color: var(--text-color-secondary);">داده‌ای برای نمایش وجود ندارد یا دریافت نشد.</p>';
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
    const textToCopy = getPlainText(listItem.innerHTML).trim();
    if (!textToCopy) return;

    if (!navigator.clipboard) {
        Swal.fire('خطا', 'مرورگر شما از کپی خودکار پشتیبانی نمی‌کند.', 'warning');
        return;
    }

    try {
        const result = await Swal.fire({
            title: 'کپی در کلیپ‌بورد',
            html: `متن زیر کپی شود؟<br><strong style="color: var(--link-color); display: block; margin-top: 10px; direction: ltr; text-align: center; font-size: 1.1em;">${textToCopy}</strong>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'بله، کپی کن',
            cancelButtonText: 'انصراف',
            reverseButtons: true,
            customClass: {
                popup: 'swal2-popup',
                confirmButton: 'swal2-confirm',
                cancelButton: 'swal2-cancel'
            }
        });

        if (result.isConfirmed) {
            await navigator.clipboard.writeText(textToCopy);
            Swal.fire({
                title: 'کپی شد!',
                text: 'در کلیپ‌بورد شما کپی شد.',
                icon: 'success',
                toast: true,
                position: 'bottom-start',
                timer: 2000,
                showConfirmButton: false,
                customClass: { popup: 'swal2-popup' }
            });
        }
    } catch (err) {
        console.error('Failed to copy text: ', err);
        Swal.fire('خطا', 'کپی کردن با مشکل مواجه شد. لطفا دستی کپی کنید.', 'error');
    }
}


// --- Fetching Logic (With Proxy and CORS Handling) ---

async function fetchData(url, options = {}, timeout = 20000) {
    if (activeRequestController) {
        console.log("Aborting previous fetch request.");
        activeRequestController.abort();
    }
    activeRequestController = new AbortController();
    const signal = activeRequestController.signal;
    const id = setTimeout(() => {
        console.log(`Fetch timed out for ${url.replace(proxyUrl,'')}`); // Log target URL on timeout
        activeRequestController.abort();
    }, timeout);

    let corsProxyActivated = sessionStorage.getItem('corsProxyActivated');

    try {
        console.log(`Fetching via Proxy: ${url.replace(proxyUrl, '')}`); // Log the target URL
        const fetchOptions = {
            ...options,
            signal: signal,
            headers: {
                'X-Requested-With': 'XMLHttpRequest', // Required by some CORS proxies
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
            }
        };
        const response = await fetch(url, fetchOptions); // URL includes proxy
        clearTimeout(id);

        if (signal.aborted) {
            return { error: true, status: 'aborted', data: null };
        }

        if (!response.ok) {
            console.error(`Fetch error: ${response.status} ${response.statusText} for ${url.replace(proxyUrl, '')}`);
            // Specific handling for CORS Anywhere activation prompt
            if (response.status === 403 && url.startsWith(proxyUrl)) {
                 console.warn(`CORS Proxy issue detected (403).`);
                 if (!corsProxyActivated) {
                    // Return specific status to indicate the need for activation.
                    return { error: true, status: 'cors_proxy_possible_activation', data: null };
                 } else {
                     console.error('CORS Proxy access likely expired or failed after activation.');
                     return { error: true, status: 403, corsError: true, data: null };
                 }
            }
            // General fetch error
            return { error: true, status: response.status, data: null };
        }

        // If response is OK via proxy, mark as activated for this session
        if (url.startsWith(proxyUrl) && !corsProxyActivated) {
             console.log("CORS Proxy appears active for this session.");
             sessionStorage.setItem('corsProxyActivated', 'true');
        }

        const textData = await response.text();
        return { error: false, data: textData };

    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            return { error: true, status: 'aborted', data: null };
        }
        console.error(`Network or other fetch error for ${url.replace(proxyUrl, '')}:`, error);
        return { error: true, status: 'network_error', data: null };
    } finally {
         if (activeRequestController && activeRequestController.signal === signal) {
            activeRequestController = null;
         }
    }
}

// --- Add Proxy Activation Prompt Back ---
async function promptActivateProxy() {
    const result = await Swal.fire({
        title: 'راهنمای فعال‌سازی دسترسی',
        html: `ممکن است برای دریافت قیمت‌ها نیاز به فعال‌سازی دسترسی به سرور کمکی (CORS Proxy) باشد.<br>۱. روی دکمه 'فعال‌سازی' کلیک کنید.<br>۲. در صفحه جدید، دکمه 'Request temporary access...' را بزنید.<br>۳. به این صفحه برگردید و دوباره دکمه دریافت قیمت یا رفرش را بزنید.`,
        icon: 'info',
        confirmButtonText: 'فعال‌سازی دسترسی',
        showCancelButton: true,
        cancelButtonText: 'انصراف',
        allowOutsideClick: false,
        customClass: { popup: 'swal2-popup', confirmButton: 'swal2-confirm', cancelButton: 'swal2-cancel' }
    });
    if (result.isConfirmed) {
        // Construct the correct demo URL for cors-anywhere
        const demoUrl = proxyUrl.replace('herokuapp.com/', 'herokuapp.com/corsdemo');
        window.open(demoUrl, '_blank');
        Swal.fire({
           title: 'مراحل را دنبال کنید',
           text: 'پس از زدن دکمه در صفحه جدید، به اینجا برگشته و دوباره تلاش کنید.',
           icon: 'success',
           customClass: { popup: 'swal2-popup', confirmButton: 'swal2-confirm' }
        });
        // Do not set sessionStorage flag here, let the next successful fetch confirm activation
        return true;
    }
    return false;
}


// --- Updated Fetching Functions to Handle 'error_cors' ---
const chandeRegex = (code) => new RegExp(`<th[^>]*>\\s*${code}\\s*<\\/th>.*?<td[^>]*>\\s*([\\d,.]+)\\s*<\\/td>`, 'is');
const tgjuRegex = /<td\s+class=["']text-left["'][^>]*>\s*([\d,.]+)\s*<\/td>/i;

async function fetchPriceFromChande(currencyCode) {
  const result = await fetchData(chandeUrl); // Uses proxy URL
  if (result.error) {
      // Map specific CORS activation status to 'error_cors'
      return result.status === 'cors_proxy_possible_activation' ? 'error_cors' : 'error';
  }
  try {
    const html = result.data;
    const regex = chandeRegex(currencyCode);
    const match = html.match(regex);
    return match && match[1] ? parseFloat(match[1].replace(/,/g, '')) : 'error';
  } catch (e) {
    console.error(`Error parsing Chande.net HTML for ${currencyCode}:`, e);
    return 'error';
  }
}

async function fetchPriceFromTGJU(profile) {
  const url = `${tgjuBaseUrl}${profile}`; // Uses proxy URL
  const result = await fetchData(url);
  if (result.error) {
       // Map specific CORS activation status to 'error_cors'
      return result.status === 'cors_proxy_possible_activation' ? 'error_cors' : 'error';
  }
  try {
    const html = result.data;
    const regex = tgjuRegex;
    const match = html.match(regex);
    return match && match[1] ? parseFloat(match[1].replace(/,/g, '')) : 'error';
  } catch (e) {
    console.error(`Error parsing TGJU HTML for ${profile}:`, e);
    return 'error';
  }
}

// --- Aggregate Fetching (With CORS Error Handling) ---

async function fetchCurrencyPrices() {
    console.log(`Fetching currency prices (Proxy)...`);
    let corsErrorEncountered = false;

    const promises = currencies.map(cur => async () => {
        const [chandeRes, tgjuRes] = await Promise.allSettled([
            fetchPriceFromChande(cur.chandeCode),
            cur.tgjuProfile ? fetchPriceFromTGJU(cur.tgjuProfile) : Promise.resolve('N/A')
        ]);

        const priceChande = chandeRes.status === 'fulfilled' ? chandeRes.value : 'error';
        const priceTGJU = tgjuRes.status === 'fulfilled' ? tgjuRes.value : 'error';

        // Check if either fetch returned the specific CORS error status
        if (priceChande === 'error_cors' || priceTGJU === 'error_cors') {
            corsErrorEncountered = true;
        }

        const results = [];
        // Pass the raw status ('error_cors' or 'error') to formatPrice
        results.push({ label: `${cur.title} (نرخ چنده): ${formatPrice(priceChande, cur.unit)}` });
        if (cur.tgjuProfile) {
            const tgjuPriceConverted = (priceTGJU !== 'error' && priceTGJU !== 'N/A' && priceTGJU !== 'error_cors') ? convertToToman(priceTGJU) : priceTGJU;
            const formattedTgju = priceTGJU === 'N/A' ? `<span class="error">-</span>` : formatPrice(tgjuPriceConverted, cur.unit);
            results.push({ label: `${cur.title} (نرخ TGJU): ${formattedTgju}` });
        }
        return results;
    });

    const settledResults = await Promise.allSettled(promises.map(p => p()));
    const finalResults = settledResults
        .filter(res => res.status === 'fulfilled')
        .flatMap(res => res.value);

    // Return indicator if CORS error happened anywhere
    return corsErrorEncountered ? { data: null, error: 'cors' } : { data: finalResults, error: null };
}


async function fetchCurrencyRatesForConversion() {
    console.log(`Fetching conversion rates (Chande Proxy)...`);
    let corsErrorEncountered = false;

    const promises = currencies.map(cur =>
        fetchPriceFromChande(cur.chandeCode)
            .then(price => {
                if (price === 'error_cors') corsErrorEncountered = true;
                // Store null only if it's a CORS error, keep other errors as 'error'
                return { code: cur.code, price: price === 'error_cors' ? null : price };
            })
    );

    const settledResults = await Promise.allSettled(promises);
    const rates = {};
    let fetchSucceeded = false;

    settledResults.forEach(result => {
        if (result.status === 'fulfilled') {
            const { code, price } = result.value;
             // price can be number, 'error', or null (if cors error)
             rates[code] = price;
             if (price !== 'error' && price !== null) {
                fetchSucceeded = true;
             }
        } else {
            console.error("Error in fetchCurrencyRatesForConversion promise:", result.reason);
             // Could potentially mark a specific currency code as error here if needed
        }
    });

    if (corsErrorEncountered) {
        return { rates: null, error: 'cors' };
    } else if (!fetchSucceeded) {
         // Check if *any* rate is not null and not 'error'
         const hasAnyValidRate = Object.values(rates).some(r => r !== null && r !== 'error');
         if (!hasAnyValidRate) {
             return { rates: null, error: 'fetch_failed' };
         } else {
             // Return rates even if some failed, as long as one succeeded
             return { rates: rates, error: null };
         }
    } else {
        return { rates: rates, error: null };
    }
}


async function fetchAssetPrices(category) {
    console.log(`Fetching ${category} prices (TGJU Proxy)...`);
    let corsErrorEncountered = false;
    const assets = additionalAssets.filter(a => a.category === category);

    const promises = assets.map(asset =>
        fetchPriceFromTGJU(asset.profile)
            .then(price => {
                if (price === 'error_cors') corsErrorEncountered = true;
                let displayPrice = price;
                 if (asset.needsTomanConversion && price !== 'error' && price !== 'error_cors') {
                   displayPrice = convertToToman(price);
                 }
                // Pass 'error_cors' or 'error' to formatPrice
                return {
                    label: `${asset.title}: ${formatPrice(displayPrice, asset.unit)}`
                };
            })
    );

    const settledResults = await Promise.allSettled(promises);
    const finalResults = settledResults
        .filter(res => res.status === 'fulfilled')
        .map(res => res.value);

    // Return indicator if CORS error happened anywhere
    return corsErrorEncountered ? { data: null, error: 'cors' } : { data: finalResults, error: null };
}

// --- Main Fetch Trigger (With CORS Handling) ---
async function triggerFetch(category) {
    lastFetchedCategory = category;
    showLoading();
    let resultPromise;

    switch (category) {
        case 'currency': resultPromise = fetchCurrencyPrices(); break;
        case 'gold': resultPromise = fetchAssetPrices('gold'); break;
        case 'coin': resultPromise = fetchAssetPrices('coin'); break;
        default:
            console.error("Invalid category:", category);
            outputDiv.innerHTML = '<p style="text-align:center; color: var(--error-color);">خطای داخلی: دسته نامعتبر.</p>';
            return;
    }

    try {
        const result = await resultPromise;
        // Check specifically for the 'cors' error flag
        if (result.error === 'cors') {
             outputDiv.innerHTML = `
                <p style="text-align:center; color: var(--text-color-secondary);">
                    خطای دسترسی به سرور کمکی (CORS). لطفا دسترسی را فعال کنید.
                    <button id="btnActivateProxy" class="btn" style="margin: 15px auto; display: block; max-width: 200px; background: var(--button-refresh-bg); font-size: 0.9em;">
                        <i class="fa-solid fa-shield-halved"></i> راهنمای فعال‌سازی
                    </button>
                 </p>`;
             const activateBtn = document.getElementById('btnActivateProxy');
             if (activateBtn) {
                 activateBtn.addEventListener('click', promptActivateProxy);
             }
         } else if (result.error || !result.data || result.data.length === 0) {
             // Handle other general errors or empty data
             console.error(`Fetch failed or returned no data for ${category}:`, result.error);
             outputDiv.innerHTML = `<p style="text-align:center; color: var(--error-color);">خطا در بارگذاری داده‌های ${category}. لطفا دوباره تلاش کنید یا اتصال اینترنت را بررسی کنید.</p>`;
         }
         else {
            showOutput(result.data); // Show data if successful
        }
    } catch (error) {
        console.error(`Unhandled error triggering fetch for ${category}:`, error);
        outputDiv.innerHTML = `<p style="text-align:center; color: var(--error-color);">خطای ناشناخته در بارگذاری داده‌ها.</p>`;
    }
}

// --- Event Listeners Setup (Unchanged) ---
function setupEventListeners() {
    currencyButton.addEventListener('click', () => triggerFetch('currency'));
    goldButton.addEventListener('click', () => triggerFetch('gold'));
    coinButton.addEventListener('click', () => triggerFetch('coin'));

    refreshButton.addEventListener('click', async () => {
        console.log("Refresh button clicked.");
        if (refreshButton.classList.contains('loading')) return;

        refreshButton.classList.add('loading');
        refreshButton.disabled = true;
        refreshButton.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i>';

        conversionRatesPromise = fetchCurrencyRatesForConversion();
        conversionRatesPromise.catch(err => { console.error("Error during background refresh pre-fetch:", err); });

        try {
            if (lastFetchedCategory) {
                console.log("Refreshing last category:", lastFetchedCategory);
                await triggerFetch(lastFetchedCategory); // triggerFetch handles showing output/errors
                // Only indicate success visually if triggerFetch didn't show an error
                if (!outputDiv.querySelector('.error') && !outputDiv.querySelector('#btnActivateProxy')) {
                    refreshButton.style.borderColor = 'var(--success-color)';
                    setTimeout(() => { refreshButton.style.borderColor = '' }, 1500);
                }
            } else {
                 outputDiv.innerHTML = '<p style="text-align: center; color: var(--text-color-secondary);">یک دسته را برای دریافت قیمت‌های جدید انتخاب کنید.</p>';
            }
        } catch (error) {
            console.error("Error during refresh fetch:", error);
            refreshButton.style.borderColor = 'var(--error-color)';
            setTimeout(() => { refreshButton.style.borderColor = '' }, 2500);
        } finally {
            refreshButton.classList.remove('loading');
            refreshButton.disabled = false;
            refreshButton.innerHTML = '<i class="fa-solid fa-rotate"></i>';
        }
    });

    convertButton.addEventListener('click', showConversionModal);
}

// --- Conversion Modal (With CORS Handling) ---
async function showConversionModal() {
    if (!conversionRatesPromise) {
        console.log("Conversion rates promise not initialized, fetching now...");
        conversionRatesPromise = fetchCurrencyRatesForConversion();
    }

    const currencyOptions = currencies.reduce((acc, cur) => {
        acc[cur.code] = `${cur.title} (${cur.code.toUpperCase()})`;
        return acc;
    }, {});

    const { value: formValues } = await Swal.fire({
        title: 'تبدیل ارز 💱',
        html:
          `<label for="swal-input-amount" style="display: block; text-align: right; margin-bottom: 5px;">مقدار:</label>` +
          '<input id="swal-input-amount" class="swal2-input" placeholder="مقدار عددی را وارد کنید" type="number" min="0" step="any" style="width: 95%; margin-bottom: 10px;">' +
          `<label for="swal-select-source" style="display: block; text-align: right; margin-bottom: 5px;">از ارز:</label>` +
          '<select id="swal-select-source" class="swal2-select" style="width: 95%; margin-bottom: 10px;"></select>' +
          `<label for="swal-select-target" style="display: block; text-align: right; margin-bottom: 5px;">به ارز:</label>` +
          '<select id="swal-select-target" class="swal2-select" style="width: 95%;"></select>',
        focusConfirm: false,
        confirmButtonText: 'محاسبه <i class="fa-solid fa-calculator"></i>',
        cancelButtonText: 'انصراف',
        showCancelButton: true,
        showLoaderOnConfirm: true,
        customClass: { popup: 'swal2-popup', confirmButton: 'swal2-confirm', cancelButton: 'swal2-cancel', input: 'swal2-input', select: 'swal2-select' },
        didOpen: () => {
          const sourceSelect = document.getElementById('swal-select-source');
          const targetSelect = document.getElementById('swal-select-target');
          for (const code in currencyOptions) {
            sourceSelect.add(new Option(currencyOptions[code], code));
            targetSelect.add(new Option(currencyOptions[code], code));
          }
          sourceSelect.value = 'usd';
          targetSelect.value = 'eur';
          document.getElementById('swal-input-amount').addEventListener('keyup', (event) => {
              if (event.key === 'Enter') Swal.clickConfirm();
          });
        },
        preConfirm: async () => {
            const amountInput = document.getElementById('swal-input-amount');
            const sourceSelect = document.getElementById('swal-select-source');
            const targetSelect = document.getElementById('swal-select-target');

            const amount = amountInput.value;
            const source = sourceSelect.value;
            const target = targetSelect.value;
            const numericAmount = parseFloat(amount);

            if (isNaN(numericAmount) || numericAmount <= 0 || !source || !target) {
                Swal.showValidationMessage('لطفاً مقدار عددی مثبت و هر دو ارز مبدا و مقصد را انتخاب کنید.');
                return false;
            }

            try {
                console.log("Awaiting conversion rates inside modal...");
                const ratesResult = await conversionRatesPromise;
                console.log("Conversion rates received:", ratesResult);

                // Check for CORS error first
                if (ratesResult.error === 'cors') {
                    Swal.showValidationMessage('خطای دسترسی CORS. لطفا ابتدا دسترسی را فعال کرده و دوباره امتحان کنید.');
                    // Optionally trigger promptActivateProxy directly?
                    // promptActivateProxy(); // Consider user experience
                    return false;
                }
                // Check for general fetch errors or no rates
                if (ratesResult.error || !ratesResult.rates) {
                    Swal.showValidationMessage('خطا در دریافت نرخ‌های تبدیل. لطفا بعدا تلاش کنید.');
                    return false;
                }

                const rates = ratesResult.rates;
                // Check if specific rates are available (not null and not 'error')
                if (rates[source] === null || rates[source] === 'error') {
                     Swal.showValidationMessage(`نرخ ارز مبدا (${currencyOptions[source]}) دریافت نشد یا خطا داشت.`);
                     return false;
                }
                if (rates[target] === null || rates[target] === 'error') {
                     Swal.showValidationMessage(`نرخ ارز مقصد (${currencyOptions[target]}) دریافت نشد یا خطا داشت.`);
                     return false;
                }
                if (rates[target] === 0) {
                   Swal.showValidationMessage('نرخ ارز مقصد صفر است و تبدیل ممکن نیست.');
                   return false;
                 }

                // Perform the calculation only with valid numbers
                const result = (numericAmount * Number(rates[source])) / Number(rates[target]);
                if (isNaN(result)) {
                     Swal.showValidationMessage('خطا در محاسبه. نرخ‌های نامعتبر دریافت شد.');
                     return false;
                }
                return { amount: numericAmount, source, target, result };

            } catch (error) {
                console.error("Error during conversion preConfirm:", error);
                Swal.showValidationMessage('خطای غیرمنتظره در محاسبه تبدیل ارز.');
                return false;
            }
        }
    });

    if (formValues) {
        const { amount, source, target, result } = formValues;
        const targetCurrencyInfo = currencies.find(c => c.code === target);
        const sourceCurrencyInfo = currencies.find(c => c.code === source);

        const formattedAmount = amount.toLocaleString('fa-IR');
        const formattedResult = result.toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        Swal.fire({
            icon: 'success',
            title: 'نتیجه تبدیل',
            html: `
                <div style="text-align: center; font-size: 1.1em; margin: 15px 0;">
                  <span style="font-weight: bold; color: var(--link-color);">${formattedAmount}</span> ${sourceCurrencyInfo?.title || source.toUpperCase()}
                  <br>برابر است با<br>
                  <span style="font-weight: bold; color: var(--link-color);">${formattedResult}</span> ${targetCurrencyInfo?.title || target.toUpperCase()}
                </div>
              `,
            confirmButtonText: 'فهمیدم <i class="fa-solid fa-check"></i>',
            customClass: { popup: 'swal2-popup', confirmButton: 'swal2-confirm' }
        });
    }
}

// --- Date/Time Update (Unchanged) ---
function updateDateTime() {
    try {
        const now = new Date();
        const persianDate = now.toLocaleDateString('fa-IR-u-nu-latn', {
            timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric'
        });
        const time = now.toLocaleTimeString('fa-IR-u-nu-latn', {
            timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false
        });
        updateEl.textContent = `آخرین بروزرسانی قیمت‌ها: ${persianDate} - ساعت ${time}`;
    } catch (e) {
        console.error("Error updating date/time:", e);
        updateEl.textContent = "خطا در نمایش زمان";
    }
}

// --- Initialization (Unchanged) ---
function initializeApp() {
    console.log("Initializing Chand Web App (Proxy Enabled)...");
    updateDateTime();
    setInterval(updateDateTime, 30000);

    setupEventListeners();

    conversionRatesPromise = fetchCurrencyRatesForConversion();
    conversionRatesPromise.catch(err => {
        console.error("Error during initial conversion rate pre-fetch:", err);
    });

    console.log("Chand Web App Initialized (Proxy Enabled).");
     // Optional: Trigger a default category fetch on load?
     // triggerFetch('currency');
}

// --- Start the App ---
document.addEventListener('DOMContentLoaded', initializeApp);
