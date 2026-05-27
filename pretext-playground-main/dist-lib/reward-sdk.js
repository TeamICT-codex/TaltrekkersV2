//#region src/reward-runtime.ts
var e = "hlc-reward-session-", t = new Set([
	"hlc-reward-ready",
	"hlc-reward-complete",
	"hlc-reward-close",
	"hlc-reward-config"
]);
function n(e) {
	return typeof e == "boolean" ? e : void 0;
}
function r(e) {
	return typeof e == "string" ? e : void 0;
}
function i(e) {
	return e === "dragon" || e === "snake" ? e : void 0;
}
function a(e) {
	return e === "ember" || e === "aurora" || e === "forest" || e === "midnight" || e === "sunrise" ? e : void 0;
}
function o(e) {
	return e === "easy" || e === "normal" || e === "hard" ? e : void 0;
}
function s(t) {
	return `${e}${t}`;
}
function c(e) {
	if (!e || typeof e != "object") return {};
	let t = e, s = r(t.text);
	return {
		mode: i(t.mode),
		theme: a(t.theme),
		difficulty: o(t.difficulty),
		text: s ? s.slice(0, 12e3) : void 0,
		showPanel: n(t.showPanel),
		showClose: n(t.showClose),
		autoStartSnake: n(t.autoStartSnake),
		hideNav: n(t.hideNav),
		compactHud: n(t.compactHud)
	};
}
function l(e, t) {
	return c({
		...e || {},
		...t || {}
	});
}
function u(e) {
	if (!e || typeof e != "object") return !1;
	let n = e.type;
	return typeof n == "string" && t.has(n);
}
//#endregion
//#region src/reward-embed.ts
function d() {
	return `reward-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function f() {
	return new URL("/reward.html", window.location.origin).toString();
}
function p(e, t) {
	sessionStorage.setItem(s(e), JSON.stringify(c(t)));
}
function m(e = {}) {
	let t = e.mountTo || document.body, n = d(), r = c({
		mode: "snake",
		difficulty: "easy",
		showPanel: !1,
		showClose: !0,
		hideNav: !0,
		compactHud: !0,
		...e
	});
	p(n, r);
	let i = document.createElement("div");
	i.dataset.rewardOverlay = "true", i.style.position = "fixed", i.style.inset = "0", i.style.zIndex = String(e.zIndex || 9999), i.style.display = "grid", i.style.placeItems = "center", i.style.background = "rgba(5, 5, 7, 0.72)", i.style.backdropFilter = "blur(10px)";
	let a = document.createElement("div");
	a.style.position = "relative", a.style.width = e.width || "min(1200px, calc(100vw - 32px))", a.style.height = e.height || "min(760px, calc(100vh - 32px))", a.style.borderRadius = "24px", a.style.overflow = "hidden", a.style.background = "#050506", a.style.boxShadow = "0 30px 100px rgba(0,0,0,0.45)", a.style.border = "1px solid rgba(255,255,255,0.08)";
	let o = document.createElement("iframe"), m = new URL(e.pageUrl || f(), window.location.href);
	m.searchParams.set("embed", "1"), m.searchParams.set("rewardSession", n), r.mode && m.searchParams.set("mode", r.mode), o.src = m.toString(), o.title = "Reward overlay", o.style.display = "block", o.style.width = "100%", o.style.height = "100%", o.style.border = "0", o.allow = "fullscreen";
	let h = document.createElement("button");
	h.type = "button", h.textContent = "Sluiten", h.style.position = "absolute", h.style.top = "16px", h.style.right = "16px", h.style.zIndex = "2", h.style.border = "1px solid rgba(255,255,255,0.14)", h.style.background = "rgba(10,10,12,0.68)", h.style.color = "#f5dfcf", h.style.padding = "8px 12px", h.style.borderRadius = "999px", h.style.cursor = "pointer", h.style.font = "600 12px/1 Inter, system-ui, sans-serif", h.style.display = r.showClose === !1 ? "none" : "inline-flex", a.append(o, h), i.appendChild(a), t.appendChild(i);
	let g = () => {
		window.removeEventListener("message", y);
		try {
			sessionStorage.removeItem(s(n));
		} catch {}
		i.remove();
	}, _ = () => {
		g(), e.onClose?.();
	}, v = (e) => {
		r = l(r, c(e)), p(n, r), h.style.display = r.showClose === !1 ? "none" : "inline-flex", o.contentWindow?.postMessage({
			type: "hlc-reward-config",
			payload: r
		}, "*");
	}, y = (t) => {
		if (!(t.source !== o.contentWindow || !u(t.data))) {
			if (t.data.type === "hlc-reward-ready") {
				o.contentWindow?.postMessage({
					type: "hlc-reward-config",
					payload: r
				}, "*"), e.onReady?.();
				return;
			}
			t.data.type === "hlc-reward-complete" && e.onComplete?.({
				mode: t.data.mode,
				score: t.data.score
			});
		}
	};
	return window.addEventListener("message", y), h.addEventListener("click", _), e.closeOnBackdrop !== !1 && i.addEventListener("click", (e) => {
		e.target === i && _();
	}), {
		element: i,
		iframe: o,
		update: v,
		close: _
	};
}
function h(e = {}) {
	return m(e);
}
//#endregion
//#region src/reward-presets.ts
var g = [
	{
		kind: "course-complete",
		label: "Course Complete",
		kicker: "Leren",
		summary: "Vier het afronden van een opleiding, module of onboardingpad met een lichtere, uitnodigende rewardflow."
	},
	{
		kind: "support-milestone",
		label: "Support Milestone",
		kicker: "Impact",
		summary: "Zet een supportmijlpaal om in een grotere, dramatischere rewardlaag die stabiliteit en voortgang uitstraalt."
	},
	{
		kind: "team-streak",
		label: "Team Streak",
		kicker: "Samen",
		summary: "Maak gezamenlijke consistentie zichtbaar met een energieke streak-reward voor teams, scholen of clusters."
	}
];
function _(e) {
	return e.trim().replace(/\s+/g, " ");
}
function v(e) {
	return e.map(_).filter(Boolean).join("\n\n");
}
function y(e = {}) {
	let t = e.courseName || "Digitale basis", n = e.learnerName || "Je team", r = e.schoolName || "Het leercollectief", i = e.nextUnlock || "Volgende module: slimmer accountbeheer";
	return {
		mode: "snake",
		difficulty: "easy",
		theme: "sunrise",
		autoStartSnake: !0,
		showPanel: !1,
		showClose: !0,
		hideNav: !0,
		compactHud: !0,
		text: v([
			"Cursus afgerond.",
			`${n} heeft ${t} succesvol voltooid binnen ${r}. Deze reward markeert een leermoment dat meteen voelbaar mag zijn.`,
			"Kennis groeit sneller wanneer vooruitgang zichtbaar wordt. Daarom maken we het afronden van een opleiding tastbaar met een korte, speelse overlay die succes bevestigt zonder het hoofdproduct te onderbreken.",
			"- Badge vrijgespeeld: Course Complete",
			`- Nieuwe stap klaar: ${i}`,
			"- Voortgang bijgewerkt in het leerpad",
			"- Team iCT ziet de groei terug in het dashboard",
			"- Gebruik dit na onboarding, opleiding of certificering"
		])
	};
}
function b(e = {}) {
	let t = e.teamName || "Team iCT", n = e.solvedTickets || 25, r = e.scopeLabel || "over de hele scholengroep", i = e.nextGoal || "Volgende mijlpaal: 50 opgeloste tickets";
	return {
		mode: "dragon",
		theme: "aurora",
		showPanel: !1,
		showClose: !0,
		hideNav: !0,
		compactHud: !0,
		text: v([
			"Support mijlpaal bereikt.",
			`${t} heeft ${n} supportvragen opgelost ${r}. Deze reward laat voelen dat betrouwbare ondersteuning ook echte vooruitgang is.`,
			"Een supportmijlpaal is meer dan volume. Ze staat voor rust, continuiteit en vertrouwen. Daarom past hier een krachtigere reward bij die stabiliteit en impact uitstraalt.",
			`- ${n} cases afgerond`,
			"- Betrouwbaarheid zichtbaar gemaakt",
			"- Supportdruk slim omgezet in momentum",
			`- ${i}`,
			"- Gebruik dit na supportstreaks, SLA-doelen of platformmigraties"
		])
	};
}
function x(e = {}) {
	let t = e.teamName || "Team iCT", n = e.streakDays || 7, r = e.schoolsReached || 5;
	return {
		mode: "snake",
		difficulty: "normal",
		theme: "ember",
		autoStartSnake: !0,
		showPanel: !1,
		showClose: !0,
		hideNav: !0,
		compactHud: !0,
		text: v([
			"Team streak actief.",
			`${t} houdt al ${n} dagen op rij focus op ${e.focusLabel || "digitale opvolging"}. ${r} scholen liften mee op die gezamenlijke ritmiek.`,
			"Een streakreward maakt collectieve discipline zichtbaar. Niet als droge teller, maar als een gedeelde pulse die mensen motiveert om nog een stap verder te gaan.",
			`- ${n} dagen consistente actie`,
			`- ${r} scholen mee in beweging`,
			"- Teamritme zichtbaar gemaakt",
			"- Bonus geschikt voor dashboards en weekstarts",
			"- Gebruik dit voor gewoontes, check-ins of beleidssprints"
		])
	};
}
function S(e) {
	return e === "support-milestone" ? b() : e === "team-streak" ? x() : y();
}
//#endregion
//#region src/reward-sdk.ts
function C(e = {}, t = {}) {
	return m({
		...y(e),
		...t
	});
}
function w(e = {}, t = {}) {
	return m({
		...b(e),
		...t
	});
}
function T(e = {}, t = {}) {
	return m({
		...x(e),
		...t
	});
}
//#endregion
export { g as REWARD_PRESET_CARDS, y as buildCourseCompleteReward, S as buildRewardPreset, b as buildSupportMilestoneReward, x as buildTeamStreakReward, m as createRewardOverlay, f as getDefaultRewardPageUrl, C as showCourseCompleteReward, h as showRewardOverlay, w as showSupportMilestoneReward, T as showTeamStreakReward };
