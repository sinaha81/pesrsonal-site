// script.js

const chandeUrl = 'https://chande.net';
const tgjuUrl  = 'https://www.tgju.org/profile/price_dollar_rl';

const currencies = [
  { code: 'usd', title: 'دلار', unit: 'تومان' },
  { code: 'gbp', title: 'پوند', unit: 'تومان' },
  { code: 'eur', title: 'یورو', unit: 'تومان' },
  { code: 'aed', title: 'درهم', unit: 'تومان' }
];

const additionalAssets = [
  { title: 'طلا 18 عیار', url: 'https://www.tgju.org/profile/geram18', unit: 'تومان' },
  { title: 'انس جهانی طلا', url: 'https://www.tgju.org/profile/ons', unit: 'دلار' },
  { title: 'مثقال طلا', url: 'https://www.tgju.org/profile/mesghal', unit: 'تومان' },
  { title: 'طلای ۲۴ عیار', url: 'https://www.tgju.org/profile/geram24', unit: 'تومان' },
  { title: 'آبشده نقدی', url: 'https://www.tgju.org/profile/gold_futures', unit: 'تومان' },
  { title: 'سکه امامی', url: 'https://www.tgju.org/profile/sekee', unit: 'تومان' },
  { title: 'نیم سکه', url: 'https://www.tgju.org/profile/nim', unit: 'تومان' },
  { title: 'ربع سکه', url: 'https://www.tgju.org/profile/rob', unit: 'تومان' },
  { title: 'سکه گرمی', url: 'https://www.tgju.org/profile/gerami', unit: 'تومان' }
];

function convertToToman(price) {
  return price / 10;
}

function formatPrice(price) {
  return price === 'erorr' ? price : Number(price).toLocaleString();
}

async function fetchPriceFromChande(currency) {
  try {
    const resp = await fetch(chandeUrl);
    const html = await resp.text();
    const regex = new RegExp(`<th.*?>${currency}</th>.*?<td.*?>(.*?)<\\/td>`, 'i');
    const match = html.match(regex);
    return match && match[1] ? parseInt(match[1].replace(/,/g, '')) : 'erorr';
  } catch {
    return 'erorr';
  }
}

async function fetchPriceFromTGJU() {
  try {
    const resp = await fetch(tgjuUrl);
    const html = await resp.text();
    const regex = /<td.*?class="text-left".*?>(.*?)<\\/td>/i;
    const match = html.match(regex);
    return match && match[1] ? parseInt(match[1].replace(/,/g, ''))/10 : 'erorr';
  } catch {
    return 'erorr';
  }
}

async function fetchAdditionalPrice(url) {
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    const regex = /<td.*?class="text-left".*?>(.*?)<\\/td>/i;
    const match = html.match(regex);
    return match && match[1] ? parseFloat(match[1].replace(/,/g, '')) : 'erorr';
  } catch {
    return 'erorr';
  }
}

async function fetchCurrencyPrices() {
  const results = [];
  for (let cur of currencies) {
    if (cur.code === 'usd') {
      const ch = await fetchPriceFromChande('USD');
      const tg = await fetchPriceFromTGJU();
      results.push({ label: `${cur.title} (نرخ 1): ${formatPrice(ch)} ${cur.unit}` });
      results.push({ label: `${cur.title} (نرخ 2): ${formatPrice(tg)} ${cur.unit}` });
    } else {
      const p = await fetchPriceFromChande(cur.code.toUpperCase());
      results.push({ label: `${cur.title}: ${formatPrice(p)} ${cur.unit}` });
    }
  }
  return results;
}

async function fetchGoldPrices() {
  const golds = additionalAssets.filter(a => a.title.includes('طلا'));
  const results = [];
  for (let asset of golds) {
    const p = await fetchAdditionalPrice(asset.url);
    const fp = asset.title === 'انس جهانی طلا'
      ? Number(p).toLocaleString('en-US')
      : Number(convertToToman(p)).toLocaleString('en-US');
    results.push({ label: `${asset.title}: ${fp} ${asset.unit}` });
  }
  return results;
}

async function fetchCoinPrices() {
  const coins = additionalAssets.filter(a => a.title.includes('سکه'));
  const results = [];
  for (let asset of coins) {
    const p = await fetchAdditionalPrice(asset.url);
    const fp = Number(convertToToman(p)).toLocaleString('en-US');
    results.push({ label: `${asset.title}: ${fp} ${asset.unit}` });
  }
  return results;
}

function showOutput(items) {
  const out = document.getElementById('output');
  out.innerHTML = '';
  const ul = document.createElement('ul');
  items.forEach(it => {
    const li = document.createElement('li');
    li.textContent = it.label;
    ul.appendChild(li);
  });
  out.appendChild(ul);
}

document.getElementById('btnCurrency').addEventListener('click', async () => {
  showOutput([{ label: 'در حال بارگذاری...' }]);
  const data = await fetchCurrencyPrices();
  showOutput(data);
});

document.getElementById('btnGold').addEventListener('click', async () => {
  showOutput([{ label: 'در حال بارگذاری...' }]);
  const data = await fetchGoldPrices();
  showOutput(data);
});

document.getElementById('btnCoin').addEventListener('click', async () => {
  showOutput([{ label: 'در حال بارگذاری...' }]);
  const data = await fetchCoinPrices();
  showOutput(data);
});

document.getElementById('btnConvert').addEventListener('click', async () => {
  const amount = parseFloat(prompt('مقدار را وارد کنید:'));
  const src = prompt('کد ارز مبدا (usd, gbp, eur, aed):').toLowerCase();
  const dst = prompt('کد ارز مقصد (usd, gbp, eur, aed):').toLowerCase();
  if (isNaN(amount) || !src || !dst) {
    alert('ورودی نامعتبر');
    return;
  }
  const rates = {};
  for (let cur of currencies) {
    rates[cur.code] = cur.code === 'usd'
      ? await fetchPriceFromChande('USD')
      : await fetchPriceFromChande(cur.code.toUpperCase());
  }
  const res = ((amount * rates[src]) / rates[dst]).toLocaleString();
  showOutput([{ label: `نتیجه: ${res}` }]);
});
