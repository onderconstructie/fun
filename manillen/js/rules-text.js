// Manillen: the rules screen, in plain words with small examples.

import { mini, suitIcon } from './cards.js';

const row = (...cs) => `<span class="mini-row">${cs.map(mini).join('')}</span>`;

const VARIANTS = [
  { key: 'zonderDubbel', title: 'Zonder troef telt dubbel', text: 'Kiest de deler zonder troef, dan tellen de punten van die ronde twee keer.' },
  { key: 'meegaan', title: 'Meegaan en terug', text: 'De tegenpartij mag meegaan (dubbel), daarna mag het team van de deler terug (nog eens dubbel).' },
  { key: 'hogerPlicht', title: 'Hoger gaan of kopen', text: 'Heeft de tegenpartij de slag, dan moet je die slag afpakken als je dat kunt.' },
  { key: 'partnerVrij', title: 'Vrij als je partner de slag heeft', text: 'Dan hoef je niet hoger te gaan en niet te kopen. Uit: je moet altijd proberen hoger te gaan.', four: true },
  { key: 'nietOndertroeven', title: 'Niet ondertroeven', text: 'Ligt er al een hogere troef, dan mag je geen lagere troef leggen als je nog iets anders hebt.' },
  { key: 'gelijkDubbel', title: 'Gelijk: volgende ronde dubbel', text: 'Bij 30 tegen 30 scoort niemand. De ronde daarna telt dubbel.' },
  { key: 'alleSlagenDubbel', title: 'Alle slagen telt dubbel', text: 'Haalt één team elke slag, dan krijgt het dubbel.' },
  { key: 'doorgeven', title: 'Troefkeuze doorgeven', text: 'De deler mag zijn partner laten kiezen. Die moet dan wel kiezen.', four: true },
  { key: 'blind', title: 'Blind zonder troef', text: 'De deler mag zonder troef kiezen voor hij zijn kaarten bekijkt. Dat telt vier keer.' },
  { key: 'maxVier', title: 'Hoogstens vier keer', text: 'Een ronde telt nooit meer dan vier keer de punten, hoeveel er ook verdubbeld wordt.' },
];
export { VARIANTS };

export function rulesHTML() {
  return `
  <article class="help-item" id="r-doel"><i class="dot">1</i><div>
    <b>Het doel</b>
    <p>Je speelt met vier, in twee teams van twee. Je partner zit tegenover je. Je wint geen punten voor het aantal slagen, maar voor de kaarten in je slagen. Het team dat eerst <b>101 punten</b> haalt, wint het spel.</p>
  </div></article>

  <article class="help-item" id="r-kaarten"><i class="dot">2</i><div>
    <b>De kaarten en hun punten</b>
    <p>Er zijn 32 kaarten: van de 7 tot de aas, in vier kleuren. De <b>10 heet de manille</b> en is de hoogste kaart van zijn kleur. Daarna komen aas, heer, vrouw en boer. De 9, 8 en 7 zijn het laagst.</p>
    <table class="pts">
      <tr><td>${mini('h10')}</td><td>manille</td><td><b>5</b></td></tr>
      <tr><td>${mini('hA')}</td><td>aas</td><td><b>4</b></td></tr>
      <tr><td>${mini('hH')}</td><td>heer</td><td><b>3</b></td></tr>
      <tr><td>${mini('hV')}</td><td>vrouw</td><td><b>2</b></td></tr>
      <tr><td>${mini('hB')}</td><td>boer</td><td><b>1</b></td></tr>
      <tr><td>${row('h9', 'h8', 'h7')}</td><td>9, 8, 7</td><td><b>0</b></td></tr>
    </table>
    <p>Per kleur zijn er 15 punten. Samen zitten er dus <b>60 punten</b> in elke ronde.</p>
  </div></article>

  <article class="help-item"><i class="dot">3</i><div>
    <b>Delen</b>
    <p>Iedereen krijgt 8 kaarten: eerst 3, dan 2, dan weer 3. Na elke ronde schuift de deler een plaats op.</p>
  </div></article>

  <article class="help-item" id="r-troef"><i class="dot">4</i><div>
    <b>Troef kiezen</b>
    <p>De deler bekijkt zijn kaarten en kiest welke kleur <b>troef</b> is. Een troef wint van elke kaart van een andere kleur. Hij mag ook <b>zonder troef</b> kiezen. Dan telt de ronde dubbel.</p>
    <p>Tip: kies de kleur waarvan je veel en hoge kaarten hebt. Zonder troef is goed als je meerdere manilles hebt, liefst met de aas erbij.</p>
    <p>Zijn partner kijkt pas naar zijn kaarten als de troef gekozen is.</p>
  </div></article>

  <article class="help-item" id="r-mee"><i class="dot">5</i><div>
    <b>Meegaan en terug</b>
    <p>Denkt iemand van de tegenpartij dat zijn team toch meer dan 30 punten haalt? Dan mag hij <b>meegaan</b>. De ronde telt dan dubbel.</p>
    <p>Gaat de tegenpartij mee, dan mag de deler of zijn partner <b>terug</b> zeggen. Dan telt het nog eens dubbel, dus vier keer.</p>
    <p>Dat gebeurt allemaal voor de eerste kaart op tafel komt.</p>
  </div></article>

  <article class="help-item" id="r-spelen"><i class="dot">6</i><div>
    <b>Spelen</b>
    <p>De speler links van de deler legt de eerste kaart. Daarna speelt iedereen om de beurt, met de klok mee. De hoogste kaart van de gevraagde kleur wint de slag, tenzij er troef ligt: dan wint de hoogste troef. Wie de slag wint, begint de volgende.</p>
    <p class="rule"><b>Kleur bekennen.</b> Heb je de gevraagde kleur, dan moet je die spelen.</p>
    <p class="rule"><b>Hoger gaan.</b> Heeft de tegenpartij de slag, dan moet je hoger spelen als je kunt.</p>
    <div class="ex">${row('kH')} <span>ligt van de tegenpartij. Jij hebt</span> ${row('kA', 'k8')} <span>Je moet de aas spelen.</span></div>
    <p class="rule"><b>Kopen.</b> Heb je de gevraagde kleur niet en heeft de tegenpartij de slag? Dan moet je troef spelen. Ligt er al troef, dan moet je hoger troeven als je kunt.</p>
    <p class="rule"><b>Partner heeft de slag.</b> Dan hoef je niet hoger te gaan of te kopen. Je mag gewoon bijleggen, bijvoorbeeld een kaart met veel punten.</p>
    <p class="rule"><b>Niet ondertroeven.</b> Ligt er een hoge troef en kun je er niet over? Speel dan een andere kleur als je die hebt.</p>
    <p class="hint">Op het scherm lichten de kaarten op die mogen. Onder de tafel staat wat je moet doen, bijvoorbeeld bekennen of kopen. Tik je op een grijze kaart, dan zie je waarom die niet mag. Twijfel je? Tik op Tip.</p>
  </div></article>

  <article class="help-item" id="r-tellen"><i class="dot">7</i><div>
    <b>Punten tellen</b>
    <p>Na 8 slagen telt elk team de punten in zijn slagen. Het team met meer dan 30 krijgt <b>wat boven de 30 zit</b>. Het andere team krijgt niets.</p>
    <div class="ex"><span>Wij halen 37, zij 23. Wij krijgen <b>7</b>. Was het zonder troef? Dan <b>14</b>. En ging de tegenpartij mee? Dan <b>28</b>.</span></div>
    <p>Is het 30 tegen 30, dan krijgt niemand iets en telt de volgende ronde dubbel. Haalt één team alle slagen, dan telt dat ook dubbel.</p>
  </div></article>

  <article class="help-item"><i class="dot">8</i><div>
    <b>Het einde</b>
    <p>Wie eerst 101 haalt, wint. Je kunt dat doel aanpassen bij de varianten.</p>
  </div></article>

  <article class="help-item" id="r-twee"><i class="dot">9</i><div>
    <b>Met twee spelers</b>
    <p>Elk krijgt 16 kaarten: 8 in de hand en 8 op tafel. Op tafel liggen vier stapeltjes van twee: een gesloten kaart met een open kaart erop.</p>
    <p>Je speelt uit je hand of een open kaart van je eigen stapeltjes. Speel je een open kaart, dan draait de kaart eronder om. Alle regels hierboven blijven gelden: ook de open kaarten tellen mee bij kleur bekennen en hoger gaan.</p>
    <p>Een slag heeft nu twee kaarten. Er zijn dus 16 slagen. De deler kiest troef nadat hij zijn hand en alle open kaarten gezien heeft. De ander begint. Meegaan mag ook, en de deler mag dan terug.</p>
  </div></article>

  <article class="help-item var-item" id="r-var"><i class="dot star">${suitIcon('k')}</i><div>
    <b>Varianten</b>
    <p>Aan elke tafel spelen ze het net iets anders. Hier stel je het zelf in. Standaard staan de klassieke regels aan. Je keuze geldt vanaf je volgende spel.</p>
    <div id="var-box"></div>
  </div></article>
  `;
}
