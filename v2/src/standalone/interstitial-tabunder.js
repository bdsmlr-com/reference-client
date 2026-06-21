'use strict';

if (!globalThis.interstitial_overlay_ran_already) {
globalThis.interstitial_overlay_ran_already = true;

;(function () {

function attrOK (ss) {
	return ss
		.replace(/&/g,'&amp;')
		.replace(/</g,'&lt;')
		.replace(/'/g,'&apos;')
		.replace(/"/g,'&quot;')
	;
}
function frameUp (src) {
	let ft = document.querySelector('overbearing-overlay ins').parentNode
	ft.innerHTML = `<iframe
		style="
			border:0;
			background:transparent;
			width:100%;
			height:100%;
		"
		src="${ attrOK(src) }"
	></iframe>`;
}
function attemptFrameDive () {
	try {
		try {
			// Try 2-deep
			frameUp(
				document.querySelector('overbearing-overlay iframe')
					.contentDocument
					.querySelector('iframe')
					.contentDocument
					.querySelector('meta[name="offer"]')
					.getAttribute('value')
			);
		}
		catch (ee) {
			// Try 1-deep
			frameUp(
				document.querySelector('overbearing-overlay iframe')
					.contentDocument
					.querySelector('meta[name="offer"]')
					.getAttribute('value')
			);
		}
		// p.s. No particular need to abstract to N-deep at this time.
	}
	catch (ee) {
		setTimeout(attemptFrameDive,250);
	}
}
attemptFrameDive();



// main items:
const interstitial_form_id = 'interstitial-form-1';
let
	 interstitial_style_el
;
function populateInterstitialURL() {
	const
		 new_url = location.href.split('?')[0]
		,params = new URLSearchParams(location.search)
		,form = document.getElementById(interstitial_form_id)
	;
	form.action = new_url;
	for (const [name,value] of params) {
		form.append(
			Object.assign(document.createElement('input'),{
				 type: 'hidden'
				,name
				,value
			})
		);
	}
}
const interstitial_html = `
	<overbearing-overlay>
		<form id="${ attrOK(interstitial_form_id) }" action="${ '' /* set later by populateInterstitialURL() */ }" target="_blank" rel="opener">
			<input type="hidden" name="revealcontent" value="1">
			${ '' /* other query string components to be replicated here as hidden-inputs by populateInterstitialURL() after html is set */ }
			<int-red-x onclick="
				if (document.body.hasAttribute('with-delayed-escape')) return;
				/*document.body.removeAttribute('with-interstitial');*/
				/*this.closest('overbearing-overlay').remove();*/
				setTimeout(() => {
					document.body.removeAttribute('with-interstitial',false);
					this.closest('overbearing-overlay').remove()
				},4000); /* fallback */
				this.closest('form').submit();
			"></int-red-x>
			<input type="submit" style="display:none">
		</form>
		<inner-panel class="full with-headroom">
			<inner-label>Sponsored Offer:</inner-label>
			<div class="holder">
				<ins id="revive-interstitial-target" data-revive-id="727bec5e09208690b050ccfc6a45d384"></ins>
			</div>
		</inner-panel>
	</overbearing-overlay>
`;
const interstitial_css = `
	overbearing-overlay {
		font:medium sans-serif
	}
	body[with-interstitial] overbearing-overlay {
		display:block;
	}
	overbearing-overlay ins[data-revive-id]::before {
		display:none;
	}
	body[with-interstitial] overbearing-overlay ~ div ins[data-revive-id] {
		display:none; /* hide banners while interstitial's up */
	}
	overbearing-overlay ins {
		display:block !important; /* counteract banner hiding rule */
		width:100%;
		height:100%;
	}
	overbearing-overlay {
		display:none;
		position:fixed;
		z-index:10001;
		top:0;
		left:0;
		right:0;
		bottom:0;
		padding:5em;
		text-align:center;
		background:#102030;
		background:#102030F2;
		-webkit-backdrop-filter:blur(1px);
		backdrop-filter:blur(1px);
		animation:overbear .35s cubic-bezier(0.25,1,0.25,1);
		/**/
		align-items:center;
		justify-content:center;
	}
	int-red-x {
		position:absolute;
		display:block;
		top:0.1em;
		right:0.1em;
		font-size:4em;
		cursor:pointer;
		user-select:none;
		color:#CF0000;
		background:#000;
		/*border:2px solid #FF00A0;*/
		border-radius:100%;
		box-sizing:border-box;
		padding:0em;
		line-height:1em;
		width:1em;
		height:1em;
		ooverflow:hidden;
		z-index:10008;
	}
	int-red-x>* {
		position:absolute;
		top:50%;
		right:4.6em;
		font-size:.25em;
		transform:translateY(-50%);
		white-space:nowrap;
		text-shadow:1px 1px #FF00A0;
		color:#FFF !important;
	}
	int-red-x::before,
	int-red-x::after {
		content:"";
		display:block;
		background:currentColor;
		width:.11em;
		height:0.51em;
		position:absolute;
		top:50%;
		left:50%;
		transform:translate(-50%,-50%) rotate(-45deg);
	}
	int-red-x::after {
		transform:translate(-50%,-50%) rotate(45deg);
	}
	@keyframes overbear {
		0% {
			opacity:0.01;
			padding:0;
			transform:scale(1.1);
		}
		100% {
			opacity:1;
			transform:scale(1);
			padding:5em;
			transform-origin:50% 50%;
		}
	}
	inner-panel {
    height:100%;
		min-height:7em;
		min-height:40vh;
		display:block;
		padding:1.8em;
		bbborder:1px solid var(--tx);
		background:#0008;
		border-radius:.7em;
		position:relative;
	}
	inner-panel inner-label {
		position:absolute;
		color:#FFF;
		font-weight:bold;
		font-style:italic;
		font-size:.8em;
		top:.6em;
		left:2.2em;
	}
	inner-panel.full>.holder {
		position:absolute;
		top:1.8em;
		right:1.8em;
		bottom:1.8em;
		left:1.8em;
		bbox-shadow:0 0 0 1px #FFF;
		background:#0007;
		display:flex;
		align-items:center;
		justify-content:center;
	}
	/**/
	body[with-delayed-escape] int-red-x {
	 cursor:not-allowed;
	 opacity:.1;
	}
	body[with-delayed-escape] input[disabled] {
	 cursor:wait;
	}

	/* for targeting script */
	head::before {content:"desktop"}
	@media (pointer:coarse) {
		head::before {content:"mobile"}
	}
`;
function setupInterstitial () {
	interstitial_style_el = document.createElement('style');
	interstitial_style_el.textContent = interstitial_css;
	document.head.appendChild(interstitial_style_el);
	//
	if (document.body) {
		document.body.insertAdjacentHTML('afterBegin',interstitial_html);
	}
	else {
		// scirpt is still in <head>; just document.write
		document.write(interstitial_html);
	}
	populateInterstitialURL();
}

function populateInterstitialWithRevive () {
	var rev_timer;
	function fix_revive_banner () {
		var elx,wwx,hhx;
		if (elx = document.querySelector('overbearing-overlay ins iframe')) {
			clearInterval(rev_timer);
			wwx = Number(elx.getAttribute('width'));
			hhx = Number(elx.getAttribute('height'));
			//if (wwx === 0 || hhx === 0) {
			elx.setAttribute('width','100%');
			elx.setAttribute('height','100%');
			//}
		}
	}
	rev_timer = setInterval(fix_revive_banner,50);

	//
	var origin = 'interstitial'
	var platform = (location.href.match(/\b.*[?&]device=([^#&]*)/) || [])[1];
	//
	if (typeof platform != 'string') {
		if (/Mobile/.test(navigator.userAgent)) {
			platform = 'mobile';
		}
		else {
			platform = getComputedStyle(document.head,'::before').content.replace(/"/g,'');
		}
		if (!(platform in {desktop:1,mobile:1,tablet:1})) {
			platform = 'desktop';
		}
	}
	////
	var choices = {
		 "interstitial:mobile":  17209
		,"interstitial:tablet":  17210
		,"interstitial:desktop": 17208
	};
	var choice_name = origin + ':' + platform;
	var zoneid = choices[choice_name];
	console.log("Interstitial Choosing:",choice_name,"-",zoneid);
	if (zoneid) {
	  document.querySelector('#revive-interstitial-target').setAttribute('data-revive-zoneid',String(zoneid));
	}
	else {
	  console.error("WEIRD combination got no results:",origin,platform); // could happen if an extension deliberately CSS-interferes, or something.
	}
	//
	if (globalThis.reviveAsync) {
		reviveAsync["727bec5e09208690b050ccfc6a45d384"].refresh();
	}
	else {
		// revive isn't loaded; load it; load it and hook the load
		var screl = document.createElement('script')
		screl.setAttribute('src','//servedby.revive-adserver.net/asyncjs.php')
		screl.onload = function () {
			queueMicrotask(function () {
				reviveAsync["727bec5e09208690b050ccfc6a45d384"].refresh();
			});
		}
		document.head.appendChild(screl)
	}
}
function revealInterstitial () {
	document.body.setAttribute('with-interstitial',1)
	try {
		if (document.activeElement) {
			document.activeElement.blur();
		}
	}
	catch (ee) {
		console.warn("Trouble blurring focused background element:",ee);
	}
}

const legacy_bdsmlr_redirect_map = {
	// mapping is keysed by replacement string, values contain matcher regexes
	'https://api-staging.bdsmlr.com/activity/$1': [
		 /^https?:\/\/([a-zA-Z0-9_-]+)\.bdsmlr\.com\/$/g
		,/^https?:\/\/(?:www\.)?bdsmlr\.com\/blog\/([a-zA-Z0-9_-]+)\/?$/g
	]
	,'https://api-staging.bdsmlr.com/post/$1': [
		 /^https?:\/\/(?:[a-zA-Z0-9_-]+\.)?bdsmlr\.com\/post\/([0-9]+)\/?$/g
	]
	,'https://api-staging.bdsmlr.com/$2/$1': [
		 /^https?:\/\/([a-zA-Z0-9_-]+)\.bdsmlr\.com\/(.+)$/g
	]
}
function legacyBdsmlrRedirectURL (forurl) {
	var
		 dest
		,reg
		,mt
	;
	// walk the mapping for any match
	for (dest in legacy_bdsmlr_redirect_map) {
		for (reg of legacy_bdsmlr_redirect_map[dest]) {
			//debug//console.info("Testing",forurl,"against",reg)
			if (reg.test(forurl)) {
				console.info("HIT")
				return forurl.replace(reg,dest)
			}
		}
	}
	return null
}

window.tabunder_oktobounce = false;
window.addEventListener('blur',function () {
	window.tabunder_oktobounce = true;
	//console.info('BLUR') // doesn't fire in Chrome
});
window.addEventListener('focus',function () {
	window.tabunder_oktobounce = false;
	//console.info('FOCUS') //  doesn't fire in Chrome
});
globalThis.tabunderBounceOut = function () {
	setTimeout(function () {
		//location.href = 'https://example.com/'
		switch (document.visibilityState) {
			case 'visible':
				break;
			default:
				if (!window.tabunder_oktobounce) {
					// fall back on blur/focus check
					break;
				}
				// fall through
			case 'hidden':
				location.href = 'https://bdsmlr.com/html/tabunder-advance.html?origin=interstitial';
				///*debug*/localStorage['tabunder_lastevent'] = 'Tab OK: ' + document.visibilityState + '; ' + window.tabunder_oktobounce;
				return;
		}
		// fallback; submit form again without new window
		var formx = document.querySelector('form');
		formx.target = "";
		formx.submit();
		///*debug*/localStorage['tabunder_lastevent'] = 'Fallback. Submit form instead; ' + document.visibilityState + '; ' + window.tabunder_oktobounce;
	},600);
}
globalThis.processParentTabunder = function () {
	if (window.opener) {
		try {
			window.opener.tabunderBounceOut();
		}
		catch (ee) {
			console.warn("TAB: Problem with that opener;",ee)
		}
	}
	else {
		console.warn("TAB: No opener.")
	}
}

globalThis.deployInterstitial = function deployInterstitial () {
	setupInterstitial()
	populateInterstitialWithRevive()
	revealInterstitial()
}


})();


if (location.href.indexOf('revealcontent') != -1) {
	processParentTabunder();
}

}
