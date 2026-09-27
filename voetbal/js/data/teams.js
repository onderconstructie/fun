// Selectable teams: the national XIs of the game's fictional nations plus a
// "Wereldsterren" all-star side drawn from the smaller nations.

import { PLAYER_BY_ID, PLAYERS } from './players.js';
import { FORMATIONS, positionPenalty } from './formations.js';
import { KITS, NATION_NAMES } from './nations.js';
import { slug } from '../util.js';

const XI = {
  ALD: ['4-3-3', 'Eneko Arnedo', 'Ignacio Montaraz', 'Javier Quintanar', 'Raúl Aizpurua', 'Julen Toledano', 'Iker Valderrey', 'Lucas Montesinos', 'Sergio Navalón', 'Aitor Labaka', 'Nicolás Echevarne', 'Martín Carrasquilla'],
  BRV: ['4-3-3', 'Samir Benhamou', 'Ayo Ekwueme', 'Lucas Coly', 'Clément Morvaix', 'Sacha Gauvreau', 'Florian Tanguy', 'Tunde Ibekwe', 'Sékou Sambou', 'Julien Dufresnoy', 'Loïc Lemarchal', 'Théo Brisard'],
  CVR: ['4-3-3', 'Emerson Cordeiro', 'Ruan Medeiros', 'Kauã Esteves', 'Caio Mourato', 'Martim Monteverde', 'Wellington Valadares', 'Diogo Quintela', 'Rui Seixas', 'Gustavo Silveira', 'Nuno Espinheira', 'Renan Carrilho'],
  DMR: ['4-3-3', 'Aidan Hallworth', 'Tom Coverdale', 'Joe Moloney', 'Julian Duncombe', 'Tatenda Shongwe', 'Neo Phiri', 'Ethan Bramall', 'Ryan Brackley', 'Leon Brissett', 'Charlie Ashworth-Lyle', 'Oliver Rafferty'],
  ESR: ['3-5-2', 'Davide Orlandini', 'Tommaso Lanzarini', 'Cristian Amrani', 'Filippo Vescovi', 'Giulio Cavallari', 'Lorenzo Rocchegiani', 'Simone Valsecchi', 'Fabio Tessaro', 'Marco Sartorello', 'Giacomo Morandini', 'Jacopo Venturelli'],
  GAV: ['4-2-3-1', 'Jonas Wiesinger', 'Tobias Uhlmann', 'Fabian Lechner', 'Raphael Ortmann', 'Vedran Stipetić', 'Dominik Kühnert', 'Marvin Nussbaumer', 'Benedikt Birkenfeld', 'Niklas Özbayrak', 'Valentin Kranzbühler', 'Walid Zeroual'],
  HLS: ['4-3-3', 'Kunle Egbuna', 'Robbe Snoeck', 'Nassim Kettani', 'Tibo Hoogendijk', 'Luuk Nijland', 'Tijn Hettema', 'Brecht Hofstede', 'Pieter Bakkeren', 'Yaw Sarpong', 'Ruben Vermeersch', 'Jesse Veldkamp'],
  KDV: ['4-4-2', 'Lazar Vidaković', 'Hrvoje Jelinić', 'Eren Karaduman', 'Aleksa Nedeljković', 'Nemanja Zrnić', 'Zoran Marinković', 'Ante Sertić', 'Luka Hodak', 'Ognjen Radojković', 'Petar Radović', 'Damir Tomičić'],
  MRD: ['4-3-3', 'Samba Soumah', 'Mehdi Sebti', 'Uchenna Osagie', 'Fodé Samassa', 'Yaw Agyemang', 'Aliou Mbaye', 'Alassane Dembaga', 'Amine Naciri', 'Bakary Niakaté', 'Kwadwo Osei-Bonsu', 'Mamadou Kébé'],
  NRV: ['4-4-2', 'Elias Dahlgren', 'Jonas Rosseland', 'Haakon Haugland', 'Sigurd Lindqvist', 'Torstein Forsell', 'Kwaku Asiedu', 'Aksel Lindahl', 'Nils Voll', 'Mikkel Tjelle', 'Ognjen Hrnjak', 'Sander Mavuso'],
  TAV: ['4-3-3', 'Valentín Arrúa', 'Julián Lencina', 'Joaquín Sciarra', 'Federico Urquiola', 'Nicolás Aguerreberry', 'Tomás Techera', 'Ignacio Lamas', 'Emiliano Doldán', 'Ezequiel Rearte', 'Lisandro Nieto', 'Agustín Bottinelli'],
  WLD: ['4-3-3', 'Mehdi Bensaïd', 'Rashawn Whyte', 'Tuomas Rautiainen', 'Kudzai Mthethwa', 'Mikko Tiainen', 'Selim Ulusoy', 'Kagiso Mudau', 'Marius Bălănescu', 'Riku Nishimori', 'Jairo Blackstock', 'Khalid Fekkak'],
};

export const TEAM_ORDER = ['ALD', 'BRV', 'CVR', 'DMR', 'ESR', 'GAV', 'HLS', 'KDV', 'MRD', 'NRV', 'TAV', 'WLD'];

function lookup(name) {
  const p = PLAYER_BY_ID[slug(name)];
  if (!p) throw new Error('Unknown player in XI: ' + name);
  return p;
}

export function teamOvr(lineup, formation) {
  const slots = FORMATIONS[formation];
  let sum = 0;
  lineup.forEach((p, i) => {
    sum += Math.max(1, p.ovr - positionPenalty(p.pos, p.alt, slots[i].pos));
  });
  return Math.round(sum / lineup.length);
}

export function nationTeam(code) {
  const [formation, ...names] = XI[code];
  const lineup = names.map(lookup);
  const nationPlayers = code === 'WLD' ? [] : PLAYERS.filter((p) => p.nation === code && !p.legend);
  return {
    id: code,
    name: NATION_NAMES[code],
    short: code === 'WLD' ? 'WLD' : code,
    flag: code,
    kits: KITS[code],
    formation,
    lineup,
    bench: nationPlayers.filter((p) => !lineup.includes(p)),
    ovr: teamOvr(lineup, formation),
  };
}

export const NATION_TEAMS = TEAM_ORDER.map(nationTeam);

// The player's own club ("Mijn Elf") is built from their collection.
export function customTeam(name, formation, lineup, kits = KITS.ELF) {
  return {
    id: 'ELF',
    name,
    short: 'ELF',
    flag: 'ELF',
    kits,
    formation,
    lineup,
    bench: [],
    ovr: teamOvr(lineup, formation),
  };
}
