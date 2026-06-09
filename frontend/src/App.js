import { useState, useEffect, useRef } from "react";
import {
    handleLoginAPI,
    handleRegisterAPI,
    startLeadScraperAPI,
    loadDashboardLeadsAPI,
    sendEmailBlastAPI,
    loadCampaignOutboxAPI,
    generateAIEmailAPI,
    handleGoogleAuthAPI,
    cancelLeadScraperAPI,
    handleForgotPasswordAPI,
    handleResetPasswordAPI,
    heartbeatAPI
} from "./api";
import { loadRepliesAPI } from "./api";
import { useGoogleLogin } from '@react-oauth/google';
import Swal from 'sweetalert2';

const ACCENT = "#00C896";
const ACCENT2 = "#0057FF";
const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5001/api";

// ─── CSV EXPORT UTILITY ────────────────────────────────────────
function downloadCSV(rows, columns, filename) {
    const escape = v => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
    };
    const header = columns.map(c => escape(c.label)).join(",");
    const body   = rows.map(row => columns.map(c => escape(c.value(row))).join(",")).join("\n");
    const blob   = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ─── BADGE ─────────────────────────────────────────────────────
function Badge({ status }) {
    const map = {
        unsent: { bg: "#88888818", color: "#888" },
        sent: { bg: "#0057FF18", color: "#0057FF" },
        replied: { bg: "#00C89618", color: "#00C896" },
        failed: { bg: "#FF444418", color: "#FF4444" },
    };
    const s = map[(status || "").toLowerCase()] || { bg: "#88888818", color: "#888" };
    return (
        <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
            {status || "unsent"}
        </span>
    );
}

// ─── LANDING ───────────────────────────────────────────────────
function Landing({ onLogin, onRegister }) {
    const [visible, setVisible] = useState(false);
    useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

    const features = [
        { icon: "🔍", title: "Smart Lead Discovery", desc: "Scrape verified business contacts from Google Maps across any city and niche in seconds." },
        { icon: "🚀", title: "Automated Outreach", desc: "Dispatch personalised email blasts to hundreds of leads with a single click." },
        { icon: "💬", title: "Reply Tracking", desc: "See every reply in one place and never miss a hot prospect again." },
        { icon: "📊", title: "Campaign Analytics", desc: "Track opens, clicks and conversion rates for every outbound campaign." },
    ];

    const faqs = [
        { q: "Is LeadForge free to start?", a: "Yes! You can sign up and explore the dashboard immediately without any upfront cost." },
        { q: "How are the leads generated?", a: "We scrape real-time business data directly from Google Maps, ensuring highly accurate and up-to-date contact information for B2B outreach." },
        { q: "Can I connect my own email account?", a: "Absolutely. LeadForge supports seamless IMAP/SMTP integration so you can send outreach directly from your own professional domain." },
        { q: "Does the AI write my emails?", a: "Yes, our system integrates with advanced AI to automatically generate personalized, high-converting outreach templates for each lead based on their specific business." }
    ];
    const [openFaq, setOpenFaq] = useState(null);

    return (
        <div style={{ minHeight: "100vh", background: "#09090B", color: "#fff", fontFamily: "'Sora',sans-serif" }}>
            <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 60px", borderBottom: "1px solid #ffffff12", position: "sticky", top: 0, zIndex: 50, background: "#09090Bcc", backdropFilter: "blur(16px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#00C896,#0057FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎯</div>
                    <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-.02em" }}>LeadForge</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onLogin} style={{ padding: "9px 22px", borderRadius: 8, border: "1px solid #ffffff25", background: "transparent", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Log in</button>
                    <button onClick={onRegister} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#00C896,#0057FF)", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Get Started</button>
                </div>
            </nav>

            <section style={{ textAlign: "center", padding: "110px 40px 80px", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all .7s cubic-bezier(.22,1,.36,1)" }}>
                {/* <div style={{ display: "inline-block", background: "#ffffff0a", border: "1px solid #ffffff18", borderRadius: 99, padding: "6px 18px", fontSize: 13, color: "#00C896", fontWeight: 600, marginBottom: 28 }}></div> */}
                <h1 style={{ fontSize: "clamp(38px,6vw,72px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.04em", margin: "0 0 24px", maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}>
                    Find leads.<br />
                    <span style={{ background: "linear-gradient(90deg,#00C896,#0057FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Close deals.</span> Faster.
                </h1>
                <p style={{ fontSize: 18, color: "#a1a1aa", maxWidth: 560, margin: "0 auto 44px", lineHeight: 1.7 }}>
                    LeadForge scrapes real businesses from Google Maps, sends targeted cold emails and tracks every reply — all from one dashboard.
                </p>
                <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={onRegister} style={{ padding: "15px 36px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#00C896,#0057FF)", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Start for free →</button>
                    <button onClick={onLogin} style={{ padding: "15px 36px", borderRadius: 10, border: "1px solid #ffffff20", background: "transparent", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 16, cursor: "pointer" }}>Sign in</button>
                </div>
            </section>

            <section style={{ padding: "0 60px 100px", maxWidth: 1100, margin: "0 auto" }}>
                <div style={{ textAlign: "center", marginBottom: 60 }}>
                    <h2 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 800, letterSpacing: "-.03em", margin: "0 0 16px" }}>Everything you need to grow</h2>
                    <p style={{ color: "#a1a1aa", fontSize: 16 }}>One platform for discovery, outreach and revenue.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 20 }}>
                    {features.map(f => (
                        <div key={f.title} style={{ background: "#0f0f12", border: "1px solid #ffffff10", borderRadius: 14, padding: "28px 24px" }}
                            onMouseOver={e => e.currentTarget.style.borderColor = "#00C89640"}
                            onMouseOut={e => e.currentTarget.style.borderColor = "#ffffff10"}>
                            <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                            <h3 style={{ fontWeight: 700, fontSize: 17, margin: "0 0 10px" }}>{f.title}</h3>
                            <p style={{ color: "#71717a", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section id="faq" style={{ padding: "0 60px 100px", maxWidth: 800, margin: "0 auto" }}>
                <div style={{ textAlign: "center", marginBottom: 50 }}>
                    <h2 style={{ fontSize: "clamp(26px,4vw,36px)", fontWeight: 800, letterSpacing: "-.02em", margin: "0 0 16px" }}>Frequently Asked Questions</h2>
                    <p style={{ color: "#a1a1aa", fontSize: 16 }}>Got questions? We've got answers.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {faqs.map((faq, i) => (
                        <div key={i} style={{ background: "#0f0f12", border: "1px solid #ffffff10", borderRadius: 12, overflow: "hidden" }}>
                            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                style={{ width: "100%", textAlign: "left", padding: "20px 24px", background: "transparent", border: "none", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 16, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                {faq.q}
                                <span style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .3s", color: "#0057FF" }}>▼</span>
                            </button>
                            {openFaq === i && (
                                <div style={{ padding: "0 24px 24px", color: "#a1a1aa", fontSize: 15, lineHeight: 1.6 }}>
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <footer>
                {/* Decorative blue line */}
                <div style={{ height: 6, background: "linear-gradient(135deg, #0057FF, #0033CC)", width: "100%" }} />

                {/* Main footer content */}
                <div style={{ padding: "60px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40, background: "#0a0a0c" }}>
                    <div>
                        <h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 24, color: "#fff" }}>LEADFORGE</h4>
                        <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                            Find B2B Leads for your business in any industry across all countries. Receive hundreds of leads in just a few minutes, giving you the data you need to get more business.
                        </p>
                    </div>

                    <div>
                        <h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 24, color: "#fff" }}>INFORMATION</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 14, color: "#a1a1aa" }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}><span style={{color:"#fff"}}>❓</span> <span style={{color: "#0057FF", cursor: "pointer"}} onClick={() => document.getElementById('faq').scrollIntoView({behavior: 'smooth'})}>Frequently asked questions</span></div>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}><span style={{color:"#fff"}}>✉️</span> <span style={{color: "#0057FF", cursor: "pointer"}}>info@leadforge.com</span></div>
                        </div>
                    </div>

                    <div>
                        <h4 style={{ fontWeight: 800, fontSize: 15, marginBottom: 24, color: "#fff" }}>CONNECT WITH US</h4>
                        <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>
                            Get connected with us on social networks!
                        </p>
                        <div style={{ display: "flex", gap: 20, color: "#0057FF", cursor: "pointer", alignItems: "center" }}>
                            <span style={{ transition: "opacity .2s", display: "flex" }} onMouseOver={e=>e.currentTarget.style.opacity=.7} onMouseOut={e=>e.currentTarget.style.opacity=1}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                            </span>
                            <span style={{ transition: "opacity .2s", display: "flex" }} onMouseOver={e=>e.currentTarget.style.opacity=.7} onMouseOut={e=>e.currentTarget.style.opacity=1}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/></svg>
                            </span>
                            <span style={{ transition: "opacity .2s", display: "flex" }} onMouseOver={e=>e.currentTarget.style.opacity=.7} onMouseOut={e=>e.currentTarget.style.opacity=1}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                            </span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// ─── AUTH MODAL ────────────────────────────────────────────────
function AuthModal({ mode, onClose, onSuccess }) {
    const [tab, setTab] = useState(mode);
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    async function submit() {
        setError(""); setSuccessMsg(""); setLoading(true);
        try {
            let res;
            if (tab === "login") res = await handleLoginAPI(form.email, form.password);
            else if (tab === "register") res = await handleRegisterAPI(form.name, form.email, form.password);
            else if (tab === "forgot") res = await handleForgotPasswordAPI(form.email);
            else if (tab === "reset") {
                const token = new URLSearchParams(window.location.search).get("resetToken");
                res = await handleResetPasswordAPI(token, form.password);
            }

            if (tab === "forgot") {
                if (res?.success) {
                    setForm({ ...form, email: "" });
                    setSuccessMsg("Password reset email sent! Check your inbox.");
                    setTab("login");
                } else setError(res?.error || "Failed to send reset email.");
            } else if (tab === "reset") {
                if (res?.success) {
                    setSuccessMsg("Password reset successful! You can now log in.");
                    window.history.replaceState({}, document.title, "/");
                    setTab("login");
                } else setError(res?.error || "Failed to reset password.");
            } else {
                if (res && res.success !== false && (res.token || res.user)) {
                    if (res.token) localStorage.setItem("userSessionToken", res.token);
                    onSuccess({
                        name: res.user?.name || form.name || form.email,
                        email: res.user?.email || form.email,
                    });
                } else {
                    setError(res?.error || "Login failed. Check your credentials.");
                }
            }
        } catch {
            setError("Could not reach server. Is your backend running on port 5001?");
        }
        setLoading(false);
    }
    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setLoading(true); setError("");
            try {
                const res = await handleGoogleAuthAPI(tokenResponse.access_token);
                if (res && res.success !== false && (res.token || res.user)) {
                    if (res.token) localStorage.setItem("userSessionToken", res.token);
                    onSuccess({
                        name: res.user?.name || "",
                        email: res.user?.email || "",
                    });
                } else {
                    setError(res?.error || "Google Auth failed.");
                }
            } catch (err) {
                setError("Could not reach server.");
            }
            setLoading(false);
        },
        onError: () => setError("Google login failed")
    });

    const inp = { width: "100%", padding: "12px 14px", borderRadius: 9, border: "1px solid #ffffff18", background: "#1a1a1f", color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, boxSizing: "border-box", outline: "none" };

    return (
        <div style={{ position: "fixed", inset: 0, background: "#000000bb", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora',sans-serif" }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "#111113", border: "1px solid #ffffff18", borderRadius: 18, padding: "40px", width: 420, maxWidth: "90vw" }}>
                <div style={{ display: "flex", marginBottom: 28, background: "#ffffff08", borderRadius: 10, padding: 4 }}>
                    {(tab === "reset" ? ["reset"] : ["login", "register"]).map(t => (
                        <button key={t} onClick={() => { setTab(t); setError(""); setSuccessMsg(""); }}
                            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: tab === t ? "#1e1e22" : "transparent", color: tab === t ? "#fff" : "#666", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                            {t === "login" ? "Log In" : t === "register" ? "Register" : "Reset Password"}
                        </button>
                    ))}
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: "#fff" }}>
                    {tab === "login" ? "Welcome back 👋" : tab === "register" ? "Create account 🚀" : tab === "forgot" ? "Reset Password" : "New Password"}
                </h2>
                <p style={{ color: "#71717a", fontSize: 14, marginBottom: 28 }}>
                    {tab === "login" ? "Sign in to your dashboard" : tab === "register" ? "Start finding leads today" : tab === "forgot" ? "Enter your email to receive a reset link" : "Enter your new password below"}
                </p>

                {tab === "register" && (
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6, fontWeight: 600 }}>Full Name</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="" autoComplete="name" style={inp} />
                    </div>
                )}
                {tab !== "reset" && (
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6, fontWeight: 600 }}>Email</label>
                        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" placeholder="" autoComplete="email" style={inp} />
                    </div>
                )}
                {(tab !== "forgot") && (
                    <div style={{ marginBottom: error ? 16 : 28 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <label style={{ fontSize: 13, color: "#a1a1aa", fontWeight: 600 }}>{tab === "reset" ? "New Password" : "Password"}</label>
                            {tab === "login" && (
                                <span onClick={() => { setTab("forgot"); setError(""); }} style={{ fontSize: 12, color: "#00C896", cursor: "pointer" }}>Forgot?</span>
                            )}
                        </div>
                        <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="" autoComplete="new-password"
                            onKeyDown={e => e.key === "Enter" && submit()} style={inp} />
                    </div>
                )}
                {error && <div style={{ background: "#FF444418", border: "1px solid #FF444430", borderRadius: 8, padding: "10px 14px", color: "#FF6666", fontSize: 13, marginBottom: 16 }}>{error}</div>}
                {successMsg && <div style={{ background: "#00C89618", border: "1px solid #00C89630", borderRadius: 8, padding: "10px 14px", color: "#00C896", fontSize: 13, marginBottom: 16 }}>{successMsg}</div>}
                <button onClick={submit} disabled={loading}
                    style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#00C896,#0057FF)", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .7 : 1, marginBottom: 12 }}>
                    {loading ? "Please wait…" : tab === "login" ? "Sign In →" : tab === "register" ? "Create Account →" : tab === "forgot" ? "Send Reset Link" : "Reset Password"}
                </button>
                {tab !== "forgot" && tab !== "reset" && (
                    <button onClick={() => googleLogin()}
                        style={{ width: "100%", padding: "14px", borderRadius: 10, border: "1px solid #ffffff25", background: "#ffffff0a", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "background .2s" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 15.907 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
                        Continue with Google
                    </button>
                )}
                {tab === "forgot" && (
                    <div style={{ textAlign: "center", marginTop: 12 }}>
                        <span onClick={() => { setTab("login"); setError(""); setSuccessMsg(""); }} style={{ color: "#a1a1aa", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Back to login</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── SIDEBAR ───────────────────────────────────────────────────
const NAV = [
    { id: "home",    icon: "🏠", label: "Dashboard" },
    { id: "scraper", icon: "🔍", label: "Lead Scraper" },
    { id: "emails", icon: "📨", label: "Emails Sent" },
    { id: "replies", icon: "💬", label: "Replies" },
    { id: "profile", icon: "👤", label: "Profile" },
];

function Sidebar({ page, setPage, user, onLogout, repliesCount }) {
    return (
        <aside style={{ width: 230, background: "#0c0c0e", borderRight: "1px solid #ffffff10", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, fontFamily: "'Sora',sans-serif", flexShrink: 0 }}>
            <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #ffffff0d" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00C896,#0057FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎯</div>
                    <span style={{ fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "-.02em" }}>LeadForge</span>
                </div>
            </div>
            <nav style={{ flex: 1, padding: "16px 12px" }}>
                {NAV.map(n => (
                    <button key={n.id} onClick={() => setPage(n.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 12px", borderRadius: 9, border: "none", background: page === n.id ? "#ffffff0f" : "transparent", color: page === n.id ? "#fff" : "#71717a", fontFamily: "'Sora',sans-serif", fontWeight: page === n.id ? 600 : 400, fontSize: 14, cursor: "pointer", marginBottom: 4, textAlign: "left" }}
                        onMouseOver={e => { if (page !== n.id) { e.currentTarget.style.background = "#ffffff06"; e.currentTarget.style.color = "#aaa"; } }}
                        onMouseOut={e => { if (page !== n.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71717a"; } }}>
                        <span style={{ fontSize: 16 }}>{n.icon}</span>
                        {n.label}
                        {n.id === "replies" && repliesCount > 0 && (
                            <span style={{ marginLeft: "auto", background: "#00C896", color: "#000", borderRadius: 99, fontSize: 11, fontWeight: 800, padding: "1px 7px" }}>{repliesCount}</span>
                        )}
                    </button>
                ))}
            </nav>
            <div style={{ padding: "16px 12px", borderTop: "1px solid #ffffff0d" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 99, background: "linear-gradient(135deg,#00C89666,#0057FF66)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                        {(user?.name || "U")[0].toUpperCase()}
                    </div>
                    <div style={{ overflow: "hidden" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "User"}</div>
                        <div style={{ fontSize: 11, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email || ""}</div>
                    </div>
                </div>
                <button onClick={onLogout} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "1px solid #ffffff15", background: "transparent", color: "#71717a", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Log Out</button>
            </div>
        </aside>
    );
}

// ── Shared SweetAlert2 Toast preset ───────────────────────────────
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
    background: '#1a1a1f',
    color: '#e5e5e7',
    iconColor: '#00C896',
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

// ── SSE Progress Bar ────────────────────────────────────────────
function SseProgressBar({ active }) {
    const [progress, setProgress] = useState({ percent: 0, message: "" });

    useEffect(() => {
        if (!active) { setProgress({ percent: 0, message: "" }); return; }
        const token = localStorage.getItem("userSessionToken");
        const poll = setInterval(async () => {
            try {
                const r = await fetch(`${API}/leads/status`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (r.ok) {
                    const d = await r.json();
                    setProgress({ percent: d.percent || 0, message: d.message || "" });
                    if (d.status === "idle" || d.status === "error") clearInterval(poll);
                }
            } catch { }
        }, 900);
        return () => clearInterval(poll);
    }, [active]);

    if (!active) return null;

    return (
        <div style={{ background: "#141417", border: "1px solid #ffffff0d", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 16, height: 16, border: "2px solid #00C896", borderTopColor: "transparent", borderRadius: 99, animation: "spin 1s linear infinite", flexShrink: 0 }} />
                <span style={{ color: "#a1a1aa", fontSize: 13, flex: 1, maxWidth: 320, overflow: "hidden", whiteSpace: "nowrap", maskImage: "linear-gradient(to right, black 40%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 40%, transparent 100%)" }}>
                    {progress.message || "Initialising…"}
                </span>
                <span style={{ color: "#00C896", fontSize: 13, fontWeight: 700 }}>{Math.round(progress.percent)}%</span>
            </div>
            <div style={{ background: "#ffffff0d", borderRadius: 99, height: 4, overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(90deg,#00C896,#0057FF)", height: "100%", width: `${progress.percent}%`, transition: "width .6s ease", borderRadius: 99 }} />
            </div>
        </div>
    );
}

// ─── HOME DASHBOARD PAGE ───────────────────────────────────────────
function HomeDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("userSessionToken");
        fetch(`${API}/leads/home-stats`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => { if (d.success) setData(d); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const s = data?.stats || {};
    const top = data?.topCategories || [];
    const recent = data?.recentActivity || [];
    const maxCat = top[0]?.count || 1;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const statCards = [
        { label: "Total Leads",        value: s.total ?? "—",        icon: "🎯", color: "#00C896", sub: `${s.total ?? 0} in database` },
        { label: "Total Outreach",      value: s.sent  ?? "—",        icon: "📨", color: "#0057FF", sub: `${s.sentThisWeek ?? 0} this week` },
        { label: "Total Replies",       value: s.replied ?? "—",      icon: "💬", color: "#A855F7", sub: `${s.replyRate ?? 0}% reply rate` },
        { label: "Reply Rate",          value: `${s.replyRate ?? 0}%`, icon: "📈", color: "#F59E0B", sub: s.bestCategory ? `Best: ${s.bestCategory.name}` : "No replies yet" },
    ];

    const statusColor = { sent: "#0057FF", replied: "#00C896", failed: "#FF4444", unsent: "#555" };

    return (
        <div style={{ padding: "36px 40px", fontFamily: "'Sora',sans-serif", color: "#fff", maxWidth: 1100 }}>

            {/* Greeting */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 4 }}>
                    {greeting} 👋
                </h1>
                <p style={{ color: "#71717a", fontSize: 14, margin: 0 }}>Here's how your outreach is performing.</p>
            </div>

            {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#555", fontSize: 14, padding: "80px 0", justifyContent: "center" }}>
                    <div style={{ width: 18, height: 18, border: "2px solid #333", borderTopColor: "#00C896", borderRadius: 99, animation: "spin 1s linear infinite" }} />
                    Loading dashboard…
                </div>
            )}

            {!loading && (
                <>
                    {/* Stat Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 28 }}>
                        {statCards.map(c => (
                            <div key={c.label} style={{ background: "#0f0f12", border: "1px solid #ffffff0d", borderRadius: 14, padding: "22px 20px", position: "relative", overflow: "hidden" }}
                                onMouseOver={e => e.currentTarget.style.borderColor = c.color + "40"}
                                onMouseOut={e => e.currentTarget.style.borderColor = "#ffffff0d"}>
                                <div style={{ position: "absolute", top: 16, right: 18, fontSize: 26, opacity: .18 }}>{c.icon}</div>
                                <div style={{ fontSize: 11, color: "#555", fontWeight: 700, letterSpacing: ".08em", marginBottom: 10 }}>{c.label.toUpperCase()}</div>
                                <div style={{ fontSize: 34, fontWeight: 800, color: c.color, lineHeight: 1, marginBottom: 8 }}>{c.value}</div>
                                <div style={{ fontSize: 12, color: "#3f3f46" }}>{c.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

                        {/* Reply Rate Bar */}
                        <div style={{ background: "#0f0f12", border: "1px solid #ffffff0d", borderRadius: 14, padding: "24px" }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>📊 Campaign Overview</div>
                            {[
                                { label: "Sent",    val: s.sent,    total: s.total, color: "#0057FF" },
                                { label: "Replied", val: s.replied, total: s.sent,  color: "#00C896" },
                                { label: "Failed",  val: s.failed,  total: s.sent,  color: "#FF4444" },
                            ].map(row => {
                                const pct = row.total > 0 ? Math.round((row.val / row.total) * 100) : 0;
                                return (
                                    <div key={row.label} style={{ marginBottom: 16 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ fontSize: 12, color: "#a1a1aa" }}>{row.label}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.val ?? 0} <span style={{ color: "#3f3f46", fontWeight: 400 }}>({pct}%)</span></span>
                                        </div>
                                        <div style={{ background: "#1a1a1f", borderRadius: 99, height: 6 }}>
                                            <div style={{ background: row.color, width: `${pct}%`, height: "100%", borderRadius: 99, transition: "width 1s ease" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Top Categories */}
                        <div style={{ background: "#0f0f12", border: "1px solid #ffffff0d", borderRadius: 14, padding: "24px" }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>🏷️ Top Categories</div>
                            {top.length === 0 && <div style={{ color: "#3f3f46", fontSize: 13 }}>No category data yet</div>}
                            {top.map((cat, i) => (
                                <div key={cat.name} style={{ marginBottom: 14 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                        <span style={{ fontSize: 12, color: "#a1a1aa", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#00C896" }}>{cat.count}</span>
                                    </div>
                                    <div style={{ background: "#1a1a1f", borderRadius: 99, height: 5 }}>
                                        <div style={{ background: `hsl(${160 - i * 28},80%,50%)`, width: `${Math.round((cat.count / maxCat) * 100)}%`, height: "100%", borderRadius: 99, transition: "width 1s ease" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div style={{ background: "#0f0f12", border: "1px solid #ffffff0d", borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ padding: "18px 22px", borderBottom: "1px solid #ffffff0d", fontWeight: 700, fontSize: 15 }}>🕐 Recent Activity</div>
                        {recent.length === 0 && (
                            <div style={{ padding: "40px", textAlign: "center", color: "#3f3f46", fontSize: 13 }}>No emails sent yet</div>
                        )}
                        {recent.map((r, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 22px", borderBottom: "1px solid #ffffff05" }}
                                onMouseOver={e => e.currentTarget.style.background = "#ffffff04"}
                                onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                                <div style={{ width: 36, height: 36, borderRadius: 99, background: "linear-gradient(135deg,#00C89622,#0057FF22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#00C896", flexShrink: 0 }}>
                                    {(r.name || "?")[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: "#e5e5e7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{r.email}</div>
                                </div>
                                <div style={{ fontSize: 11, color: "#3f3f46", whiteSpace: "nowrap" }}>{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : ""}</div>
                                <span style={{ background: (statusColor[r.status] || "#555") + "18", color: statusColor[r.status] || "#555", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                    {r.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}

// ─── SCRAPER PAGE ──────────────────────────────────────────────
function ScraperPage() {
    const [keyword, setKeyword] = useState("");
    const [city, setCity] = useState("");
    const [scanning, setScanning] = useState(false);
    const [leads, setLeads] = useState([]);
    const [selected, setSelected] = useState([]);
    const [blasting, setBlasting] = useState(false);
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Compose Modal State
    const [showCompose, setShowCompose] = useState(false);
    const [emailSubject, setEmailSubject] = useState("Partnership opportunity with {name}");
    
    async function scan() {
        if (!keyword || !city) return;
        setScanning(true); setLeads([]); setSelected([]); setError(""); setMsg("");

        let res = null;
        try {
            res = await startLeadScraperAPI(keyword, city);
        } catch (networkErr) {
            // Network-level failure (connection reset, proxy timeout on Azure, etc.)
            // The backend may have completed successfully — always try the DB re-fetch.
            console.warn('[scan] Network error, attempting DB re-fetch:', networkErr.message);
        }

        setScanning(false);

        // ── Handle concurrency guard errors (these are fast rejections, no DB data) ──
        if (res && !res.success) {
            if ((res.error || '').includes('already running')) {
                Toast.fire({ icon: 'warning', title: 'Scan already running', text: 'Press "Stop Scan" before starting a new search.' });
                return;
            }
            if ((res.error || '').includes('full capacity') || (res.error || '').includes('active scans')) {
                Toast.fire({ icon: 'info', title: '🚦 Server at capacity', text: 'All scan slots are in use right now. Please try again after some time.', timer: 8000, timerProgressBar: true });
                return;
            }
            if ((res.error || '').includes('keyword and city')) {
                setError(res.error);
                return;
            }
        }

        // ── Always re-fetch from DB after the scrape ─────────────────────────────
        // Reason 1: res.data contains raw Mongoose docs whose status may already be
        //           "sent"/"replied" — filtering them to "unsent" silently drops them.
        // Reason 2: On Azure, long-running HTTP responses (3–5 min) are often
        //           truncated by load balancers/proxies, arriving as null/empty.
        //           Re-fetching from DB is always authoritative regardless of what
        //           the scan response body contained.
        try {
            const fresh = await loadDashboardLeadsAPI();
            const freshLeads = Array.isArray(fresh?.data)
                ? fresh.data.filter(l => l.email && l.website && l.status === "unsent")
                : [];
            setLeads(freshLeads);

            if (res?.cancelled) {
                Toast.fire({ icon: 'info', title: 'Scan stopped', text: `${freshLeads.length} leads saved so far.` });
            } else if (freshLeads.length === 0) {
                setError("No new leads found. Try a different keyword or city.");
            } else {
                Toast.fire({ icon: 'success', title: '✅ Scan complete!', text: `${freshLeads.length} ready-to-email lead(s) found.` });
            }
        } catch (fetchErr) {
            // Even the re-fetch failed — genuine connectivity problem
            setError("Scan completed but couldn't load results. Please refresh the page.");
        }
    }
    
    const defaultBody = `Hi {name} team,\n\nI noticed you are a prominent business in the {category} space.\n\nWe specialize in helping businesses like yours scale and acquire more customers through targeted digital strategies. I'd love to share a few quick ideas on how we can collaborate and drive more growth for your business.\n\nAre you open to a brief 10-minute chat next week?\n\nThank you`;
    
    const [emailBody, setEmailBody] = useState(defaultBody);
    const [generatingAI, setGeneratingAI] = useState(false);

    // Load existing leads from dashboard on mount
    useEffect(() => {
        loadDashboardLeadsAPI().then(res => {
            // backend returns { success, count, data }
            const arr = Array.isArray(res?.data) ? res.data : [];
            setLeads(arr.filter(l => l.email && l.website && l.status === "unsent"));
        }).catch(() => { });
    }, []);


    async function stopScan() {
        try {
            await cancelLeadScraperAPI();
            // Cancel now force-closes all 3 Chromium browsers immediately
            Toast.fire({ icon: 'success', title: 'Scan stopped', text: 'All browser processes have been terminated.' });
            setScanning(false);
        } catch (e) {
            console.error("Failed to cancel", e);
            Toast.fire({ icon: 'error', title: 'Could not stop scan', text: e.message });
        }
    }

    async function handleGenerateAI() {
        setGeneratingAI(true);
        const res = await generateAIEmailAPI(keyword, city);
        setGeneratingAI(false);
        if (res?.subject) setEmailSubject(res.subject);
        if (res?.body) setEmailBody(res.body);
        if (res?.simulated) {
            setError("No GEMINI_API_KEY found in backend/.env file. Fell back to the default template. To get real AI-generated emails, please add your Google Gemini API key!");
        }
    }

    async function sendBlast() {
        if (!selected.length) return;
        setShowCompose(false);
        setBlasting(true); setMsg("");
        const res = await sendEmailBlastAPI(selected, emailSubject, emailBody);
        setBlasting(false);
        if (res?.success) {
            // ── SweetAlert2 Toast: replaces plain setMsg text ────────────
            Toast.fire({ icon: 'success', title: `🚀 Emails dispatched!`, text: `Successfully sent to ${selected.length} lead(s).` });
            setSelected([]);
            // Refresh to update statuses
            const refresh = await loadDashboardLeadsAPI();
            if (Array.isArray(refresh?.data)) {
                setLeads(refresh.data.filter(l => l.email && l.website && l.status === "unsent"));
            }
        } else {
            Toast.fire({ icon: 'error', title: 'Email blast failed', text: res?.error || 'Check your SMTP settings.' });
        }
    }

    function toggleSelect(id) { setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
    function selectAll() { setSelected(leads.map(l => l._id)); }

    async function deleteLead(id) {
        try {
            const lead = leads.find(l => l._id === id);
            if (lead?.status !== "unsent") {
                setError("Cannot delete a lead that has been sent, replied, or failed.");
                return;
            }
            const token = localStorage.getItem("userSessionToken");
            const res = await fetch(`${API}/leads/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setLeads(l => l.filter(x => x._id !== id));
                setSelected(s => s.filter(x => x !== id));
            }
        } catch (e) {
            console.error("Delete failed:", e.message);
        }
    }

    async function clearAllLeads() {
        setShowClearConfirm(false);
        try {
            const token = localStorage.getItem("userSessionToken");
            const unsentLeads = leads.filter(l => l.status === "unsent");
            await Promise.all(unsentLeads.map(l =>
                fetch(`${API}/leads/${l._id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                })
            ));
            setLeads(l => l.filter(x => x.status !== "unsent"));
            setSelected([]);
            setMsg("");
            setError("");
        } catch (e) {
            console.error("Clear failed:", e.message);
        }
    }

    return (
        <div style={{ padding: "36px 40px", fontFamily: "'Sora',sans-serif", color: "#fff", maxWidth: 1100 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>Lead Scraper</h1>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 32 }}>Find businesses by keyword and location from Google Maps.</p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g. web development, restaurant…"
                    style={{ flex: "1 1 220px", padding: "13px 16px", borderRadius: 10, border: "1px solid #ffffff15", background: "#141417", color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, outline: "none" }} />
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="City (e.g. Kota, Mumbai…)"
                    onKeyDown={e => e.key === "Enter" && scan()}
                    style={{ flex: "1 1 180px", padding: "13px 16px", borderRadius: 10, border: "1px solid #ffffff15", background: "#141417", color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, outline: "none" }} />
                <button onClick={scan} disabled={scanning || !keyword || !city}
                    style={{ padding: "13px 28px", borderRadius: 10, border: "none", background: scanning ? "#00C89666" : "linear-gradient(135deg,#00C896,#0057FF)", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: scanning ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                    {scanning ? "⏳ Scanning…" : "🔍 Scan Leads"}
                </button>
                {scanning && (
                    <button onClick={stopScan}
                        style={{ padding: "13px 28px", borderRadius: 10, border: "1px solid #FF4444", background: "#FF444420", color: "#FF4444", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
                        ⏹️ Stop Scanning
                    </button>
                )}
                {leads.length > 0 && (
                    <button onClick={() => setShowClearConfirm(true)}
                        style={{ padding: "13px 28px", borderRadius: 10, border: "1px solid #FF444440", background: "transparent", color: "#FF4444", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
                        🗑️ Clear All
                    </button>
                )}
                {selected.length > 0 && (
                    <button onClick={() => setShowCompose(true)} disabled={blasting}
                        style={{ padding: "13px 28px", borderRadius: 10, border: "none", background: "#0057FF", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: blasting ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: blasting ? .7 : 1 }}>
                        {blasting ? "Sending…" : `🚀 Blast ${selected.length} Email${selected.length > 1 ? "s" : ""}`}
                    </button>
                )}
            </div>

            {/* Live SSE progress bar — only shown while scanning */}
            <SseProgressBar active={scanning} />

            {msg && (
                <div style={{ background: msg.startsWith("Failed") ? "#FF444418" : "#00C89618", border: `1px solid ${msg.startsWith("Failed") ? "#FF444430" : "#00C89630"}`, borderRadius: 10, padding: "12px 18px", marginBottom: 16, fontSize: 14, color: msg.startsWith("Failed") ? "#FF6666" : "#00C896" }}>
                    {msg}
                </div>
            )}
            {error && <div style={{ background: "#FF444418", border: "1px solid #FF444430", borderRadius: 10, padding: "12px 18px", marginBottom: 16, color: "#FF6666", fontSize: 14 }}>{error}</div>}

            {!scanning && leads.length > 0 && (
                <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={{ color: "#a1a1aa", fontSize: 13 }}>{leads.length} lead{leads.length !== 1 ? "s" : ""} found</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <button
                                onClick={() => downloadCSV(
                                    leads,
                                    [
                                        { label: "Business Name", value: r => r.name },
                                        { label: "Category",      value: r => r.category },
                                        { label: "Phone",         value: r => r.phone },
                                        { label: "Address",       value: r => r.address },
                                        { label: "Website",       value: r => r.website },
                                        { label: "Email",         value: r => r.email },
                                        { label: "Maps URL",      value: r => r.mapsUrl },
                                        { label: "Status",        value: r => r.status },
                                    ],
                                    `leads-${new Date().toISOString().slice(0,10)}.csv`
                                )}
                                style={{ fontSize: 12, color: "#00C896", background: "#00C89610", border: "1px solid #00C89640", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700 }}
                            >
                                ⬇ Export CSV
                            </button>
                            <button onClick={selectAll} style={{ fontSize: 13, color: "#00C896", background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 600 }}>Select all</button>
                        </div>
                    </div>
                    <div style={{ background: "#0f0f12", border: "1px solid #ffffff0d", borderRadius: 14, overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #ffffff0d" }}>
                                    <th style={{ padding: "13px 16px", textAlign: "left", color: "#555", fontWeight: 600 }}>#</th>
                                    {["Business", "Category", "Phone", "Website", "Email", "Status", ""].map(h => (
                                        <th key={h} style={{ padding: "13px 14px", textAlign: "left", color: "#555", fontWeight: 600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {leads.map(l => (
                                    <tr key={l._id} onClick={() => toggleSelect(l._id)}
                                        style={{ borderBottom: "1px solid #ffffff06", cursor: "pointer", background: selected.includes(l._id) ? "#00C89608" : "transparent" }}>
                                        <td style={{ padding: "13px 16px" }}>
                                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected.includes(l._id) ? "#00C896" : "#333"}`, background: selected.includes(l._id) ? "#00C896" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {selected.includes(l._id) && <span style={{ fontSize: 10, color: "#000", fontWeight: 800 }}>✓</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: "13px 14px", fontWeight: 600, color: "#e5e5e7" }}>{l.name || "—"}</td>
                                        <td style={{ padding: "13px 14px", color: "#71717a" }}>{l.category || "—"}</td>
                                        <td style={{ padding: "13px 14px", color: "#71717a" }}>{l.phone || "—"}</td>
                                        <td style={{ padding: "13px 14px" }}>
                                            {l.website
                                                ? <a href={l.website} target="_blank" rel="noreferrer" style={{ color: "#0057FF", textDecoration: "none" }} onClick={e => e.stopPropagation()}>{l.website.replace(/^https?:\/\//, "").slice(0, 30)}</a>
                                                : <span style={{ color: "#444" }}>—</span>}
                                        </td>
                                        <td style={{ padding: "13px 14px", color: "#a1a1aa" }}>{l.email || <span style={{ color: "#444" }}>—</span>}</td>
                                        <td style={{ padding: "13px 14px" }}><Badge status={l.status} /></td>
                                        <td style={{ padding: "13px 14px" }}>
                                            <button onClick={e => { e.stopPropagation(); deleteLead(l._id); }}
                                                style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #FF444440", background: "transparent", color: "#FF4444", fontSize: 12, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 600 }}>
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {!scanning && leads.length === 0 && !error && (
                <div style={{ textAlign: "center", padding: "80px 20px", color: "#3f3f46" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No results yet</div>
                    <div style={{ fontSize: 13 }}>Enter a keyword and city above to start scanning</div>
                </div>
            )}

            {/* Compose Modal */}
            {showCompose && (
                <div style={{ position: "fixed", inset: 0, background: "#000000c0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
                    <div style={{ background: "#0f0f12", border: "1px solid #ffffff15", borderRadius: 16, padding: 30, width: "100%", maxWidth: 600, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Compose Blast ({selected.length} leads)</h2>
                            <button onClick={() => setShowCompose(false)} style={{ background: "transparent", border: "none", color: "#555", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
                        </div>

                        <div style={{ marginBottom: 16, background: "#0057FF10", border: "1px solid #0057FF30", padding: "12px 16px", borderRadius: 8 }}>
                            <div style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 4 }}>Tags you can use:</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <span style={{ background: "#0057FF30", color: "#66b3ff", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{`{name}`}</span>
                                <span style={{ background: "#0057FF30", color: "#66b3ff", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{`{category}`}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6, fontWeight: 600 }}>Subject</label>
                            <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 8, border: "1px solid #ffffff15", background: "#141417", color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, outline: "none" }} />
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6, fontWeight: 600 }}>Message Body</label>
                            <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={7}
                                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 8, border: "1px solid #ffffff15", background: "#141417", color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, outline: "none", resize: "vertical" }} />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <button onClick={handleGenerateAI} disabled={generatingAI}
                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 18px", borderRadius: 8, border: "1px solid #00C89640", background: "#00C89610", color: "#00C896", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, cursor: generatingAI ? "wait" : "pointer" }}>
                                {generatingAI ? "✨ Generating..." : "✨ Generate AI Email"}
                            </button>

                            <button onClick={sendBlast}
                                style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#0057FF,#0033CC)", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                                Send Blast 🚀
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Confirm Modal */}
            {showClearConfirm && (
                <div style={{ position: "fixed", inset: 0, background: "#000000bb", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
                    <div style={{ background: "#111113", border: "1px solid #ffffff15", borderRadius: 16, padding: "30px", width: "100%", maxWidth: 400, textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 12, marginTop: 0 }}>Clear Unsent Leads?</h2>
                        <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
                            Are you sure you want to clear all unsent leads? Leads that have already been sent or replied to will be kept safe.
                        </p>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button onClick={() => setShowClearConfirm(false)}
                                style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #ffffff15", background: "transparent", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                                Cancel
                            </button>
                            <button onClick={clearAllLeads}
                                style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: "#FF4444", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                                Yes, Clear Leads
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}

// ─── EMAILS PAGE ───────────────────────────────────────────────
function EmailsPage({ isActive }) {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("date");
    const [sortDir, setSortDir] = useState("desc");
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        if (isActive) {
            setLoading(true);
            loadCampaignOutboxAPI().then(res => {
                setLoading(false);
                if (res?.success && Array.isArray(res.data)) setEmails(res.data);
                else if (res?.error && res.error !== 'SESSION_EVICTED') {
                    // Suppress SESSION_EVICTED — the global event listener in App
                    // already shows the SweetAlert2 popup for that case.
                    setError(res.error);
                }
            }).catch(() => { setLoading(false); setError("Could not load emails."); });
        }
    }, [isActive]);

    const total   = emails.length;
    const sent    = emails.filter(e => e.status === "sent").length;
    const replied = emails.filter(e => e.status === "replied").length;
    const failed  = emails.filter(e => e.status === "failed").length;

    // ── Filter & Sort ──────────────────────────────────────────
    const q = search.toLowerCase().trim();
    const filtered = emails
        .filter(e => {
            if (statusFilter !== "all" && e.status !== statusFilter) return false;
            if (!q) return true;
            return (
                (e.name || "").toLowerCase().includes(q) ||
                (e.email || "").toLowerCase().includes(q) ||
                (e.sentSubject || "").toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            let va, vb;
            if (sortBy === "date")   { va = new Date(a.sentAt || 0); vb = new Date(b.sentAt || 0); }
            if (sortBy === "name")   { va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); }
            if (sortBy === "status") { va = a.status || ""; vb = b.status || ""; }
            if (va < vb) return sortDir === "asc" ? -1 : 1;
            if (va > vb) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

    const inp = { padding: "10px 14px", borderRadius: 9, border: "1px solid #ffffff15", background: "#141417", color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 13, outline: "none" };
    const STATUS_OPTS = ["all","sent","replied","failed"];

    return (
        <div style={{ padding: "36px 40px", fontFamily: "'Sora',sans-serif", color: "#fff", maxWidth: 1100 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>Emails Sent</h1>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 32 }}>Track every outbound email and its delivery status.</p>

            {/* Stat Cards */}
            <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
                {[["📨","Total",total],["✅","Sent",sent],["💬","Replied",replied],["❌","Failed",failed]].map(([icon,label,n]) => (
                    <div key={label} style={{ flex: "1 1 130px", background: "#0f0f12", border: "1px solid #ffffff0d", borderRadius: 12, padding: "20px" }}>
                        <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "#00C896" }}>{n}</div>
                        <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Search + Sort bar */}
            {!loading && emails.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                    {/* Search */}
                    <div style={{ position: "relative", flex: "1 1 220px" }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#555" }}>🔍</span>
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, email or subject…"
                            style={{ ...inp, width: "100%", paddingLeft: 34, boxSizing: "border-box" }}
                        />
                    </div>

                    {/* Status filter pills */}
                    <div style={{ display: "flex", gap: 6 }}>
                        {STATUS_OPTS.map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)}
                                style={{
                                    padding: "8px 14px", borderRadius: 8, border: "1px solid",
                                    borderColor: statusFilter === s ? "#00C896" : "#ffffff15",
                                    background: statusFilter === s ? "#00C89618" : "transparent",
                                    color: statusFilter === s ? "#00C896" : "#71717a",
                                    fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12, cursor: "pointer",
                                }}>
                                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Sort by */}
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                        style={{ ...inp, cursor: "pointer" }}>
                        <option value="date">Sort: Date</option>
                        <option value="name">Sort: Name</option>
                        <option value="status">Sort: Status</option>
                    </select>

                    {/* Sort direction */}
                    <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                        style={{ ...inp, cursor: "pointer", border: "1px solid #ffffff15", fontWeight: 700, fontSize: 14, minWidth: 42, textAlign: "center" }}>
                        {sortDir === "asc" ? "↑" : "↓"}
                    </button>

                    {/* Results count */}
                    <span style={{ fontSize: 12, color: "#3f3f46", whiteSpace: "nowrap" }}>
                        {filtered.length} of {emails.length}
                    </span>

                    {/* Export button */}
                    <button
                        onClick={() => downloadCSV(
                            filtered,
                            [
                                { label: "Business Name",  value: r => r.name },
                                { label: "Email",          value: r => r.email },
                                { label: "Subject",        value: r => r.sentSubject },
                                { label: "Status",         value: r => r.status },
                                { label: "Sent At",        value: r => r.sentAt ? new Date(r.sentAt).toLocaleString() : "" },
                                { label: "Reply From",     value: r => r.replyFrom },
                                { label: "Reply Subject",  value: r => r.replySubject },
                                { label: "Reply Body",     value: r => r.replyBody },
                                { label: "Replied At",     value: r => r.repliedAt ? new Date(r.repliedAt).toLocaleString() : "" },
                            ],
                            `emails-sent-${new Date().toISOString().slice(0,10)}.csv`
                        )}
                        style={{ ...inp, cursor: "pointer", border: "1px solid #00C89640", color: "#00C896", fontWeight: 700, whiteSpace: "nowrap", background: "#00C89610" }}
                    >
                        ⬇ Export CSV
                    </button>
                </div>
            )}

            {loading && <div style={{ color: "#555", fontSize: 14, textAlign: "center", padding: "60px" }}>Loading emails…</div>}
            {error   && <div style={{ background: "#FF444418", border: "1px solid #FF444430", borderRadius: 10, padding: "14px 18px", color: "#FF6666", fontSize: 14 }}>{error}</div>}

            {!loading && emails.length > 0 && (
                <div style={{ background: "#0f0f12", border: "1px solid #ffffff0d", borderRadius: 14, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #ffffff0d" }}>
                                {["Business","Email","Subject","Sent At","Status","View Reply"].map(h => (
                                    <th key={h} style={{ padding: "13px 16px", textAlign: "left", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length > 0
                                ? filtered.map(e => <EmailRow key={e._id} e={e} />)
                                : (
                                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#3f3f46", fontSize: 13 }}>
                                        No results match your search
                                    </td></tr>
                                )
                            }
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && emails.length === 0 && !error && (
                <div style={{ textAlign: "center", padding: "80px 20px", color: "#3f3f46" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No emails sent yet</div>
                    <div style={{ fontSize: 13 }}>Scan for leads and blast an email campaign to see results here</div>
                </div>
            )}
        </div>
    );
}

// ─── EMAIL ROW with inline reply panel ─────────────────────────
function EmailRow({ e }) {
    const [open, setOpen] = useState(false);
    const hasReply = e.status === "replied" && (e.replyBody || e.replyFrom);

    return (
        <>
            <tr
                style={{ borderBottom: open ? "none" : "1px solid #ffffff06", transition: "background .15s" }}
                onMouseOver={ev => ev.currentTarget.style.background = "#ffffff04"}
                onMouseOut={ev => ev.currentTarget.style.background = "transparent"}
            >
                <td style={{ padding: "14px 16px", fontWeight: 600, color: "#e5e5e7" }}>{e.name || "—"}</td>
                <td style={{ padding: "14px 16px", color: "#71717a" }}>{e.email || "—"}</td>
                <td style={{ padding: "14px 16px", color: "#a1a1aa" }}>{e.sentSubject || "—"}</td>
                <td style={{ padding: "14px 16px", color: "#555", whiteSpace: "nowrap" }}>
                    {e.sentAt ? new Date(e.sentAt).toLocaleString() : "—"}
                </td>
                <td style={{ padding: "14px 16px" }}><Badge status={e.status} /></td>
                <td style={{ padding: "14px 16px" }}>
                    {hasReply ? (
                        <button
                            onClick={() => setOpen(o => !o)}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                                background: open
                                    ? "linear-gradient(135deg,#00C896,#0057FF)"
                                    : "#00C89618",
                                color: open ? "#fff" : "#00C896",
                                fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12,
                                transition: "all .2s",
                            }}
                        >
                            {open ? "▲ Hide" : "💬 View Reply"}
                        </button>
                    ) : (
                        <span style={{ color: "#2a2a2e", fontSize: 12 }}>—</span>
                    )}
                </td>
            </tr>

            {hasReply && open && (
                <tr style={{ borderBottom: "1px solid #ffffff06" }}>
                    <td colSpan={6} style={{ padding: "0 16px 20px 16px", background: "#0a0a0d" }}>
                        <div style={{
                            border: "1px solid #00C89630",
                            borderRadius: 12,
                            overflow: "hidden",
                            animation: "slideDown .18s ease",
                        }}>
                            <div style={{
                                background: "linear-gradient(90deg,#00C89610,#0057FF08)",
                                borderBottom: "1px solid #00C89620",
                                padding: "12px 18px",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 15 }}>💬</span>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: "#00C896" }}>Reply from {e.name}</span>
                                    {e.replySubject && (
                                        <span style={{ fontSize: 12, color: "#555", marginLeft: 4 }}>· {e.replySubject}</span>
                                    )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    {e.repliedAt && (
                                        <span style={{ fontSize: 11, color: "#3f3f46" }}>
                                            {new Date(e.repliedAt).toLocaleString()}
                                        </span>
                                    )}
                                    {e.replyFrom && (
                                        <span style={{ fontSize: 11, color: "#555", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            From: {e.replyFrom}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                padding: "18px 20px",
                                fontSize: 13, lineHeight: 1.8,
                                color: "#c4c4c8",
                                whiteSpace: "pre-wrap", wordBreak: "break-word",
                                background: "#0d0d10",
                                maxHeight: 260, overflowY: "auto",
                            }}>
                                {e.replyBody || <span style={{ color: "#3f3f46", fontStyle: "italic" }}>(No reply body captured)</span>}
                            </div>

                            <div style={{ padding: "12px 18px", background: "#0a0a0d", borderTop: "1px solid #ffffff08", display: "flex", gap: 10 }}>
                                <a
                                    href={`mailto:${e.email}?subject=Re: ${encodeURIComponent(e.sentSubject || "")}`}
                                    style={{
                                        padding: "7px 16px", borderRadius: 8,
                                        background: "linear-gradient(135deg,#00C896,#0057FF)",
                                        color: "#fff", fontFamily: "'Sora',sans-serif",
                                        fontWeight: 700, fontSize: 12,
                                        textDecoration: "none", display: "inline-block",
                                    }}
                                >
                                    ✉️ Reply
                                </a>
                            </div>
                        </div>
                        <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }`}</style>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── REPLIES PAGE ──────────────────────────────────────────────
function RepliesPage({ onCountUpdate }) {
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [checkMsg, setCheckMsg] = useState("");
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState({});
    const [autoStatus, setAutoStatus] = useState(null);
    const [countdown, setCountdown] = useState("");

    async function loadReplies() {
        try {
            const data = await loadRepliesAPI();
            if (data.success && Array.isArray(data.data)) {
                setReplies(data.data);
                if (onCountUpdate) onCountUpdate(data.data.length);
            } else if (data.error !== 'SESSION_EVICTED') {
                // Suppress SESSION_EVICTED — the global App event listener
                // already shows the SweetAlert2 popup for that case.
                setError(data.error || "Failed to load replies.");
            }
        } catch {
            setError("Could not reach server.");
        }
    }

    async function fetchAutoStatus() {
        try {
            const res = await fetch(`${API}/leads/auto-check-status`);
            if (res.ok) setAutoStatus(await res.json());
        } catch { }
    }

    // Auto-refresh replies list every 2 minutes
    useEffect(() => {
        loadReplies().finally(() => setLoading(false));
        fetchAutoStatus();

        const dataRefresh = setInterval(() => {
            loadReplies();
            fetchAutoStatus();
        }, 2 * 60 * 1000);

        return () => clearInterval(dataRefresh);
    }, []);

    // Live countdown ticker every second
    useEffect(() => {
        const tick = setInterval(() => {
            if (!autoStatus?.nextCheck) { setCountdown(""); return; }
            const diff = new Date(autoStatus.nextCheck) - Date.now();
            if (diff <= 0) { setCountdown("checking…"); return; }
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${m}:${String(s).padStart(2, "0")}`);
        }, 1000);
        return () => clearInterval(tick);
    }, [autoStatus]);

    async function checkInbox() {
        setChecking(true);
        setCheckMsg("");
        try {
            const token = localStorage.getItem("userSessionToken");
            const res = await fetch(`${API}/leads/check-replies`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            const data = await res.json();
            if (data.success) {
                setCheckMsg(
                    data.newReplies > 0
                        ? `✅ Processed ${data.newReplies} incoming email${data.newReplies > 1 ? "s" : ""}!`
                        : "📭 No new emails found."
                );
                await loadReplies();
                await fetchAutoStatus();
            } else {
                setCheckMsg(`❌ ${data.error || "IMAP check failed."}`);
            }
        } catch {
            setCheckMsg("❌ Could not reach server.");
        }
        setChecking(false);
    }

    function toggleExpand(id) {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    }

    return (
        <div style={{ padding: "36px 40px", fontFamily: "'Sora',sans-serif", color: "#fff", maxWidth: 900 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>Replies</h1>
                    <p style={{ color: "#71717a", fontSize: 14, margin: 0 }}>
                        Leads who replied to your outbound emails.
                        {replies.length > 0 && (
                            <span style={{ marginLeft: 10, background: "#00C89618", color: "#00C896", borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
                                {replies.length} repl{replies.length !== 1 ? "ies" : "y"}
                            </span>
                        )}
                    </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <button
                        onClick={checkInbox}
                        disabled={checking}
                        style={{
                            padding: "11px 22px", borderRadius: 10, border: "none",
                            background: checking ? "#1a1a1f" : "linear-gradient(135deg,#00C896,#0057FF)",
                            color: checking ? "#555" : "#fff",
                            fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13,
                            cursor: checking ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", gap: 8,
                        }}
                    >
                        {checking ? (
                            <>
                                <div style={{ width: 13, height: 13, border: "2px solid #555", borderTopColor: "#00C896", borderRadius: 99, animation: "spin 1s linear infinite" }} />
                                Checking IMAP…
                            </>
                        ) : "📬 Check Inbox"}
                    </button>
                    {checkMsg && (
                        <div style={{
                            fontSize: 12, padding: "7px 14px", borderRadius: 8,
                            background: checkMsg.startsWith("✅") ? "#00C89615" : checkMsg.startsWith("📭") ? "#ffffff08" : "#FF444415",
                            color: checkMsg.startsWith("✅") ? "#00C896" : checkMsg.startsWith("📭") ? "#71717a" : "#FF6666",
                            border: `1px solid ${checkMsg.startsWith("✅") ? "#00C89630" : checkMsg.startsWith("📭") ? "#ffffff12" : "#FF444430"}`,
                        }}>
                            {checkMsg}
                        </div>
                    )}
                </div>
            </div>

            {/* Auto-check status bar */}
            <div style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "#0f0f12", border: "1px solid #ffffff0d",
                borderRadius: 10, padding: "10px 18px", marginBottom: 24,
                flexWrap: "wrap",
            }}>
                <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 99, background: autoStatus?.running ? "#FFA500" : "#00C896" }} />
                    <div style={{ position: "absolute", inset: 0, borderRadius: 99, background: autoStatus?.running ? "#FFA50060" : "#00C89660", animation: "pulse 1.8s ease-in-out infinite" }} />
                </div>
                <span style={{ fontSize: 12, color: "#a1a1aa", fontWeight: 600 }}>
                    {autoStatus?.running ? "⏳ Checking inbox…" : "🔄 Auto-checking every 2 min"}
                </span>
                <span style={{ fontSize: 12, color: "#3f3f46", marginLeft: "auto" }}>
                    {autoStatus?.lastChecked ? `Last: ${new Date(autoStatus.lastChecked).toLocaleTimeString()}` : "Waiting for first check…"}
                </span>
                {countdown && !autoStatus?.running && (
                    <span style={{ fontSize: 12, fontWeight: 700, background: "#00C89612", color: "#00C896", border: "1px solid #00C89625", borderRadius: 6, padding: "3px 10px" }}>
                        Next: {countdown}
                    </span>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#555", fontSize: 14, padding: "60px 0", justifyContent: "center" }}>
                    <div style={{ width: 16, height: 16, border: "2px solid #333", borderTopColor: "#00C896", borderRadius: 99, animation: "spin 1s linear infinite" }} />
                    Loading replies…
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ background: "#FF444418", border: "1px solid #FF444430", borderRadius: 10, padding: "14px 18px", color: "#FF6666", fontSize: 14, marginBottom: 16 }}>
                    {error}
                </div>
            )}

            {/* Reply cards */}
            {!loading && replies.map(r => (
                <div key={r._id} style={{
                    background: "#0f0f12", border: "1px solid #ffffff0d",
                    borderRadius: 16, marginBottom: 16, overflow: "hidden",
                    transition: "border-color .2s",
                }}
                    onMouseOver={e => e.currentTarget.style.borderColor = "#00C89630"}
                    onMouseOut={e => e.currentTarget.style.borderColor = "#ffffff0d"}
                >
                    {/* Green left bar */}
                    <div style={{ display: "flex" }}>
                        <div style={{ width: 3, flexShrink: 0, background: "linear-gradient(180deg,#00C896,#0057FF)" }} />
                        <div style={{ flex: 1, padding: "22px 24px" }}>

                            {/* Top row */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 99, flexShrink: 0,
                                        background: "linear-gradient(135deg,#00C89633,#0057FF33)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 17, fontWeight: 800, color: "#00C896",
                                    }}>
                                        {(r.name || "?")[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: "#e5e5e7" }}>{r.name || "Unknown"}</div>
                                        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{r.replyFrom || r.email || ""}</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ background: "#00C89618", color: "#00C896", borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "3px 10px" }}>
                                        Replied
                                    </span>
                                    <span style={{ fontSize: 12, color: "#3f3f46" }}>
                                        {r.repliedAt ? new Date(r.repliedAt).toLocaleString() : ""}
                                    </span>
                                </div>
                            </div>

                            {/* Sent email summary */}
                            {r.sentSubject && (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 10, color: "#3f3f46", fontWeight: 700, letterSpacing: ".08em", marginBottom: 5 }}>
                                        YOU SENT
                                    </div>
                                    <div style={{ background: "#141417", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#555", borderLeft: "2px solid #0057FF33" }}>
                                        <span style={{ color: "#71717a" }}>Subject: </span>
                                        <span style={{ color: "#a1a1aa", fontWeight: 600 }}>{r.sentSubject}</span>
                                    </div>
                                </div>
                            )}

                            {/* Their reply */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 10, color: "#3f3f46", fontWeight: 700, letterSpacing: ".08em", marginBottom: 5 }}>
                                    THEIR REPLY
                                    {r.replySubject && r.replySubject !== r.sentSubject && (
                                        <span style={{ color: "#555", fontWeight: 400, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
                                            · {r.replySubject}
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    background: "#141417", borderRadius: 10, padding: "14px 18px",
                                    fontSize: 13, lineHeight: 1.75, color: "#c4c4c8",
                                    borderLeft: "2px solid #00C89644",
                                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                                    maxHeight: expanded[r._id] ? "none" : "96px",
                                    overflow: "hidden",
                                    position: "relative",
                                }}>
                                    {r.replyBody
                                        ? r.replyBody
                                        : <span style={{ color: "#3f3f46", fontStyle: "italic" }}>(No message body captured)</span>
                                    }
                                    {/* Fade if collapsed and long */}
                                    {!expanded[r._id] && r.replyBody && r.replyBody.length > 220 && (
                                        <div style={{
                                            position: "absolute", bottom: 0, left: 0, right: 0, height: 40,
                                            background: "linear-gradient(transparent, #141417)",
                                        }} />
                                    )}
                                </div>
                                {r.replyBody && r.replyBody.length > 220 && (
                                    <button onClick={() => toggleExpand(r._id)}
                                        style={{ marginTop: 6, fontSize: 12, color: "#00C896", background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 600, padding: 0 }}>
                                        {expanded[r._id] ? "Show less ↑" : "Show more ↓"}
                                    </button>
                                )}
                            </div>

                            {/* Action row */}
                            <div style={{ display: "flex", gap: 10 }}>
                                <a href={`mailto:${r.email}?subject=Re: ${encodeURIComponent(r.sentSubject || "")}`}
                                    style={{
                                        padding: "8px 18px", borderRadius: 8, border: "none",
                                        background: "linear-gradient(135deg,#00C896,#0057FF)",
                                        color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700,
                                        fontSize: 12, cursor: "pointer", textDecoration: "none", display: "inline-block",
                                    }}>
                                    ✉️ Reply
                                </a>
                                {r.website && (
                                    <a href={r.website} target="_blank" rel="noreferrer"
                                        style={{
                                            padding: "8px 18px", borderRadius: 8,
                                            border: "1px solid #ffffff15", background: "transparent",
                                            color: "#a1a1aa", fontFamily: "'Sora',sans-serif", fontWeight: 600,
                                            fontSize: 12, cursor: "pointer", textDecoration: "none", display: "inline-block",
                                        }}>
                                        🌐 Visit Site
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            {/* Empty state */}
            {!loading && replies.length === 0 && !error && (
                <div style={{ textAlign: "center", padding: "80px 20px" }}>
                    <div style={{ fontSize: 52, marginBottom: 18 }}>💬</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#3f3f46", marginBottom: 8 }}>No replies yet</div>
                    <div style={{ fontSize: 13, color: "#2a2a2e" }}>
                        Click "Check Inbox" to pull fresh replies from your email inbox
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                @keyframes pulse { 0%,100% { transform: scale(1); opacity:.6 } 50% { transform: scale(2.2); opacity:0 } }
            `}</style>
        </div>
    );
}
// ─── PROFILE PAGE ─────────────────────────────────────────────
function ProfilePage({ user }) {
    const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", company: "", website: "" });
    const [saved, setSaved] = useState(false);
    function save() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

    const inp = { width: "100%", padding: "12px 14px", borderRadius: 9, border: "1px solid #ffffff15", background: "#141417", color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, boxSizing: "border-box", outline: "none" };

    return (
        <div style={{ padding: "36px 40px", fontFamily: "'Sora',sans-serif", color: "#fff", maxWidth: 680 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>Profile</h1>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 36 }}>Manage your account and preferences.</p>

            <div style={{ background: "#0f0f12", border: "1px solid #ffffff0d", borderRadius: 16, padding: "32px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36, paddingBottom: 28, borderBottom: "1px solid #ffffff0d" }}>
                    <div style={{ width: 72, height: 72, borderRadius: 99, background: "linear-gradient(135deg,#00C896,#0057FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                        {(form.name || "U")[0].toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 20 }}>{form.name || "User"}</div>
                        <div style={{ color: "#71717a", fontSize: 14, marginTop: 3 }}>{form.email}</div>
                    </div>
                </div>
                {[["Full Name", "name", "Your name"], ["Email", "email", "you@example.com"], ["Company", "company", "Your company"], ["Website", "website", "https://yoursite.com"]].map(([label, key, ph]) => (
                    <div key={key} style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 7, fontWeight: 600 }}>{label}</label>
                        <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={ph} style={inp} />
                    </div>
                ))}
                <button onClick={save} style={{ padding: "13px 28px", borderRadius: 10, border: "none", background: saved ? "#00C89699" : "linear-gradient(135deg,#00C896,#0057FF)", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    {saved ? "✓ Saved!" : "Save Changes"}
                </button>
            </div>

            <div style={{ background: "#0f0f12", border: "1px solid #FF444418", borderRadius: 16, padding: "24px 28px" }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "#FF4444" }}>Danger Zone</h3>
                <p style={{ color: "#71717a", fontSize: 13, marginBottom: 16 }}>Permanently delete your account and all data.</p>
                <button style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid #FF444440", background: "transparent", color: "#FF4444", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Delete Account</button>
            </div>
        </div>
    );
}

// ─── DASHBOARD SHELL ───────────────────────────────────────────
function Dashboard({ user, onLogout }) {
    const [page, setPage] = useState("home");
    const [repliesCount, setReplies] = useState(0);

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#09090B" }}>
            <Sidebar page={page} setPage={setPage} user={user} onLogout={onLogout} repliesCount={repliesCount} />
            <main style={{ flex: 1, overflowY: "auto" }}>
                <div style={{ display: page === "home"    ? "block" : "none" }}><HomeDashboard isActive={page === "home"} /></div>
                <div style={{ display: page === "scraper" ? "block" : "none" }}><ScraperPage /></div>
                <div style={{ display: page === "emails"  ? "block" : "none" }}><EmailsPage isActive={page === "emails"} /></div>
                <div style={{ display: page === "replies" ? "block" : "none" }}><RepliesPage onCountUpdate={setReplies} /></div>
                <div style={{ display: page === "profile" ? "block" : "none" }}><ProfilePage user={user} /></div>
            </main>
        </div>
    );
}

// ─── ROOT ──────────────────────────────────────────────────────
export default function App() {
    const [view, setView] = useState("landing");
    const [modal, setModal] = useState(null);
    const [user, setUser] = useState(null);

    // Auto-login if JWT already stored
    useEffect(() => {
        const resetToken = new URLSearchParams(window.location.search).get("resetToken");
        if (resetToken) {
            setModal("reset");
            return;
        }

        const token = localStorage.getItem("userSessionToken");
        if (token) {
            setUser({ name: localStorage.getItem("userName") || "", email: localStorage.getItem("userEmail") || "" });
            setView("dashboard");
        }
    }, []);

    // ── Global Session Eviction Listener ──────────────────────────
    // api.js fires this custom event whenever the server returns SESSION_EVICTED.
    // This is the single place in the UI responsible for the lockout popup.
    useEffect(() => {
        const handleEviction = () => {
            ["userSessionToken", "userName", "userEmail"].forEach(k => localStorage.removeItem(k));

            Swal.fire({
                title: '🔐 Session Ended',
                html: 'Your account was just logged into from <strong>another device or browser</strong>.<br/><br/>You have been securely signed out.',
                icon: 'warning',
                confirmButtonText: 'Sign In Again',
                confirmButtonColor: '#0057FF',
                background: '#111113',
                color: '#e5e5e7',
                allowOutsideClick: false,
                allowEscapeKey: false,
            }).then(() => {
                setUser(null);
                setView("landing");
                setModal("login");
            });
        };

        window.addEventListener('session-evicted', handleEviction);
        return () => window.removeEventListener('session-evicted', handleEviction);
    }, []);

    // ── Persistent SSE connection for instant session eviction ─────────
    // Opens GET /api/auth/events as a long-lived stream. The moment someone
    // else logs in, evictUser() pushes SESSION_EVICTED here — millisecond popup.
    useEffect(() => {
        if (!user) return;

        const token = localStorage.getItem('userSessionToken');
        if (!token) return;

        const SSE_URL = API + '/auth/events';
        let abortCtrl = new AbortController();
        let retryTimeout = null;

        async function connectSSE() {
            try {
                const response = await fetch(SSE_URL, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal: abortCtrl.signal,
                });

                if (!response.ok || !response.body) return;

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                // ⚠️ MUST be outside the while loop — on Azure, TCP packets can be
                // fragmented so 'event:' and 'data:' lines may arrive in separate
                // chunks. Resetting inside the loop would wipe the event type.
                let eventType = 'message';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            eventType = line.slice(6).trim();
                        } else if (line.startsWith('data:') || line === '') {
                            if (eventType === 'SESSION_EVICTED') {
                                window.dispatchEvent(new CustomEvent('session-evicted'));
                                return;
                            }
                            eventType = 'message';
                        }
                    }
                }

                if (!abortCtrl.signal.aborted) {
                    retryTimeout = setTimeout(connectSSE, 3000);
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                retryTimeout = setTimeout(connectSSE, 5000);
            }
        }

        connectSSE();

        return () => {
            abortCtrl.abort();
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 30-second heartbeat (fallback safety net) ──────────────────
    useEffect(() => {
        if (!user) return;
        heartbeatAPI();
        const id = setInterval(heartbeatAPI, 30_000);
        return () => clearInterval(id);
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleAuth(userData) {
        setUser(userData);
        if (userData.name) localStorage.setItem("userName", userData.name);
        if (userData.email) localStorage.setItem("userEmail", userData.email);
        setModal(null);
        setView("dashboard");
    }

    function handleLogout() {
        ["userSessionToken", "userName", "userEmail"].forEach(k => localStorage.removeItem(k));
        setUser(null);
        setView("landing");
    }

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet" />
            {view === "landing" && <Landing onLogin={() => setModal("login")} onRegister={() => setModal("register")} />}
            {view === "dashboard" && <Dashboard user={user} onLogout={handleLogout} />}
            {modal && <AuthModal mode={modal} onClose={() => setModal(null)} onSuccess={handleAuth} />}
        </>
    );
}
