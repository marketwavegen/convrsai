/* ============================================================
   CONVRSAI.COM — scroll interactions
   ============================================================ */

(function () {
	'use strict';

	var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* ---------- header ---------- */
	var header = document.getElementById('siteHeader');
	function onScrollHeader() {
		header.classList.toggle('scrolled', window.scrollY > 24);
	}
	window.addEventListener('scroll', onScrollHeader, { passive: true });
	onScrollHeader();

	/* ---------- mobile menu ---------- */
	var burger = document.getElementById('navBurger');
	var mobileMenu = document.getElementById('mobileMenu');
	if (burger && mobileMenu) {
		burger.addEventListener('click', function () {
			var open = mobileMenu.classList.toggle('open');
			burger.classList.toggle('open', open);
			burger.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
		mobileMenu.querySelectorAll('a').forEach(function (a) {
			a.addEventListener('click', function () {
				mobileMenu.classList.remove('open');
				burger.classList.remove('open');
			});
		});
	}

	/* ---------- split-text ---------- */
	document.querySelectorAll('[data-split]').forEach(function (el) {
		var words = el.textContent.trim().split(/\s+/);
		el.textContent = '';
		words.forEach(function (word, i) {
			var wrap = document.createElement('span');
			wrap.className = 'w';
			var inner = document.createElement('span');
			inner.textContent = word;
			inner.style.setProperty('--d', (i * 55) + 'ms');
			wrap.appendChild(inner);
			el.appendChild(wrap);
			el.appendChild(document.createTextNode(' '));
		});
	});
	var ctaH2 = document.querySelector('.bottom-cta h2');
	if (ctaH2) {
		new IntersectionObserver(function (entries, obs) {
			entries.forEach(function (e) {
				if (e.isIntersecting) { ctaH2.classList.add('split-in'); obs.disconnect(); }
			});
		}, { threshold: 0.4 }).observe(ctaH2);
	}

	/* ---------- reveal on scroll ---------- */
	var revealObserver = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (entry.isIntersecting) {
				entry.target.classList.add('in');
				revealObserver.unobserve(entry.target);
			}
		});
	}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
	document.querySelectorAll('.reveal-up, .layer-card').forEach(function (el) {
		var d = el.getAttribute('data-delay');
		if (d) el.style.setProperty('--rd', d + 'ms');
		revealObserver.observe(el);
	});

	/* ---------- hero dashboard: scroll-driven 3D flatten ---------- */
	var dash = document.getElementById('heroDash');
	var dashWrap = document.getElementById('dashWrap');
	if (dash && dashWrap && !prefersReduced) {
		var ticking = false;
		function updateDash() {
			ticking = false;
			var rect = dashWrap.getBoundingClientRect();
			var vh = window.innerHeight;
			// progress: 0 when the dash enters low in viewport, 1 when its center passes 45% of vh
			var p = Math.min(Math.max((vh - rect.top) / (vh * 0.85), 0), 1);
			var rx = 18 * (1 - p);            // 18deg -> 0deg
			var sc = 0.96 + 0.04 * p;         // .96 -> 1
			dash.style.transform = 'rotateX(' + rx + 'deg) scale(' + sc + ')';
		}
		window.addEventListener('scroll', function () {
			if (!ticking) { requestAnimationFrame(updateDash); ticking = true; }
		}, { passive: true });
		updateDash();
	}

	/* ---------- confidence score ring ---------- */
	var scoreArc = document.getElementById('scoreArc');
	var scoreNum = document.getElementById('scoreNum');
	if (scoreArc && scoreNum) {
		new IntersectionObserver(function (entries, obs) {
			entries.forEach(function (e) {
				if (!e.isIntersecting) return;
				obs.disconnect();
				var target = 94;
				var C = 226;
				scoreArc.style.strokeDashoffset = String(C - (C * target / 100));
				if (prefersReduced) { scoreNum.textContent = target; return; }
				var start = null;
				function tick(ts) {
					if (!start) start = ts;
					var p = Math.min((ts - start) / 1400, 1);
					scoreNum.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
					if (p < 1) requestAnimationFrame(tick);
				}
				requestAnimationFrame(tick);
			});
		}, { threshold: 0.5 }).observe(scoreArc);
	}

	/* ---------- funnel bars ---------- */
	var funnel = document.getElementById('funnelCompare');
	if (funnel) {
		funnel.querySelectorAll('.f-bar b').forEach(function (b) {
			b.style.setProperty('--fw', b.getAttribute('data-w'));
		});
		new IntersectionObserver(function (entries, obs) {
			entries.forEach(function (e) {
				if (e.isIntersecting) { funnel.classList.add('in'); obs.disconnect(); }
			});
		}, { threshold: 0.35 }).observe(funnel);
	}

	/* ---------- 3D tilt cards (problem grid) ---------- */
	if (matchMedia('(pointer:fine)').matches && !prefersReduced) {
		document.querySelectorAll('.tilt').forEach(function (card) {
			card.addEventListener('mousemove', function (e) {
				var r = card.getBoundingClientRect();
				var x = (e.clientX - r.left) / r.width - 0.5;
				var y = (e.clientY - r.top) / r.height - 0.5;
				card.style.transform = 'perspective(700px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 8) + 'deg) translateY(-4px)';
			});
			card.addEventListener('mouseleave', function () {
				card.style.transform = '';
			});
		});

		/* magnetic buttons */
		document.querySelectorAll('.magnetic').forEach(function (btn) {
			btn.addEventListener('mousemove', function (e) {
				var r = btn.getBoundingClientRect();
				var x = e.clientX - r.left - r.width / 2;
				var y = e.clientY - r.top - r.height / 2;
				btn.style.transform = 'translate(' + x * 0.18 + 'px,' + y * 0.3 + 'px)';
			});
			btn.addEventListener('mouseleave', function () {
				btn.style.transform = '';
			});
		});
	}

	/* ---------- FAQ accordion ---------- */
	document.querySelectorAll('.accordion-trigger').forEach(function (trigger) {
		trigger.addEventListener('click', function () {
			var item = trigger.closest('.accordion-item');
			var panel = item.querySelector('.accordion-panel');
			var isOpen = item.classList.contains('open');

			document.querySelectorAll('.accordion-item.open').forEach(function (openItem) {
				if (openItem !== item) {
					openItem.classList.remove('open');
					openItem.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'false');
					openItem.querySelector('.accordion-panel').style.maxHeight = null;
				}
			});

			if (isOpen) {
				item.classList.remove('open');
				trigger.setAttribute('aria-expanded', 'false');
				panel.style.maxHeight = null;
			} else {
				item.classList.add('open');
				trigger.setAttribute('aria-expanded', 'true');
				panel.style.maxHeight = panel.scrollHeight + 'px';
			}
		});
	});
	// first item opens by default (inline max-height:none); normalize it for toggling
	var firstOpen = document.querySelector('.accordion-item.open .accordion-panel');
	if (firstOpen) firstOpen.style.maxHeight = 'none';

})();
