// Player database.
//
// Every player, nation and rating in Gouden Elf is made up for this game.
// Any resemblance to real people is coincidental; surnames that match a
// well-known footballer were rejected when the names were generated.
//
// Row format:  Full name | Short name | Nation | Pos[/alt] | OVR | six stats | look
// Outfield stats: SNE SCH PAS DRI VER FYS (pace, shooting, passing, dribbling,
// defending, physical). Goalkeeper stats: DUI HAN TRA REF SNE POS.
// Look (see looks.js): 'skin hair colour [b1|b2] [L]'.

import { slug } from '../util.js';

const CURRENT = `
Eneko Arnedo|Arnedo|ALD|GK|84|83 78 87 83 58 82|3 curly k L
Ignacio Montaraz|Montaraz|ALD|LB|87|78 74 79 86 82 79|3 short k
Javier Quintanar|Quintanar|ALD|CB|85|78 51 68 69 84 86|2 long k b2
Raúl Aizpurua|Aizpurua|ALD|CB/RB|84|66 33 86 61 85 85|2 short b b1
Julen Toledano|Toledano|ALD|RB|83|81 63 75 80 74 81|1 short b b1
Iker Valderrey|Valderrey|ALD|CM|91|81 86 91 93 80 81|2 swept k b1
Lucas Montesinos|Montesinos|ALD|CDM|83|57 72 85 77 84 77|3 swept k
Sergio Navalón|Navalón|ALD|CM|89|83 81 88 89 79 75|2 short b
Aitor Labaka|Labaka|ALD|LW|85|92 77 83 88 28 69|1 short b b2
Nicolás Echevarne|Echevarne|ALD|ST|90|84 88 81 87 51 78|2 buzz k b2
Martín Carrasquilla|Carrasquilla|ALD|RW/ST|86|92 79 84 86 58 65|2 short d L
Rubén Ezcurra|Ezcurra|ALD|GK|83|83 80 82 85 54 80|2 crop b
Mateo Urquiza|Urquiza|ALD|CB|84|77 55 69 70 86 87|2 swept b
Tomás Letamendi|Letamendi|ALD|CB|82|84 34 71 62 82 80|1 long b
Manuel Olmedo|Olmedo|ALD|LB|85|96 67 83 82 79 75|2 crop b b1 L
Alonso Ribalta|Ribalta|ALD|CM|81|72 73 79 82 70 74|1 short d b1
Kojo Baidoo|Baidoo|ALD|CM|85|85 74 83 83 72 85|5 crop k b1
Andrés Ribelles|Ribelles|ALD|CAM/CM|81|73 78 83 83 69 66|2 crop d
Gonzalo Montejano|Montejano|ALD|CAM/CM|84|79 75 79 84 46 73|2 buzz d b2 L
Borja Belmonte|Belmonte|ALD|LW|84|92 80 77 83 34 66|3 buzz k b1
Álvaro Villaseca|Villaseca|ALD|ST/LW|86|85 90 71 85 35 91|1 short b b1
Héctor Lastra|Lastra|ALD|ST|86|80 84 78 85 31 78|1 swept l

Samir Benhamou|Benhamou|BRV|GK|87|85 82 88 89 57 84|3 crop d
Ayo Ekwueme|Ekwueme|BRV|LB|84|74 65 79 81 80 73|5 crop k
Lucas Coly|Coly|BRV|CB|89|87 41 75 79 90 89|4 afro k L
Clément Morvaix|Morvaix|BRV|CB|84|69 54 69 66 84 80|2 swept d b2 L
Sacha Gauvreau|Gauvreau|BRV|RB|86|82 58 83 84 85 83|1 swept p L
Florian Tanguy|Tanguy|BRV|CM|84|72 75 79 81 69 82|3 swept d
Tunde Ibekwe|Ibekwe|BRV|CDM|81|62 58 79 74 79 84|6 crop k
Sékou Sambou|Sambou|BRV|CM|83|80 72 81 85 72 82|5 afro k b1
Julien Dufresnoy|Dufresnoy|BRV|LW|90|85 82 80 93 51 80|2 buzz k b2
Loïc Lemarchal|Lemarchal|BRV|ST|88|94 86 80 84 42 78|1 buzz d
Théo Brisard|Brisard|BRV|RW/LW|83|82 81 82 87 26 57|1 buzz d b1
Adrien Besnard|Besnard|BRV|GK|85|85 81 88 85 55 83|2 crop d L
Timothée Fauconnier|Fauconnier|BRV|CB|82|83 46 79 75 83 77|2 buzz d
Kwaku Boakye|Boakye|BRV|CB/LB|84|78 37 62 65 83 83|6 dreads p b1
Valentin Laforêt|Laforêt|BRV|LB|83|83 67 80 77 76 71|3 bald d L
Gabin Beaumanoir|Beaumanoir|BRV|CDM|85|75 83 79 79 84 82|3 buzz k
Jordan Rouxel|Rouxel|BRV|CM|85|77 72 83 84 72 81|2 curly d
Kudzai Nxumalo|Nxumalo|BRV|CAM/ST|82|70 74 82 87 39 63|6 twists k b1
Rayan Montferrand|Montferrand|BRV|CM|83|67 75 82 81 76 86|2 bun d
Bastien Garnaud|Garnaud|BRV|LW|83|98 73 76 82 28 65|2 short d
Maxime Pradier|Pradier|BRV|ST/LW|83|83 80 75 81 50 73|1 short b b1 L
Baptiste Stennett|Stennett|BRV|ST|82|77 79 73 77 34 75|5 dreads p b1

Emerson Cordeiro|Cordeiro|CVR|GK|92|90 88 91 94 58 88|2 bun b b2
Ruan Medeiros|Medeiros|CVR|LB|86|85 58 81 84 84 77|5 twists k L
Kauã Esteves|Esteves|CVR|CB|83|61 45 67 70 82 83|1 crop b
Caio Mourato|Mourato|CVR|CB|85|62 44 77 65 85 87|5 twists k b1
Martim Monteverde|Monteverde|CVR|RB|86|89 59 82 80 81 77|2 curly d b1
Wellington Valadares|Valadares|CVR|CM|86|78 79 87 81 83 84|2 buzz k b2 L
Diogo Quintela|Quintela|CVR|CDM|82|67 71 78 79 82 69|2 buzz d
Rui Seixas|Seixas|CVR|CM|87|68 76 84 85 71 76|2 bald d
Gustavo Silveira|Silveira|CVR|LW|90|91 87 83 93 43 69|1 short r
Nuno Espinheira|Espinheira|CVR|ST|90|86 91 80 90 45 84|3 buzz d b1
Renan Carrilho|Carrilho|CVR|RW|82|80 78 79 85 36 59|2 short d b1
Jefferson Albuquerque|Albuquerque|CVR|GK|85|85 83 81 86 49 84|5 twists k
Davi Lacerda|Lacerda|CVR|CB|81|83 48 74 64 81 79|3 swept k
Lorenzo Taborda|Taborda|CVR|CB|82|68 42 71 64 83 85|6 bald k b1
Henrique Nóbrega|Nóbrega|CVR|RB/RM|84|83 72 74 81 79 82|2 short d b2
Gonçalo Brandolim|Brandolim|CVR|CM/CAM|82|73 72 78 80 76 79|2 short b
Fábio Sobral|Sobral|CVR|CM|86|76 79 85 85 73 83|3 crop k
Tiago Salgueiro|Salgueiro|CVR|CAM/LW|85|84 82 82 87 68 62|5 buzz k b2 L
Sandro Loureiro|Loureiro|CVR|CM|86|69 74 82 85 79 73|1 buzz d
Tomás Fontoura|Fontoura|CVR|LW|82|83 73 79 81 32 76|4 buzz k b1
Vasco Canário|Canário|CVR|RW|85|88 85 86 87 56 83|4 curly k
Joaquim Morgado|Morgado|CVR|ST|84|81 83 78 84 40 77|5 crop k

Aidan Hallworth|Hallworth|DMR|GK|85|84 82 75 86 54 83|2 crop b b1
Tom Coverdale|Coverdale|DMR|LB/RB|81|82 57 74 79 74 65|2 buzz d b1
Joe Moloney|Moloney|DMR|CB|84|86 49 65 65 85 85|3 short d L
Julian Duncombe|Duncombe|DMR|CB|90|84 55 77 78 90 88|4 dreads k b2
Tatenda Shongwe|Shongwe|DMR|RB/RM|81|76 74 68 76 71 71|5 dreads k
Neo Phiri|Phiri|DMR|CM|84|78 77 83 85 77 78|6 crop k
Ethan Bramall|Bramall|DMR|CDM|84|63 74 79 81 87 90|1 short b
Ryan Brackley|Brackley|DMR|CM|84|69 76 84 85 83 74|1 swept d
Leon Brissett|Brissett|DMR|LW|81|82 72 75 84 31 58|5 afro k
Charlie Ashworth-Lyle|Ashworth-Lyle|DMR|ST|85|68 86 81 79 34 89|1 short b
Oliver Rafferty|Rafferty|DMR|RW/LW|85|85 82 87 86 37 62|1 short r
Finley Cullinane|Cullinane|DMR|GK|84|84 80 76 87 55 80|1 buzz d
Nnamdi Oyebode|Oyebode|DMR|CB/RB|80|62 45 69 68 81 81|4 short k b1
Liam Blackwood|Blackwood|DMR|CB/CDM|82|75 42 71 69 84 84|1 short d b2
Owen Lanigan|Lanigan|DMR|LB|82|80 58 75 78 76 72|2 crop d
Toby Whitlock|Whitlock|DMR|CDM|82|60 67 78 82 83 84|2 crop b b1
Alfie Cartwright|Cartwright|DMR|CM|80|73 72 78 84 74 79|1 short d b1
Connor Ellwood|Ellwood|DMR|CAM|83|72 79 84 87 34 56|2 long k b2
Jaden Henriques|Henriques|DMR|CAM|84|77 79 83 88 67 69|4 curly k L
Nathan Brindley|Brindley|DMR|LW|82|85 81 76 83 50 69|2 short k
Kemar Lindo|Lindo|DMR|LW/RW|80|96 80 74 82 36 66|6 buzz k
Elijah Tulloch|Tulloch|DMR|ST|83|79 84 75 85 46 80|4 short k b1 L

Davide Orlandini|Orlandini|ESR|GK|84|83 84 80 84 49 83|2 short k b1
Tommaso Lanzarini|Lanzarini|ESR|CB|89|76 47 76 80 90 86|2 crop d
Cristian Amrani|Amrani|ESR|CB|84|75 44 75 74 83 79|2 short d b1
Filippo Vescovi|Vescovi|ESR|CB|84|76 34 63 68 84 84|3 short k b1
Giulio Cavallari|Cavallari|ESR|LM/CM|82|77 78 78 79 55 71|1 swept d
Lorenzo Rocchegiani|Rocchegiani|ESR|CM|83|69 75 84 80 78 77|2 swept d L
Simone Valsecchi|Valsecchi|ESR|CDM|86|66 76 81 82 82 79|2 swept d b1 L
Fabio Tessaro|Tessaro|ESR|CM|82|71 73 79 88 70 76|2 curly k b1
Marco Sartorello|Sartorello|ESR|RM/CM|90|97 87 89 88 61 79|2 buzz b
Giacomo Morandini|Morandini|ESR|ST|82|76 85 67 78 31 96|2 crop b L
Jacopo Venturelli|Venturelli|ESR|ST|82|70 83 72 81 44 77|3 swept k
Matteo Pellegatta|Pellegatta|ESR|GK|81|82 77 81 81 42 83|2 swept b b2
Pietro Ferravanti|Ferravanti|ESR|CB|83|69 52 68 77 83 78|1 crop b
Michele Rizzardi|Rizzardi|ESR|CB|82|75 47 65 73 82 81|1 crop d L
Mattia Marzocchi|Marzocchi|ESR|LB|81|87 60 79 79 79 78|3 long d L
Gabriele Fontanesi|Fontanesi|ESR|CDM|81|64 56 80 78 79 77|2 crop d
Andrea Bertinelli|Bertinelli|ESR|CM|80|66 70 74 78 76 78|1 short b
Stefano Scarpellini|Scarpellini|ESR|CAM|84|79 81 84 91 52 57|1 short d
Alessandro Giordanetti|Giordanetti|ESR|CM|81|71 77 81 82 73 66|1 swept b b1
Luca Rinaldelli|Rinaldelli|ESR|LW|82|83 75 77 81 49 67|2 short d
Nicolò Carlucci|Carlucci|ESR|RW/CAM|84|83 80 84 82 54 71|1 buzz d L
Emanuele Brenna|Brenna|ESR|ST|79|85 79 65 73 42 80|2 swept b b1

Jonas Wiesinger|Wiesinger|GAV|GK|89|89 86 87 90 56 84|1 short b b2
Tobias Uhlmann|Uhlmann|GAV|LB/CB|85|78 70 80 82 78 73|2 swept b L
Fabian Lechner|Lechner|GAV|CB|84|83 43 76 67 83 83|1 short d
Raphael Ortmann|Ortmann|GAV|CB|84|69 51 82 74 85 81|3 short d b1
Vedran Stipetić|Stipetić|GAV|RB|84|90 60 75 77 81 83|2 short d
Dominik Kühnert|Kühnert|GAV|CDM|83|52 75 83 78 89 88|3 crop d
Marvin Nussbaumer|Nussbaumer|GAV|CDM|80|57 76 75 76 78 77|3 swept d b1
Benedikt Birkenfeld|Birkenfeld|GAV|LW|83|85 79 77 86 45 67|1 swept d b1
Niklas Özbayrak|Özbayrak|GAV|CAM|90|84 83 94 91 56 71|3 crop k b1
Valentin Kranzbühler|Kranzbühler|GAV|RW/RM|90|97 88 92 88 59 68|1 curly b L
Walid Zeroual|Zeroual|GAV|ST|85|71 84 73 87 46 82|4 afro k b1
Finn Marquardt|Marquardt|GAV|GK|84|84 79 72 85 55 84|2 short d
Mert Kuruoğlu|Kuruoğlu|GAV|CB|83|74 42 71 72 82 84|2 swept b b2
Lukas Thalberg|Thalberg|GAV|CB|81|71 34 72 71 81 82|1 buzz d b1
Deniz Karakaya|Karakaya|GAV|RB|85|92 71 79 80 84 78|3 short d
Florian Mühlhaus|Mühlhaus|GAV|CM|81|71 76 78 82 79 70|1 crop l
Jakob Weißgerber|Weißgerber|GAV|CM|83|82 69 81 86 77 80|2 crop d L
Efe Aydınlı|Aydınlı|GAV|CAM/ST|83|69 81 91 85 45 67|2 buzz k b2
Felix Zollinger|Zollinger|GAV|CAM/CM|79|78 75 80 80 51 61|1 swept b
Leon Hollerich|Hollerich|GAV|RW|85|89 80 81 87 40 69|1 short b L
Simon Hagedorn|Hagedorn|GAV|ST|81|77 83 74 84 38 83|1 short l
Anton Obermaier|Obermaier|GAV|ST|85|93 83 77 82 41 82|2 short d b1

Kunle Egbuna|Egbuna|HLS|GK|87|87 80 85 88 54 88|5 afro k
Robbe Snoeck|Snoeck|HLS|LB|83|84 64 78 81 72 70|1 buzz r b1 L
Nassim Kettani|Kettani|HLS|CB|80|73 40 65 68 79 79|2 bun k
Tibo Hoogendijk|Hoogendijk|HLS|CB|84|74 42 62 67 83 85|2 short d
Luuk Nijland|Nijland|HLS|RB/RM|81|89 55 72 75 73 70|2 short b
Tijn Hettema|Hettema|HLS|CM|80|71 74 78 79 72 73|2 swept d b2
Brecht Hofstede|Hofstede|HLS|CDM|83|64 67 85 77 83 82|1 long d L
Pieter Bakkeren|Bakkeren|HLS|CM|83|72 70 86 91 75 80|1 short l
Yaw Sarpong|Sarpong|HLS|LW|90|97 86 86 93 50 79|4 curly k L
Ruben Vermeersch|Vermeersch|HLS|ST|81|74 82 71 79 44 76|1 short l
Jesse Veldkamp|Veldkamp|HLS|RW|83|83 81 82 83 49 57|1 long d
Lars Vanhaecke|Vanhaecke|HLS|GK|80|79 79 60 79 43 77|1 short d b1
Thijs Tollenaere|Tollenaere|HLS|CB|79|74 36 71 61 79 72|1 swept l
Daan De Vlieger|De Vlieger|HLS|CB|81|66 47 66 70 83 74|2 crop b b2
Wannes Oldenkamp|Oldenkamp|HLS|RB|81|74 67 77 76 79 74|1 short b
Niels Bogaert|Bogaert|HLS|CM|82|85 73 83 79 71 76|1 short b b1 L
Jens Blommaert|Blommaert|HLS|CM|78|64 68 75 81 75 82|2 short d
Kobe Moerman|Moerman|HLS|CAM|82|68 78 86 81 52 54|1 short d b1
Tobi Odukoya|Odukoya|HLS|CM|83|75 71 79 79 80 72|6 afro k b2
Siebe Zijlstra|Zijlstra|HLS|RW/LW|81|81 78 80 83 38 67|1 curly b
Ties Rahmouni|Rahmouni|HLS|LW|82|91 78 71 84 41 64|3 short k b1
Seppe Oosterhuis|Oosterhuis|HLS|ST|80|73 80 69 79 46 74|3 short k

Lazar Vidaković|Vidaković|KDV|GK|81|79 75 82 83 43 79|1 short p
Hrvoje Jelinić|Jelinić|KDV|LB|84|81 70 79 82 82 73|1 short l L
Eren Karaduman|Karaduman|KDV|CB|81|76 44 69 69 82 78|2 crop d
Aleksa Nedeljković|Nedeljković|KDV|CB/LB|79|67 43 67 64 78 73|2 short k
Nemanja Zrnić|Zrnić|KDV|RB|83|93 75 78 82 76 70|2 crop d
Zoran Marinković|Marinković|KDV|LM|84|94 83 83 81 47 71|2 crop k b1 L
Ante Sertić|Sertić|KDV|CM|79|74 78 80 76 66 81|2 curly b b1
Luka Hodak|Hodak|KDV|CM|83|75 75 80 84 82 77|1 short b
Ognjen Radojković|Radojković|KDV|RM/RB|79|82 70 76 79 63 61|2 crop d L
Petar Radović|Radović|KDV|ST/LW|83|77 82 71 74 36 80|2 bun d b1
Damir Tomičić|Tomičić|KDV|ST|90|77 87 79 86 50 87|1 short l
Krunoslav Novosel|Novosel|KDV|GK|79|79 78 74 80 43 77|2 short b
Stefan Stanojević|Stanojević|KDV|CB|81|67 44 67 70 81 81|1 short d b2
Vuk Topić|Topić|KDV|CB|79|88 34 69 65 80 78|1 short d b2
Uroš Jevtić|Jevtić|KDV|RB/RM|78|79 65 76 75 75 74|2 crop d
Miloš Lazarević|Lazarević|KDV|CM|79|76 71 75 76 67 69|1 short d
Toni Škorić|Škorić|KDV|CM|79|74 72 78 78 70 65|2 short k b1
Tomislav Rendulić|Rendulić|KDV|CAM/ST|77|70 73 79 80 36 51|1 buzz b L
Dušan Petrušić|Petrušić|KDV|CM|82|81 72 81 85 71 75|1 crop b
Vedran Mravak|Mravak|KDV|RW|82|83 78 80 86 32 65|1 short l b1 L
Jakov Jurišić|Jurišić|KDV|RW|82|92 80 81 87 51 78|1 short b b1
Dario Grgić|Grgić|KDV|ST|80|71 79 72 76 34 81|2 bun b b1

Samba Soumah|Soumah|MRD|GK|88|88 85 80 89 47 88|6 twists k b1 L
Mehdi Sebti|Sebti|MRD|LB|86|86 76 83 82 75 77|3 crop k b2 L
Uchenna Osagie|Osagie|MRD|CB|86|79 58 76 63 88 83|5 afro p
Fodé Samassa|Samassa|MRD|CB|83|77 47 67 71 84 77|6 bald k
Yaw Agyemang|Agyemang|MRD|RB|85|78 72 83 81 86 79|5 buzz k b1
Aliou Mbaye|Mbaye|MRD|CM|91|79 82 88 92 83 87|6 crop k b1 L
Alassane Dembaga|Dembaga|MRD|CDM|85|59 82 80 81 85 86|6 buzz k
Amine Naciri|Naciri|MRD|CM|86|74 75 84 85 73 69|3 swept k b1
Bakary Niakaté|Niakaté|MRD|LW|89|92 84 83 93 40 69|6 crop k b1 L
Kwadwo Osei-Bonsu|Osei-Bonsu|MRD|ST|81|75 79 62 77 50 69|6 crop k
Mamadou Kébé|Kébé|MRD|RW|90|90 86 86 91 42 63|5 buzz k
Kwabena Kyeremeh|Kyeremeh|MRD|GK|85|84 82 77 87 52 81|4 dreads k
Moussa Thiaw|Thiaw|MRD|CB|84|81 41 71 72 84 77|5 dreads k
Kunle Ouazzani|Ouazzani|MRD|CB|85|89 43 70 70 86 85|2 short d
Kwesi Quaye|Quaye|MRD|LB|82|80 59 77 82 81 75|6 afro k L
Idrissa Tounkara|Tounkara|MRD|CDM|85|75 73 81 81 82 75|6 twists p b1
Tobi Adeniran|Adeniran|MRD|CM|84|76 82 84 83 82 80|6 buzz k
Youssouf Ndour|Ndour|MRD|CAM/LW|86|63 83 88 90 31 63|6 short d
Tunde Adebanjo|Adebanjo|MRD|CAM/RW|82|75 80 84 81 44 75|6 buzz k b1
Ibrahima Seck|Seck|MRD|LW|83|83 74 73 85 38 70|5 crop k b2 L
Segun Maazouz|Maazouz|MRD|RW|86|90 80 81 85 39 67|3 swept d b1 L
Fiifi Adjei|Adjei|MRD|ST|86|82 85 72 80 30 74|5 buzz k

Elias Dahlgren|Dahlgren|NRV|GK|82|82 79 73 82 49 80|2 swept l
Jonas Rosseland|Rosseland|NRV|LB|80|78 61 69 75 78 72|1 crop b L
Haakon Haugland|Haugland|NRV|CB/RB|89|86 62 65 68 91 92|1 swept l
Sigurd Lindqvist|Lindqvist|NRV|CB|80|68 35 74 71 78 78|1 swept l
Torstein Forsell|Forsell|NRV|RB|82|74 64 81 80 80 76|1 crop d
Kwaku Asiedu|Asiedu|NRV|LM/LB|80|76 77 72 78 60 60|6 dreads k L
Aksel Lindahl|Lindahl|NRV|CM|80|76 67 77 83 75 72|1 buzz l
Nils Voll|Voll|NRV|CM|81|73 82 85 81 76 77|1 short l
Mikkel Tjelle|Tjelle|NRV|RM|81|89 73 78 76 66 66|1 short b
Ognjen Hrnjak|Hrnjak|NRV|ST|80|84 84 75 72 34 82|2 crop b
Sander Mavuso|Mavuso|NRV|ST|80|65 79 80 78 27 63|6 crop k
Erik Sæther|Sæther|NRV|GK|78|79 75 75 78 37 76|1 swept l
Kristoffer Norrman|Norrman|NRV|CB|79|64 45 68 60 82 74|2 bald d
Aron Juhlin|Juhlin|NRV|CB|81|70 48 66 63 81 83|2 short d b2 L
Emil Kvalheim|Kvalheim|NRV|LB|77|81 61 74 75 70 66|1 swept b L
Magnus Ulvestad|Ulvestad|NRV|CM|80|69 81 79 77 73 78|1 short r
Kagiso Moyo|Moyo|NRV|CM|80|71 73 77 84 64 68|6 short k
Oskar Rydén|Rydén|NRV|CAM|81|76 75 78 83 57 72|2 buzz d
Anders Vikström|Vikström|NRV|CAM/LW|77|70 68 76 81 65 65|1 short b
Johan Brattli|Brattli|NRV|RW|78|74 74 78 79 33 57|1 short l
Mathias Mørk|Mørk|NRV|ST|78|76 80 64 79 29 74|1 short b
Sindre Storvik|Storvik|NRV|ST|77|67 74 59 70 39 80|1 buzz l

Valentín Arrúa|Arrúa|TAV|GK|85|85 82 72 86 55 87|2 buzz d b2
Julián Lencina|Lencina|TAV|LB|84|88 65 77 76 78 81|2 swept b b2
Joaquín Sciarra|Sciarra|TAV|CB|82|83 38 77 65 83 82|3 swept d b1
Federico Urquiola|Urquiola|TAV|CB|85|87 48 74 73 87 89|1 short b b1
Nicolás Aguerreberry|Aguerreberry|TAV|RB|86|76 73 72 83 75 69|1 swept d b1
Tomás Techera|Techera|TAV|CM|90|83 74 89 92 84 76|2 swept k
Ignacio Lamas|Lamas|TAV|CDM|82|66 70 80 79 87 83|2 crop d b1
Emiliano Doldán|Doldán|TAV|CM|85|77 79 82 87 78 91|2 short d b1
Ezequiel Rearte|Rearte|TAV|LW|85|92 80 79 84 42 76|1 long d
Lisandro Nieto|Nieto|TAV|ST|90|87 90 88 93 53 76|2 bun d
Agustín Bottinelli|Bottinelli|TAV|RW/ST|85|82 77 78 89 53 64|2 short d b2
Franco Tagliabue|Tagliabue|TAV|GK|82|82 81 93 83 55 82|1 swept d
Brian Saravia|Saravia|TAV|CB|84|76 39 73 70 85 78|2 short d b2 L
Facundo Mastrángelo|Mastrángelo|TAV|CB|81|80 44 75 67 83 76|3 buzz d
Rodrigo Dalmao|Dalmao|TAV|LB|81|74 66 72 74 74 70|2 buzz k L
Matías Zampedri|Zampedri|TAV|CDM/CM|83|71 73 88 80 82 74|1 bun d b2
Santiago Oroño|Oroño|TAV|CM|84|75 80 75 84 69 82|1 short b b1 L
Thiago Pérsico|Pérsico|TAV|CAM/LW|81|82 78 83 79 46 75|1 short p b1
Cristian Echeverría|Echeverría|TAV|CAM|80|70 78 76 82 49 58|2 long d L
Maximiliano Bonfiglio|Bonfiglio|TAV|LW|82|87 74 74 84 37 63|2 crop d b1
Gastón Toranzo|Toranzo|TAV|ST|81|70 83 76 80 43 75|2 buzz b b1
Gonzalo Zabala|Zabala|TAV|ST|79|77 79 64 82 33 65|2 swept d b1

Mehdi Bensaïd|Bensaïd|PVN|GK|88|86 82 86 91 49 86|3 crop d b2
Khalid Fekkak|Fekkak|PVN|RW/LW|88|90 81 88 93 34 60|3 crop d b1 L
Zakaria El Idrissi|El Idrissi|PVN|CM|84|77 79 82 83 80 76|3 short b L
Walid Laaroussi|Laaroussi|PVN|CB|82|72 47 77 68 82 78|3 buzz d b2
Amine Mansouri|Mansouri|PVN|ST|81|74 78 67 79 43 73|4 crop k b2

Selim Ulusoy|Ulusoy|ZRK|CAM/CM|87|70 81 88 91 52 80|2 buzz d b2 L
Mert Kalaycı|Kalaycı|ZRK|CB/LB|85|68 45 71 71 85 85|3 curly k b1
Oğuz Çelikkaya|Çelikkaya|ZRK|LW|84|89 77 73 82 37 64|2 bun b b2
Umut Tunçel|Tunçel|ZRK|CDM|82|69 74 84 76 85 75|2 buzz k b2
Burak Yeşilyurt|Yeşilyurt|ZRK|ST|80|74 80 63 76 40 61|1 bald d b1

Riku Nishimori|Nishimori|SOR|LW|88|89 84 83 90 47 71|3 short k b1
Daiki Kajiwara|Kajiwara|SOR|CM|85|81 79 84 78 76 79|1 swept d
Shota Matsubara|Matsubara|SOR|RB|83|82 62 81 80 78 76|1 curly b
Yuto Morishita|Morishita|SOR|CAM/CM|82|72 79 85 87 48 68|2 crop d
Sota Fujisawa|Fujisawa|SOR|GK|80|80 80 82 80 47 76|1 crop r

Jairo Blackstock|Blackstock|VEL|ST|90|89 89 83 90 47 86|5 buzz k
Rashawn Whyte|Whyte|VEL|LB/LM|86|80 55 81 80 79 74|3 buzz d L
Dwayne Dacres|Dacres|VEL|RW|83|89 78 81 85 41 59|5 twists k b1
Isaiah Linton|Linton|VEL|CB|81|72 44 72 63 83 78|4 crop k
Julian McCalla|McCalla|VEL|CM|80|63 71 78 79 78 70|3 curly d L

Kagiso Mudau|Mudau|TDR|CDM|87|73 77 92 82 85 77|5 crop k
Kudzai Mthethwa|Mthethwa|TDR|CB|86|66 49 77 69 86 85|6 buzz k
Tendai Zwane|Zwane|TDR|ST|84|72 81 72 81 35 86|6 buzz p b1
Tumelo Masilela|Masilela|TDR|RB|82|76 62 78 77 81 68|5 buzz k b1
Lesedi Ntuli|Ntuli|TDR|LW/ST|81|85 80 76 83 34 65|5 crop k L

Sorin Pătrașcu|Pătrașcu|ROV|ST|86|75 84 71 87 40 75|2 short k
Marius Bălănescu|Bălănescu|ROV|CM|86|70 72 84 86 78 87|1 short p b2
Andrei Țurcanu|Țurcanu|ROV|GK|83|83 78 79 84 38 78|2 bald d
Adrian Bârlădeanu|Bârlădeanu|ROV|LB|81|81 72 78 82 69 70|1 swept b b1 L
Tudor Dumitrașcu|Dumitrașcu|ROV|CB|80|76 45 64 64 80 73|3 buzz k

Tuomas Rautiainen|Rautiainen|SMK|CB|87|75 41 69 80 87 77|1 crop d L
Mikko Tiainen|Tiainen|SMK|RB/LB|85|84 65 84 80 78 79|1 short d b1
Ville Kivelä|Kivelä|SMK|CM|83|77 78 87 80 75 72|1 short d b1 L
Juho Salmivaara|Salmivaara|SMK|ST|82|79 84 75 80 43 76|2 short b
Lauri Honkanen|Honkanen|SMK|RW|80|86 75 80 80 47 70|1 swept b
`;

// Retired greats: rare "Legende" cards in packs.
const LEGENDS = `
Lowie Dierckx|Dierckx|HLS|ST|95|99 98 91 97 53 94|1 swept b
Henrik Vatne|Vatne|NRV|CAM/CM|95|82 92 96 94 68 79|2 short d
Mateo Bartley|Bartley|BRV|ST|94|89 92 82 89 57 88|5 buzz k b1
Mateo Kolarić|Kolarić|KDV|CAM|94|85 94 95 96 56 87|2 short b
Bautista Giacomelli|Giacomelli|TAV|CM|94|93 87 90 91 90 91|1 crop d
Gaëtan Vautrin|Vautrin|BRV|CB|93|87 54 82 81 94 88|2 bald d L
Jordan Harkin|Harkin|DMR|CB|93|96 58 89 74 94 93|1 bald d L
Federico Colombera|Colombera|ESR|ST/CAM|93|84 93 81 88 47 95|2 swept d b1
Edoardo Brambati|Brambati|ESR|CAM|93|97 85 98 98 65 77|2 short b
Andrej Simonović|Simonović|KDV|ST|93|91 94 77 94 52 84|1 short d
Unai Arrieta|Arrieta|ALD|ST|92|84 95 86 87 44 83|3 swept k
Arthur Trévidic|Trévidic|BRV|GK|92|91 88 80 93 62 89|2 buzz b
Afonso Bandeira|Bandeira|CVR|CM|91|82 81 87 93 81 96|2 swept d b1 L
Duarte Amoedo|Amoedo|CVR|LW/RW|91|91 85 84 95 51 69|2 swept d
Daniele Dalmonte|Dalmonte|ESR|ST/RW|91|86 95 73 91 46 88|2 short d
Berk Zengin|Zengin|GAV|CM|91|79 81 89 93 84 83|2 curly d b2
Maximilian Vogelsang|Vogelsang|GAV|CAM|91|78 82 95 95 70 68|1 long b b2
Floris Claessens|Claessens|HLS|GK|91|91 89 81 92 59 90|1 long d
Kwaku Ofosu-Hene|Ofosu-Hene|MRD|RW|91|96 85 87 93 47 68|5 bald k L
Alejandro Esquivel|Esquivel|ALD|ST|90|92 89 80 82 44 94|2 short d b1 L
Joaquín Castromil|Castromil|ALD|CDM|90|76 78 95 83 86 86|2 swept k L
Óscar Garcimuñoz|Garcimuñoz|ALD|CM|90|87 73 90 90 90 90|3 swept k
Corentin Rabier|Rabier|BRV|GK|90|91 86 80 92 50 87|2 curly d b2
Rafael Vilaça|Vilaça|CVR|ST|90|83 93 72 90 41 91|1 curly b
Heitor Faria|Faria|CVR|RB/LB|90|91 69 86 90 86 80|2 crop d b2
Darragh Farrow|Farrow|DMR|CAM|90|83 88 91 96 71 71|1 crop b
Archie Thackeray|Thackeray|DMR|RM/RW|90|96 78 85 89 77 79|2 buzz k
Samuele Zanardelli|Zanardelli|ESR|LB|90|96 69 81 89 83 86|1 buzz b L
Matthias Holzapfel|Holzapfel|GAV|ST|90|79 86 80 90 42 79|2 bun k
Warre Meulendijk|Meulendijk|HLS|CDM|90|69 74 95 83 91 88|2 long b b1
Kofi Ansah|Ansah|MRD|CB|90|88 60 85 67 90 90|5 buzz k b1 L
Sékou Faye|Faye|MRD|ST|90|83 90 76 90 46 80|5 bald k
Mauro Orsini|Orsini|TAV|RB|90|83 71 84 87 84 81|2 long p b2
Jarne Obiora|Obiora|HLS|CB|89|86 48 78 74 89 89|5 crop p
Leandro Vidart|Vidart|TAV|ST|89|78 90 74 87 42 78|2 swept d b1
Lucas Azevedo|Azevedo|CVR|CM/CAM|88|77 72 85 91 83 76|2 short b b1
`;

function parse(block, legend) {
  const out = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [name, short, nation, posField, ovr, stats, look] = line.split('|');
    const [pos, ...alt] = posField.split('/');
    out.push({
      id: slug(name),
      name,
      short,
      nation,
      pos,
      alt,
      ovr: Number(ovr),
      stats: stats.split(' ').map(Number),
      look,
      legend,
    });
  }
  return out;
}

export const PLAYERS = [...parse(CURRENT, false), ...parse(LEGENDS, true)];
export const PLAYER_BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

export const STAT_LABELS = ['SNE', 'SCH', 'PAS', 'DRI', 'VER', 'FYS'];
export const GK_STAT_LABELS = ['DUI', 'HAN', 'TRA', 'REF', 'SNE', 'POS'];

// Tiers drive card styling and pack odds.
export function tierOf(p) {
  if (p.legend) return 'legende';
  if (p.ovr >= 88) return 'ster';
  if (p.ovr >= 84) return 'elite';
  return 'goud';
}

export const TIER_NAMES = { goud: 'Goud', elite: 'Elite', ster: 'Wereldster', legende: 'Legende' };
