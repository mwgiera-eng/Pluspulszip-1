import { Link } from "wouter";

export type TrustSection = "accessibility"|"privacy"|"cookies"|"terms"|"conduct"|"modern-slavery"|"speak-up"|"company";

const nav:[TrustSection,string,string][]=[
["accessibility","Accessibility","/trust/accessibility"],["privacy","Privacy notice","/trust/privacy"],["cookies","Cookie policy","/trust/cookies"],["terms","Terms of use","/trust/terms"],["conduct","Code of conduct","/trust/code-of-conduct"],["modern-slavery","Modern slavery","/trust/modern-slavery"],["speak-up","Speak up","/trust/speak-up"],["company","Company & controller","/trust/company"]];

const text:Record<Exclude<TrustSection,"company">,{title:string;items:[string,string[]][]}>={
accessibility:{title:"Accessibility statement",items:[
["Standard",["+Puls is working toward WCAG 2.2 Level AA and the principles perceivable, operable, understandable and robust.","Our baseline includes keyboard access, visible focus, semantic structure, readable text, sufficient contrast, reduced-motion support where practical, and labels that do not rely on colour alone."]],
["Maps and live data",["Animated traffic signals are supplementary. Core states use the words Flow, Heavy and Jam. We aim to provide essential map information in accessible text when a visual map cannot be interpreted.","Some third-party map content and legacy areas may not yet meet our target consistently. Use Feedback and choose Accessibility if something blocks your use of +Puls."]],
["Status",["This is a transparency statement, not a certification of full conformance. Last reviewed 14 August 2026."]]]},
privacy:{title:"Privacy notice",items:[
["Data",["Depending on features used, +Puls can process account/contact details, location and last-seen information, trip and earnings records, subscription/payment references, notification preferences, and support or feedback submissions.","We aim to collect only data needed for the feature and do not call data anonymous when it can reasonably be linked to an account."]],
["Purposes",["Typical purposes are providing the service, authentication, security, driver-facing insights, subscriptions, preferences, support, legal obligations and reliability. The legal basis depends on the activity and can include contract, consent, legitimate interests and legal obligations."]],
["Sharing and retention",["Infrastructure, database, payment, email and other providers may handle data only where needed. Provider disclosures and retention schedules must be kept current as integrations change.","A complete controller identity and privacy contact must be published in Company & controller before public launch."]]]},
cookies:{title:"Cookie policy",items:[
["Essential",["Essential cookies or equivalent browser storage may be needed for secure sign-in, session continuity, security and remembering choices. They cannot be disabled where the service would otherwise stop working securely."]],
["Optional",["Functional and analytics categories are optional and remain off unless enabled. Continuing to browse is not treated as consent.","The permanent Cookie settings button stays available so choices can be changed later."]]]},
terms:{title:"Terms of use",items:[
["Decision support",["+Puls provides driver decision-support information. Traffic, demand, event, route, earnings and forecast information can be incomplete, delayed, simulated or estimated. It is not a guarantee of work, earnings, trip availability, road conditions or safety.","Drivers remain responsible for road rules, platform rules, licensing and safe driving. Do not interact with the service in a way that distracts you while driving."]],
["Accounts and use",["Keep credentials private. Do not access another user's data, interfere with the service, automate abusive traffic, scrape protected data or bypass security controls.","Paid features, trials, cancellation, renewal and refunds must be shown clearly at purchase and do not remove consumer rights that cannot lawfully be excluded."]],
["Independence",["+Puls is independent and is not presented as an official service of a ride-hailing platform unless a written partnership is stated."]]]},
conduct:{title:"Code of conduct",items:[
["Respect",["Harassment, discrimination, threats, retaliation, fraud, impersonation, deliberate misinformation and exposing another person's private information are not acceptable."]],
["Safety and integrity",["Do not use +Puls to encourage unsafe driving, evade lawful controls, manipulate marketplaces or interfere with another person's access to work. Reports should be made in good faith."]],
["Enforcement",["Serious or repeated violations can result in restricted access or account action, subject to applicable law and fair review."]]]},
"modern-slavery":{title:"Modern-slavery statement",items:[
["Commitment",["+Puls does not tolerate forced labour, human trafficking, servitude or coercive labour practices in its operations or supply chain.","Whether a formal statutory statement is legally required depends on the operating entity, jurisdiction, activities and applicable thresholds. Until company details are complete, this is a voluntary transparency commitment rather than a claim that a particular statutory duty applies."]],
["Approach",["We aim to select reputable suppliers, respond to credible concerns, avoid retaliation against good-faith reporters and escalate substantiated issues where required."]]]},
"speak-up":{title:"Speak-up / reporting channel",items:[
["How to report",["Use the persistent Feedback button and select Speak up for conduct, privacy, safety, accessibility or integrity concerns. Contact details are optional unless you want a response.","Share only what is necessary. Do not submit passwords, payment credentials or authentication codes."]],
["Urgent situations",["This channel is not an emergency service. If there is an immediate risk to a person, use the appropriate local emergency or public-safety channel."]]]}
};

function Company(){
const rows=[
["Brand","+Puls"],
["Legal entity",import.meta.env.VITE_LEGAL_ENTITY_NAME||"Not yet published"],
["Data controller",import.meta.env.VITE_DATA_CONTROLLER_NAME||"Not yet published"],
["Registered address",import.meta.env.VITE_REGISTERED_ADDRESS||"Not yet published"],
["Registration / tax ID",import.meta.env.VITE_COMPANY_REGISTRATION||"Not yet published"],
["Privacy / legal contact",import.meta.env.VITE_PRIVACY_CONTACT||"Not yet published"]];
const missing=rows.slice(1).some(([,v])=>v==="Not yet published");
return <div className="space-y-4">{missing&&<div role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">Legal identity fields are not fully configured. Complete the VITE legal/controller values before public launch.</div>}<section className="rounded-2xl border border-border/70 bg-card/80 p-5 md:p-7"><dl className="grid gap-3 sm:grid-cols-[180px_1fr]">{rows.map(([k,v])=><div className="contents" key={k}><dt className="font-medium">{k}</dt><dd className="text-sm text-muted-foreground">{v}</dd></div>)}</dl></section></div>;
}

export function TrustCenter({section}:{section:TrustSection}){
const active=section==="company"?{title:"Company and data-controller details",items:[]}:text[section];
return <div className="min-h-screen bg-background text-foreground pb-24">
<a href="#trust-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2">Skip to content</a>
<header className="border-b border-border/60 bg-card/60"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8"><Link href="/" className="font-mono text-lg font-bold"><span className="text-primary">+</span>Puls</Link><span className="text-xs uppercase tracking-[.2em] text-muted-foreground">Trust & access</span></div></header>
<main id="trust-main" className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[230px_1fr] md:px-8">
<nav aria-label="Trust pages" className="h-fit rounded-2xl border border-border/70 bg-card/70 p-2 md:sticky md:top-6">{nav.map(([id,label,href])=><Link key={id} href={href} aria-current={id===section?"page":undefined} className={`block rounded-xl px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${id===section?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>{label}</Link>)}</nav>
<div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">+Puls standard</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">{active.title}</h1><p className="mb-6 mt-2 text-sm text-muted-foreground">Readable, bounded and transparent.</p>{section==="company"?<Company/>:<div className="space-y-4">{active.items.map(([title,ps])=><section key={title} className="rounded-2xl border border-border/70 bg-card/80 p-5 md:p-7"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">{ps.map((p,i)=><p key={i}>{p}</p>)}</div></section>)}</div>}</div>
</main></div>;
}
