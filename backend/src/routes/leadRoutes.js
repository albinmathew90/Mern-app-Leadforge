/**
 * leads.js — Google Maps scraper + DEEP email extractor + blast router
 * UPDATE: Reply tracking via IMAP, conversation storage, thread view
 */

import express from 'express';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import Lead from '../models/Lead.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// SSE PROGRESS
// ═══════════════════════════════════════════════════════════════
let currentProgress = { status: 'idle', percent: 0, message: '' };
const sseClients = new Set();

function broadcastProgress(update) {
    Object.assign(currentProgress, update);
    const payload = `data: ${JSON.stringify(currentProgress)}\n\n`;
    for (const client of sseClients) {
        try { client.write(payload); } catch { sseClients.delete(client); }
    }
}

router.get('/status', (_req, res) => res.json(currentProgress));

router.get('/status/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify(currentProgress)}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = (lo, hi) => sleep(lo + Math.random() * (hi - lo));
const getOrigin = url => { try { const u = new URL(url); return `${u.protocol}//${u.hostname}`; } catch { return null; } };
const getRootDomain = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } };
const toAbs = url => /^https?:\/\//i.test(url) ? url : `https://${url}`;

function decodeCloudflareEmail(cipher) {
    try {
        const key = parseInt(cipher.slice(0, 2), 16);
        let out = '';
        for (let i = 2; i < cipher.length; i += 2)
            out += String.fromCharCode(parseInt(cipher.slice(i, i + 2), 16) ^ key);
        return out.includes('@') ? out.trim() : null;
    } catch { return null; }
}

function unwrapGoogleUrl(href) {
    if (!href) return null;
    try {
        const u = new URL(href);
        const q = u.searchParams.get('q') || u.searchParams.get('adurl') || u.searchParams.get('url');
        if (q) return q;
        return href;
    } catch { return href; }
}

const BLOCKED_DOMAINS = new Set([
    'google.com', 'gstatic.com', 'googleapis.com', 'googletagmanager.com',
    'doubleclick.net', 'googlesyndication.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'youtube.com', 'linkedin.com', 'whatsapp.com',
    'yelp.com', 'tripadvisor.com', 'justdial.com', 'indiamart.com',
    'sulekha.com', 'wikipedia.org', 'glassdoor.com', 'naukri.com',
    'ambitionbox.com', 'goo.gl', 'bit.ly', 'tinyurl.com',
    'maps.app.goo.gl',
]);

function isBlockedHost(href) {
    try {
        const host = new URL(href).hostname.toLowerCase();
        for (const b of BLOCKED_DOMAINS) if (host === b || host.endsWith('.' + b)) return true;
        return false;
    } catch { return true; }
}

function isUsableUrl(href) {
    if (!href || href === 'N/A') return false;
    try {
        const u = new URL(toAbs(href));
        if (!['http:', 'https:'].includes(u.protocol)) return false;
        if (isBlockedHost(u.href)) return false;
        if (u.hostname.includes('google.') || u.pathname.includes('/maps/')) return false;
        return true;
    } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════
// PAGE POOL
// ═══════════════════════════════════════════════════════════════
class PagePool {
    constructor(browser, size) {
        this.browser = browser;
        this.size = size;
        this.idle = [];
        this.waiting = [];
    }
    async init() {
        this.idle = await Promise.all(
            Array.from({ length: this.size }, () => makeStealthPage(this.browser, false))
        );
    }
    acquire() {
        return this.idle.length
            ? Promise.resolve(this.idle.pop())
            : new Promise(res => this.waiting.push(res));
    }
    release(page) {
        if (this.waiting.length) this.waiting.shift()(page);
        else this.idle.push(page);
    }
    async drain() {
        await Promise.all(this.idle.map(p => p.close().catch(() => { })));
        this.idle = [];
    }
}

// ═══════════════════════════════════════════════════════════════
// BROWSER / PAGE FACTORY
// ═══════════════════════════════════════════════════════════════
async function launchBrowser() {
    return puppeteer.launch({
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
    ]
});
}

async function makeStealthPage(browser, blockResources = true) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
    });
    if (blockResources) {
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });
    }
    return page;
}

// ═══════════════════════════════════════════════════════════════
// GOOGLE MAPS SCRAPING
// ═══════════════════════════════════════════════════════════════
async function scrapeMapCards(keyword, city, cancelToken = { cancelled: false }) {
    const browser = await launchBrowser();
    const page = await makeStealthPage(browser);
    const allCards = new Map();

    try {
        const queries = [
            `${keyword} in ${city}`,
            `${keyword} ${city}`,
            `best ${keyword} ${city}`,
        ];

        for (const queryText of queries) {
            if (cancelToken.cancelled) break;
            broadcastProgress({ message: `Searching: "${queryText}"…` });
            const q = encodeURIComponent(queryText);

            try {
                await page.goto(`https://www.google.com/maps/search/${q}?hl=en`, {
                    waitUntil: 'networkidle2', timeout: 35000,
                });
                await jitter(2500, 4000);

                for (const sel of [
                    'button[aria-label="Accept all"]', 'form[action*="consent"] button',
                    'button[jsname="b3VHJd"]', '[id="L2AGLb"]',
                ]) {
                    try {
                        const btn = await page.$(sel);
                        if (btn) { await btn.click(); await jitter(1500, 2500); break; }
                    } catch { }
                }

                const feedFound = await page
                    .waitForSelector('[role="feed"]', { timeout: 15000 })
                    .then(() => true).catch(() => false);

                if (!feedFound) continue;

                await aggressiveScroll(page, allCards, keyword, cancelToken);

            } catch (err) {
                console.log(`[maps] Query failed "${queryText}": ${err.message}`);
            }

            if (allCards.size >= 100) break;
            await jitter(2000, 3000);
        }

        console.log(`[maps] Total unique cards: ${allCards.size}`);
        await browser.close();
        return [...allCards.values()];

    } catch (err) {
        console.error('[scrapeMapCards]', err.message);
        await browser.close().catch(() => { });
        return [...allCards.values()];
    }
}

async function aggressiveScroll(page, allCards, keyword) {
    let staleRounds = 0;
    let lastCount = 0;
    let totalScrolls = 0;
    const MAX_SCROLLS = 50;
    const MAX_STALE = 8;

    while (staleRounds < MAX_STALE && totalScrolls < MAX_SCROLLS) {
        if (arguments[3] && arguments[3].cancelled) break; // If cancelToken passed
        const newCards = await extractCardsFromPage(page);
        let addedThisRound = 0;

        for (const card of newCards) {
            if (!allCards.has(card.mapsUrl)) {
                allCards.set(card.mapsUrl, card);
                addedThisRound++;
            }
        }

        const currentCount = allCards.size;
        broadcastProgress({
            message: `Scrolling… found ${currentCount} listings so far`,
            percent: Math.min(30, 5 + currentCount / 3),
        });

        const reachedEnd = await page.evaluate(() => {
            const feed = document.querySelector('[role="feed"]');
            if (!feed) return false;
            const txt = feed.innerText || '';
            return txt.includes("You've reached the end") || txt.includes('No more results');
        }).catch(() => false);

        if (reachedEnd) break;

        await page.evaluate(() => {
            const feed = document.querySelector('[role="feed"]');
            if (feed) {
                feed.scrollTop = feed.scrollHeight;
                feed.scrollBy(0, 3000);
            }
            const panel = document.querySelector('.m6QErb.DxyBCb') || document.querySelector('.m6QErb');
            if (panel) {
                panel.scrollTop = panel.scrollHeight;
                panel.scrollBy(0, 3000);
            }
        });

        await jitter(1200, 2000);
        await page.keyboard.press('End');
        await jitter(800, 1200);

        totalScrolls++;

        if (currentCount === lastCount) {
            staleRounds++;
            await page.evaluate(() => {
                const feed = document.querySelector('[role="feed"]');
                if (feed) feed.dispatchEvent(new WheelEvent('wheel', { deltaY: 5000, bubbles: true }));
            });
            await jitter(2000, 3000);
        } else {
            staleRounds = 0;
            lastCount = currentCount;
        }
    }

    const finalCards = await extractCardsFromPage(page);
    for (const card of finalCards) {
        if (!allCards.has(card.mapsUrl)) allCards.set(card.mapsUrl, card);
    }
}

async function extractCardsFromPage(page) {
    return page.evaluate(() => {
        const seen = new Set();
        const results = [];
        const anchors = document.querySelectorAll('[role="feed"] a[href*="/maps/place/"]');

        anchors.forEach(anchor => {
            const href = anchor.href;
            if (!href?.includes('/maps/place/') || seen.has(href)) return;
            seen.add(href);

            const name = (anchor.getAttribute('aria-label') || anchor.querySelector('[jsan]')?.innerText || '').trim();
            if (!name) return;

            let container = anchor;
            for (let i = 0; i < 10; i++) {
                const p = container.parentElement;
                if (!p || p.querySelectorAll('a[href*="/maps/place/"]').length !== 1) break;
                container = p;
            }

            const lines = (container.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
            let type = '', address = '', phone = '';

            for (const line of lines) {
                if (!line || line === name) continue;
                if (/^[\d.]+$/.test(line) && +line >= 1 && +line <= 5) continue;
                if (/^(Open|Closed|Opens|Hours|⋅)/i.test(line)) continue;

                const digits = line.replace(/[\s\-().+]/g, '');
                if (/^\d{7,15}$/.test(digits) && !line.includes(',')) { phone = line; continue; }
                if (!type && (line.includes('·') || line.includes('\xB7'))) { type = line.split(/[·\xB7]/)[0].trim(); continue; }
                if (!address && (line.includes(',') || /\d/.test(line)) && line.length > 8) { address = line; continue; }
            }

            results.push({ mapsUrl: href, name, type: type || '', address: address || '', phone: phone || '', website: '' });
        });

        return results;
    });
}

// ═══════════════════════════════════════════════════════════════
// MAPS DETAIL PAGE
// ═══════════════════════════════════════════════════════════════
async function fetchMapsDetail(card, pool) {
    const page = await pool.acquire();
    try {
        await page.goto(card.mapsUrl, { waitUntil: 'networkidle2', timeout: 25000 });
        await jitter(1000, 1800);
        await page.waitForSelector('[data-item-id], [jsaction*="pane"]', { timeout: 8000 }).catch(() => { });

        const detail = await page.evaluate(() => {
            const out = { phone: '', address: '', website: '' };
            const GBLOCKED = ['google.com', 'gstatic.com', 'googleapis.com'];

            const isExternal = href => {
                if (!href) return false;
                try {
                    const h = new URL(href).hostname;
                    if (GBLOCKED.some(b => h.includes(b))) return false;
                    if (h.includes('google.') || href.includes('/maps/')) return false;
                    return true;
                } catch { return false; }
            };

            const unwrap = href => {
                try {
                    const u = new URL(href);
                    return u.searchParams.get('q') || u.searchParams.get('url') || href;
                } catch { return href; }
            };

            for (const el of document.querySelectorAll('[data-item-id]')) {
                const id = el.getAttribute('data-item-id')?.toLowerCase() || '';
                const label = el.getAttribute('aria-label') || '';
                const text = (el.innerText || '').trim().split('\n').filter(l => l.trim()).pop()?.trim() || '';

                if (!out.address && id.includes('address')) out.address = label.replace(/^Address:\s*/i, '').trim() || text;
                if (!out.phone && id.includes('phone')) out.phone = label.replace(/^Phone:\s*/i, '').trim() || text;
                if (!out.website && (id.includes('authority') || id.includes('website'))) {
                    const lnk = el.querySelector('a[href]');
                    if (lnk) {
                        const u = unwrap(lnk.href);
                        if (isExternal(u)) out.website = u;
                    }
                }
            }

            if (!out.website) {
                for (const a of document.querySelectorAll('a[aria-label]')) {
                    const lbl = a.getAttribute('aria-label') || '';
                    if (/website/i.test(lbl) && isExternal(a.href)) { out.website = unwrap(a.href); break; }
                }
            }

            if (!out.website) {
                for (const a of document.querySelectorAll('a[href^="http"]')) {
                    const u = unwrap(a.href);
                    if (isExternal(u)) { out.website = u; break; }
                }
            }

            return out;
        });

        if (detail.website) {
            const clean = unwrapGoogleUrl(detail.website);
            detail.website = isUsableUrl(clean) ? clean : '';
        }

        if (detail.phone) card.phone = detail.phone;
        if (detail.address) card.address = detail.address;
        if (detail.website) card.website = detail.website;

    } catch (err) {
        console.log(`[detail-error] ${card.name}: ${err.message}`);
    } finally {
        await page.goto('about:blank').catch(() => { });
        pool.release(page);
    }
}

// ═══════════════════════════════════════════════════════════════
// DEEP EMAIL EXTRACTION
// ═══════════════════════════════════════════════════════════════

const EMAIL_RX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,15}/gi;

const EMAIL_BLACKLIST = [
    /\.(png|jpg|jpeg|svg|gif|webp|css|js|woff|ttf|eot)$/i,
    /^(example|test|noreply|no-reply|donotreply|admin@example|user@)@/i,
    /sentry\.io|cloudflare|wixpress|squarespace|wordpress\.com|gravatar|schema\.org/i,
    /^[0-9].*@/,
    /@sentry\./i,
    /@wix\./i,
    /@google\./i,
    /@facebook\./i,
];

const CONTACT_PATHS = [
    '', '/contact', '/contact-us', '/contactus', '/contact.html', '/contact.php',
    '/contact.aspx', '/about', '/about-us', '/aboutus', '/about.html',
    '/get-in-touch', '/reach-us', '/enquiry', '/inquiry', '/support',
    '/help', '/info', '/team', '/our-team', '/connect', '/feedback',
    '/write-to-us', '/mail-us', '/email-us', '/customer-service',
    '/customer-support', '/careers', '/jobs', '/footer', '/sitemap',
];

function cleanEmails(list) {
    return [...new Set(list)]
        .map(e => e.trim().toLowerCase())
        .filter(e => e.includes('@') && e.includes('.'))
        .filter(e => e.indexOf('@') > 0 && e.indexOf('@') < e.length - 1)
        .filter(e => {
            const domain = e.split('@')[1];
            return domain && domain.includes('.') && domain.length > 3;
        })
        .filter(e => !EMAIL_BLACKLIST.some(r => r.test(e)));
}

function extractEmailsFromText(text) {
    if (!text) return [];
    const normalized = text
        .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
        .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
        .replace(/\s*\{\s*at\s*\}\s*/gi, '@')
        .replace(/\s+at\s+/gi, '@')
        .replace(/\s*\(\s*dot\s*\)\s*/gi, '.')
        .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
        .replace(/\s*\{\s*dot\s*\}\s*/gi, '.')
        .replace(/\s+dot\s+/gi, '.')
        .replace(/\s*<\s*at\s*>\s*/gi, '@')
        .replace(/\s*<\s*dot\s*>\s*/gi, '.');
    return normalized.match(EMAIL_RX) || [];
}

function extractEmailsFromHtml(html) {
    if (!html) return [];
    const emails = [];

    for (const m of html.matchAll(/data-cfemail="([^"]+)"/gi)) {
        const d = decodeCloudflareEmail(m[1]);
        if (d) emails.push(d);
    }
    for (const m of html.matchAll(/mailto:([^"'?\s><\[\],;]+)/gi)) {
        const email = decodeURIComponent(m[1].split('?')[0]).trim();
        if (email.includes('@')) emails.push(email);
    }
    for (const m of html.matchAll(/href=["']mailto:([^"']+)["']/gi)) {
        let email = m[1].split('?')[0];
        email = email.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
        email = email.replace(/&#x([a-f0-9]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
        if (email.includes('@')) emails.push(decodeURIComponent(email));
    }
    for (const m of html.matchAll(/"email"\s*:\s*"([^"]+)"/gi)) {
        if (m[1].includes('@')) emails.push(m[1]);
    }
    for (const m of html.matchAll(/data-email=["']([^"']+)["']/gi)) {
        if (m[1].includes('@')) emails.push(m[1]);
    }

    const textOnly = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));

    emails.push(...extractEmailsFromText(textOnly));
    return emails;
}

async function fetchHtml(url, timeout = 12000) {
    return new Promise((resolve) => {
        try {
            const absUrl = toAbs(url);
            const mod = absUrl.startsWith('https') ? https : http;
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'identity',
                    'Connection': 'keep-alive',
                },
                timeout,
            };
            const req = mod.get(absUrl, options, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                    const loc = res.headers.location.startsWith('http')
                        ? res.headers.location
                        : new URL(res.headers.location, absUrl).href;
                    fetchHtml(loc, timeout).then(resolve);
                    return;
                }
                if (res.statusCode !== 200) { resolve(''); return; }
                let data = '';
                res.setEncoding('utf8');
                res.on('data', c => { if (data.length < 800000) data += c; });
                res.on('end', () => resolve(data));
            });
            req.on('error', () => resolve(''));
            req.on('timeout', () => { req.destroy(); resolve(''); });
        } catch { resolve(''); }
    });
}

async function deepScanWithPuppeteer(url, pool) {
    const page = await pool.acquire();
    const allEmails = [];
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
        await jitter(2000, 3000);

        await page.evaluate(async () => {
            await new Promise(resolve => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) { clearInterval(timer); resolve(); }
                }, 100);
                setTimeout(() => { clearInterval(timer); resolve(); }, 5000);
            });
            window.scrollTo(0, 0);
        });

        await jitter(1000, 1500);

        const html = await page.content();
        allEmails.push(...extractEmailsFromHtml(html));

        const domEmails = await page.evaluate(() => {
            const found = [];
            const EMAIL_RX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,15}/gi;

            document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
                const email = decodeURIComponent(a.href.replace('mailto:', '').split('?')[0]).trim();
                if (email.includes('@')) found.push(email);
            });

            const bodyText = document.body?.innerText || '';
            found.push(...(bodyText.match(EMAIL_RX) || []));

            const selectors = [
                'footer', '.footer', '#footer', '[class*="footer"]',
                '.contact', '#contact', '[class*="contact"]',
                '.about', '#about', '[class*="about"]',
                '[class*="email"]', '[id*="email"]',
                '[class*="mail"]', '[id*="mail"]',
            ];
            selectors.forEach(sel => {
                try {
                    document.querySelectorAll(sel).forEach(el => {
                        found.push(...((el.innerText || '').match(EMAIL_RX) || []));
                    });
                } catch { }
            });

            document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
                try {
                    const json = JSON.parse(script.textContent);
                    const findEmails = obj => {
                        if (!obj || typeof obj !== 'object') return;
                        if (obj.email) found.push(obj.email);
                        if (obj.contactEmail) found.push(obj.contactEmail);
                        Object.values(obj).forEach(v => {
                            if (Array.isArray(v)) v.forEach(findEmails);
                            else if (typeof v === 'object') findEmails(v);
                        });
                    };
                    findEmails(json);
                } catch { }
            });

            return found;
        });

        allEmails.push(...domEmails);
        return cleanEmails(allEmails);

    } catch (err) {
        console.log(`[puppeteer-scan-error] ${url}: ${err.message}`);
        return cleanEmails(allEmails);
    } finally {
        await page.goto('about:blank').catch(() => { });
        pool.release(page);
    }
}

async function findEmailForWebsite(siteUrl, puppeteerPool) {
    if (!isUsableUrl(siteUrl)) return null;
    const base = getOrigin(toAbs(siteUrl));
    if (!base) return null;

    const allFoundEmails = [];

    // Phase 1: HTTP scan
    const httpResults = await Promise.all(
        CONTACT_PATHS.slice(0, 15).map(async path => {
            try { return extractEmailsFromHtml(await fetchHtml(`${base}${path}`)); }
            catch { return []; }
        })
    );
    httpResults.forEach(emails => allFoundEmails.push(...emails));

    let cleaned = cleanEmails(allFoundEmails);
    if (cleaned.length) return pickBestEmail(cleaned, siteUrl);

    // Phase 2: Puppeteer
    const puppeteerEmails = await deepScanWithPuppeteer(base, puppeteerPool);
    allFoundEmails.push(...puppeteerEmails);

    cleaned = cleanEmails(allFoundEmails);
    if (cleaned.length) return pickBestEmail(cleaned, siteUrl);

    // Phase 3: www variant
    const variant = base.includes('www.')
        ? base.replace('www.', '')
        : base.replace('://', '://www.');
    try {
        allFoundEmails.push(...await deepScanWithPuppeteer(variant, puppeteerPool));
    } catch { }

    cleaned = cleanEmails(allFoundEmails);
    return cleaned.length ? pickBestEmail(cleaned, siteUrl) : null;
}

function pickBestEmail(emails, siteUrl) {
    if (!emails.length) return null;
    const domain = getRootDomain(siteUrl);
    const domainPart = domain?.split('.')[0] || '';
    const valid = emails.filter(e => e.length >= 6 && e.split('@')[0].length >= 2);
    if (!valid.length) return emails[0];

    const domainMatch = valid.find(e => domainPart && e.toLowerCase().includes(domainPart.toLowerCase()));
    if (domainMatch) return domainMatch;

    const bizPrefixes = ['info', 'contact', 'hello', 'support', 'sales', 'enquiry', 'inquiry', 'admin', 'office', 'mail', 'business', 'team', 'help'];
    for (const prefix of bizPrefixes) {
        const found = valid.find(e => e.toLowerCase().startsWith(prefix + '@'));
        if (found) return found;
    }

    return valid[0];
}

// ═══════════════════════════════════════════════════════════════
// RELEVANCE FILTER
// ═══════════════════════════════════════════════════════════════
const NEGATIVE_TYPES = new Set(['government', 'police', 'municipality', 'court', 'post office']);

function isRelevant(card) {
    const t = (card.name + ' ' + card.type).toLowerCase();
    if ([...NEGATIVE_TYPES].some(n => t.includes(n))) return false;
    return true;
}

// ═══════════════════════════════════════════════════════════════
// ★★★ IMPROVED IMAP REPLY CHECKER ★★★
// ═══════════════════════════════════════════════════════════════

async function sendTelegramAlert(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (e) {
        console.error('[Telegram] Alert failed:', e.message);
    }
}

async function checkRepliesViaImap(userId) {
    const sentLeads = await Lead.find({
        user: userId,
        status: { $in: ['sent', 'replied'] }, // Check both sent AND already-replied
        messageId: { $exists: true, $ne: '' },
    });

    if (!sentLeads.length) {
        console.log('[IMAP] No sent leads with messageId found');
        return { checked: 0, newReplies: 0 };
    }

    // Build multiple lookup formats for Message-ID
    const messageIdMap = new Map();
    sentLeads.forEach(lead => {
        const cleanId = lead.messageId.replace(/[<>]/g, '').trim().toLowerCase();
        messageIdMap.set(cleanId, lead);
        messageIdMap.set(`<${cleanId}>`, lead); // with brackets
        messageIdMap.set(lead.messageId.toLowerCase(), lead); // original format
    });

    console.log(`[IMAP] Checking replies for ${sentLeads.length} sent emails`);
    console.log(`[IMAP] Message IDs to match:`, [...messageIdMap.keys()].slice(0, 3));

    return new Promise((resolve, reject) => {
        const imapConfig = {
            user: process.env.SMTP_USER,
            password: process.env.SMTP_PASS,
            host: process.env.IMAP_HOST || process.env.SMTP_HOST,
            port: parseInt(process.env.IMAP_PORT || '993'),
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 15000,
            connTimeout: 15000,
        };

        console.log('[IMAP] Connecting to:', imapConfig.host, imapConfig.port);

        const imap = new Imap(imapConfig);
        let newReplies = 0;
        let checkedEmails = 0;

        imap.once('error', err => {
            console.error('[IMAP connection error]', err.message);
            resolve({ checked: 0, newReplies: 0, error: err.message });
        });

        imap.once('ready', () => {
            console.log('[IMAP] Connected successfully');
            
            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    console.error('[IMAP] Failed to open INBOX:', err.message);
                    imap.end();
                    return resolve({ checked: 0, newReplies: 0, error: err.message });
                }

                console.log(`[IMAP] INBOX opened, total messages: ${box.messages.total}`);

                // Search for emails from the last 30 days so older replies are still found
                const since = new Date();
                since.setDate(since.getDate() - 30);

                // Search for UNSEEN or recent emails
                imap.search([['SINCE', since]], (err, uids) => {
                    if (err) {
                        console.error('[IMAP] Search error:', err.message);
                        imap.end();
                        return resolve({ checked: 0, newReplies: 0, error: err.message });
                    }

                    if (!uids || !uids.length) {
                        console.log('[IMAP] No emails found in date range');
                        imap.end();
                        return resolve({ checked: sentLeads.length, newReplies: 0 });
                    }

                    console.log(`[IMAP] Found ${uids.length} emails to check`);

                    const fetch = imap.fetch(uids, { 
                        bodies: '', // fetch entire email
                        struct: true 
                    });
                    
                    const promises = [];

                    fetch.on('message', msg => {
                        promises.push(new Promise(async (res2) => {
                            let buffer = '';
                            
                            msg.on('body', stream => {
                                stream.on('data', chunk => {
                                    buffer += chunk.toString('utf8');
                                });
                            });

                            msg.once('end', async () => {
                                try {
                                    const parsed = await simpleParser(buffer);
                                    checkedEmails++;

                                    console.log(`\n[IMAP] ─────────────────────────────────────`);
                                    console.log(`[IMAP] Email ${checkedEmails}/${uids.length}`);
                                    console.log('[IMAP] From:', parsed.from?.text);
                                    console.log('[IMAP] To:', parsed.to?.text);
                                    console.log('[IMAP] Subject:', parsed.subject);
                                    console.log('[IMAP] Date:', parsed.date);

                                    // ── Bug Fix 1: Skip bounce/delivery-failure emails ──────────
                                    const senderAddress = (parsed.from?.value?.[0]?.address || '').toLowerCase();
                                    const BOUNCE_PATTERNS = [
                                        'mailer-daemon',
                                        'postmaster',
                                        'mail-daemon',
                                        'delivery subsystem',
                                        'noreply@',
                                        'no-reply@',
                                        'donotreply@',
                                    ];
                                    const isBounce = BOUNCE_PATTERNS.some(p => senderAddress.includes(p));
                                    if (isBounce) {
                                        console.log(`[IMAP] ⚠ Skipping bounce/delivery notification from: ${senderAddress}`);
                                        return res2();
                                    }

                                    // Normalize headers for comparison
                                    const inReplyTo = (parsed.inReplyTo || '').toLowerCase().trim();
                                    const references = Array.isArray(parsed.references) 
                                        ? parsed.references.map(r => r.toLowerCase().trim()).join(' ')
                                        : (parsed.references || '').toLowerCase().trim();

                                    console.log('[IMAP] In-Reply-To:', inReplyTo);
                                    console.log('[IMAP] References:', references);

                                    let matchedLead = null;
                                    let matchMethod = '';
                                    // 🚀 GLOBAL HTML TAG STRIPPER & THREAD TRUNCATOR
        let replyBody = parsed.text || parsed.html || '';

        if (replyBody.includes('<') && replyBody.includes('>')) {
            replyBody = replyBody
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, '\n') // Turn brackets into clean line breaks
                .replace(/&nbsp;/g, ' ');
        }

        // Slice off the old email trail globally if it contains "wrote:" on any line configuration
        replyBody = replyBody.replace(/(?:\r?\n|^)On\s+[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d+.*wrote:[\s\S]*/i, '');
        replyBody = replyBody.replace(/(?:\r?\n|^)On\s+\d{1,2}\/\d{1,2}\/\d{2,4}.*wrote:[\s\S]*/i, '');
        replyBody = replyBody.split(/^-+\s*Original Message\s*-+/i)[0];

        // Standardize single line spacing splits
        replyBody = replyBody
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return !trimmed.startsWith('>') &&
                       !/^On .+ wrote:$/i.test(trimmed) &&
                       !trimmed.startsWith('From:') &&
                       !trimmed.startsWith('Sent:') &&
                       !trimmed.startsWith('To:') &&
                       !trimmed.startsWith('Subject:');
            })
            .join('\n')
            .replace(/\n\s*\n+/g, '\n\n')
            .trim();

                                    // ── Method 1: Match via In-Reply-To / References headers ───
                                    for (const [msgId, lead] of messageIdMap) {
                                        const searchIn = `${inReplyTo} ${references}`.toLowerCase();
                                        const cleanMsgId = msgId.toLowerCase();

                                        if (searchIn.includes(cleanMsgId)) {
                                            matchedLead = lead;
                                            matchMethod = 'Message-ID header';
                                            console.log(`[IMAP] ✓ MATCH FOUND via header! Message-ID: ${cleanMsgId}`);
                                            break;
                                        }
                                    }

                                    
                                    // ── Method 2: Fallback — updated to match ALL leads sharing this email ──────
    if (!matchedLead && senderAddress) {
        const matchingLeads = sentLeads.filter(
            lead => lead.email && lead.email.toLowerCase() === senderAddress
        );
        
        if (matchingLeads.length > 0) {
            matchedLead = matchingLeads[0]; // Kept for your singular logging variables below
            matchMethod = 'sender email address';
            console.log(`[IMAP] ✓ MATCH FOUND via sender email for ${matchingLeads.length} leads: ${senderAddress}`);

            // Update every single matching duplicate hotel record in MongoDB right now!
            await Promise.all(matchingLeads.map(async (extraLead) => {
                await Lead.findOneAndUpdate(
                    { _id: extraLead._id, user: userId },
                    { 
                        $set: { 
                            status: 'replied',
                            repliedAt: parsed.date || new Date(),
                            replyBody: replyBody.slice(0, 10000),
                            replyFrom: parsed.from?.text || '',
                            replySubject: parsed.subject || ''
                        } 
                    }
                );
            }));
        }
    }

                                   if (matchedLead) {
        // Extract reply body (strip quoted content)
        let replyBody = parsed.text || parsed.html || '';

        // 1. Universal HTML Tag Cleaner
        if (replyBody.includes('<') && replyBody.includes('>')) {
            replyBody = replyBody
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, '\n') // Replace HTML tags with line breaks to keep separation clean
                .replace(/&nbsp;/g, ' ');
        }

        // 2. Heavy-Duty Email Thread Truncation Engine
        // Chop off the original email trail if it's appended onto the same line
        replyBody = replyBody.replace(/\s+On\s+[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d+.*wrote:[\s\S]*/i, '');
        replyBody = replyBody.replace(/\s*On\s+\d{1,2}\/\d{1,2}\/\d{2,4}.*wrote:[\s\S]*/i, '');

        // 3. Line-by-Line Content Polisher
        replyBody = replyBody
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return !trimmed.startsWith('>') &&
                       !/^On .+ wrote:$/i.test(trimmed) &&
                       !trimmed.startsWith('From:') &&
                       !trimmed.startsWith('Sent:') &&
                       !trimmed.startsWith('To:') &&
                       !trimmed.startsWith('Subject:');
            })
            .join('\n')
            .replace(/\n\s*\n+/g, '\n\n') // Collapse annoying empty lines
            .trim(); 
                                        // Remove quoted replies
                                                                                                                           
                                                                                              
                                                       
                                                       
                                                      

                                        // Combine multiple replies into a thread without duplicating
                                        let existingThread = matchedLead.replyBody || '';
                                        let finalReplyBody = existingThread;
                                        let isNewMessage = false;

                                        // Only append if this exact message isn't already in the thread
                                        if (!existingThread.includes(replyBody)) {
                                            isNewMessage = true;
                                            const dateStr = parsed.date ? new Date(parsed.date).toLocaleString() : new Date().toLocaleString();
                                            const newEntry = `[${dateStr}]\n${replyBody}`;
                                            
                                            if (existingThread) {
                                                finalReplyBody = `${newEntry}\n\n───────────\n\n${existingThread}`;
                                            } else {
                                                finalReplyBody = newEntry;
                                            }
                                        }

                                        if (isNewMessage || matchedLead.status !== 'replied') {
                                            const updated = await Lead.findOneAndUpdate(
                                                { 
                                                    _id: matchedLead._id,
                                                    user: userId,
                                                },
                                                {
                                                    $set: {
                                                        status: 'replied',
                                                        repliedAt: parsed.date || new Date(),
                                                        replyBody: finalReplyBody.slice(0, 10000),
                                                        replyFrom: parsed.from?.text || '',
                                                        replySubject: parsed.subject || '',
                                                    }
                                                },
                                                { new: true }
                                            );

                                            if (updated) {
                                                newReplies++;
                                                console.log(`[IMAP] ✓✓ Updated lead: ${matchedLead.name} (${matchedLead.email})`);
                                                console.log(`[IMAP] Reply preview: ${replyBody.slice(0, 100)}...`);
                                                
                                                // Send Telegram Alert silently
                                                if (isNewMessage) {
                                                    sendTelegramAlert(`🎉 <b>New Reply Received!</b>\n\n<b>From:</b> ${matchedLead.name} (${matchedLead.email})\n<b>Subject:</b> ${parsed.subject || 'No Subject'}\n\n<b>Message:</b>\n${replyBody.slice(0, 300)}...`).catch(() => null);
                                                }
                                            }
                                        } else {
                                            console.log(`[IMAP] - Skipped duplicate message from ${matchedLead.email}`);
                                        }
                                    } else {
                                        console.log('[IMAP] ✗ No match found for this email');
                                    }

                                } catch (parseErr) {
                                    console.error('[IMAP] Parse error:', parseErr.message);
                                }
                                res2();
                            });
                        }));
                    });

                    fetch.once('error', fetchErr => {
                        console.error('[IMAP] Fetch error:', fetchErr.message);
                    });

                    fetch.once('end', async () => {
                        await Promise.all(promises);
                        imap.end();
                        console.log(`\n[IMAP] ═══════════════════════════════════════`);
                        console.log(`[IMAP] Check complete: ${checkedEmails} emails checked, ${newReplies} new replies`);
                        resolve({ checked: checkedEmails, newReplies });
                    });
                });
            });
        });

        imap.connect();
    });
}
// ─── endpoint: manually trigger reply check ────────────────────
router.post('/check-replies', protect, async (req, res) => {
    try {
        const result = await checkRepliesViaImap(req.user.id);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[check-replies]', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── endpoint: get conversation for one lead ──────────────────
router.get('/:id/conversation', protect, async (req, res) => {
    try {
        const lead = await Lead.findOne({ _id: req.params.id, user: req.user.id });
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        res.json({
            success: true,
            conversation: {
                leadName: lead.name,
                leadEmail: lead.email,
                status: lead.status,
                sent: lead.sentAt ? {
                    subject: lead.sentSubject,
                    body: lead.sentBody,
                    at: lead.sentAt,
                } : null,
                reply: lead.repliedAt ? {
                    from: lead.replyFrom,
                    body: lead.replyBody,
                    at: lead.repliedAt,
                } : null,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// MAIN SEARCH ENDPOINT
// ═══════════════════════════════════════════════════════════════
export const activeScrapeTokens = new Map();

router.post('/cancel-search', protect, (req, res) => {
    const token = activeScrapeTokens.get(req.user.id);
    if (token) token.cancelled = true;
    res.json({ success: true });
});

router.post('/search', protect, async (req, res) => {
    const { keyword, city } = req.body;
    if (!keyword?.trim() || !city?.trim())
        return res.status(400).json({ error: 'keyword and city are required' });

    const cancelToken = { cancelled: false };
    activeScrapeTokens.set(req.user.id, cancelToken);

    let detailBrowser, emailBrowser;
    try {
        broadcastProgress({ status: 'searching', percent: 3, message: 'Starting scrape…' });

        const cards = await scrapeMapCards(keyword.trim(), city.trim(), cancelToken);

        if (!cards.length || cancelToken.cancelled) {
            broadcastProgress({ status: 'idle', percent: 100, message: cancelToken.cancelled ? 'Scan cancelled by user.' : 'No listings found.' });
            return res.json({ success: true, cancelled: cancelToken.cancelled, totalLeads: 0, data: [] });
        }

        broadcastProgress({ status: 'details', percent: 32, message: `Fetching details for ${cards.length} listings…` });

        const DETAIL_POOL_SIZE = 6;
        detailBrowser = await launchBrowser();
        const detailPool = new PagePool(detailBrowser, DETAIL_POOL_SIZE);
        await detailPool.init();

        const relevantCards = cards.filter(c => isRelevant(c));
        let detailDone = 0;

        for (let i = 0; i < relevantCards.length; i += 6) {
            if (cancelToken.cancelled) {
                broadcastProgress({ status: 'idle', percent: 100, message: 'Scan cancelled by user.' });
                break;
            }
            const batch = relevantCards.slice(i, i + 6);
            await Promise.all(batch.map(async card => {
                await fetchMapsDetail(card, detailPool);
                detailDone++;
                broadcastProgress({
                    percent: 32 + Math.floor((detailDone / relevantCards.length) * 28),
                    message: `Details: ${detailDone}/${relevantCards.length} — ${card.name}`,
                });
            }));
        }

        await detailPool.drain();
        await detailBrowser.close();
        detailBrowser = null;

        if (cancelToken.cancelled) {
            return res.json({ success: true, cancelled: true, totalLeads: 0, data: [] });
        }

        broadcastProgress({ status: 'emails', percent: 60, message: `Deep-scanning websites for emails…` });

        emailBrowser = await launchBrowser();
        const emailPool = new PagePool(emailBrowser, 4);
        await emailPool.init();

        const savedLeads = [];
        let emailDone = 0;
        const queue = [...cards];

        await Promise.all(Array.from({ length: 4 }, async () => {
            while (true) {
                if (cancelToken.cancelled) break;
                const card = queue.shift();
                if (!card) break;

                let email = null;
                if (isUsableUrl(card.website)) {
                    email = await findEmailForWebsite(card.website, emailPool);
                }

                emailDone++;
                broadcastProgress({
                    percent: 60 + Math.floor((emailDone / cards.length) * 35),
                    message: `[${emailDone}/${cards.length}] ${card.name} → ${email || 'no email'}`,
                });

                try {
                    const saved = await Lead.findOneAndUpdate(
                        { name: card.name, user: req.user.id },
                        {
                            // Always update basic info fields
                            $set: {
                                user: req.user.id, name: card.name,
                                category: card.type || '', phone: card.phone || '',
                                address: card.address || '', website: card.website || '',
                                email: email || null, mapsUrl: card.mapsUrl || '',
                            },
                            // Only set status to 'unsent' on NEW inserts — never overwrite
                            // an existing 'replied', 'sent', or 'failed' status
                            $setOnInsert: {
                                status: 'unsent',
                            },
                        },
                        { upsert: true, returnDocument: 'after' }
                    );
                    if (saved) savedLeads.push(saved);
                } catch (e) {
                    console.log(`[db-skip] ${card.name}: ${e.message}`);
                }
            }
        }));

        await emailPool.drain();
        await emailBrowser.close();
        emailBrowser = null;

        const withEmail = savedLeads.filter(l => l.email);
        broadcastProgress({ status: 'idle', percent: 100, message: `Done! ${savedLeads.length} leads (${withEmail.length} with email)` });

        return res.json({ success: true, cancelled: cancelToken.cancelled, totalLeads: savedLeads.length, data: savedLeads });

    } catch (err) {
        console.error('[/search error]', err);
        if (detailBrowser) await detailBrowser.close().catch(() => { });
        if (emailBrowser) await emailBrowser.close().catch(() => { });
        broadcastProgress({ status: 'error', percent: 0, message: err.message });
        return res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// AI EMAIL WRITER
// ═══════════════════════════════════════════════════════════════
import { GoogleGenAI } from '@google/genai';

router.post('/generate-email', protect, async (req, res) => {
    const { keyword, city } = req.body;
    const userName = req.user.name || "Your Name";
    
    // Fallback template if no API key is provided
    const fallbackSubject = `Partnership opportunity with {name}`;
    const fallbackBody = `Hi {name} team,\n\nI noticed you are a prominent business in the ${keyword || 'local'} space${city ? ` in ${city}` : ''}.\n\nWe specialize in helping businesses like yours scale and acquire more customers through targeted digital strategies. I'd love to share a few quick ideas on how we can collaborate and drive more growth for your business.\n\nAre you open to a brief 10-minute chat next week?\n\nThank you`;

    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.json({ subject: fallbackSubject, body: fallbackBody, simulated: true });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `You are an expert B2B sales copywriter. Write a short, highly-converting cold outreach email template for reaching out to a company.
The target company is in the industry/category of: "${keyword || 'business'}" located in "${city || 'the local area'}".
You must use exactly these two placeholders where appropriate:
"{name}" for the company's name.
"{category}" for the company's category.

Output exactly a JSON object with two keys: "subject" and "body".
The subject should be catchy and personalized.
The body should be concise (under 100 words), focused on value, and end with a soft call to action. Use the placeholders. Do not use Markdown formatting in the body string, use plain text with \\n for newlines.
The signature should only say "Thank you".
Example format:
{
  "subject": "Quick question for {name}",
  "body": "Hi {name} team,\\n\\n..."
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        let result;
        try {
            let cleanText = response.text.trim();
            if (cleanText.startsWith("```json")) {
                cleanText = cleanText.substring(7);
            } else if (cleanText.startsWith("```")) {
                cleanText = cleanText.substring(3);
            }
            if (cleanText.endsWith("```")) {
                cleanText = cleanText.substring(0, cleanText.length - 3);
            }
            result = JSON.parse(cleanText.trim());
        } catch (e) {
            console.error("[AI Parse Error]:", e, response.text);
            return res.json({ subject: fallbackSubject, body: fallbackBody, simulated: true });
        }
        
        return res.json({ subject: result.subject || fallbackSubject, body: result.body || fallbackBody });
    } catch (err) {
        console.error("[AI Writer Error]:", err);
        return res.json({ subject: fallbackSubject, body: fallbackBody, simulated: true });
    }
});

// ═══════════════════════════════════════════════════════════════
// BLAST — now saves subject, body, messageId, sentAt
// ═══════════════════════════════════════════════════════════════
router.post('/blast', protect, async (req, res) => {
    const { leadIds, subject, body } = req.body;
    if (!leadIds?.length) return res.status(400).json({ error: 'No leads selected.' });

    const getSubject = (lead) => subject
        ? subject.replace(/\{name\}/g, lead.name).replace(/\{category\}/g, lead.category || '')
        : `Partnership proposal for ${lead.name}`;

    const getBody = (lead) => body
        ? body.replace(/\{name\}/g, lead.name).replace(/\{category\}/g, lead.category || '')
        : `Hi ${lead.name},\n\nI noticed your business under ${lead.category}. Let's collaborate.\n\nBest regards`;

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: +process.env.SMTP_PORT,
            secure: true,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        const results = await Promise.all(leadIds.map(async id => {
            const lead = await Lead.findOne({ _id: id, user: req.user.id });
            if (!lead?.email) return { id, status: 'skipped', reason: 'no email' };

            const emailSubject = getSubject(lead);
            const emailBody = getBody(lead);

            // Create a UNIQUE and PROPERLY FORMATTED Message-ID
            const timestamp = Date.now();
            const random = crypto.randomBytes(8).toString('hex');
            const domain = process.env.SMTP_HOST || 'localhost';
            const msgId = `<${lead._id}-${timestamp}-${random}@${domain}>`;

            console.log(`[BLAST] Sending to ${lead.email} with Message-ID: ${msgId}`);

            try {
                const info = await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: lead.email,
                    subject: emailSubject,
                    text: emailBody,
                    headers: {
                        'Message-ID': msgId,
                        'X-Lead-ID': lead._id.toString(),
                    },
                });

                lead.status = 'sent';
                lead.sentSubject = emailSubject;
                lead.sentBody = emailBody;
                lead.sentAt = new Date();
                lead.messageId = msgId;
                await lead.save();

                console.log(`[BLAST] ✓ Sent to ${lead.email}, server response:`, info.messageId);
                return { id, status: 'sent', email: lead.email };

            } catch (e) {
                console.error(`[BLAST] ✗ Failed ${lead.email}:`, e.message);
                lead.status = 'failed';
                await lead.save();
                return { id, status: 'failed', email: lead.email, error: e.message };
            }
        }));

        const sent = results.filter(r => r.status === 'sent').length;
        const failed = results.filter(r => r.status === 'failed').length;

        res.json({ 
            success: true, 
            message: `Sent: ${sent}, Failed: ${failed}`,
            details: results 
        });
    } catch (err) { 
        console.error('[BLAST ERROR]', err);
        res.status(500).json({ error: err.message }); 
    }
});

// ═══════════════════════════════════════════════════════════════
// OTHER ENDPOINTS
// ═══════════════════════════════════════════════════════════════

router.get('/dashboard', protect, async (req, res) => {
    try {
        const data = await Lead.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, count: data.length, data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/campaigns', protect, async (req, res) => {
    try {
        const data = await Lead.find({
            user: req.user.id,
            status: { $in: ['sent', 'replied', 'failed'] },
        }).sort({ updatedAt: -1 });
        res.json({ success: true, count: data.length, data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── HOME DASHBOARD STATS ──────────────────────────────────────
router.get('/home-stats', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const all = await Lead.find({ user: userId });

        const total   = all.length;
        const sent    = all.filter(l => ['sent','replied','failed'].includes(l.status)).length;
        const replied = all.filter(l => l.status === 'replied').length;
        const failed  = all.filter(l => l.status === 'failed').length;

        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const sentThisWeek = all.filter(l => l.sentAt && new Date(l.sentAt) >= weekAgo).length;

        const replyRate = sent > 0 ? +((replied / sent) * 100).toFixed(1) : 0;

        const catMap = {};
        all.filter(l => l.status === 'replied' && l.category).forEach(l => {
            catMap[l.category] = (catMap[l.category] || 0) + 1;
        });
        const bestCatEntry = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
        const bestCategory = bestCatEntry ? { name: bestCatEntry[0], count: bestCatEntry[1] } : null;

        const catTotal = {};
        all.filter(l => l.category).forEach(l => {
            catTotal[l.category] = (catTotal[l.category] || 0) + 1;
        });
        const topCategories = Object.entries(catTotal)
            .sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const recent = all
            .filter(l => l.sentAt)
            .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
            .slice(0, 6)
            .map(l => ({ name: l.name, email: l.email, status: l.status, sentAt: l.sentAt, category: l.category }));

        res.json({ success: true, stats: { total, sent, replied, failed, sentThisWeek, replyRate, bestCategory }, topCategories, recentActivity: recent });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', protect, async (req, res) => {
    try {
        await Lead.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET all replied leads ─────────────────────────────────────
router.get('/replies', protect, async (req, res) => {
    try {
        const data = await Lead.find({
            user: req.user.id,
            status: 'replied',
        }).sort({ repliedAt: -1 });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 🚀 TEMPORARY MASTERCLEAN ROUTE — VISIT THIS IN BROWSER TO FLUSH LOGS:
router.get('/masterclean/execute', async (req, res) => {
    try {
        const result = await Lead.updateMany(
            { status: "replied" },
            { $set: { status: "sent", replyBody: "" } }
        );
        res.send(`<h1>🚀 LeadForge MasterClean Complete!</h1><p>Successfully reset ${result.modifiedCount} old cached leads back to sent queue.</p>`);
    } catch (err) {
        res.status(500).send(`<h1>❌ Error:</h1><p>${err.message}</p>`);
    }
});
export { checkRepliesViaImap };
export default router;
