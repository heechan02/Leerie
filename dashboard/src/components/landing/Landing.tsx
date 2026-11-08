// The landing page: why darkness matters, how Leerie measures it, and what one night found.
import Link from "next/link";
import { Hero } from "./Hero";
import { LiveNumbers } from "./LiveNumbers";
import "./landing.css";

const ONS = "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/bulletins/perceptionsofpersonalsafetyandexperiencesofharassmentgreatbritain/2to27june2021";
const STATS = [
  { value: "1 in 2", text: "women feel unsafe walking alone after dark on a quiet street near their home. For men it is 1 in 7.",
    source: "ONS, Great Britain, 2021", href: ONS },
  { value: "4 in 5", text: "women feel unsafe walking alone after dark in a park or other open space. For men it is 2 in 5.",
    source: "ONS, Great Britain, 2021", href: ONS },
  { value: "35%", text: "of women in Scotland do not feel safe walking alone in their own area after dark, against 10% of men.",
    source: "Scottish Crime and Justice Survey 2019/20",
    href: "https://www.gov.scot/publications/scottish-crime-justice-survey-2019-20-main-findings/pages/35/" },
  { value: "71%", text: "of women in the UK have experienced sexual harassment in a public space.",
    source: "UN Women UK / YouGov, 2021",
    href: "https://www.unwomenuk.org/site/wp-content/uploads/2021/03/APPG-UN-Women-Sexual-Harassment-Report_Updated.pdf" },
];

const STEPS = [
  { n: "01", title: "Walk", text: "Open the app, point the camera ahead and walk. Leerie undoes auto-exposure with the camera's own shutter speed, ISO and aperture, the method the phyphox lab app uses, and uploads one reading a second with its GPS point. Comfortable and Uncomfortable buttons record how a street feels." },
  { n: "02", title: "Map", text: "Readings are matched to OpenStreetMap streets and compared in stops: +1 is twice the light of the median street. Streets nobody walked are predicted from measured neighbours, drawn faded, and given a range rather than a single number." },
  { n: "03", title: "Decide", text: "A council officer draws a box and types a budget and a cost per lamp. Leerie picks the streets that gain most per pound, writes a works order for contractors, lists where one more walk would change the plan, and flags streets that have lamps but still measure dark." },
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
          <a href="#night">Last night</a>
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
              Light is one thing a council can change. In a randomised trial in New York City public housing,
              extra street lighting cut night-time outdoor crime by at least 36%.
            </p>
            <p className="secondary">
              But nobody measures how much light reaches the pavement. Councils know where their lamps are,
              not whether a dead lantern, a tree or a long gap between posts has left a stretch in the dark.{" "}
              <a className="ld-source" href="https://econpapers.repec.org/RePEc:nbr:nberwo:25798" target="_blank" rel="noreferrer">Chalfin et al., NBER</a>
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

        <section id="night" className="ld-section">
          <p className="micro ld-eyebrow">Last night · 7 to 8 November 2026</p>
          <h2 className="display ld-h2">One night between George Square and King&apos;s Buildings.</h2>
          <LiveNumbers />
          <Link className="lr-button" href="/map">Explore the map</Link>
        </section>

        <section className="ld-section ld-poem">
          <blockquote className="display">
            &ldquo;O Leerie, I&apos;ll go round at night and light the lamps with you!&rdquo;
          </blockquote>
          <p className="secondary">
            Robert Louis Stevenson, <i>The Lamplighter</i>, 1885. Leerie was the man who lit Edinburgh&apos;s gas lamps each evening.
            Nobody walks the streets checking the light any more. So we did.
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
          Street data © OpenStreetMap contributors · Lamp posts: City of Edinburgh Council · Photo: Marco Trassini on Unsplash
        </p>
      </footer>
    </div>
  );
}
