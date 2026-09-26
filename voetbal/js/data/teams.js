// Selectable teams: star XIs per nation plus a "Wereldsterren" all-star side.
// These are the game's own dream line-ups, not official squads.

import { PLAYER_BY_ID, PLAYERS } from './players.js';
import { FORMATIONS, positionPenalty } from './formations.js';
import { KITS, NATION_NAMES } from './nations.js';
import { slug } from '../util.js';

const XI = {
  FRA: ['4-3-3', 'Mike Maignan', 'Theo Hernández', 'Dayot Upamecano', 'William Saliba', 'Jules Koundé', 'Adrien Rabiot', 'Aurélien Tchouaméni', 'Manu Koné', 'Kylian Mbappé', 'Ousmane Dembélé', 'Michael Olise'],
  ESP: ['4-3-3', 'Unai Simón', 'Marc Cucurella', 'Dean Huijsen', 'Pau Cubarsí', 'Pedro Porro', 'Pedri', 'Rodri', 'Fabián Ruiz', 'Nico Williams', 'Mikel Oyarzabal', 'Lamine Yamal'],
  ENG: ['4-3-3', 'Jordan Pickford', 'Myles Lewis-Skelly', 'Marc Guéhi', 'John Stones', 'Trent Alexander-Arnold', 'Jude Bellingham', 'Declan Rice', 'Cole Palmer', 'Phil Foden', 'Harry Kane', 'Bukayo Saka'],
  BRA: ['4-3-3', 'Alisson', 'Guilherme Arana', 'Gabriel Magalhães', 'Marquinhos', 'Vanderson', 'Lucas Paquetá', 'Casemiro', 'Bruno Guimarães', 'Vinícius Júnior', 'Rodrygo', 'Raphinha'],
  ARG: ['4-3-3', 'Emiliano Martínez', 'Nicolás Tagliafico', 'Lisandro Martínez', 'Cristian Romero', 'Nahuel Molina', 'Alexis Mac Allister', 'Enzo Fernández', 'Rodrigo De Paul', 'Julián Álvarez', 'Lautaro Martínez', 'Lionel Messi'],
  POR: ['4-3-3', 'Diogo Costa', 'Nuno Mendes', 'Gonçalo Inácio', 'Rúben Dias', 'João Cancelo', 'Vitinha', 'João Neves', 'Bruno Fernandes', 'Rafael Leão', 'Cristiano Ronaldo', 'Bernardo Silva'],
  GER: ['4-2-3-1', 'Marc-André ter Stegen', 'David Raum', 'Jonathan Tah', 'Antonio Rüdiger', 'Joshua Kimmich', 'Aleksandar Pavlović', 'Leon Goretzka', 'Florian Wirtz', 'Jamal Musiala', 'Leroy Sané', 'Kai Havertz'],
  NED: ['4-3-3', 'Bart Verbruggen', 'Nathan Aké', 'Micky van de Ven', 'Virgil van Dijk', 'Denzel Dumfries', 'Tijjani Reijnders', 'Ryan Gravenberch', 'Frenkie de Jong', 'Cody Gakpo', 'Memphis Depay', 'Xavi Simons'],
  BEL: ['4-3-3', 'Thibaut Courtois', 'Maxim De Cuyper', 'Arthur Theate', 'Zeno Debast', 'Timothy Castagne', 'Youri Tielemans', 'Amadou Onana', 'Kevin De Bruyne', 'Leandro Trossard', 'Romelu Lukaku', 'Jérémy Doku'],
  ITA: ['3-5-2', 'Gianluigi Donnarumma', 'Alessandro Bastoni', 'Alessandro Buongiorno', 'Giovanni Di Lorenzo', 'Federico Dimarco', 'Nicolò Barella', 'Sandro Tonali', 'Davide Frattesi', 'Matteo Politano', 'Mateo Retegui', 'Moise Kean'],
  URU: ['4-3-3', 'Sergio Rochet', 'Mathías Olivera', 'José María Giménez', 'Ronald Araújo', 'Nahitan Nández', 'Rodrigo Bentancur', 'Manuel Ugarte', 'Federico Valverde', 'Maximiliano Araújo', 'Darwin Núñez', 'Giorgian de Arrascaeta'],
  WLD: ['4-3-3', 'Jan Oblak', 'Alphonso Davies', 'Joško Gvardiol', 'Kim Min-jae', 'Achraf Hakimi', 'Martin Ødegaard', 'Moisés Caicedo', 'Scott McTominay', 'Khvicha Kvaratskhelia', 'Erling Haaland', 'Mohamed Salah'],
};

export const TEAM_ORDER = ['FRA', 'ESP', 'ENG', 'BRA', 'ARG', 'POR', 'GER', 'NED', 'BEL', 'ITA', 'URU', 'WLD'];

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
