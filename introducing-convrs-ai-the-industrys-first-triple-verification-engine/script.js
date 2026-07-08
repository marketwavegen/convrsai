/* ============================================================
   CONVRS AI landing page — interactions & scroll animation
   ============================================================ */

(function () {
	'use strict';

	var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* ---------- sticky header state ---------- */
	var header = document.getElementById('siteHeader');
	function onScrollHeader() {
		header.classList.toggle('scrolled', window.scrollY > 24);
	}
	window.addEventListener('scroll', onScrollHeader, { passive: true });
	onScrollHeader();

	/* ---------- split-text word reveal ---------- */
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
	// bottom CTA split animates when scrolled into view
	var ctaH2 = document.querySelector('.bottom-cta h2');
	if (ctaH2) {
		new IntersectionObserver(function (entries, obs) {
			entries.forEach(function (e) {
				if (e.isIntersecting) { ctaH2.classList.add('split-in'); obs.disconnect(); }
			});
		}, { threshold: 0.4 }).observe(ctaH2);
	}

	/* ---------- scroll reveal (containers) ---------- */
	var revealObserver = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (entry.isIntersecting) {
				entry.target.classList.add('in');
				revealObserver.unobserve(entry.target);
			}
		});
	}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

	document.querySelectorAll('.reveal-up').forEach(function (el) {
		var d = el.getAttribute('data-delay');
		if (d) el.style.setProperty('--rd', d + 'ms');
		revealObserver.observe(el);
	});

	/* ---------- count-up numbers ---------- */
	function animateCount(el) {
		var target = parseFloat(el.getAttribute('data-count'));
		var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
		var suffix = el.getAttribute('data-suffix') || '';
		var dur = 1400;
		var start = null;
		function tick(ts) {
			if (!start) start = ts;
			var p = Math.min((ts - start) / dur, 1);
			var eased = 1 - Math.pow(1 - p, 3);
			el.textContent = (target * eased).toFixed(decimals) + suffix;
			if (p < 1) requestAnimationFrame(tick);
		}
		if (prefersReduced) { el.textContent = target.toFixed(decimals) + suffix; return; }
		requestAnimationFrame(tick);
	}
	var countObserver = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (entry.isIntersecting) {
				animateCount(entry.target);
				countObserver.unobserve(entry.target);
			}
		});
	}, { threshold: 0.6 });
	document.querySelectorAll('[data-count]').forEach(function (el) { countObserver.observe(el); });

	/* ---------- sticky stack: scale previous cards ---------- */
	var stackCards = Array.prototype.slice.call(document.querySelectorAll('[data-stack]'));
	function onStackScroll() {
		var vh = window.innerHeight;
		stackCards.forEach(function (card, i) {
			var rect = card.getBoundingClientRect();
			var next = stackCards[i + 1];
			if (next) {
				var nextRect = next.getBoundingClientRect();
				// how far the next card has risen over this one (0 → 1)
				var overlap = Math.min(Math.max((vh - nextRect.top) / (vh * 0.9), 0), 1);
				var scale = 1 - overlap * 0.06;
				var fade = 1 - overlap * 0.35;
				card.style.transform = 'scale(' + scale + ')';
				card.style.opacity = fade;
			}
			// mark in-view for internal animations (progress bars)
			if (rect.top < vh * 0.75 && rect.bottom > 0) card.classList.add('in-view');
		});
	}
	if (!prefersReduced) {
		window.addEventListener('scroll', onStackScroll, { passive: true });
		onStackScroll();
	} else {
		stackCards.forEach(function (c) { c.classList.add('in-view'); });
	}

	/* ---------- hero 3D tilt ---------- */
	var stage = document.getElementById('heroStage');
	var tilt = document.getElementById('stageTilt');
	if (stage && tilt && !prefersReduced && matchMedia('(pointer:fine)').matches) {
		stage.addEventListener('mousemove', function (e) {
			var r = stage.getBoundingClientRect();
			var x = (e.clientX - r.left) / r.width - 0.5;
			var y = (e.clientY - r.top) / r.height - 0.5;
			tilt.style.transform = 'rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 8) + 'deg)';
		});
		stage.addEventListener('mouseleave', function () {
			tilt.style.transform = 'rotateY(0deg) rotateX(0deg)';
		});
	}

	/* ---------- hero verification feed loop ---------- */
	var leads = [
		{ name: 'Dana Mercer',  title: 'VP Revenue · Northwind',      initials: 'DM', verified: true },
		{ name: 'Priya Raman',  title: 'Head of Growth · Corelight',  initials: 'PR', verified: true },
		{ name: 'Sam Whitfield','title': 'Dir. Demand Gen · Argos',   initials: 'SW', verified: false },
		{ name: 'Jon Okafor',   title: 'CRO · Meridian Labs',         initials: 'JO', verified: true },
		{ name: 'Alex Chen',    title: 'RevOps Lead · Fathom',        initials: 'AC', verified: true }
	];
	var leadIndex = 0;

	var card = document.getElementById('leadCard');
	var nameEl = document.getElementById('leadName');
	var titleEl = document.getElementById('leadTitle');
	var avatarEl = document.getElementById('leadAvatar');
	var checks = [document.getElementById('check1'), document.getElementById('check2'), document.getElementById('check3')];
	var stamp = document.getElementById('stamp');
	var stampDead = document.getElementById('stampDead');
	var scanline = document.getElementById('scanline');

	function resetCard() {
		checks.forEach(function (c) { c.classList.remove('checking', 'done'); });
		stamp.classList.remove('on');
		stampDead.classList.remove('on');
		scanline.classList.remove('on');
	}

	function runLead() {
		if (!card || prefersReduced) return;
		var lead = leads[leadIndex % leads.length];
		leadIndex++;

		resetCard();
		nameEl.textContent = lead.name;
		titleEl.textContent = lead.title || lead['title'];
		avatarEl.textContent = lead.initials;

		card.classList.remove('leaving');
		card.classList.add('entering');
		setTimeout(function () { card.classList.remove('entering'); }, 600);

		// scanline sweep
		setTimeout(function () {
			scanline.classList.add('on');
			setTimeout(function () { scanline.classList.remove('on'); }, 1000);
		}, 500);

		// sequential checks
		var t = 800;
		checks.forEach(function (check, i) {
			var isLastFail = !lead.verified && i === 2;
			setTimeout(function () { check.classList.add('checking'); }, t);
			setTimeout(function () {
				check.classList.remove('checking');
				if (!isLastFail) check.classList.add('done');
			}, t + 700);
			t += 800;
		});

		// stamp
		setTimeout(function () {
			(lead.verified ? stamp : stampDead).classList.add('on');
		}, t + 150);

		// leave & loop
		setTimeout(function () {
			card.classList.add('leaving');
		}, t + 1500);
		setTimeout(runLead, t + 2100);
	}

	if (card && !prefersReduced) {
		setTimeout(runLead, 900);
	} else if (card) {
		// reduced motion: static verified state
		checks.forEach(function (c) { c.classList.add('done'); });
		stamp.classList.add('on');
	}

	/* ---------- magnetic buttons ---------- */
	if (matchMedia('(pointer:fine)').matches && !prefersReduced) {
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

})();
