// The landing page: why darkness matters, how Leerie measures it, and what one night found.
import Link from "next/link";
import { Hero } from "./Hero";
import { LiveNumbers } from "./LiveNumbers";
import "./landing.css";

const ONS = "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/perceptionsofpersonalsafetyandexperiencesofharassmentgreatbritain/16februaryto13march2022";
const STATS = [
  { value: "50%", text: "of women felt unsafe walking alone after dark on a quiet street near home, compared with 17% of men.",
    source: "ONS, Great Britain, 2022", href: ONS },
  { value: "82%", text: "of women felt unsafe walking alone after dark in a park or open space, compared with 42% of men.",
    source: "ONS, Great Britain, 2022", href: ONS },
  { value: "71%", text: "of women in Scotland felt safe walking alone in their neighbourhood after dark, compared with 90% of men.",
    source: "Scottish Household Survey, 2025",
    href: "https://www.gov.scot/publications/neighbourhoods-and-communities-2025-findings-from-the-scottish-household-survey/pages/neighbourhood-safety/" },
  { value: "38%", text: "of women aged 16 to 34 reported catcalling in the previous 12 months.",
    source: "ONS, Great Britain, 2022", href: ONS },
];

const STEPS = [
  { n: "01", title: "Walk", text: "Open the app, point the camera ahead and walk. Leerie undoes auto-exposure with the camera's own shutter speed, ISO and aperture, the method the phyphox lab app uses, and uploads one reading a second with its GPS point. Comfortable and Uncomfortable buttons record how a street feels." },
  { n: "02", title: "Map", text: "Readings are matched to OpenStreetMap streets and compared with nearby measurements. A street at +1 stop has twice the light of its local median. Where nearby readings support an estimate, unmeasured streets appear faded." },
  { n: "03", title: "Decide", text: "Draw an area and set a budget. Leerie maps proposed lamp sites, estimates their effect, and exports the coordinates. It also highlights lighting hotspots and streets worth surveying next." },
];

/** The council's lamp map beside our light map, same view each time. Images: /map with one layer on. */
const COMPARE = [
  { key: "area", title: "George Square to King's Buildings",
    lamps: "The council inventory shows where lamp posts are installed.",
    light: "Measured light varies from street to street. Amber is brighter, violet is darker, and faded lines show estimates." },
  { key: "street", title: "Around Findhorn Place",
    lamps: "Council records show lamp posts on both sides of the street.",
    light: "In this survey view, Findhorn Place appears darker than the streets around it." },
];

const PRIVACY = [
  ["No photos", "Frames are reduced to one brightness number on the phone and thrown away."],
  ["No accounts", "Each walk gets a random ID. There is no name, email or phone number."],
  ["Write-only app", "The app can add readings but cannot read anyone's, including its own."],
  ["Streets, not people", "The map shows per-street summaries. Nobody's path or individual report is ever shown."],
];

export function Landing() {
  return (
    <div className="ld">
      <nav className="ld-nav" aria-label="Main">
        <Link href="/" className="lr-wordmark" aria-label="Leerie home"><span className="lr-lamp" aria-hidden /><span>Leerie</span></Link>
        <div className="ld-nav-links">
          <a href="#why">Why</a>
          <a href="#how">How it works</a>
          <a href="#compare">Lamps vs light</a>
          <a href="#night">Night survey</a>
          <Link className="lr-button" href="/map">Open the map</Link>
        </div>
      </nav>

      <main>
        <Hero />

        <section id="why" className="ld-section">
          <p className="micro ld-eyebrow">Why it matters</p>
          <h2 className="display ld-h2">After dark, the same street is a different street.</h2>
          <div className="ld-stats">
            {STATS.map((s) => (
              <figure key={s.value} className="ld-stat">
                <div className="display ld-stat-value">{s.value}</div>
                <figcaption>
                  <p>{s.text}</p>
                  <a className="ld-source" href={s.href} target="_blank" rel="noreferrer">{s.source}</a>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="ld-callout">
            <p className="display">
              A randomised trial in New York City public housing estimated that extra lighting reduced
              serious crimes outdoors at night by at least 36%.
            </p>
            <p className="secondary">
              A lamp inventory shows where the posts are. Measurements can reveal where a failed lamp,
              a tree or a long gap between posts leaves the pavement dark.{" "}
              <a className="ld-source" href="https://www.nber.org/papers/w25798" target="_blank" rel="noreferrer">Chalfin et al., NBER</a>
            </p>
          </div>
        </section>

        <section id="how" className="ld-section">
          <p className="micro ld-eyebrow">How it works</p>
          <h2 className="display ld-h2">A phone, a walk and a map a council can act on.</h2>
          <ol className="ld-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="ld-step">
                <span className="data ld-step-n">{s.n}</span>
                <h3 className="display">{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="compare" className="ld-section">
          <p className="micro ld-eyebrow">The lamp map vs the light map</p>
          <h2 className="display ld-h2">A lamp on a map is not light on the pavement.</h2>
          {COMPARE.map((c) => (
            <div key={c.key} className="ld-compare">
              <h3 className="display">{c.title}</h3>
              <div className="ld-compare-pair">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots, already sized */}
                  <img src={`/compare/${c.key}-lamps.webp`} alt={`Council lamp posts, ${c.title}`} loading="lazy" />
                  <figcaption><b>What the council&apos;s map shows</b>{c.lamps}</figcaption>
                </figure>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots, already sized */}
                  <img src={`/compare/${c.key}-light.webp`} alt={`Measured light by street, ${c.title}`} loading="lazy" />
                  <figcaption><b>What we measured</b>{c.light}</figcaption>
                </figure>
              </div>
            </div>
          ))}
        </section>

        <section id="night" className="ld-section">
          <LiveNumbers />
        </section>

        <section className="ld-section ld-poem">
          <blockquote className="display">
            &ldquo;O Leerie, I&apos;ll go round at night and light the lamps with you!&rdquo;
          </blockquote>
          <p className="secondary">
            Robert Louis Stevenson, <i>The Lamplighter</i>, 1885. Leerie was the man who lit Edinburgh&apos;s gas lamps each evening.
            We took that idea back to the streets with a phone light meter.
          </p>
        </section>

        <section id="privacy" className="ld-section">
          <p className="micro ld-eyebrow">Privacy</p>
          <h2 className="display ld-h2">It measures streets, not people.</h2>
          <dl className="ld-privacy">
            {PRIVACY.map(([title, text]) => (
              <div key={title}><dt>{title}</dt><dd>{text}</dd></div>
            ))}
          </dl>
          <p className="secondary ld-note">
            Brightness is relative, not lux. A brighter street is not a promise of safety, and Leerie does not predict crime.
          </p>
        </section>
      </main>

      <footer className="ld-footer">
        <span className="lr-wordmark"><span className="lr-lamp" aria-hidden /><span>Leerie</span></span>
        <p>
          Built at HackTheBurgh XIII ·{" "}
          <a href="https://github.com/heechan02/Leerie" target="_blank" rel="noreferrer">Source on GitHub</a>
        </p>
        <p>
          Street data © OpenStreetMap contributors · Lamp posts: City of Edinburgh Council · Opening image generated with Higgsfield
        </p>
      </footer>
    </div>
  );
}
