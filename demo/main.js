// ============================================================
// CONVRS AI — main.js
// Handles: animations, email validation, form submission,
//          modal display, contact restriction logic,
//          country-code phone picker
// ============================================================

// ---- FREE / DISPOSABLE EMAIL DOMAIN BLOCKLIST ----
const FREE_EMAIL_DOMAINS = new Set([
    'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.co.in',
    'yahoo.fr','yahoo.de','yahoo.es','yahoo.it','ymail.com',
    'hotmail.com','hotmail.co.uk','hotmail.fr','hotmail.de','hotmail.es',
    'hotmail.it','outlook.com','outlook.co.uk','outlook.fr','outlook.de',
    'live.com','live.co.uk','live.fr','live.de','msn.com',
    'icloud.com','me.com','mac.com','aol.com','aim.com',
    'protonmail.com','proton.me','pm.me','tutanota.com','tutamail.com',
    'tuta.io','keemail.me','zoho.com','zohomail.com',
    'mail.com','gmx.com','gmx.net','gmx.de','gmx.us',
    'inbox.com','fastmail.com','fastmail.fm','hushmail.com',
    'mailinator.com','guerrillamail.com','guerrillamail.net',
    'guerrillamail.org','guerrillamail.biz','guerrillamail.de',
    'trashmail.com','trashmail.me','trashmail.net','trashmail.io',
    'tempmail.com','temp-mail.org','tempail.com','tempr.email',
    '10minutemail.com','10minutemail.net','throwam.com','throwaway.email',
    'yopmail.com','yopmail.fr','cool.fr.nf','jetable.fr.nf',
    'nospam.ze.tc','nomail.xl.cx','mega.zik.dj','speed.1s.fr',
    'courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf',
    'monmail.fr.nf','sharklasers.com','guerrillamail.info','spam4.me','dispostable.com',
    'spamgourmet.com','spamgourmet.net','spamgourmet.org',
    'maildrop.cc','emailondeck.com','getairmail.com',
    'filzmail.com','spamfree24.org','spamfree24.de','spamfree24.eu',
    'spamfree24.info','spamfree24.net','spamfree24.org',
    'rediffmail.com','rocketmail.com','att.net','sbcglobal.net',
    'verizon.net','cox.net','comcast.net','charter.net',
    'bellsouth.net','earthlink.net','juno.com','netzero.com',
    // --- Disposable domains observed in the Jun 2026 abuse + broader list ---
    'yomail.in','mail2me.co','10mail.org','freeml.net','spymail.one',
    '20minutemail.com','33mail.com','anonbox.net','burnermail.io',
    'dropmail.me','emailfake.com','emailtemporanea.com','fakeinbox.com',
    'fakemail.net','getnada.com','inboxbear.com','inboxkitten.com',
    'mailcatch.com','mailnesia.com','mailsac.com','mintemail.com',
    'mohmal.com','moakt.com','mytemp.email','nada.email','tempmailo.com',
    'temp-mail.io','tempinbox.com','tmail.ws','tmpmail.org','vomoto.com',
    'wegwerfmail.de','mailpoof.com','luxusmail.org','mailto.plus',
    'mail.tm','1secmail.com','1secmail.org','1secmail.net','altmails.com',
    'disposablemail.com','tempmailaddress.com','minuteinbox.com','mailbox.in.ua',
]);

// ---- WHITELIST DOMAINS (unlimited agent sessions) ----
const WHITELIST_DOMAINS = new Set(['marketwavegen.com', 'outsourcedemandgen.com']);

// ---- ALLOWED COUNTRY CODES (must mirror server.js) ----
const ALLOWED_COUNTRY_CODES = ['+91', '+44', '+1'];

// ---- DOGRAH VOICE AGENT EMBED ----
// Loaded lazily (only after the lead passes the gate) so the bubble never
// appears before the form is submitted.
const DOGRAH_EMBED_SRC = 'https://app.dograh.com/embed/dograh-widget.js?token=emb_mG0LrXD_VTAepSNo7jGlMoqa4V2kkAKMfb9dK8-gWgE&environment=production&apiEndpoint=https://api.dograh.com';

// ---- UTILITIES ----
// NOTE: Google Form submission is handled ONLY by server.js to avoid duplicates.
function getEmailDomain(email) {
    return email.split('@')[1]?.toLowerCase().trim() || '';
}

function isBusinessEmail(email) {
    const domain = getEmailDomain(email);
    if (!domain || !domain.includes('.')) return false;
    return !FREE_EMAIL_DOMAINS.has(domain);
}

function isWhitelisted(email) {
    return WHITELIST_DOMAINS.has(getEmailDomain(email));
}

function hasUsedBefore(email) {
    const used = JSON.parse(localStorage.getItem('convrs_used_emails') || '[]');
    return used.includes(email.toLowerCase());
}

function markAsUsed(email) {
    const used = JSON.parse(localStorage.getItem('convrs_used_emails') || '[]');
    if (!used.includes(email.toLowerCase())) {
        used.push(email.toLowerCase());
        localStorage.setItem('convrs_used_emails', JSON.stringify(used));
    }
}

// ============================================================
// COUNTRY CODE DATA
// Format: { flag, name, dial }
// ============================================================
const COUNTRIES = [
    { flag: '🇦🇫', name: 'Afghanistan',              dial: '+93'  },
    { flag: '🇦🇱', name: 'Albania',                   dial: '+355' },
    { flag: '🇩🇿', name: 'Algeria',                   dial: '+213' },
    { flag: '🇦🇩', name: 'Andorra',                   dial: '+376' },
    { flag: '🇦🇴', name: 'Angola',                    dial: '+244' },
    { flag: '🇦🇬', name: 'Antigua & Barbuda',         dial: '+1'   },
    { flag: '🇦🇷', name: 'Argentina',                 dial: '+54'  },
    { flag: '🇦🇲', name: 'Armenia',                   dial: '+374' },
    { flag: '🇦🇺', name: 'Australia',                 dial: '+61'  },
    { flag: '🇦🇹', name: 'Austria',                   dial: '+43'  },
    { flag: '🇦🇿', name: 'Azerbaijan',                dial: '+994' },
    { flag: '🇧🇸', name: 'Bahamas',                   dial: '+1'   },
    { flag: '🇧🇭', name: 'Bahrain',                   dial: '+973' },
    { flag: '🇧🇩', name: 'Bangladesh',                dial: '+880' },
    { flag: '🇧🇧', name: 'Barbados',                  dial: '+1'   },
    { flag: '🇧🇾', name: 'Belarus',                   dial: '+375' },
    { flag: '🇧🇪', name: 'Belgium',                   dial: '+32'  },
    { flag: '🇧🇿', name: 'Belize',                    dial: '+501' },
    { flag: '🇧🇯', name: 'Benin',                     dial: '+229' },
    { flag: '🇧🇹', name: 'Bhutan',                    dial: '+975' },
    { flag: '🇧🇴', name: 'Bolivia',                   dial: '+591' },
    { flag: '🇧🇦', name: 'Bosnia & Herzegovina',      dial: '+387' },
    { flag: '🇧🇼', name: 'Botswana',                  dial: '+267' },
    { flag: '🇧🇷', name: 'Brazil',                    dial: '+55'  },
    { flag: '🇧🇳', name: 'Brunei',                    dial: '+673' },
    { flag: '🇧🇬', name: 'Bulgaria',                  dial: '+359' },
    { flag: '🇧🇫', name: 'Burkina Faso',              dial: '+226' },
    { flag: '🇧🇮', name: 'Burundi',                   dial: '+257' },
    { flag: '🇨🇻', name: 'Cape Verde',                dial: '+238' },
    { flag: '🇰🇭', name: 'Cambodia',                  dial: '+855' },
    { flag: '🇨🇲', name: 'Cameroon',                  dial: '+237' },
    { flag: '🇨🇦', name: 'Canada',                    dial: '+1'   },
    { flag: '🇨🇫', name: 'Central African Republic',  dial: '+236' },
    { flag: '🇹🇩', name: 'Chad',                      dial: '+235' },
    { flag: '🇨🇱', name: 'Chile',                     dial: '+56'  },
    { flag: '🇨🇳', name: 'China',                     dial: '+86'  },
    { flag: '🇨🇴', name: 'Colombia',                  dial: '+57'  },
    { flag: '🇰🇲', name: 'Comoros',                   dial: '+269' },
    { flag: '🇨🇬', name: 'Congo',                     dial: '+242' },
    { flag: '🇨🇩', name: 'Congo (DRC)',               dial: '+243' },
    { flag: '🇨🇷', name: 'Costa Rica',                dial: '+506' },
    { flag: '🇭🇷', name: 'Croatia',                   dial: '+385' },
    { flag: '🇨🇺', name: 'Cuba',                      dial: '+53'  },
    { flag: '🇨🇾', name: 'Cyprus',                    dial: '+357' },
    { flag: '🇨🇿', name: 'Czechia',                   dial: '+420' },
    { flag: '🇩🇰', name: 'Denmark',                   dial: '+45'  },
    { flag: '🇩🇯', name: 'Djibouti',                  dial: '+253' },
    { flag: '🇩🇴', name: 'Dominican Republic',        dial: '+1'   },
    { flag: '🇪🇨', name: 'Ecuador',                   dial: '+593' },
    { flag: '🇪🇬', name: 'Egypt',                     dial: '+20'  },
    { flag: '🇸🇻', name: 'El Salvador',               dial: '+503' },
    { flag: '🇬🇶', name: 'Equatorial Guinea',         dial: '+240' },
    { flag: '🇪🇷', name: 'Eritrea',                   dial: '+291' },
    { flag: '🇪🇪', name: 'Estonia',                   dial: '+372' },
    { flag: '🇸🇿', name: 'Eswatini',                  dial: '+268' },
    { flag: '🇪🇹', name: 'Ethiopia',                  dial: '+251' },
    { flag: '🇫🇯', name: 'Fiji',                      dial: '+679' },
    { flag: '🇫🇮', name: 'Finland',                   dial: '+358' },
    { flag: '🇫🇷', name: 'France',                    dial: '+33'  },
    { flag: '🇬🇦', name: 'Gabon',                     dial: '+241' },
    { flag: '🇬🇲', name: 'Gambia',                    dial: '+220' },
    { flag: '🇬🇪', name: 'Georgia',                   dial: '+995' },
    { flag: '🇩🇪', name: 'Germany',                   dial: '+49'  },
    { flag: '🇬🇭', name: 'Ghana',                     dial: '+233' },
    { flag: '🇬🇷', name: 'Greece',                    dial: '+30'  },
    { flag: '🇬🇹', name: 'Guatemala',                 dial: '+502' },
    { flag: '🇬🇳', name: 'Guinea',                    dial: '+224' },
    { flag: '🇬🇼', name: 'Guinea-Bissau',             dial: '+245' },
    { flag: '🇬🇾', name: 'Guyana',                    dial: '+592' },
    { flag: '🇭🇹', name: 'Haiti',                     dial: '+509' },
    { flag: '🇭🇳', name: 'Honduras',                  dial: '+504' },
    { flag: '🇭🇰', name: 'Hong Kong',                 dial: '+852' },
    { flag: '🇭🇺', name: 'Hungary',                   dial: '+36'  },
    { flag: '🇮🇸', name: 'Iceland',                   dial: '+354' },
    { flag: '🇮🇳', name: 'India',                     dial: '+91'  },
    { flag: '🇮🇩', name: 'Indonesia',                 dial: '+62'  },
    { flag: '🇮🇷', name: 'Iran',                      dial: '+98'  },
    { flag: '🇮🇶', name: 'Iraq',                      dial: '+964' },
    { flag: '🇮🇪', name: 'Ireland',                   dial: '+353' },
    { flag: '🇮🇱', name: 'Israel',                    dial: '+972' },
    { flag: '🇮🇹', name: 'Italy',                     dial: '+39'  },
    { flag: '🇯🇲', name: 'Jamaica',                   dial: '+1'   },
    { flag: '🇯🇵', name: 'Japan',                     dial: '+81'  },
    { flag: '🇯🇴', name: 'Jordan',                    dial: '+962' },
    { flag: '🇰🇿', name: 'Kazakhstan',                dial: '+7'   },
    { flag: '🇰🇪', name: 'Kenya',                     dial: '+254' },
    { flag: '🇰🇮', name: 'Kiribati',                  dial: '+686' },
    { flag: '🇰🇼', name: 'Kuwait',                    dial: '+965' },
    { flag: '🇰🇬', name: 'Kyrgyzstan',               dial: '+996' },
    { flag: '🇱🇦', name: 'Laos',                      dial: '+856' },
    { flag: '🇱🇻', name: 'Latvia',                    dial: '+371' },
    { flag: '🇱🇧', name: 'Lebanon',                   dial: '+961' },
    { flag: '🇱🇸', name: 'Lesotho',                   dial: '+266' },
    { flag: '🇱🇷', name: 'Liberia',                   dial: '+231' },
    { flag: '🇱🇾', name: 'Libya',                     dial: '+218' },
    { flag: '🇱🇮', name: 'Liechtenstein',             dial: '+423' },
    { flag: '🇱🇹', name: 'Lithuania',                 dial: '+370' },
    { flag: '🇱🇺', name: 'Luxembourg',                dial: '+352' },
    { flag: '🇲🇴', name: 'Macau',                     dial: '+853' },
    { flag: '🇲🇬', name: 'Madagascar',                dial: '+261' },
    { flag: '🇲🇼', name: 'Malawi',                    dial: '+265' },
    { flag: '🇲🇾', name: 'Malaysia',                  dial: '+60'  },
    { flag: '🇲🇻', name: 'Maldives',                  dial: '+960' },
    { flag: '🇲🇱', name: 'Mali',                      dial: '+223' },
    { flag: '🇲🇹', name: 'Malta',                     dial: '+356' },
    { flag: '🇲🇷', name: 'Mauritania',                dial: '+222' },
    { flag: '🇲🇺', name: 'Mauritius',                 dial: '+230' },
    { flag: '🇲🇽', name: 'Mexico',                    dial: '+52'  },
    { flag: '🇫🇲', name: 'Micronesia',               dial: '+691' },
    { flag: '🇲🇩', name: 'Moldova',                   dial: '+373' },
    { flag: '🇲🇨', name: 'Monaco',                    dial: '+377' },
    { flag: '🇲🇳', name: 'Mongolia',                  dial: '+976' },
    { flag: '🇲🇪', name: 'Montenegro',               dial: '+382' },
    { flag: '🇲🇦', name: 'Morocco',                   dial: '+212' },
    { flag: '🇲🇿', name: 'Mozambique',               dial: '+258' },
    { flag: '🇲🇲', name: 'Myanmar',                   dial: '+95'  },
    { flag: '🇳🇦', name: 'Namibia',                   dial: '+264' },
    { flag: '🇳🇵', name: 'Nepal',                     dial: '+977' },
    { flag: '🇳🇱', name: 'Netherlands',              dial: '+31'  },
    { flag: '🇳🇿', name: 'New Zealand',               dial: '+64'  },
    { flag: '🇳🇮', name: 'Nicaragua',                 dial: '+505' },
    { flag: '🇳🇪', name: 'Niger',                     dial: '+227' },
    { flag: '🇳🇬', name: 'Nigeria',                   dial: '+234' },
    { flag: '🇲🇰', name: 'North Macedonia',           dial: '+389' },
    { flag: '🇳🇴', name: 'Norway',                    dial: '+47'  },
    { flag: '🇴🇲', name: 'Oman',                      dial: '+968' },
    { flag: '🇵🇰', name: 'Pakistan',                  dial: '+92'  },
    { flag: '🇵🇼', name: 'Palau',                     dial: '+680' },
    { flag: '🇵🇦', name: 'Panama',                    dial: '+507' },
    { flag: '🇵🇬', name: 'Papua New Guinea',          dial: '+675' },
    { flag: '🇵🇾', name: 'Paraguay',                  dial: '+595' },
    { flag: '🇵🇪', name: 'Peru',                      dial: '+51'  },
    { flag: '🇵🇭', name: 'Philippines',              dial: '+63'  },
    { flag: '🇵🇱', name: 'Poland',                    dial: '+48'  },
    { flag: '🇵🇹', name: 'Portugal',                  dial: '+351' },
    { flag: '🇶🇦', name: 'Qatar',                     dial: '+974' },
    { flag: '🇷🇴', name: 'Romania',                   dial: '+40'  },
    { flag: '🇷🇺', name: 'Russia',                    dial: '+7'   },
    { flag: '🇷🇼', name: 'Rwanda',                    dial: '+250' },
    { flag: '🇸🇦', name: 'Saudi Arabia',              dial: '+966' },
    { flag: '🇸🇳', name: 'Senegal',                   dial: '+221' },
    { flag: '🇷🇸', name: 'Serbia',                    dial: '+381' },
    { flag: '🇸🇱', name: 'Sierra Leone',              dial: '+232' },
    { flag: '🇸🇬', name: 'Singapore',                 dial: '+65'  },
    { flag: '🇸🇰', name: 'Slovakia',                  dial: '+421' },
    { flag: '🇸🇮', name: 'Slovenia',                  dial: '+386' },
    { flag: '🇸🇧', name: 'Solomon Islands',           dial: '+677' },
    { flag: '🇸🇴', name: 'Somalia',                   dial: '+252' },
    { flag: '🇿🇦', name: 'South Africa',              dial: '+27'  },
    { flag: '🇸🇸', name: 'South Sudan',               dial: '+211' },
    { flag: '🇪🇸', name: 'Spain',                     dial: '+34'  },
    { flag: '🇱🇰', name: 'Sri Lanka',                 dial: '+94'  },
    { flag: '🇸🇩', name: 'Sudan',                     dial: '+249' },
    { flag: '🇸🇷', name: 'Suriname',                  dial: '+597' },
    { flag: '🇸🇪', name: 'Sweden',                    dial: '+46'  },
    { flag: '🇨🇭', name: 'Switzerland',              dial: '+41'  },
    { flag: '🇸🇾', name: 'Syria',                     dial: '+963' },
    { flag: '🇹🇼', name: 'Taiwan',                    dial: '+886' },
    { flag: '🇹🇯', name: 'Tajikistan',               dial: '+992' },
    { flag: '🇹🇿', name: 'Tanzania',                  dial: '+255' },
    { flag: '🇹🇭', name: 'Thailand',                  dial: '+66'  },
    { flag: '🇹🇱', name: 'Timor-Leste',              dial: '+670' },
    { flag: '🇹🇬', name: 'Togo',                      dial: '+228' },
    { flag: '🇹🇴', name: 'Tonga',                     dial: '+676' },
    { flag: '🇹🇹', name: 'Trinidad & Tobago',         dial: '+1'   },
    { flag: '🇹🇳', name: 'Tunisia',                   dial: '+216' },
    { flag: '🇹🇷', name: 'Turkey',                    dial: '+90'  },
    { flag: '🇹🇲', name: 'Turkmenistan',              dial: '+993' },
    { flag: '🇺🇬', name: 'Uganda',                    dial: '+256' },
    { flag: '🇺🇦', name: 'Ukraine',                   dial: '+380' },
    { flag: '🇦🇪', name: 'United Arab Emirates',      dial: '+971' },
    { flag: '🇬🇧', name: 'United Kingdom',            dial: '+44'  },
    { flag: '🇺🇸', name: 'United States',             dial: '+1'   },
    { flag: '🇺🇾', name: 'Uruguay',                   dial: '+598' },
    { flag: '🇺🇿', name: 'Uzbekistan',               dial: '+998' },
    { flag: '🇻🇺', name: 'Vanuatu',                   dial: '+678' },
    { flag: '🇻🇪', name: 'Venezuela',                 dial: '+58'  },
    { flag: '🇻🇳', name: 'Vietnam',                   dial: '+84'  },
    { flag: '🇾🇪', name: 'Yemen',                     dial: '+967' },
    { flag: '🇿🇲', name: 'Zambia',                    dial: '+260' },
    { flag: '🇿🇼', name: 'Zimbabwe',                  dial: '+263' },
];

// Only show countries we actually dial (matches ALLOWED_COUNTRY_CODES + server).
// Keeps users from selecting a blocked country and getting rejected after the CAPTCHA.
const PICKER_COUNTRY_NAMES = new Set(['United States', 'Canada', 'India', 'United Kingdom']);
const PICKER_COUNTRIES = COUNTRIES.filter(c => PICKER_COUNTRY_NAMES.has(c.name));

// Default to United States
let selectedCountry = PICKER_COUNTRIES.find(c => c.name === 'United States');

// ============================================================
document.addEventListener("DOMContentLoaded", () => {

    // ---- GSAP ANIMATIONS ----
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(".hero-badge",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power4.out" }
    )
    .fromTo(".hero-title",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: "power4.out" },
        "-=0.3"
    )
    .fromTo(".sub-line",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.12 },
        "-=0.6"
    )
    .fromTo(".clean-card",
        { y: 40, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 1, ease: "back.out(1.5)" },
        "-=0.4"
    );

    if (window.innerWidth > 1024) {
        tl.fromTo(".line-path",
            { strokeDashoffset: 1000, strokeDasharray: "1000 1000" },
            { strokeDashoffset: 0, duration: 2, ease: "power2.inOut", stagger: 0.2 },
            "-=1"
        )
        .fromTo(".accent-line",
            { strokeDashoffset: 1000, strokeDasharray: "1000 1000", opacity: 0 },
            { strokeDashoffset: 200, opacity: 0.5, duration: 2, ease: "power1.inOut", stagger: 0.1 },
            "-=1.5"
        )
        .fromTo(".stat-card",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "back.out(1.5)" },
            "-=1.5"
        );

        gsap.utils.toArray(".stat-card").forEach((card, i) => {
            gsap.to(card, {
                y: "-=10",
                duration: 2 + (i % 2),
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
                delay: i * 0.2
            });
        });
    }

    // Scroll animations for new sections
    gsap.utils.toArray('.step-card').forEach((el, i) => {
        gsap.fromTo(el,
            { y: 40, opacity: 0 },
            {
                y: 0, opacity: 1, duration: 0.7, delay: i * 0.08,
                scrollTrigger: { trigger: el, start: "top 85%" }
            }
        );
    });

    gsap.utils.toArray('.dual-card, .comparison-card').forEach(el => {
        gsap.fromTo(el,
            { y: 30, opacity: 0 },
            {
                y: 0, opacity: 1, duration: 0.7,
                scrollTrigger: { trigger: el, start: "top 85%" }
            }
        );
    });

    // ---- NAVBAR SCROLL EFFECT ----
    const navbar = document.querySelector(".navbar");
    window.addEventListener("scroll", () => {
        navbar.classList.toggle("scrolled", window.scrollY > 10);
    });

    // ---- MODAL LOGIC ----
    const modal      = document.getElementById("contact-modal");
    const modalClose = document.getElementById("modal-close");
    const modalIcon  = document.getElementById("modal-icon");
    const modalTitle = document.getElementById("modal-title");
    const modalBody  = document.getElementById("modal-body");

    // Shown when a business email has already used its one free session.
    function showModal() {
        modalIcon.textContent  = "🎙️";
        modalTitle.textContent = "Want Another Session?";
        modalBody.textContent  = "You've already used your free AI agent session. To get an additional session or explore our full platform, book a meeting with our team.";
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function hideModal() {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }

    modalClose.addEventListener("click", hideModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) hideModal();
    });

    // ================================================================
    // COUNTRY CODE PICKER
    // ================================================================
    const csBtn      = document.getElementById('country-select-btn');
    const csFlag     = document.getElementById('cs-flag');
    const csCode     = document.getElementById('cs-code');
    const csDropdown = document.getElementById('country-dropdown');
    const csList     = document.getElementById('cs-list');
    const csSearch   = document.getElementById('cs-search');

    function renderCountryList(filter = '') {
        const q = filter.toLowerCase().trim();
        const filtered = q
            ? PICKER_COUNTRIES.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.dial.includes(q)
              )
            : PICKER_COUNTRIES;

        csList.innerHTML = '';

        if (filtered.length === 0) {
            csList.innerHTML = '<li class="cs-no-results">No countries found</li>';
            return;
        }

        filtered.forEach(country => {
            const li = document.createElement('li');
            li.innerHTML =
                `<span class="li-flag">${country.flag}</span>` +
                `<span class="li-name">${country.name}</span>` +
                `<span class="li-dial">${country.dial}</span>`;
            if (country === selectedCountry) li.classList.add('active');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', country === selectedCountry ? 'true' : 'false');
            li.addEventListener('click', () => selectCountry(country));
            csList.appendChild(li);
        });
    }

    function selectCountry(country) {
        selectedCountry = country;
        csFlag.textContent = country.flag;
        csCode.textContent = country.dial;
        closeDropdown();
    }

    function openDropdown() {
        csDropdown.classList.add('open');
        csBtn.setAttribute('aria-expanded', 'true');
        csSearch.value = '';
        renderCountryList('');
        setTimeout(() => csSearch.focus(), 50);
    }

    function closeDropdown() {
        csDropdown.classList.remove('open');
        csBtn.setAttribute('aria-expanded', 'false');
    }

    // Initialize list
    renderCountryList();

    // Toggle on button click
    csBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        csDropdown.classList.contains('open') ? closeDropdown() : openDropdown();
    });

    // Live search
    csSearch.addEventListener('input', () => renderCountryList(csSearch.value));

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!document.getElementById('country-select-wrapper').contains(e.target)) {
            closeDropdown();
        }
    });

    // Keyboard: Escape closes
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDropdown();
    });

    // ---- FORM LOGIC ----
    const form        = document.getElementById("lead-form");
    const submitBtn   = document.getElementById("submit-btn");
    const btnText     = submitBtn.querySelector(".btn-text");
    const formStatus  = document.getElementById("form-status");
    const emailInput  = document.getElementById("email");
    const phoneInput  = document.getElementById("phone-number");
    const phoneRow    = phoneInput.closest('.phone-input-row');

    // Real-time email validation hint
    emailInput.addEventListener("blur", () => {
        const email = emailInput.value.trim();
        if (email && !isBusinessEmail(email)) {
            emailInput.classList.add("is-invalid");
            setStatus("Please use a business email address (not Gmail, Yahoo, etc.)", "error");
        } else {
            emailInput.classList.remove("is-invalid");
            setStatus("", "");
        }
    });

    emailInput.addEventListener("input", () => {
        emailInput.classList.remove("is-invalid");
        if (formStatus.classList.contains("status-error")) {
            setStatus("", "");
        }
    });

    // Phone local number — strip invalid characters on input
    phoneInput.addEventListener("input", () => {
        phoneRow.classList.remove("is-invalid");
    });

    function setStatus(msg, type) {
        formStatus.textContent = msg;
        formStatus.className = "form-status" + (type === "success" ? " status-success" : type === "error" ? " status-error" : "");
    }

    function setLoading(loading) {
        submitBtn.classList.toggle("loading", loading);
        submitBtn.disabled = loading;
        btnText.style.opacity = loading ? "0" : "1";
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name    = form.name.value.trim();
        const company = form.company.value.trim();
        const email   = emailInput.value.trim().toLowerCase();

        // Assemble full phone number: dial code + local number (digits only)
        const localNumber = phoneInput.value.trim().replace(/[\s\-().]/g, '');
        if (!localNumber) {
            phoneRow.classList.add("is-invalid");
            setStatus("Please enter your phone number.", "error");
            phoneInput.focus();
            return;
        }
        // Build E.164 compatible phone: dialCode + localNumber (strip leading 0 from local if present)
        const phone = selectedCountry.dial + localNumber.replace(/^0+/, '');

        // Client-side: country allowlist (server enforces this authoritatively)
        if (!ALLOWED_COUNTRY_CODES.includes(selectedCountry.dial)) {
            phoneRow.classList.add("is-invalid");
            setStatus("Calls are only available for US (+1), India (+91), and UK (+44) numbers at this time.", "error");
            phoneInput.focus();
            return;
        }

        // Client-side: business email check
        if (!isBusinessEmail(email)) {
            emailInput.classList.add("is-invalid");
            setStatus("Please use a business email. Personal emails (Gmail, Yahoo, etc.) are not accepted.", "error");
            emailInput.focus();
            return;
        }

        // Client-side: one-call restriction (whitelisted domains bypass)
        if (!isWhitelisted(email) && hasUsedBefore(email)) {
            showModal();
            return;
        }

        // Bot protection: grab the Turnstile token (verified server-side)
        const turnstileToken = (window.turnstile && typeof turnstile.getResponse === 'function')
            ? turnstile.getResponse()
            : '';
        if (!turnstileToken) {
            setStatus("Please complete the verification check below and try again.", "error");
            return;
        }

        setLoading(true);
        setStatus("", "");

        try {
            const response = await fetch('/api/start-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, company, phone, email, turnstileToken })
            });

            const data = await response.json();
            setLoading(false);
            // Turnstile tokens are single-use — reset so a retry gets a fresh one
            if (window.turnstile) turnstile.reset();

            if (data.restricted) {
                // Server also flagged as already used
                showModal();
                return;
            }

            if (data.success) {
                // Mark email as used (client-side enforcement)
                if (!isWhitelisted(email)) {
                    markAsUsed(email);
                }

                // Launch the in-browser voice agent with this lead's context.
                launchAgent({ name, company, phone, email });

                form.reset();
                // Reset picker to default (US)
                selectedCountry = PICKER_COUNTRIES.find(c => c.name === 'United States');
                csFlag.textContent = selectedCountry.flag;
                csCode.textContent = selectedCountry.dial;
                emailInput.classList.remove("is-invalid");
                phoneRow.classList.remove("is-invalid");
                setStatus("", "");
            } else {
                setStatus(data.error || "Could not start the agent. Please try again.", "error");
                setTimeout(() => setStatus("", ""), 8000);
            }

        } catch (_) {
            setLoading(false);
            if (window.turnstile) turnstile.reset();
            setStatus("Network error. Please check your connection and try again.", "error");
            setTimeout(() => setStatus("", ""), 6000);
        }
    });

    // ================================================================
    // AI VOICE AGENT PANEL — drives the embedded Dograh widget and
    // logs the lead to the sheet after the conversation ends.
    // ================================================================
    const agentOverlay   = document.getElementById("agent-overlay");
    const agentClose     = document.getElementById("agent-close");
    const agentEndBtn    = document.getElementById("agent-end-btn");
    const agentBadgeText = document.getElementById("agent-badge-text");
    const agentSub       = document.getElementById("agent-sub");
    const agentCanvas    = document.getElementById("agent-canvas");

    let callbacksWired = false;
    let dograhLoadPromise = null;
    let agentLimitTimer = 0;     // 3-minute auto-cutoff timer
    const AGENT_TIME_LIMIT_MS = 3 * 60 * 1000;

    function clearAgentLimit() {
        if (agentLimitTimer) { clearTimeout(agentLimitTimer); agentLimitTimer = 0; }
    }
    // NOTE: the lead is written to the sheet ONLY by Dograh's post-call webhook
    // (/api/webhook/call-ended), which carries the recording URL. The browser
    // intentionally does NOT write — we wait for the full post-call data.

    function setAgentState(state, badge, sub) {
        agentOverlay.classList.remove(
            "state-connecting", "state-connected", "state-failed", "state-ended"
        );
        if (state) agentOverlay.classList.add("state-" + state);
        if (badge !== undefined) agentBadgeText.textContent = badge;
        if (sub   !== undefined) agentSub.textContent = sub;
        vizMode = state || "idle";
    }

    // ================================================================
    // VOICE-REACTIVE ORB — a fluid blob that morphs with the live audio
    // (taps both the agent's voice and your mic via the Web Audio API).
    // ================================================================
    let vizRaf = 0, vizCtx = null, vizAudioCtx = null, vizAnalysers = [];
    let vizMode = "idle", vizLevel = 0, vizT = 0, vizAttachTries = 0;
    const vizReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const VIZ_PALETTES = {
        idle:       ['#1E90FF', '#3BA3FF', '#60c0ff'],
        connecting: ['#f59e0b', '#fbbf24', '#fcd34d'],
        connected:  ['#1E90FF', '#3BA3FF', '#22d3ee'],
        failed:     ['#64748b', '#475569', '#94a3b8'],
        ended:      ['#64748b', '#475569', '#94a3b8'],
    };

    function vizHexToRgb(h) {
        const n = parseInt(h.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function vizReadLevel() {
        if (!vizAnalysers.length) return 0;
        let total = 0, n = 0;
        for (const an of vizAnalysers) {
            const arr = an._buf || (an._buf = new Uint8Array(an.frequencyBinCount));
            an.getByteFrequencyData(arr);
            let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i];
            total += (s / arr.length) / 255; n++;
        }
        return n ? total / n : 0;
    }

    function vizGetBins() {
        if (!vizAnalysers.length) return null;
        const an = vizAnalysers[0];
        const arr = an._buf || (an._buf = new Uint8Array(an.frequencyBinCount));
        an.getByteFrequencyData(arr);
        return arr;
    }

    // Tap the agent + mic MediaStreams without affecting playback.
    function vizAttach() {
        if (!window.DograhWidget || !window.DograhWidget.getState) return;
        try {
            const st = window.DograhWidget.getState();
            if (!vizAudioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                vizAudioCtx = new AC();
            }
            if (vizAudioCtx.state === 'suspended') vizAudioCtx.resume();
            const streams = [];
            if (st.audioElement && st.audioElement.srcObject) streams.push(st.audioElement.srcObject);
            if (st.stream) streams.push(st.stream);
            for (const stream of streams) {
                if (vizAnalysers.some(a => a._stream === stream)) continue;
                try {
                    const src = vizAudioCtx.createMediaStreamSource(stream);
                    const an  = vizAudioCtx.createAnalyser();
                    an.fftSize = 256;
                    an.smoothingTimeConstant = 0.82;
                    src.connect(an);
                    an._stream = stream;
                    vizAnalysers.push(an);
                } catch (_) { /* stream not ready */ }
            }
        } catch (_) {}
    }

    function vizFrame() {
        vizRaf = requestAnimationFrame(vizFrame);
        if (!vizCtx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssSize = agentCanvas.clientWidth || 200;
        const size = Math.round(cssSize * dpr);
        if (agentCanvas.width !== size) { agentCanvas.width = size; agentCanvas.height = size; }

        const ctx = vizCtx;
        const W = agentCanvas.width, H = agentCanvas.height;
        const cx = W / 2, cy = H / 2;
        ctx.clearRect(0, 0, W, H);
        vizT += vizReduce ? 0.006 : 0.018;

        // Live level when connected; gentle breathing otherwise.
        if (vizMode === 'connected') {
            if (vizAnalysers.length < 2 && vizAttachTries < 60) { vizAttach(); vizAttachTries++; }
            const target = Math.min(1, vizReadLevel() * 1.7);
            vizLevel += (target - vizLevel) * 0.18;
        } else {
            const breathe = 0.12 + Math.sin(vizT * 1.6) * 0.05;
            vizLevel += (breathe - vizLevel) * 0.08;
        }

        const pal   = VIZ_PALETTES[vizMode] || VIZ_PALETTES.idle;
        const baseR = W * 0.20;
        const amp   = baseR * (0.16 + vizLevel * 0.9);
        const bins  = vizMode === 'connected' ? vizGetBins() : null;

        // Soft outer glow
        const [gr, gg, gb] = vizHexToRgb(pal[1]);
        const glow = ctx.createRadialGradient(cx, cy, baseR * 0.4, cx, cy, baseR * (1.9 + vizLevel));
        glow.addColorStop(0, `rgba(${gr},${gg},${gb},${0.30 + vizLevel * 0.4})`);
        glow.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = 'lighter';

        const layers = [
            { col: pal[0],        a: 0.55, k1: 3, k2: 5, sp: 1.0,  sc: 1.00 },
            { col: pal[2] || pal[1], a: 0.45, k1: 4, k2: 7, sp: -1.4, sc: 0.86 },
            { col: pal[1],        a: 0.40, k1: 5, k2: 2, sp: 0.7,  sc: 0.72 },
        ];

        for (const L of layers) {
            const pts = 96;
            ctx.beginPath();
            for (let i = 0; i <= pts; i++) {
                const t = (i / pts) * Math.PI * 2;
                const bin = bins ? bins[i % bins.length] / 255 : 0;
                const wob = Math.sin(t * L.k1 + vizT * L.sp * 2) * amp * 0.45
                          + Math.sin(t * L.k2 - vizT * L.sp * 1.3) * amp * 0.30
                          + bin * amp * 0.9;
                const r = (baseR + wob) * L.sc;
                const x = cx + Math.cos(t) * r;
                const y = cy + Math.sin(t) * r;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
            const [r1, g1, b1] = vizHexToRgb(L.col);
            const grad = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * 1.5);
            grad.addColorStop(0, `rgba(${r1},${g1},${b1},${L.a + 0.15})`);
            grad.addColorStop(1, `rgba(${r1},${g1},${b1},${L.a * 0.25})`);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Bright core
        const coreR = baseR * (0.7 + vizLevel * 0.45);
        const [cr, cg, cb] = vizHexToRgb(pal[2] || pal[1]);
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        core.addColorStop(0,   `rgba(255,255,255,0.9)`);
        core.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.6)`);
        core.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
    }

    function startViz() {
        if (!agentCanvas) return;
        if (!vizCtx) vizCtx = agentCanvas.getContext('2d');
        vizAttachTries = 0;
        if (!vizRaf) vizRaf = requestAnimationFrame(vizFrame);
    }

    function stopViz() {
        if (vizRaf) { cancelAnimationFrame(vizRaf); vizRaf = 0; }
        vizAnalysers = [];
        if (vizAudioCtx) { try { vizAudioCtx.close(); } catch (_) {} vizAudioCtx = null; }
        vizLevel = 0; vizAttachTries = 0;
    }

    function openAgentPanel() {
        agentOverlay.classList.add("active");
        agentOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        startViz();
    }

    function closeAgentPanel() {
        clearAgentLimit();
        try { if (window.DograhWidget) window.DograhWidget.stop(); } catch (_) {}
        stopViz();
        agentOverlay.classList.remove("active");
        agentOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    // Lazy-load the Dograh embed once; resolve when its API is initialized.
    function loadDograhWidget(context) {
        if (window.DograhWidget && window.DograhWidget.getState && window.DograhWidget.getState().isInitialized) {
            return Promise.resolve(window.DograhWidget);
        }
        if (dograhLoadPromise) return dograhLoadPromise;

        dograhLoadPromise = new Promise((resolve, reject) => {
            if (document.getElementById('dograh-widget')) {
                // Script tag exists but not ready yet — fall through to polling.
            } else {
                const s = document.createElement('script');
                s.id = 'dograh-widget';
                s.async = true;
                s.setAttribute('data-dograh-context', JSON.stringify(context || {}));
                s.src = DOGRAH_EMBED_SRC;
                s.onerror = () => reject(new Error('Failed to load voice agent script'));
                document.body.appendChild(s);
            }
            const started = Date.now();
            (function waitReady() {
                if (window.DograhWidget && window.DograhWidget.getState && window.DograhWidget.getState().isInitialized) {
                    resolve(window.DograhWidget);
                } else if (Date.now() - started > 15000) {
                    reject(new Error('Voice agent did not initialize in time'));
                } else {
                    setTimeout(waitReady, 150);
                }
            })();
        });
        return dograhLoadPromise;
    }

    function wireAgentCallbacks(widget) {
        if (callbacksWired) return;
        callbacksWired = true;

        widget.onStatusChange((status) => {
            if (status === 'connecting') {
                setAgentState('connecting', 'Connecting…', 'Setting up your secure voice session…');
            }
        });
        widget.onCallConnected(() => {
            setAgentState('connected', 'Live', "You're connected — go ahead and speak with the agent. (3-minute limit)");
            vizAttachTries = 0;
            vizAttach();
            // Hard 3-minute cap — auto-end the conversation when reached.
            clearAgentLimit();
            agentLimitTimer = setTimeout(() => {
                setAgentState('ended', 'Time up', "You've reached the 3-minute demo limit. Book a meeting to continue the conversation.");
                agentEndBtn.textContent = 'Done';
                try { if (window.DograhWidget) window.DograhWidget.stop(); } catch (_) {}
            }, AGENT_TIME_LIMIT_MS);
        });
        widget.onCallEnd(() => {
            clearAgentLimit();
            // Don't clobber the "Time up" message if the cap triggered the stop.
            if (!agentOverlay.classList.contains('state-ended')) {
                setAgentState('ended', 'Ended', 'Thanks for talking with our AI agent.');
                agentEndBtn.textContent = 'Done';
            }
        });
        widget.onError((err) => {
            clearAgentLimit();
            setAgentState('failed', 'Error', (err && err.message) ? err.message : 'Something went wrong. Please try again.');
            agentEndBtn.textContent = 'Close';
        });
    }

    async function launchAgent(lead) {
        clearAgentLimit();
        agentEndBtn.textContent = 'End Conversation';

        // Passed to Dograh as context_variables → arrives in the webhook's
        // initial_context, which is how the recording reaches the Google Sheet.
        const context = {
            customer_name:  lead.name,
            company_name:   lead.company,
            business_email: lead.email,
            phone:          lead.phone
        };

        setAgentState('connecting', 'Connecting…', 'Setting up your secure voice session…');
        openAgentPanel();

        try {
            const widget = await loadDograhWidget(context);
            wireAgentCallbacks(widget);
            // Refresh context so it's sent on this (and each) session start.
            try { widget.getState().config.contextVariables = context; } catch (_) {}
            widget.start();
        } catch (_) {
            setAgentState('failed', 'Error', 'Could not load the voice agent. Please refresh and try again.');
            agentEndBtn.textContent = 'Close';
        }
    }

    agentClose.addEventListener('click', closeAgentPanel);
    agentEndBtn.addEventListener('click', () => {
        // After the talk ends/fails the button just closes; otherwise it stops the call.
        if (agentOverlay.classList.contains('state-ended') || agentOverlay.classList.contains('state-failed')) {
            closeAgentPanel();
        } else {
            try { if (window.DograhWidget) window.DograhWidget.stop(); } catch (_) {}
        }
    });
    // Backdrop click + Escape close the panel.
    agentOverlay.addEventListener('click', (e) => { if (e.target === agentOverlay) closeAgentPanel(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && agentOverlay.classList.contains('active')) closeAgentPanel();
    });
    // If the user leaves mid-conversation, end the session cleanly.
    window.addEventListener('pagehide', () => {
        clearAgentLimit();
        try { if (window.DograhWidget) window.DograhWidget.stop(); } catch (_) {}
    });
});

