import { test, expect, type Page } from "@playwright/test";

const trigger = (page: Page) => page.getByRole("button", { name: "AI Copilot", exact: true }).filter({ visible: true });
const panel = (page: Page) => page.locator("#sales-copilot");
const input = (page: Page) => page.locator("#sales-copilot-input");
const close = (page: Page) => panel(page).getByRole("button", { name: "Sulje AI Copilot", exact: true });
const send = (page: Page) => panel(page).getByRole("button", { name: "Lähetä viesti" });
const answer = "Synteettinen vastaus. " + "Pitkä turvallinen sisältö ja URL https://example.invalid/" + "x".repeat(300);

async function load(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto("/app/orders");
  await expect(page.locator(".app-shell-v2")).toHaveAttribute("data-shell-width", String(width));
  if (width >= 1200) await expect(panel(page)).toHaveAttribute("data-phase", "open");
}
async function open(page: Page) { if (!(await panel(page).count())) await trigger(page).click(); await expect(panel(page)).toHaveAttribute("data-phase", "open"); }

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    expect(url.origin).toBe("http://127.0.0.1:3102");
    if (!["GET", "HEAD"].includes(request.method())) expect(url.pathname).toBe("/api/copilot/ask");
    await route.fallback();
  });
  // Fail unexpected writes, including Support, ERP, imports and email. Only this
  // exact mocked Copilot endpoint may accept POST; no real backend is connected.
  await page.route("**/api/**", async route => {
    if (new URL(route.request().url()).pathname === "/api/copilot/ask") await route.fulfill({ json: route.request().method() === "GET" ? { context: { label: "Synteettinen konteksti" } } : { answer, sources: [] } });
    else { expect(["GET", "HEAD"]).toContain(route.request().method()); await route.fulfill({ json: {} }); }
  });
});

for (const width of [320,390,430,767,768,1023,1024,1180,1199,1200,1280,1440,1599,1600,1680,1919,1920]) {
  test(`LAY/RESP/TOK/SCROLL geometry ${width}px`, async ({ page }, info) => {
    await load(page, width);
    if (width < 1200) await open(page);
    const measurement = await page.evaluate(() => {
      const read = (selector: string) => { const e = document.querySelector<HTMLElement>(selector)!; const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,bg:s.backgroundColor,radii:[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius],border:s.borderLeftWidth}; };
      return {shell:read('.app-shell-v2'), main:read('.app-main-v2'),nav:read('.app-sidebar-v2'),chat:read('#sales-copilot'),content:read('.app-content-v2'), composer:read('.sales-copilot-bottom'),scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth};
    });
    await info.attach("geometry.json", {body:JSON.stringify({width, ...measurement},null,2),contentType:"application/json"});
    expect(measurement.shell.bg).toBe("rgb(250, 246, 242)");
    expect(measurement.chat.bg).toBe(measurement.shell.bg);
    expect(measurement.scrollWidth).toBeLessThanOrEqual(width);
    expect(measurement.composer.bottom).toBeLessThanOrEqual(901);
    if (width >= 1200) {
      expect(measurement.nav.width).toBe(232);
      expect(measurement.main.x-measurement.nav.right).toBe(16);
      expect(measurement.chat.x-measurement.main.right).toBe(16);
      expect(measurement.chat.width).toBe(width>=1920?400:width>=1600?384:360);
      expect(measurement.main.y).toBe(12);
      expect(measurement.main.border).toBe("1px");
      expect(measurement.main.radii).toEqual(["0px","16px","16px","0px"]);
      expect(measurement.main.width).toBe(width-232-32-measurement.chat.width);
      expect(measurement.content.width-64).toBe(measurement.main.width-66);
      expect(await page.locator('.app-main-v2').evaluate(e=>getComputedStyle(e).overflow)).toBe("visible");
    } else {
      await expect(panel(page)).toHaveAttribute('role','dialog');
      expect(measurement.chat.width).toBe(width<768?width:400);
    }
    await page.screenshot({path:info.outputPath(`${width}-open.png`),fullPage:false,animations:"disabled"});
    await close(page).click();
    await expect(panel(page)).toHaveCount(0);
    if (width >= 1024) {
      const right=await page.locator('.app-main-v2').evaluate(e=>e.getBoundingClientRect().right);
      expect(width-right).toBe(16);
    }
    if(width>=768) {
      await page.mouse.move(width/2,500); await page.mouse.wheel(0,1800);
      await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      const bottomGap=await page.locator('.app-main-v2').evaluate(e=>document.documentElement.scrollHeight-(e.getBoundingClientRect().bottom+window.scrollY));
      expect(bottomGap).toBeCloseTo(12,0);
    }
    if([320,390,430,768,1024,1180,1200,1440,1680,1920].includes(width)) await page.screenshot({path:info.outputPath(`${width}-closed-scrolled.png`),animations:"disabled"});
  });
}

test("NAV persistence, denied storage, search, query/hash and history",async({page})=>{
  await load(page);
  await page.getByRole('button',{name:'Pienennä valikko'}).click();
  await expect(page.locator('.app-sidebar-v2')).toHaveCSS('width','68px');
  await page.reload(); await expect(page.locator('.app-shell-v2')).toHaveClass(/is-sidebar-collapsed/);
  await page.keyboard.press('Control+k'); await expect(page.locator('#app-workspace-search-input')).toBeFocused();
  await page.locator('#app-workspace-search-input').fill('Tuotteet'); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/app\/products$/);
  await page.locator('.app-sidebar-v2-link-reviews').click(); await expect(page.locator('.app-sidebar-v2-link-reviews')).toHaveAttribute('aria-current','page');
  await page.locator('.app-sidebar-v2-link-tasks').click(); await expect(page.locator('.app-sidebar-v2-link-tasks')).toHaveAttribute('aria-current','location');
  await expect(page.locator('.app-sidebar-v2-link-dashboard')).not.toHaveAttribute('aria-current');
  await page.goBack(); await expect(page.locator('.app-sidebar-v2-link-reviews')).toHaveAttribute('aria-current','page');
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});});
  await page.reload(); await expect(page.locator('.app-shell-v2')).toBeVisible();
});

for(const height of [600,450]) test(`NAV low ${height}px keyboard reaches settings and account`,async({page},info)=>{
  await load(page,1440,height);
  const settings=page.locator('.app-sidebar-v2-link-settings');
  await settings.focus(); await expect(settings).toBeFocused();
  const nav=page.locator('.app-nav-scroll'); expect(await nav.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Tab'); await expect(page.locator('.app-sidebar-account-trigger')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('button',{name:'Kirjaudu ulos'})).toBeVisible();
  await page.screenshot({path:info.outputPath(`low-${height}.png`)});
  await page.keyboard.press('Escape'); await expect(page.locator('.app-sidebar-account-trigger')).toBeFocused();
});

test("CHAT retains draft/session, mobile Enter, IME, autogrow, real clipboard outcome and double send",async({page})=>{
  await load(page);
  let posts=0; await page.route('**/api/copilot/ask',async route=>{if(route.request().method()==='POST')posts++;await route.fulfill({json:route.request().method()==='GET'?{}:{answer}});});
  await input(page).fill('Tallennettu luonnos'); await close(page).click(); await expect(panel(page)).toHaveCount(0); await open(page); await expect(input(page)).toHaveValue('Tallennettu luonnos');
  await input(page).dispatchEvent('keydown',{key:'Enter',isComposing:true}); expect(posts).toBe(0);
  await input(page).fill('Kysy monta riviä\n'.repeat(20)); expect(await input(page).evaluate(e=>e.getBoundingClientRect().height)).toBeLessThanOrEqual(148);
  await input(page).fill('Tarkista tilaus'); await send(page).dblclick();
  await expect(page.locator('.sales-copilot-message.is-assistant')).toHaveCount(1); expect(posts).toBe(1);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied')}}}));
  await page.getByRole('button',{name:'Kopioi vastaus'}).click(); await expect(page.getByRole('alert')).toContainText('Kopiointi ei onnistunut'); await expect(page.getByText('Kopioitu',{exact:true})).toHaveCount(0);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}}));
  await page.getByRole('button',{name:'Kopioi vastaus'}).click(); await expect(page.getByText('Kopioitu',{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:700}); await expect(panel(page)).toHaveAttribute('role','dialog'); await expect(page.locator('.sales-copilot-message.is-assistant')).toHaveCount(1);
  await input(page).fill('Mobiili'); await input(page).press('Enter'); expect(posts).toBe(1); await expect(input(page)).toHaveValue('Mobiili\n');
});

test("CHAT pending reader keeps position, latest control, rate limit and context discard",async({page})=>{
  await load(page);
  await page.route('**/api/copilot/ask',async route=>{ if(route.request().method()==='GET')return route.fulfill({json:{}}); await route.fulfill({json:{answer:('Pitkä vastaus\n').repeat(120)}}); });
  await input(page).fill('Ensimmäinen kysymys');await send(page).click();await expect(page.locator('.is-assistant')).toHaveCount(1);
  let release!:()=>void; const waiting=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/copilot/ask',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{}});await waiting;await route.fulfill({json:{answer:'Viivästetty vastaus'}}).catch(()=>{});});
  await input(page).fill('Toinen kysymys');await send(page).click();
  await page.locator('.sales-copilot-scroll').evaluate(e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll'));});
  release();await expect(page.locator('.is-assistant')).toHaveCount(2);
  expect(await page.locator('.sales-copilot-scroll').evaluate(e=>e.scrollTop)).toBe(0);
  await page.getByRole('button',{name:'Siirry uusimpaan'}).click();await expect.poll(()=>page.locator('.sales-copilot-scroll').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  await page.route('**/api/copilot/ask',route=>route.fulfill({status:429,json:{error:'Päivän kysymysraja on täynnä.'}}));
  await input(page).fill('Rajoitettu kysymys');await send(page).click();await expect(page.getByRole('alert')).toContainText('Päivän');await expect(input(page)).toHaveValue('Rajoitettu kysymys');
  let releaseOld!:()=>void;const old=new Promise<void>(r=>releaseOld=r);
  await page.route('**/api/copilot/ask',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{}});await old;await route.fulfill({json:{answer:'VÄÄRÄ TYÖTILA'}}).catch(()=>{});});
  await input(page).fill('Vanhan työtilan kysymys');await send(page).click();await page.getByTestId('switch-workspace').click();releaseOld();
  await expect(input(page)).toHaveValue('');await expect(page.locator('.sales-copilot-message')).toHaveCount(0);await expect(page.getByText('VÄÄRÄ TYÖTILA')).toHaveCount(0);
});

test("MOD rapid intent, resize thresholds, nested menu Escape and scroll cleanup",async({page})=>{
  await load(page,1180);
  await page.mouse.move(600,500);await page.mouse.wheel(0,700);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  await open(page);await expect(page.locator('.app-main-v2')).toHaveAttribute('inert','');
  await input(page).fill('Sama luonnos');
  for(const width of [1199,1200,1024,1023,768,767,1440]) {await page.setViewportSize({width,height:900});await expect(panel(page)).toHaveAttribute('role',width>=1200?'complementary':'dialog');await expect(input(page)).toHaveValue('Sama luonnos');}
  await expect(page.locator('.app-main-v2')).not.toHaveAttribute('inert');expect(await page.locator('body').evaluate(e=>e.style.position)).toBe('');
  await close(page).click();await trigger(page).click();await expect(panel(page)).toHaveAttribute('data-phase','open');
  await close(page).click();await expect(panel(page)).toHaveCount(0);
  await page.setViewportSize({width:768,height:900});await page.getByRole('button',{name:'Avaa valikko'}).click();
  await page.getByRole('button',{name:'Työtili ja tiliasetukset'}).click();await page.getByRole('button',{name:'Kirjaudu ulos'}).focus();await page.keyboard.press('Escape');await expect(page.locator('.app-sidebar-account-menu')).toHaveCount(0);await expect(page.locator('.is-mobile-open')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('.is-mobile-open')).toHaveCount(0);expect(await page.locator('body').evaluate(e=>e.style.position)).toBe('');
  await open(page);await page.locator('.sales-copilot-backdrop').click({position:{x:10,y:10}});await expect(panel(page)).toHaveCount(0);await expect(trigger(page)).toBeFocused();
});

test("MOT reduced motion closes immediately without animation event",async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await load(page);await close(page).click();await expect(panel(page)).toHaveCount(0);await open(page);expect(await panel(page).evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});

test("CHAT network and timeout retain editable text without retrying on reopen",async({page})=>{
  await load(page);
  let posts=0;
  await page.route('**/api/copilot/ask',route=>{if(route.request().method()==='POST'){posts++;return route.abort('failed');}return route.fulfill({json:{}});});
  await input(page).fill('Verkkovirheen kysymys');await send(page).click();await expect(page.getByRole('alert')).toContainText('Verkkoyhteys');await expect(input(page)).toHaveValue('Verkkovirheen kysymys');
  await close(page).click();await expect(panel(page)).toHaveCount(0);await open(page);expect(posts).toBe(1);
  await page.clock.install();
  let release!:()=>void;const waiting=new Promise<void>(r=>release=r);
  await page.route('**/api/copilot/ask',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{}});posts++;await waiting;await route.fulfill({json:{answer:'Aikakatkaisun jälkeinen vastaus'}}).catch(()=>{});});
  await send(page).click();await expect(page.getByRole('status').filter({hasText:'Analysoin'})).toBeVisible();await page.clock.fastForward(30_100);
  await expect(page.getByRole('alert')).toContainText('aikakatkaistiin');await expect(input(page)).toHaveValue('Verkkovirheen kysymys');release();await expect(page.getByText('Aikakatkaisun jälkeinen vastaus',{exact:true})).toHaveCount(0);
});

test("MOD nested Support, route during open and keyboard trap restore document",async({page})=>{
  await load(page,1180);await open(page);
  const first=panel(page).getByRole('button',{name:'Uusi keskustelu'});
  await first.focus();await page.keyboard.press('Shift+Tab');await expect(send(page)).not.toBeFocused(); // disabled send is excluded
  expect(await page.evaluate(()=>document.querySelector('#sales-copilot')?.contains(document.activeElement))).toBe(true);
  // The existing contextual Help event opens real Support above Copilot.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('averomira:support-open',{detail:{articleId:'new-rfq'}})));
  await expect(page.locator('#support-center-dialog')).toBeVisible();await expect(panel(page)).toHaveAttribute('inert','');
  await page.keyboard.press('Escape');await expect(page.locator('#support-center-dialog')).toHaveCount(0);
  await expect(panel(page)).not.toHaveAttribute('inert');expect(await page.locator('body').evaluate(e=>e.style.position)).toBe('fixed');
  await close(page).click();await expect(panel(page)).toHaveCount(0);expect(await page.locator('body').evaluate(e=>e.style.position)).toBe('');
  await open(page);
  await page.evaluate(()=>{history.pushState({},'', '/app/products');window.dispatchEvent(new PopStateEvent('popstate'));});
  await expect(panel(page)).toHaveCount(0);await expect(page.locator('.app-main-v2')).toBeFocused();expect(await page.locator('body').evaluate(e=>e.style.position)).toBe('');
});

test("NAV role/feature presentation and 320px enlarged text reflow",async({page})=>{
  await page.setViewportSize({width:320,height:700});await page.goto('/app?role=member&leads=off');await page.getByRole('button',{name:'Avaa valikko'}).click();
  await expect(page.locator('.app-sidebar-v2-link-leads')).toHaveCount(0);await expect(page.locator('.app-sidebar-v2-link-team')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{
    const elements=Array.from(document.querySelectorAll<HTMLElement>('.app-shell-v2 *'));
    const sizes=elements.map(e=>Number.parseFloat(getComputedStyle(e).fontSize));
    elements.forEach((e,i)=>{if(e.childNodes.length&&Array.from(e.childNodes).some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim()))e.style.fontSize=`${sizes[i]*2}px`;});
  });
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button',{name:'Avaa valikko'}).click();await page.locator('.app-sidebar-v2-link-settings').focus();await expect(page.locator('.app-sidebar-v2-link-settings')).toBeFocused();
});

for (const route of ['products','customers','quotes','inbox']) test(`PAGE actual ${route} at 510px content`,async({page},info)=>{
  await page.setViewportSize({width:1200,height:900});await page.goto(`/app/${route}`);await expect(panel(page)).toHaveAttribute('data-phase','open');
  await expect(page.locator('.app-page-v2 h1')).toBeVisible();
  const size=await page.locator('.app-content-v2').evaluate(e=>e.clientWidth-Number.parseFloat(getComputedStyle(e).paddingLeft)-Number.parseFloat(getComputedStyle(e).paddingRight));expect(size).toBe(510);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1200);
  for(const field of await page.locator('.app-content-v2 input').all()) {const box=await field.boundingBox();expect(box!.width).toBeLessThanOrEqual(510);}
  await page.screenshot({path:info.outputPath(`${route}-510.png`),animations:'disabled'});
});

test("A11Y actual surfaces, control borders and one composite focus indicator",async({page},info)=>{
  await load(page);
  const result = await page.evaluate(()=>{
    const color=(selector:string,property:string)=>getComputedStyle(document.querySelector(selector)!).getPropertyValue(property);
    const luminance=(color:string)=>{const v=(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
    const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    return {
      nav:contrast(color('.app-sidebar-v2-link','color'),color('.app-sidebar-v2','background-color')),
      selected:contrast(color('.app-sidebar-v2-link.is-active','color'),color('.app-sidebar-v2-link.is-active','background-color')),
      control:contrast(color('.sales-copilot-bottom form','border-left-color'),color('.sales-copilot-bottom form','background-color')),
      primary:contrast(color('.upload-v2-primary-btn','color'),color('.upload-v2-primary-btn','background-color')),
      placeholder:contrast(getComputedStyle(document.querySelector('#sales-copilot-input')!,'::placeholder').color,color('.sales-copilot-bottom form','background-color')),
    };
  });
  await info.attach('contrast.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
  for(const key of ['nav','selected','primary','placeholder'] as const)expect(result[key]).toBeGreaterThanOrEqual(4.5);expect(result.control).toBeGreaterThanOrEqual(3);
  await input(page).focus();expect(await input(page).evaluate(e=>getComputedStyle(e).borderLeftWidth)).toBe('0px');
  await expect(page.locator('.sales-copilot-bottom form')).toHaveCSS('outline-width','2px');
});

test("LAY/MOD available width and scrollbar cannot oscillate",async({page})=>{
  await load(page,1200);
  await page.addStyleTag({content:'html { overflow-y: scroll; scrollbar-gutter: stable; }'});
  // WebKit on this Linux host uses overlay scrollbars and reserves no gutter.
  // Constrain the available container there, preserving the same width contract.
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const reservesGutter = await page.locator('.app-shell-v2').evaluate(e => e.getBoundingClientRect().width < 1200);
  if (!reservesGutter) await page.addStyleTag({content:'.app-shell-v2 { width: calc(100% - 16px); }'});
  await test.info().attach('available-width-method.json',{body:JSON.stringify({reservesGutter,method:reservesGutter?'native scrollbar gutter':'constrained shell container'}),contentType:'application/json'});
  await expect.poll(()=>page.locator('.app-shell-v2').evaluate(e=>e.getBoundingClientRect().width)).toBeLessThan(1200);
  await expect(page.locator('.app-shell-v2')).toHaveAttribute('data-shell-mode','overlay');
  await expect(panel(page)).toHaveAttribute('role','dialog');
  const widths=await page.evaluate(async()=>{const values:number[]=[];for(let i=0;i<8;i++){await new Promise(requestAnimationFrame);values.push(document.querySelector('.app-shell-v2')!.getBoundingClientRect().width);}return values;});
  expect(new Set(widths).size).toBe(1);await close(page).click();await expect(panel(page)).toHaveCount(0);
  await page.mouse.move(600,500);await page.mouse.wheel(0,500);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
});
