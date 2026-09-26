// Player database.
//
// Names, nationalities and positions are real; the ratings are this game's own
// estimates (not taken from any licensed game). No clubs are listed on purpose:
// clubs change every transfer window, nationality does not.
//
// Row format:  Full name | Short name | Nation | Pos[/alt] | OVR | six stats
// Outfield stats: PAC SHO PAS DRI DEF PHY
// Goalkeeper stats: DIV HAN KIC REF SPD POS

import { slug } from '../util.js';

const CURRENT = `
Kylian Mbappé|Mbappé|FRA|ST/LW|91|97 90 80 92 36 78
Ousmane Dembélé|Dembélé|FRA|ST/RW|90|92 87 85 92 42 66
Michael Olise|Olise|FRA|RW/CAM|88|84 84 87 90 38 64
Désiré Doué|Doué|FRA|RW/LW|86|86 81 82 89 44 66
Bradley Barcola|Barcola|FRA|LW|84|92 80 76 85 36 68
Marcus Thuram|M. Thuram|FRA|ST|84|86 83 73 80 38 85
Hugo Ekitiké|Ekitiké|FRA|ST|84|86 82 74 84 30 76
Rayan Cherki|Cherki|FRA|CAM|83|80 80 85 88 32 62
Aurélien Tchouaméni|Tchouaméni|FRA|CDM|85|72 70 79 77 84 86
Adrien Rabiot|Rabiot|FRA|CM|83|72 77 79 79 77 84
Manu Koné|Koné|FRA|CM|82|77 68 77 82 77 80
Eduardo Camavinga|Camavinga|FRA|CM|83|80 67 79 84 79 79
Warren Zaïre-Emery|Zaïre-Emery|FRA|CM|81|76 70 79 81 74 76
William Saliba|Saliba|FRA|CB|88|80 40 72 75 89 84
Dayot Upamecano|Upamecano|FRA|CB|84|82 40 66 70 85 86
Ibrahima Konaté|Konaté|FRA|CB|84|80 35 60 64 85 88
Jules Koundé|Koundé|FRA|RB/CB|85|84 50 74 78 84 76
Theo Hernández|T. Hernández|FRA|LB|85|90 72 77 80 78 83
Malo Gusto|Gusto|FRA|RB|81|85 58 74 79 77 72
Mike Maignan|Maignan|FRA|GK|87|87 83 88 88 55 84
Lucas Chevalier|Chevalier|FRA|GK|82|83 78 80 85 52 80

Lamine Yamal|Lamine Yamal|ESP|RW|90|88 83 88 94 30 60
Pedri|Pedri|ESP|CM|89|76 75 90 91 70 68
Rodri|Rodri|ESP|CDM|88|64 78 88 84 87 85
Nico Williams|Nico Williams|ESP|LW|86|93 78 79 88 35 66
Dani Olmo|Dani Olmo|ESP|CAM|85|78 82 85 87 50 68
Fabián Ruiz|Fabián Ruiz|ESP|CM|85|67 80 86 85 72 74
Martín Zubimendi|Zubimendi|ESP|CDM|85|66 68 84 80 84 78
Mikel Merino|Merino|ESP|CM|83|68 78 80 79 78 84
Álex Baena|Baena|ESP|CAM/LW|84|78 79 86 85 50 66
Fermín López|Fermín|ESP|CAM|83|80 80 79 83 60 74
Gavi|Gavi|ESP|CM|82|78 70 81 85 70 74
Mikel Oyarzabal|Oyarzabal|ESP|ST|84|76 84 80 82 42 74
Pau Cubarsí|Cubarsí|ESP|CB|85|72 38 80 72 85 76
Dean Huijsen|Huijsen|ESP|CB|84|76 45 80 74 83 80
Aymeric Laporte|Laporte|ESP|CB|82|60 50 78 72 83 80
Marc Cucurella|Cucurella|ESP|LB|84|82 55 75 79 81 78
Alejandro Grimaldo|Grimaldo|ESP|LB|85|83 76 86 84 72 68
Pedro Porro|Porro|ESP|RB|84|85 70 82 80 76 72
Dani Carvajal|Carvajal|ESP|RB|83|74 62 78 79 83 79
Unai Simón|Unai Simón|ESP|GK|86|85 81 84 87 52 84
David Raya|Raya|ESP|GK|87|86 83 88 88 55 85

Harry Kane|Kane|ENG|ST|90|68 93 85 83 48 83
Jude Bellingham|Bellingham|ENG|CAM/CM|89|80 85 84 89 76 84
Bukayo Saka|Saka|ENG|RW|88|86 83 84 88 60 70
Declan Rice|Rice|ENG|CM/CDM|88|74 76 84 82 86 86
Cole Palmer|Palmer|ENG|CAM/RW|87|76 86 86 87 50 68
Phil Foden|Foden|ENG|CAM/LW|86|81 84 85 89 55 60
Trent Alexander-Arnold|Alexander-Arnold|ENG|RB|86|76 72 91 82 76 72
Reece James|Reece James|ENG|RB|84|78 73 83 80 81 80
John Stones|Stones|ENG|CB|83|68 50 80 76 84 78
Marc Guéhi|Guéhi|ENG|CB|84|74 40 70 70 85 80
Levi Colwill|Colwill|ENG|CB|82|76 40 74 72 82 78
Ezri Konsa|Konsa|ENG|CB|82|80 40 66 70 82 80
Myles Lewis-Skelly|Lewis-Skelly|ENG|LB|80|80 55 76 80 76 72
Anthony Gordon|Gordon|ENG|LW|84|90 78 78 84 45 72
Eberechi Eze|Eze|ENG|CAM/LW|84|82 81 81 88 40 68
Morgan Rogers|Rogers|ENG|CAM|83|82 76 78 84 50 80
Elliot Anderson|Anderson|ENG|CM|83|75 70 80 82 78 80
Kobbie Mainoo|Mainoo|ENG|CM|80|72 68 79 83 74 76
Adam Wharton|Wharton|ENG|CM|81|68 66 84 80 74 70
Ollie Watkins|Watkins|ENG|ST|83|84 83 74 80 42 80
Jarrod Bowen|Bowen|ENG|RW|83|86 80 78 82 45 74
Jordan Pickford|Pickford|ENG|GK|85|85 79 90 86 55 82

Vinícius Júnior|Vinícius Jr.|BRA|LW|89|95 84 81 91 30 68
Raphinha|Raphinha|BRA|LW/RW|89|90 86 84 88 50 72
Rodrygo|Rodrygo|BRA|RW/ST|84|88 81 78 86 32 64
Estêvão|Estêvão|BRA|RW|83|86 78 78 87 30 60
Gabriel Martinelli|Martinelli|BRA|LW|83|89 79 76 83 45 70
Matheus Cunha|Cunha|BRA|ST/CAM|84|80 82 79 85 40 78
João Pedro|João Pedro|BRA|ST|83|82 81 76 84 40 76
Neymar Jr|Neymar Jr.|BRA|CAM/LW|82|76 80 85 89 30 60
Bruno Guimarães|Bruno G.|BRA|CM|86|70 76 85 84 80 80
Casemiro|Casemiro|BRA|CDM|82|55 74 76 72 83 84
Lucas Paquetá|Paquetá|BRA|CAM|82|70 76 81 84 65 76
Marquinhos|Marquinhos|BRA|CB|86|76 52 76 74 87 80
Gabriel Magalhães|Gabriel|BRA|CB|87|75 55 68 68 88 87
Éder Militão|Militão|BRA|CB|84|83 55 68 70 84 84
Gleison Bremer|Bremer|BRA|CB|84|80 40 60 64 86 86
Vanderson|Vanderson|BRA|RB|80|83 55 72 77 76 76
Guilherme Arana|Arana|BRA|LB|79|82 60 76 78 74 72
Alisson|Alisson|BRA|GK|89|86 85 85 89 56 89
Ederson|Ederson|BRA|GK|84|82 80 93 84 64 83

Lionel Messi|Messi|ARG|RW/CAM|86|72 86 90 91 33 62
Lautaro Martínez|Lautaro|ARG|ST|88|80 88 76 85 50 83
Julián Álvarez|Julián Álvarez|ARG|ST|87|83 85 80 85 60 76
Alexis Mac Allister|Mac Allister|ARG|CM|87|72 80 86 85 80 78
Enzo Fernández|Enzo Fernández|ARG|CM|85|72 76 85 83 76 78
Rodrigo De Paul|De Paul|ARG|CM|83|72 75 82 82 74 80
Alejandro Garnacho|Garnacho|ARG|LW|82|90 78 72 84 35 68
Nico Paz|Nico Paz|ARG|CAM|82|72 80 83 85 45 70
Franco Mastantuono|Mastantuono|ARG|RW/CAM|80|80 78 80 84 35 62
Exequiel Palacios|Palacios|ARG|CM|81|72 72 80 82 76 72
Leandro Paredes|Paredes|ARG|CDM|80|55 74 84 78 76 74
Cristian Romero|Romero|ARG|CB|86|72 50 67 70 87 85
Lisandro Martínez|Lisandro|ARG|CB|83|72 45 76 74 84 80
Nicolás Otamendi|Otamendi|ARG|CB|80|58 50 70 66 82 80
Nahuel Molina|Molina|ARG|RB|81|83 65 75 78 76 72
Nicolás Tagliafico|Tagliafico|ARG|LB|80|74 55 72 74 78 76
Emiliano Martínez|Emi Martínez|ARG|GK|87|86 83 80 88 50 85

Cristiano Ronaldo|Ronaldo|POR|ST|84|76 88 74 79 34 76
Bruno Fernandes|Bruno Fernandes|POR|CAM|87|72 85 89 83 68 76
Bernardo Silva|Bernardo Silva|POR|CAM/RW|86|76 77 86 89 64 68
Vitinha|Vitinha|POR|CM|88|74 76 89 89 76 70
João Neves|João Neves|POR|CM|86|80 70 83 86 80 76
Rafael Leão|Leão|POR|LW|85|93 80 76 87 30 78
Pedro Neto|Pedro Neto|POR|RW|83|90 76 79 85 45 66
Francisco Trincão|Trincão|POR|RW|82|82 80 80 85 40 64
Francisco Conceição|F. Conceição|POR|RW|81|86 74 76 85 38 60
Gonçalo Ramos|Gonçalo Ramos|POR|ST|81|78 82 70 78 40 80
Rúben Neves|Rúben Neves|POR|CDM|81|58 76 84 78 76 74
Nuno Mendes|Nuno Mendes|POR|LB|87|92 65 78 84 82 80
Rúben Dias|Rúben Dias|POR|CB|87|64 40 72 70 88 86
Gonçalo Inácio|Inácio|POR|CB|83|70 50 76 72 83 78
António Silva|António Silva|POR|CB|81|72 40 70 68 81 80
João Cancelo|Cancelo|POR|RB/LB|84|80 70 84 85 76 70
Diogo Dalot|Dalot|POR|RB|81|82 62 76 78 77 76
Diogo Costa|Diogo Costa|POR|GK|86|86 81 85 87 56 84

Jamal Musiala|Musiala|GER|CAM|88|82 82 83 92 60 64
Florian Wirtz|Wirtz|GER|CAM|88|80 83 88 90 55 64
Joshua Kimmich|Kimmich|GER|CDM/RB|87|70 74 89 83 82 76
Antonio Rüdiger|Rüdiger|GER|CB|86|80 50 70 66 86 87
Jonathan Tah|Tah|GER|CB|85|72 40 72 66 86 84
Nico Schlotterbeck|Schlotterbeck|GER|CB|83|76 50 76 70 83 80
David Raum|Raum|GER|LB|82|82 65 81 78 76 72
Maximilian Mittelstädt|Mittelstädt|GER|LB|80|78 62 76 76 76 72
Aleksandar Pavlović|Pavlović|GER|CDM|83|66 66 83 81 80 76
Leon Goretzka|Goretzka|GER|CM|82|72 78 78 78 78 86
Felix Nmecha|Nmecha|GER|CM|81|74 74 78 82 74 78
Robert Andrich|Andrich|GER|CDM|80|64 72 76 74 80 84
Kai Havertz|Havertz|GER|ST/CAM|84|76 81 80 82 60 80
Leroy Sané|Sané|GER|RW|84|88 80 80 86 38 68
Serge Gnabry|Gnabry|GER|RW|82|84 80 76 83 42 70
Karim Adeyemi|Adeyemi|GER|LW/RW|81|93 76 72 81 36 66
Nick Woltemade|Woltemade|GER|ST|82|72 80 76 84 40 78
Marc-André ter Stegen|Ter Stegen|GER|GK|86|85 84 88 86 52 86
Manuel Neuer|Neuer|GER|GK|84|83 84 88 84 55 88

Virgil van Dijk|Van Dijk|NED|CB|89|78 60 76 72 90 88
Frenkie de Jong|De Jong|NED|CM|86|78 70 87 88 77 75
Tijjani Reijnders|Reijnders|NED|CM|86|76 81 84 85 70 76
Ryan Gravenberch|Gravenberch|NED|CM/CDM|86|76 70 81 85 82 81
Cody Gakpo|Gakpo|NED|LW|85|82 84 80 84 45 78
Xavi Simons|Xavi Simons|NED|CAM/LW|84|84 79 82 87 50 66
Jeremie Frimpong|Frimpong|NED|RB|84|94 70 76 83 72 66
Denzel Dumfries|Dumfries|NED|RB|84|86 72 74 76 78 84
Micky van de Ven|Van de Ven|NED|CB|85|93 40 70 72 84 80
Matthijs de Ligt|De Ligt|NED|CB|83|68 50 70 68 84 86
Nathan Aké|Aké|NED|CB/LB|82|72 50 76 74 83 76
Jurriën Timber|Timber|NED|RB/CB|84|82 55 76 80 83 76
Jan Paul van Hecke|Van Hecke|NED|CB|81|74 40 72 68 82 80
Teun Koopmeiners|Koopmeiners|NED|CM|82|68 80 82 78 72 80
Justin Kluivert|Kluivert|NED|CAM/LW|81|82 78 78 83 40 66
Memphis Depay|Depay|NED|ST|81|78 82 80 84 30 76
Donyell Malen|Malen|NED|RW/ST|81|88 79 72 81 35 68
Joshua Zirkzee|Zirkzee|NED|ST|79|66 76 78 82 40 76
Bart Verbruggen|Verbruggen|NED|GK|82|82 78 84 84 55 79

Thibaut Courtois|Courtois|BEL|GK|89|87 86 76 89 48 89
Kevin De Bruyne|De Bruyne|BEL|CAM|87|66 85 93 85 60 74
Jérémy Doku|Doku|BEL|LW/RW|84|95 70 76 90 30 66
Leandro Trossard|Trossard|BEL|LW|83|80 81 81 85 40 66
Youri Tielemans|Tielemans|BEL|CM|83|64 78 85 81 70 72
Amadou Onana|Onana|BEL|CDM|82|72 66 75 76 81 88
Charles De Ketelaere|De Ketelaere|BEL|CAM/ST|83|78 80 82 84 45 72
Romelu Lukaku|Lukaku|BEL|ST|82|76 84 74 76 35 88
Loïs Openda|Openda|BEL|ST|82|93 81 68 79 30 72
Johan Bakayoko|Bakayoko|BEL|RW|80|86 74 76 84 34 64
Alexis Saelemaekers|Saelemaekers|BEL|RW/RB|80|82 72 77 80 66 72
Malick Fofana|Fofana|BEL|LW|80|90 74 72 83 35 62
Hans Vanaken|Vanaken|BEL|CAM|80|58 78 84 80 60 74
Arthur Vermeeren|Vermeeren|BEL|CM|79|70 64 78 80 74 70
Arthur Theate|Theate|BEL|CB/LB|80|76 50 70 70 80 80
Zeno Debast|Debast|BEL|CB|79|72 45 74 70 79 76
Wout Faes|Faes|BEL|CB|78|70 40 64 62 79 80
Timothy Castagne|Castagne|BEL|RB|79|78 58 72 74 77 76
Maxim De Cuyper|De Cuyper|BEL|LB|79|82 66 77 78 72 70
Matz Sels|Sels|BEL|GK|82|82 80 78 84 50 80

Gianluigi Donnarumma|Donnarumma|ITA|GK|89|89 81 76 90 52 86
Alessandro Bastoni|Bastoni|ITA|CB|87|74 55 80 76 87 82
Nicolò Barella|Barella|ITA|CM|87|78 78 85 86 78 80
Sandro Tonali|Tonali|ITA|CM/CDM|85|74 75 83 82 79 80
Federico Dimarco|Dimarco|ITA|LB|85|78 76 85 81 76 72
Giovanni Di Lorenzo|Di Lorenzo|ITA|RB/CB|84|76 66 76 76 82 80
Riccardo Calafiori|Calafiori|ITA|CB/LB|83|78 60 76 78 81 80
Alessandro Buongiorno|Buongiorno|ITA|CB|83|72 40 68 66 84 84
Davide Frattesi|Frattesi|ITA|CM|82|80 78 76 80 70 76
Manuel Locatelli|Locatelli|ITA|CDM|82|62 72 82 78 80 78
Andrea Cambiaso|Cambiaso|ITA|LB/RB|82|78 66 78 81 76 74
Mateo Retegui|Retegui|ITA|ST|84|76 84 68 76 40 82
Moise Kean|Kean|ITA|ST|84|86 83 66 80 35 84
Matteo Politano|Politano|ITA|RW/RM|81|82 76 78 83 50 66
Federico Chiesa|Chiesa|ITA|RW|80|84 78 76 83 40 70
Giacomo Raspadori|Raspadori|ITA|ST/CAM|80|78 78 76 82 40 66
Guglielmo Vicario|Vicario|ITA|GK|84|85 78 74 87 52 80

Federico Valverde|Valverde|URU|CM/RM|88|86 83 84 84 80 86
Ronald Araújo|Araújo|URU|CB|84|82 50 64 66 85 86
José María Giménez|Giménez|URU|CB|82|70 45 62 62 84 84
Manuel Ugarte|Ugarte|URU|CDM|81|72 55 74 76 81 80
Rodrigo Bentancur|Bentancur|URU|CM|81|66 70 80 80 76 76
Darwin Núñez|Darwin Núñez|URU|ST|82|90 80 68 78 40 84
Giorgian de Arrascaeta|De Arrascaeta|URU|CAM|81|70 80 84 84 40 64
Mathías Olivera|Olivera|URU|LB|79|76 55 70 74 77 78
Nahitan Nández|Nández|URU|RB|78|78 60 72 76 76 80
Maximiliano Araújo|Maxi Araújo|URU|LW|79|86 72 72 80 55 72
Facundo Pellistri|Pellistri|URU|RW|77|86 68 72 80 35 60
Sergio Rochet|Rochet|URU|GK|79|80 76 74 81 48 78

Erling Haaland|Haaland|NOR|ST|91|89 93 68 80 45 88
Martin Ødegaard|Ødegaard|NOR|CAM|87|72 80 89 88 60 64
Alexander Sørloth|Sørloth|NOR|ST|82|78 82 68 74 40 86
Antonio Nusa|Nusa|NOR|LW|80|90 70 72 84 30 64
Mohamed Salah|Salah|EGY|RW|90|88 89 83 88 45 75
Omar Marmoush|Marmoush|EGY|ST/LW|83|86 82 78 84 40 74
Khvicha Kvaratskhelia|Kvaratskhelia|GEO|LW|88|86 82 83 90 38 72
Achraf Hakimi|Hakimi|MAR|RB|89|92 76 82 83 81 78
Yassine Bounou|Bounou|MAR|GK|85|85 82 78 87 50 83
Brahim Díaz|Brahim|MAR|CAM|82|82 76 80 87 35 60
Noussair Mazraoui|Mazraoui|MAR|RB/LB|81|78 60 78 80 78 74
Jan Oblak|Oblak|SVN|GK|87|86 87 76 89 50 88
Benjamin Šeško|Šeško|SVN|ST|82|86 81 68 78 35 84
Kim Min-jae|Kim Min-jae|KOR|CB|84|80 40 68 68 85 86
Son Heung-min|Son|KOR|LW|84|84 85 80 84 40 68
Lee Kang-in|Lee Kang-in|KOR|CAM/RW|81|74 76 84 85 45 58
Joško Gvardiol|Gvardiol|CRO|CB/LB|86|82 60 78 79 85 82
Mateo Kovačić|Kovačić|CRO|CM|83|70 70 83 87 72 74
Alphonso Davies|Davies|CAN|LB|83|94 65 76 84 76 76
Jonathan David|J. David|CAN|ST|82|84 82 74 82 40 72
Moisés Caicedo|Caicedo|ECU|CDM|87|76 66 80 81 86 84
Willian Pacho|Pacho|ECU|CB|84|82 40 70 66 84 84
Piero Hincapié|Hincapié|ECU|CB/LB|82|80 45 72 72 81 80
Pervis Estupiñán|Estupiñán|ECU|LB|80|84 60 78 78 74 74
Dominik Szoboszlai|Szoboszlai|HUN|CAM/CM|85|80 82 84 83 72 80
Alexander Isak|Isak|SWE|ST|87|86 87 75 86 35 76
Viktor Gyökeres|Gyökeres|SWE|ST|86|86 87 74 80 40 88
Dejan Kulusevski|Kulusevski|SWE|RW|83|76 78 83 84 50 80
Lucas Bergvall|Bergvall|SWE|CM|79|76 68 78 82 66 72
Victor Osimhen|Osimhen|NGA|ST|86|88 86 68 80 40 82
Ademola Lookman|Lookman|NGA|LW|84|86 81 76 85 40 70
Robert Lewandowski|Lewandowski|POL|ST|85|70 89 79 83 44 80
Piotr Zieliński|Zieliński|POL|CM|81|70 78 83 82 64 68
Scott McTominay|McTominay|SCO|CM|85|72 82 76 78 78 84
Andrew Robertson|Robertson|SCO|LB|82|78 60 82 78 78 72
Arda Güler|Arda Güler|TUR|CAM|84|74 81 86 87 45 58
Hakan Çalhanoğlu|Çalhanoğlu|TUR|CDM|85|62 80 88 80 74 72
Kenan Yıldız|Yıldız|TUR|LW|83|84 79 78 87 35 66
Luis Díaz|Luis Díaz|COL|LW|86|90 81 78 88 45 74
Mohammed Kudus|Kudus|GHA|RW|82|84 76 76 86 50 76
Antoine Semenyo|Semenyo|GHA|RW/LW|83|88 81 72 82 45 80
Bryan Mbeumo|Mbeumo|CMR|RW|84|84 83 80 84 50 74
André Onana|A. Onana|CMR|GK|82|82 76 84 84 60 78
Takefusa Kubo|Kubo|JPN|RW|82|82 76 80 86 40 60
Kaoru Mitoma|Mitoma|JPN|LW|82|88 76 74 86 40 66
Christian Pulisic|Pulisic|USA|RW/LW|84|84 80 79 85 40 66
Weston McKennie|McKennie|USA|CM|80|74 72 76 78 74 82
Manuel Akanji|Akanji|SUI|CB|84|78 50 76 72 84 80
Granit Xhaka|Xhaka|SUI|CM|84|58 78 86 78 78 82
Gregor Kobel|Kobel|SUI|GK|86|86 82 80 87 52 84
Yann Sommer|Sommer|SUI|GK|84|84 82 78 86 48 82
Dušan Vlahović|Vlahović|SRB|ST|82|76 84 68 78 35 84
Morten Hjulmand|Hjulmand|DEN|CDM|82|66 68 78 78 80 80
Rasmus Højlund|Højlund|DEN|ST|80|86 78 66 76 40 80
Serhou Guirassy|Guirassy|GUI|ST|85|80 86 70 80 35 84
Amad Diallo|Amad|CIV|RW|82|86 76 78 86 45 62
Evan Ndicka|Ndicka|CIV|CB|81|76 40 68 66 82 80
Rayan Aït-Nouri|Aït-Nouri|ALG|LB|82|86 62 78 84 74 70
Iliman Ndiaye|I. Ndiaye|SEN|LW|81|86 76 74 85 40 66
Pape Matar Sarr|P. M. Sarr|SEN|CM|80|78 72 76 80 74 76
Nicolas Jackson|N. Jackson|SEN|ST|80|88 76 70 80 40 76
Illia Zabarnyi|Zabarnyi|UKR|CB|82|76 40 66 64 83 82
Artem Dovbyk|Dovbyk|UKR|ST|81|72 82 66 74 40 84
Santiago Giménez|S. Giménez|MEX|ST|80|76 81 66 76 40 80
Patrik Schick|Schick|CZE|ST|82|74 84 70 78 40 80
`;

// Retired greats: rare "Legende" cards in packs.
const LEGENDS = `
Pelé|Pelé|BRA|ST/CAM|95|95 96 93 96 60 76
Diego Maradona|Maradona|ARG|CAM|95|91 92 92 97 40 76
Johan Cruijff|Cruijff|NED|ST/CAM|94|92 91 91 95 42 72
Zinédine Zidane|Zidane|FRA|CAM|94|78 88 94 95 70 84
Ronaldo Nazário|R. Nazário|BRA|ST|94|96 95 80 95 40 84
Ronaldinho|Ronaldinho|BRA|CAM/LW|93|90 88 91 96 38 78
Thierry Henry|Henry|FRA|ST|93|94 91 84 90 48 80
Paolo Maldini|Maldini|ITA|CB/LB|93|85 55 78 78 95 86
Franz Beckenbauer|Beckenbauer|GER|CB|93|80 72 88 84 93 84
Marco van Basten|Van Basten|NED|ST|93|86 95 80 90 40 84
Eusébio|Eusébio|POR|ST|92|93 94 80 91 40 82
Gianluigi Buffon|Buffon|ITA|GK|92|90 89 78 92 55 92
Ruud Gullit|Gullit|NED|CM|91|86 88 88 90 80 90
Dennis Bergkamp|Bergkamp|NED|ST/CAM|91|80 90 89 93 40 76
Andrés Iniesta|Iniesta|ESP|CM|91|78 76 92 94 60 66
Xavi|Xavi|ESP|CM|91|70 74 95 90 68 66
Iker Casillas|Casillas|ESP|GK|91|92 86 76 93 60 88
Kaká|Kaká|BRA|CAM|91|90 88 88 91 45 78
Luís Figo|Figo|POR|RW|91|86 84 89 91 45 76
Frank Rijkaard|Rijkaard|NED|CDM|90|78 76 84 82 90 88
Edwin van der Sar|Van der Sar|NED|GK|90|88 89 88 90 55 91
Carles Puyol|Puyol|ESP|CB|90|80 55 70 70 92 88
Andrea Pirlo|Pirlo|ITA|CM|90|66 82 95 88 66 66
Eden Hazard|Hazard|BEL|LW|90|90 84 87 94 35 70
Roberto Carlos|Roberto Carlos|BRA|LB|90|93 84 84 84 82 84
Cafu|Cafu|BRA|RB|90|91 70 82 84 86 84
Steven Gerrard|Gerrard|ENG|CM|90|80 88 90 84 80 86
Wayne Rooney|Rooney|ENG|ST|90|84 90 85 87 50 84
David Beckham|Beckham|ENG|RM|90|78 82 95 84 60 78
Philipp Lahm|Lahm|GER|RB|90|82 60 86 86 90 72
Patrick Vieira|Vieira|FRA|CDM|90|78 72 84 84 88 90
Didier Drogba|Drogba|CIV|ST|90|84 90 74 84 45 92
Samuel Eto'o|Eto'o|CMR|ST|90|90 89 78 88 45 80
Miroslav Klose|Klose|GER|ST|89|80 90 74 80 45 84
Vincent Kompany|Kompany|BEL|CB|89|78 55 72 72 90 88
Enzo Scifo|Scifo|BEL|CAM|88|78 82 89 89 50 70
`;

function parse(block, legend) {
  const out = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [name, short, nation, posField, ovr, stats] = line.split('|');
    const [pos, ...alt] = posField.split('/');
    const s = stats.split(' ').map(Number);
    out.push({
      id: slug(name),
      name,
      short,
      nation,
      pos,
      alt,
      ovr: Number(ovr),
      stats: s,
      legend,
    });
  }
  return out;
}

export const PLAYERS = [...parse(CURRENT, false), ...parse(LEGENDS, true)];
export const PLAYER_BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

export const STAT_LABELS = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
export const GK_STAT_LABELS = ['DUI', 'HAN', 'TRA', 'REF', 'SNE', 'POS'];

// Tiers drive card styling and pack odds.
export function tierOf(p) {
  if (p.legend) return 'legende';
  if (p.ovr >= 88) return 'ster';
  if (p.ovr >= 84) return 'elite';
  return 'goud';
}

export const TIER_NAMES = { goud: 'Goud', elite: 'Elite', ster: 'Wereldster', legende: 'Legende' };
